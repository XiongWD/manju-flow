"""镜头/场景路由 — 完整 CRUD 实现"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Scene, SceneVersion
from schemas.scene import SceneCreate, SceneUpdate, SceneRead, SceneWithVersionsRead, SceneVersionRead
from services.pipeline.orchestrator import retry_scene

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


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
    return scenes


@router.post("/", response_model=SceneRead, status_code=status.HTTP_201_CREATED)
async def create_scene(body: SceneCreate, db: AsyncSession = Depends(get_db)):
    """创建场景"""
    scene = Scene(**body.model_dump())
    db.add(scene)
    await db.flush()
    await db.refresh(scene)
    return scene


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

    return {
        "id": scene.id,
        "episode_id": scene.episode_id,
        "scene_no": scene.scene_no,
        "title": scene.title,
        "duration": scene.duration,
        "status": scene.status,
        "locked_version_id": scene.locked_version_id,
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
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(scene, key, value)
    await db.flush()
    await db.refresh(scene)
    return scene


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
