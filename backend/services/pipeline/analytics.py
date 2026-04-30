"""Analytics Service — 041b3

最小 analytics 回流链：
- 记录 analytics_snapshot（手动/API 导入/webhook）
- 按 episode / publish_job 查询
- 从 snapshot 提取 insight → knowledge_item

不做真实第三方平台拉数，不做复杂报表。
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    AnalyticsSnapshot,
    Episode,
    KnowledgeItem,
    PublishJob,
    Project,
)

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Analytics 快照服务 — 记录、查询、提取洞察"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── 记录快照 ──────────────────────────────────────────────────────

    async def record_snapshot(
        self,
        project_id: Optional[str] = None,
        episode_id: Optional[str] = None,
        publish_job_id: Optional[str] = None,
        platform: Optional[str] = None,
        external_post_id: Optional[str] = None,
        views: Optional[int] = None,
        completion_rate: Optional[float] = None,
        likes: Optional[int] = None,
        comments: Optional[int] = None,
        shares: Optional[int] = None,
        watch_time: Optional[float] = None,
        source: str = "manual",
        snapshot_at: Optional[datetime] = None,
    ) -> AnalyticsSnapshot:
        """记录一条 analytics 快照

        自动推断 project_id（从 episode 或 publish_job）。
        """
        # 自动推断 project_id
        if not project_id:
            if publish_job_id:
                job = await self.db.get(PublishJob, publish_job_id)
                if job:
                    project_id = job.project_id
            elif episode_id:
                ep = await self.db.get(Episode, episode_id)
                if ep:
                    project_id = ep.project_id

        snapshot = AnalyticsSnapshot(
            project_id=project_id,
            episode_id=episode_id,
            publish_job_id=publish_job_id,
            platform=platform,
            external_post_id=external_post_id,
            views=views,
            completion_rate=completion_rate,
            likes=likes,
            comments=comments,
            shares=shares,
            watch_time=watch_time,
            source=source,
            snapshot_at=snapshot_at or datetime.now(timezone.utc),
        )
        self.db.add(snapshot)
        await self.db.flush()

        logger.info(
            "AnalyticsSnapshot recorded: id=%s, episode=%s, job=%s, views=%s",
            snapshot.id, episode_id, publish_job_id, views,
        )
        return snapshot

    # ── 查询 ──────────────────────────────────────────────────────────

    async def get(self, snapshot_id: str) -> Optional[AnalyticsSnapshot]:
        return await self.db.get(AnalyticsSnapshot, snapshot_id)

    async def list_by_episode(
        self,
        episode_id: str,
        platform: Optional[str] = None,
        limit: int = 50,
    ) -> list[AnalyticsSnapshot]:
        """按 episode 查询快照列表"""
        stmt = select(AnalyticsSnapshot).where(
            AnalyticsSnapshot.episode_id == episode_id
        ).order_by(AnalyticsSnapshot.snapshot_at.desc()).limit(limit)
        if platform:
            stmt = stmt.where(AnalyticsSnapshot.platform == platform)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_by_publish_job(
        self,
        publish_job_id: str,
        limit: int = 50,
    ) -> list[AnalyticsSnapshot]:
        """按 publish_job 查询快照列表"""
        stmt = select(AnalyticsSnapshot).where(
            AnalyticsSnapshot.publish_job_id == publish_job_id
        ).order_by(AnalyticsSnapshot.snapshot_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_episode_summary(
        self,
        episode_id: str,
    ) -> dict:
        """获取 episode 的 analytics 汇总（最新快照 + 聚合指标）"""
        # 最新快照
        latest_stmt = select(AnalyticsSnapshot).where(
            AnalyticsSnapshot.episode_id == episode_id
        ).order_by(AnalyticsSnapshot.snapshot_at.desc()).limit(1)
        latest_result = await self.db.execute(latest_stmt)
        latest = latest_result.scalar_one_or_none()

        # 聚合
        agg_stmt = select(
            func.count(AnalyticsSnapshot.id).label("snapshot_count"),
            func.max(AnalyticsSnapshot.views).label("max_views"),
            func.avg(AnalyticsSnapshot.completion_rate).label("avg_completion_rate"),
            func.max(AnalyticsSnapshot.likes).label("max_likes"),
            func.max(AnalyticsSnapshot.comments).label("max_comments"),
            func.max(AnalyticsSnapshot.shares).label("max_shares"),
            func.sum(AnalyticsSnapshot.watch_time).label("total_watch_time"),
        ).where(AnalyticsSnapshot.episode_id == episode_id)
        agg_result = await self.db.execute(agg_stmt)
        agg = agg_result.one()

        return {
            "episode_id": episode_id,
            "latest_snapshot": latest,
            "aggregation": {
                "snapshot_count": agg.snapshot_count or 0,
                "max_views": agg.max_views,
                "avg_completion_rate": round(agg.avg_completion_rate, 4) if agg.avg_completion_rate else None,
                "max_likes": agg.max_likes,
                "max_comments": agg.max_comments,
                "max_shares": agg.max_shares,
                "total_watch_time": agg.total_watch_time,
            },
        }

    # ── 从快照提取洞察 → knowledge ────────────────────────────────────

    async def extract_insight(
        self,
        snapshot_id: str,
        insight_category: str,
        title: str,
        content: Optional[str] = None,
        tags: Optional[list[str]] = None,
        confidence: float = 0.8,
    ) -> KnowledgeItem:
        """从 analytics 快照提取一条 knowledge insight

        自动关联 project_id / episode_id / publish_job_id。
        """
        snapshot = await self.db.get(AnalyticsSnapshot, snapshot_id)
        if not snapshot:
            raise ValueError(f"AnalyticsSnapshot not found: {snapshot_id}")

        item = KnowledgeItem(
            project_id=snapshot.project_id,
            episode_id=snapshot.episode_id,
            publish_job_id=snapshot.publish_job_id,
            analytics_snapshot_id=snapshot.id,
            category=insight_category,
            title=title,
            content=content,
            tags=tags,
            confidence=confidence,
            is_active=True,
            metadata_json={
                "source": "analytics_extraction",
                "snapshot_views": snapshot.views,
                "snapshot_completion_rate": snapshot.completion_rate,
                "snapshot_likes": snapshot.likes,
                "snapshot_platform": snapshot.platform,
            },
        )
        self.db.add(item)
        await self.db.flush()

        logger.info(
            "KnowledgeItem extracted from analytics: id=%s, category=%s, snapshot=%s",
            item.id, insight_category, snapshot_id,
        )
        return item
