"""镜头/场景路由 — 完整 CRUD 实现"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Scene, SceneVersion, SceneCharacter, Character
from schemas.scene import (
    SceneCreate,
    SceneUpdate,
    SceneRead,
    SceneWithVersionsRead,
    SceneVersionRead,
    SceneVersionTreeResponse,
    FallbackHistoryResponse,
    SceneReworkRequest,
    SceneReworkResponse,
    VersionDiffRequest,
    VersionDiffResponse,
    SwitchLockedVersionRequest,
    SwitchLockedVersionResponse,
    SubtitleCue,
    SubtitleEditRequest,
    SubtitleEditResponse,
    AudioMixEditRequest,
    AudioMixEditResponse,
    SceneReorderRequest,
    SceneBatchDeleteRequest,
    SceneBatchUpdateStatusRequest,
    SceneBatchUpdateDurationRequest,
)
from services.pipeline.orchestrator import retry_scene
from services.pipeline.version_lock import VersionLockService

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


async def _load_character_ids(db: AsyncSession, scene_id: str) -> list[str]:
    """加载场景的关联角色 ID 列表"""
    result = await db.execute(
        select(SceneCharacter.character_id)
        .where(SceneCharacter.scene_id == scene_id)
    )
    return [row[0] for row in result.all()]


async def _sync_character_ids(
    db: AsyncSession,
    scene_id: str,
    character_ids: list[str] | None,
) -> None:
    """同步场景-角色关联（全量替换）"""
    if character_ids is None:
        return
    await db.execute(
        SceneCharacter.__table__.delete()
        .where(SceneCharacter.scene_id == scene_id)
    )
    if character_ids:
        await db.execute(
            SceneCharacter.__table__.insert(),
            [{"scene_id": scene_id, "character_id": cid} for cid in character_ids],
        )


def _scene_to_read(scene: Scene, character_ids: list[str]) -> dict:
    """将 Scene ORM 对象 + character_ids 转为 SceneRead 字典"""
    return {
        "id": scene.id,
        "episode_id": scene.episode_id,
        "scene_no": scene.scene_no,
        "title": scene.title,
        "duration": scene.duration,
        "status": scene.status,
        "locked_version_id": scene.locked_version_id,
        "character_ids": character_ids,
        "created_at": scene.created_at,
        "updated_at": scene.updated_at,
    }


@router.get("/", response_model=list[SceneRead])
async def list_scenes(
    episode_id: str = Query(None, description="剧集 ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取场景列表"""
    q = select(Scene)
    if episode_id:
        q = q.where(Scene.episode_id == episode_id)
    q = q.order_by(Scene.scene_no)
    result = await db.execute(q)
    scenes = result.scalars().all()
    out = []
    for s in scenes:
        cids = await _load_character_ids(db, s.id)
        out.append(SceneRead(**_scene_to_read(s, cids)))
    return out


@router.post("/", response_model=SceneRead, status_code=status.HTTP_201_CREATED)
async def create_scene(body: SceneCreate, db: AsyncSession = Depends(get_db)):
    """创建场景"""
    scene = Scene(**body.model_dump())
    db.add(scene)
    await db.flush()
    await db.refresh(scene)
    return scene


@router.get("/by-character/{character_id}", response_model=list[SceneRead])
async def list_scenes_by_character(character_id: str, db: AsyncSession = Depends(get_db)):
    """按角色获取关联场景列表"""
    result = await db.execute(
        select(Scene)
        .join(SceneCharacter, SceneCharacter.scene_id == Scene.id)
        .where(SceneCharacter.character_id == character_id)
        .order_by(Scene.scene_no)
    )
    scenes = result.scalars().all()
    out = []
    for s in scenes:
        cids = await _load_character_ids(db, s.id)
        out.append(SceneRead(**_scene_to_read(s, cids)))
    return out


