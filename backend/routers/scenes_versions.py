"""Scenes version management — rework, diff, subtitle, audio-mix."""
import logging

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Scene, SceneVersion
from schemas.scene import (
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
)
from services.pipeline.orchestrator import retry_scene
from services.pipeline.version_lock import VersionLockService

router = APIRouter()


# ─── Version listing ─────────────────────────────────────────


@router.get("/{scene_id}/versions", response_model=list[SceneVersionRead])
async def list_scene_versions(scene_id: str, db: AsyncSession = Depends(get_db)):
    """获取镜头版本列表
    # 分页豁免：列表固定小
    """
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    q = select(SceneVersion).where(SceneVersion.scene_id == scene_id).order_by(SceneVersion.version_no)
    result = await db.execute(q)
    versions = result.scalars().all()
    return versions


@router.get("/{scene_id}/version-tree", response_model=SceneVersionTreeResponse)
async def get_scene_version_tree(
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取镜头版本树（含 fallback 记录）
    
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
    """获取镜头的 fallback 历史（从所有 job_steps 提取）
    
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


# ─── Retry / Rework / Diff / Switch ─────────────────────────


@router.post("/{scene_id}/retry")
async def retry_scene_endpoint(
    scene_id: str,
    project_id: str = Query(...),
    episode_id: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """重跑镜头：创建新 job + 新 scene_version，保留历史"""
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


# ─── Subtitle + Audio Mix ────────────────────────────────────


@router.get("/{scene_id}/versions/{version_id}/subtitle", response_model=SubtitleEditResponse)
async def get_scene_subtitle(
    scene_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取镜头版本的字幕数据（042b）"""
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
    """更新镜头版本的字幕数据（042b）

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
    """获取镜头版本的音频混音参数（042b）"""
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
    """更新镜头版本的音频混音参数（042b）

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
