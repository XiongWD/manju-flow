"""数据分析路由 — 041b3

API 端点：
- POST   /api/analytics/snapshots              记录 analytics 快照
- GET    /api/analytics/snapshots              列出快照
- GET    /api/analytics/snapshots/{id}         获取单个快照
- GET    /api/analytics/episodes/{episode_id}  Episode analytics 汇总
- POST   /api/analytics/insights               从快照提取洞察 → knowledge
- GET    /api/analytics/cost                   成本汇总（stub）
"""
import logging


from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import async_session_factory
from schemas.analytics import (
    AnalyticsSnapshotCreate,
    AnalyticsSnapshotRead,
    AnalyticsSnapshotSummary,
    EpisodeAnalyticsSummary,
    InsightExtractRequest,
)
from schemas.knowledge import KnowledgeItemRead
from services.pipeline.analytics import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


async def _get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


# ── Snapshots CRUD ─────────────────────────────────────────────────────

@router.post("/snapshots", response_model=AnalyticsSnapshotRead)
async def record_snapshot(
    req: AnalyticsSnapshotCreate,
    db: AsyncSession = Depends(_get_db),
):
    """记录一条 analytics 快照（手动/API 导入）"""
    try:
        svc = AnalyticsService(db)
        snapshot = await svc.record_snapshot(
            project_id=req.project_id,
            episode_id=req.episode_id,
            publish_job_id=req.publish_job_id,
            platform=req.platform,
            external_post_id=req.external_post_id,
            views=req.views,
            completion_rate=req.completion_rate,
            likes=req.likes,
            comments=req.comments,
            shares=req.shares,
            watch_time=req.watch_time,
            source=req.source,
            snapshot_at=req.snapshot_at,
        )
        await db.commit()
        return snapshot
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record snapshot: {e}")


@router.get("/snapshots")
async def list_snapshots(
    episode_id: Optional[str] = Query(None, description="按剧集筛选"),
    publish_job_id: Optional[str] = Query(None, description="按发布任务筛选"),
    platform: Optional[str] = Query(None, description="按平台筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    db: AsyncSession = Depends(_get_db),
):
    """列出 analytics 快照"""
    limit = min(limit, 200)
    svc = AnalyticsService(db)
    snapshots = []
    if publish_job_id:
        snapshots = await svc.list_by_publish_job(publish_job_id, skip=skip, limit=limit)
    elif episode_id:
        snapshots = await svc.list_by_episode(episode_id, platform=platform, skip=skip, limit=limit)
    else:
        # 返回空列表 — 不支持无筛选的全量查询
        return {"items": [], "total": 0, "skip": skip, "limit": limit}
    # Note: total from service is not available, approximate with len
    return {"items": snapshots, "total": len(snapshots), "skip": skip, "limit": limit}


@router.get("/snapshots/{snapshot_id}", response_model=AnalyticsSnapshotRead)
async def get_snapshot(
    snapshot_id: str,
    db: AsyncSession = Depends(_get_db),
):
    """获取单个 analytics 快照"""
    svc = AnalyticsService(db)
    snapshot = await svc.get(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="AnalyticsSnapshot not found")
    return snapshot


# ── Episode Analytics Summary ──────────────────────────────────────────

@router.get("/episodes/{episode_id}", response_model=EpisodeAnalyticsSummary)
async def get_episode_analytics(
    episode_id: str,
    db: AsyncSession = Depends(_get_db),
):
    """获取 Episode analytics 汇总（最新快照 + 聚合指标）"""
    svc = AnalyticsService(db)
    summary = await svc.get_episode_summary(episode_id)

    # 序列化 latest_snapshot
    latest = None
    if summary["latest_snapshot"]:
        s = summary["latest_snapshot"]
        latest = AnalyticsSnapshotRead.model_validate(s)

    return EpisodeAnalyticsSummary(
        episode_id=episode_id,
        latest_snapshot=latest,
        aggregation=summary["aggregation"],
    )


# ── Insight Extraction ─────────────────────────────────────────────────

@router.post("/insights", response_model=KnowledgeItemRead)
async def extract_insight(
    req: InsightExtractRequest,
    db: AsyncSession = Depends(_get_db),
):
    """从 analytics 快照提取一条 knowledge insight

    最小闭环：analytics 数据 → 结构化洞察 → knowledge 沉淀
    """
    try:
        svc = AnalyticsService(db)
        item = await svc.extract_insight(
            snapshot_id=req.snapshot_id,
            insight_category=req.category,
            title=req.title,
            content=req.content,
            tags=req.tags,
            confidence=req.confidence,
        )
        await db.commit()
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to extract insight: {e}")


# ── Cost Summary (stub) ───────────────────────────────────────────────

@router.get("/cost")
async def get_cost_summary():
    """获取成本汇总（stub）"""
    return {"message": "cost summary — 待实现", "data": {"total": 0}}