@router.get("/{scene_id}", response_model=SceneWithVersionsRead)
async def get_scene(scene_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个场景详情，含最新版本"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    # 获取最新版本
    sv_q = (
        select(SceneVersion)
        .where(SceneVersion.scene_id == scene_id)
        .order_by(SceneVersion.version_no.desc())
        .limit(1)
    )
    sv_result = await db.execute(sv_q)
    latest_sv = sv_result.scalar_one_or_none()

    cids = await _load_character_ids(db, scene_id)

    return {
        "id": scene.id,
        "episode_id": scene.episode_id,
        "scene_no": scene.scene_no,
        "title": scene.title,
        "duration": scene.duration,
        "status": scene.status,
        "locked_version_id": scene.locked_version_id,
        "character_ids": cids,
        "created_at": scene.created_at,
        "updated_at": scene.updated_at,
        "latest_version": latest_sv,
    }


@router.patch("/{scene_id}", response_model=SceneRead)
async def update_scene(
    scene_id: str,
    body: SceneUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新场景"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    character_ids = body.character_ids
    for key, value in body.model_dump(exclude={"character_ids"}, exclude_unset=True).items():
        setattr(scene, key, value)
    await db.flush()
    await db.refresh(scene)
    await _sync_character_ids(db, scene_id, character_ids)
    await db.flush()
    return SceneRead(**_scene_to_read(scene, await _load_character_ids(db, scene_id)))


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(scene_id: str, db: AsyncSession = Depends(get_db)):
    """删除场景"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    await db.delete(scene)
    await db.flush()


@router.get("/{scene_id}/versions", response_model=list[SceneVersionRead])
async def list_scene_versions(scene_id: str, db: AsyncSession = Depends(get_db)):
    """获取场景版本列表"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    q = select(SceneVersion).where(SceneVersion.scene_id == scene_id).order_by(SceneVersion.version_no)
    result = await db.execute(q)
    versions = result.scalars().all()
    return versions


@router.post("/{scene_id}/retry")
async def retry_scene_endpoint(
    scene_id: str,
    project_id: str = Query(...),
    episode_id: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """重跑场景：创建新 job + 新 scene_version，保留历史"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    try:
        new_job = await retry_scene(
            db=db,
            scene_id=scene_id,
            project_id=project_id,
            episode_id=episode_id,
        )
        return {"data": {"job_id": new_job.id, "status": new_job.status, "message": "重跑任务已创建"}}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{scene_id}/version-tree", response_model=SceneVersionTreeResponse)
async def get_scene_version_tree(
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取场景版本树（含 fallback 记录）
    
    039b：提供版本链可视化所需的数据。
    返回版本列表（按 version_no 升序），每个版本包含关联的 fallback_records。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    tree = await VersionLockService.get_scene_version_tree(db, scene_id)

    return SceneVersionTreeResponse(
        scene_id=scene_id,
        locked_version_id=scene.locked_version_id,
        versions=tree,
    )


@router.get("/{scene_id}/fallback-history", response_model=FallbackHistoryResponse)
async def get_scene_fallback_history(
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取场景的 fallback 历史（从所有 job_steps 提取）
    
    039b：提供 fallback 历史可视化所需的数据。
    返回所有 fallback 记录（按时间降序）。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    history = await VersionLockService.get_fallback_history(db, scene_id)

    return FallbackHistoryResponse(
        scene_id=scene_id,
        fallback_records=history,
    )


# ─── 分镜增强: 批量排序 + 批量删除 + 批量状态 ──────────────


@router.post("/batch/reorder", response_model=list[SceneRead])
async def reorder_scenes(
    body: SceneReorderRequest,
    db: AsyncSession = Depends(get_db),
):
    """批量重排序场景 scene_no

    按传入的 scene_ids 列表顺序，依次设置 scene_no = 1, 2, 3 ...
    """
    results = []
    for idx, scene_id in enumerate(body.scene_ids, start=1):
        scene = await db.get(Scene, scene_id)
        if not scene:
            raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")
        scene.scene_no = idx
        await db.flush()
        await db.refresh(scene)
        cids = await _load_character_ids(db, scene_id)
        results.append(SceneRead(**_scene_to_read(scene, cids)))
    return results


@router.post("/batch/delete", status_code=status.HTTP_200_OK)
async def batch_delete_scenes(
    body: SceneBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """批量删除场景"""
    deleted: list[str] = []
    not_found: list[str] = []
    for scene_id in body.scene_ids:
        scene = await db.get(Scene, scene_id)
        if scene:
            await db.delete(scene)
            deleted.append(scene_id)
        else:
            not_found.append(scene_id)
    await db.flush()
    return {"deleted": deleted, "not_found": not_found, "count": len(deleted)}


@router.post("/batch/update-status", response_model=list[SceneRead])
async def batch_update_scene_status(
    body: SceneBatchUpdateStatusRequest,
    db: AsyncSession = Depends(get_db),
):
    """批量修改场景状态"""
    results = []
    for scene_id in body.scene_ids:
        scene = await db.get(Scene, scene_id)
        if not scene:
            raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")
        scene.status = body.status
        await db.flush()
        await db.refresh(scene)
        cids = await _load_character_ids(db, scene_id)
        results.append(SceneRead(**_scene_to_read(scene, cids)))
    return results


@router.post("/batch/update-duration", response_model=list[SceneRead])
async def batch_update_scene_duration(
    body: SceneBatchUpdateDurationRequest,
    db: AsyncSession = Depends(get_db),
):
    """批量调整场景时长

    支持三种模式：
    - set: 将所有选中场景的时长设为固定值
    - add: 在现有时长基础上增加/减少秒数
    - multiply: 按倍率缩放现有时长
    """
    results = []
    for scene_id in body.scene_ids:
        scene = await db.get(Scene, scene_id)
        if not scene:
            raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")
        current = scene.duration or 0.0
        if body.mode == "set":
            scene.duration = max(0, body.value)
        elif body.mode == "add":
            scene.duration = max(0, current + body.value)
        elif body.mode == "multiply":
            scene.duration = max(0, current * body.value)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {body.mode}")
        await db.flush()
        await db.refresh(scene)
        cids = await _load_character_ids(db, scene_id)
        results.append(SceneRead(**_scene_to_read(scene, cids)))
    return results


# ─── 042a: 局部返修 + locked_version 切换 + version diff ──────────


@router.post("/{scene_id}/rework", response_model=SceneReworkResponse)
async def rework_scene_version(
    scene_id: str,
    body: SceneReworkRequest,
    db: AsyncSession = Depends(get_db),
):
    """局部返修：从指定版本派生新版本（042a）

    基于指定的 scene_version 创建新版本，带变更原因。
    新版本的 parent_version_id 指向基准版本，并触发新的生成 job。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    try:
        job, new_sv = await VersionLockService.rework_scene_version(
            db=db,
            scene_id=scene_id,
            scene_version_id=body.scene_version_id,
            change_reason=body.change_reason,
            project_id=body.project_id,
            episode_id=body.episode_id,
        )
        await db.commit()
        return SceneReworkResponse(
            job_id=job.id,
            scene_version_id=new_sv.id,
            parent_version_id=body.scene_version_id,
            status=job.status,
            message="返修任务已创建",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{scene_id}/versions/diff", response_model=VersionDiffResponse)
async def get_scene_version_diff(
    scene_id: str,
    version_a_id: str = Query(..., description="版本 A ID"),
    version_b_id: str = Query(..., description="版本 B ID"),
    db: AsyncSession = Depends(get_db),
):
    """版本对比（042a）

    比较场景中两个版本的差异，返回字段级 diff。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    try:
        result = await VersionLockService.get_version_diff(
            db=db,
            scene_id=scene_id,
            version_a_id=version_a_id,
            version_b_id=version_b_id,
        )
        return VersionDiffResponse(
            scene_id=scene_id,
            version_a=result["version_a"],
            version_b=result["version_b"],
            diffs=result["diffs"],
            changed_fields=result["changed_fields"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{scene_id}/switch-locked", response_model=SwitchLockedVersionResponse)
async def switch_locked_version(
    scene_id: str,
    body: SwitchLockedVersionRequest,
    db: AsyncSession = Depends(get_db),
):
    """切换锁定版本（042a）

    便捷接口：在场景维度切换 locked_version。
    如果场景已有锁定版本，需要 force=True 才能覆盖。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    previous_locked = scene.locked_version_id

    try:
        scene = await VersionLockService.explicit_lock_version(
            db=db,
            scene_id=scene_id,
            scene_version_id=body.scene_version_id,
            force=body.force,
        )
        await db.commit()
        await db.refresh(scene)

        return SwitchLockedVersionResponse(
            scene_id=scene.id,
            locked_version_id=scene.locked_version_id,
            previous_locked_version_id=previous_locked,
            status="LOCKED",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ─── 042b: 字幕编辑 + 音频混音编辑最小闭环 ──────────────────


@router.get("/{scene_id}/versions/{version_id}/subtitle", response_model=SubtitleEditResponse)
async def get_scene_subtitle(
    scene_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取场景版本的字幕数据（042b）"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    sv = await db.get(SceneVersion, version_id)
    if not sv or sv.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="SceneVersion not found")

    params = sv.params or {}
    raw_cues = params.get("subtitle", [])
    cues = [SubtitleCue(**c) for c in raw_cues] if raw_cues else []

    return SubtitleEditResponse(
        scene_id=scene_id,
        scene_version_id=version_id,
        cues=cues,
        updated=False,
    )


@router.patch("/{scene_id}/versions/{version_id}/subtitle", response_model=SubtitleEditResponse)
async def update_scene_subtitle(
    scene_id: str,
    version_id: str,
    body: SubtitleEditRequest,
    db: AsyncSession = Depends(get_db),
):
    """更新场景版本的字幕数据（042b）

    整体替换 params.subtitle。按 index 递增验证。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    sv = await db.get(SceneVersion, version_id)
    if not sv or sv.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="SceneVersion not found")

    # 验证时间顺序
    for i in range(1, len(body.cues)):
        if body.cues[i].start_time < body.cues[i - 1].end_time:
            raise HTTPException(
                status_code=400,
                detail=f"字幕 {body.cues[i].index} 的开始时间早于上一条的结束时间",
            )

    sv.params = sv.params or {}
    sv.params["subtitle"] = [c.model_dump() for c in body.cues]
    await db.flush()
    await db.refresh(sv)

    return SubtitleEditResponse(
        scene_id=scene_id,
        scene_version_id=version_id,
        cues=body.cues,
        updated=True,
    )


@router.get("/{scene_id}/versions/{version_id}/audio-mix", response_model=AudioMixEditResponse)
async def get_scene_audio_mix(
    scene_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取场景版本的音频混音参数（042b）"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    sv = await db.get(SceneVersion, version_id)
    if not sv or sv.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="SceneVersion not found")

    params = sv.params or {}
    mix = params.get("audio_mix", {})

    return AudioMixEditResponse(
        scene_id=scene_id,
        scene_version_id=version_id,
        voice_volume=mix.get("voice_volume", 1.0),
        bgm_volume=mix.get("bgm_volume", 0.3),
        bgm_fade_in=mix.get("bgm_fade_in", 1.0),
        bgm_fade_out=mix.get("bgm_fade_out", 2.0),
        updated=False,
    )


@router.patch("/{scene_id}/versions/{version_id}/audio-mix", response_model=AudioMixEditResponse)
async def update_scene_audio_mix(
    scene_id: str,
    version_id: str,
    body: AudioMixEditRequest,
    db: AsyncSession = Depends(get_db),
):
    """更新场景版本的音频混音参数（042b）

    合并更新 params.audio_mix，只覆盖请求中非 None 的字段。
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    sv = await db.get(SceneVersion, version_id)
    if not sv or sv.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="SceneVersion not found")

    sv.params = sv.params or {}
    mix = sv.params.get("audio_mix", {
        "voice_volume": 1.0,
        "bgm_volume": 0.3,
        "bgm_fade_in": 1.0,
        "bgm_fade_out": 2.0,
    })

    update_data = body.model_dump(exclude_unset=True)
    mix.update(update_data)
    sv.params["audio_mix"] = mix
    await db.flush()
    await db.refresh(sv)

    return AudioMixEditResponse(
        scene_id=scene_id,
        scene_version_id=version_id,
        voice_volume=mix["voice_volume"],
        bgm_volume=mix["bgm_volume"],
        bgm_fade_in=mix["bgm_fade_in"],
        bgm_fade_out=mix["bgm_fade_out"],
        updated=True,
    )
