"""Scenes CRUD + batch operations + reorder."""
import logging

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Scene, SceneCharacter
from schemas.scene import (
    SceneCreate,
    SceneUpdate,
    SceneRead,
    SceneWithVersionsRead,
    SceneReorderRequest,
    SceneBatchDeleteRequest,
    SceneBatchUpdateStatusRequest,
    SceneBatchUpdateDurationRequest,
)
from services.broadcast import broadcast
from services.auth import get_current_user
from database.models import User

router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────


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
        "location_id": scene.location_id,
        "shot_stage": scene.shot_stage,
        "created_at": scene.created_at,
        "updated_at": scene.updated_at,
    }


# ─── Basic CRUD ──────────────────────────────────────────────


@router.get("/")
async def list_scenes(
    episode_id: str = Query(None, description="剧集 ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", description="搜索关键词"),
    db: AsyncSession = Depends(get_db),
):
    """获取镜头列表"""
    skip = (page - 1) * page_size
    limit = min(page_size, 200)
    q = select(Scene).where(not_deleted(Scene))
    if episode_id:
        q = q.where(Scene.episode_id == episode_id)
    if search:
        q = q.filter(Scene.title.ilike(f"%{search}%"))
    # count
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(Scene.scene_no).offset(skip).limit(limit)
    result = await db.execute(q)
    scenes = result.scalars().all()
    out = []
    for s in scenes:
        cids = await _load_character_ids(db, s.id)
        out.append(SceneRead(**_scene_to_read(s, cids)))
    return {"items": out, "total": total, "skip": skip, "limit": limit}


@router.post("/", response_model=SceneRead, status_code=status.HTTP_201_CREATED)
async def create_scene(body: SceneCreate, db: AsyncSession = Depends(get_db)):
    """创建镜头"""
    scene = Scene(**body.model_dump())
    db.add(scene)
    await db.flush()
    await db.refresh(scene)
    await broadcast.broadcast(f"project:{scene.episode_id}", {"type": "created", "entity": "scene", "id": scene.id})
    return scene


@router.get("/by-character/{character_id}", response_model=list[SceneRead])
async def list_scenes_by_character(character_id: str, db: AsyncSession = Depends(get_db)):
    """按角色获取关联镜头列表"""
    # 分页豁免：列表固定小
    result = await db.execute(
        select(Scene).where(not_deleted(Scene))
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
    """获取单个镜头详情，含最新版本"""
    scene = await get_or_none(db, Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    # 获取最新版本
    from database.models import SceneVersion
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
        "location_id": scene.location_id,
        "shot_stage": scene.shot_stage,
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
    """更新镜头"""
    result = await db.execute(select(Scene).where(Scene.id == scene_id, not_deleted(Scene)))
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    character_ids = body.character_ids
    for key, value in body.model_dump(exclude={"character_ids"}, exclude_unset=True).items():
        setattr(scene, key, value)
    await db.flush()
    await db.refresh(scene)
    await _sync_character_ids(db, scene_id, character_ids)
    await db.flush()
    await broadcast.broadcast(f"project:{scene.episode_id}", {"type": "updated", "entity": "scene", "id": scene_id})
    return SceneRead(**_scene_to_read(scene, await _load_character_ids(db, scene_id)))


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(scene_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """删除镜头"""
    result = await db.execute(select(Scene).where(Scene.id == scene_id, not_deleted(Scene)))
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    scene.soft_delete()
    await db.flush()
    await broadcast.broadcast(f"project:{scene.episode_id}", {"type": "deleted", "entity": "scene", "id": scene_id})


# ─── Batch operations + reorder ──────────────────────────────


@router.post("/batch/reorder", response_model=list[SceneRead])
async def reorder_scenes(
    body: SceneReorderRequest,
    db: AsyncSession = Depends(get_db),
):
    """批量重排序镜头 scene_no

    按传入的 scene_ids 列表顺序，依次设置 scene_no = 1, 2, 3 ...
    """
    results = []
    for idx, scene_id in enumerate(body.scene_ids, start=1):
        scene = await get_or_none(db, Scene, scene_id)
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
    """批量删除镜头"""
    deleted: list[str] = []
    not_found: list[str] = []
    for scene_id in body.scene_ids:
        result = await db.execute(select(Scene).where(Scene.id == scene_id, not_deleted(Scene)))
        scene = result.scalar_one_or_none()
        if scene:
            scene.soft_delete()
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
    """批量修改镜头状态"""
    results = []
    for scene_id in body.scene_ids:
        scene = await get_or_none(db, Scene, scene_id)
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
    """批量调整镜头时长

    支持三种模式：
    - set: 将所有选中场景的时长设为固定值
    - add: 在现有时长基础上增加/减少秒数
    - multiply: 按倍率缩放现有时长
    """
    results = []
    for scene_id in body.scene_ids:
        scene = await get_or_none(db, Scene, scene_id)
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
