"""状态传播路由

手动触发状态传播、查询进度。
"""
import logging


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db, get_or_none
from database.models import Scene, Episode, Project
from schemas.status import ProgressInfo, StatusPropagationResponse
from services.status_propagation import StatusPropagationService


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["status"])


@router.post("/scenes/{scene_id}/propagate-status", response_model=StatusPropagationResponse)
async def propagate_from_scene(
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    """手动触发从 Scene 向上的状态传播"""
    scene = await get_or_none(db, Scene, scene_id)
    if not scene:
        raise HTTPException(404, f"Scene {scene_id} not found")

    service = StatusPropagationService()
    result = await service.propagate_scene_change(db, scene_id)
    if result is None:
        raise HTTPException(500, "状态传播失败")

    return StatusPropagationResponse(**result)


@router.post("/episodes/{episode_id}/propagate-status", response_model=StatusPropagationResponse)
async def propagate_from_episode(
    episode_id: str,
    db: AsyncSession = Depends(get_db),
):
    """手动触发从 Episode 向上的状态传播"""
    episode = await get_or_none(db, Episode, episode_id)
    if not episode:
        raise HTTPException(404, f"Episode {episode_id} not found")

    service = StatusPropagationService()
    result = await service.propagate_episode_change(db, episode_id)
    if result is None:
        raise HTTPException(500, "状态传播失败")

    return StatusPropagationResponse(**result)


@router.get("/episodes/{episode_id}/progress", response_model=ProgressInfo)
async def get_episode_progress(
    episode_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取剧集进度"""
    episode = await get_or_none(db, Episode, episode_id)
    if not episode:
        raise HTTPException(404, f"Episode {episode_id} not found")

    from sqlalchemy import select
    scenes_result = await db.execute(
        select(Scene).where(Scene.episode_id == episode_id)
    )
    scenes = list(scenes_result.scalars().all())

    service = StatusPropagationService()
    return service._compute_episode_progress(scenes)


@router.get("/projects/{project_id}/progress", response_model=ProgressInfo)
async def get_project_progress(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取项目进度"""
    project = await get_or_none(db, Project, project_id)
    if not project:
        raise HTTPException(404, f"Project {project_id} not found")

    from sqlalchemy import select
    episodes_result = await db.execute(
        select(Episode).where(Episode.project_id == project_id)
    )
    episodes = list(episodes_result.scalars().all())

    service = StatusPropagationService()
    return service._compute_project_progress(episodes)
