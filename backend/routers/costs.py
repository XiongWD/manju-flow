"""成本追踪路由"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Episode, Scene
from schemas.cost import (
    CostRecordCreate,
    CostRecordResponse,
    EpisodeCostSummary,
    ProjectCostSummary,
)
from services.cost_tracker import CostTrackerService

router = APIRouter(prefix="/api", tags=["costs"])

_svc = CostTrackerService()


@router.post(
    "/costs",
    response_model=CostRecordResponse,
    summary="记录成本",
)
async def record_cost(data: CostRecordCreate, db: AsyncSession = Depends(get_db)):
    """记录一条 API 调用 / 生成任务的成本。"""
    record = await _svc.record_cost(db, data.model_dump())
    await db.commit()
    return record


@router.get(
    "/scenes/{scene_id}/costs",
    response_model=list[CostRecordResponse],
    summary="获取镜头成本列表",
)
async def get_scene_costs(scene_id: str, db: AsyncSession = Depends(get_db)):
    """返回指定镜头的所有成本记录，按时间倒序。"""
    scene = await db.execute(select(Scene).where(Scene.id == scene_id))
    if scene.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    records = await _svc.get_scene_costs(db, scene_id)
    return records


@router.get(
    "/projects/{project_id}/costs/summary",
    response_model=ProjectCostSummary,
    summary="项目成本汇总",
)
async def get_project_cost_summary(
    project_id: str,
    start_date: str | None = Query(None, description="起始日期 YYYY-MM-DD"),
    end_date: str | None = Query(None, description="结束日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    """返回项目级成本汇总，支持按日期范围过滤。"""
    summary = await _svc.get_project_summary(db, project_id, start_date, end_date)
    return summary


@router.get(
    "/episodes/{episode_id}/costs/summary",
    response_model=EpisodeCostSummary,
    summary="剧集成本汇总",
)
async def get_episode_cost_summary(
    episode_id: str, db: AsyncSession = Depends(get_db)
):
    """返回剧集下所有镜头的成本汇总。"""
    episode = await db.execute(select(Episode).where(Episode.id == episode_id))
    if episode.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"Episode {episode_id} not found")

    summary = await _svc.get_episode_summary(db, episode_id)
    return summary
