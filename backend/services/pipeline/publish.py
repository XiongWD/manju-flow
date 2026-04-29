"""PublishJob Service — 041b2

最小发布链：publish_job 创建 → 状态流转 → 关联 delivery_package / publish_variant

状态机：pending → running → success / failed
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    DeliveryPackage,
    Episode,
    PublishJob,
    PublishVariant,
)

logger = logging.getLogger(__name__)

# 合法状态流转
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"running", "failed", "cancelled"},
    "running": {"success", "failed", "cancelled"},
    "success": set(),
    "failed": {"pending"},  # 允许重试
    "cancelled": set(),
}


class PublishJobService:
    """发布任务服务 — 创建、状态流转、关联交付包"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── 创建 ──────────────────────────────────────────────────────────

    async def create(
        self,
        episode_id: str,
        platform: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        payload_json: Optional[dict] = None,
    ) -> PublishJob:
        """创建发布任务

        1. 校验 episode 存在
        2. 创建 PublishJob 记录
        3. 返回 job

        不自动创建 delivery_package — 调用方按需通过 delivery router 创建并关联。
        """
        episode = await self.db.get(Episode, episode_id)
        if not episode:
            raise ValueError(f"Episode not found: {episode_id}")

        job = PublishJob(
            project_id=episode.project_id,
            episode_id=episode_id,
            platform=platform,
            status="pending",
            scheduled_at=scheduled_at,
            payload_json=payload_json,
        )
        self.db.add(job)
        await self.db.flush()

        logger.info("PublishJob created: id=%s, episode=%s, platform=%s",
                     job.id, episode_id, platform)
        return job

    # ── 状态流转 ──────────────────────────────────────────────────────

    async def transition(
        self,
        job_id: str,
        target_status: str,
        error_message: Optional[str] = None,
    ) -> PublishJob:
        """状态流转

        Args:
            job_id: 发布任务 ID
            target_status: 目标状态
            error_message: 失败时的错误信息

        Raises:
            ValueError: 无效状态流转
        """
        job = await self.db.get(PublishJob, job_id)
        if not job:
            raise ValueError(f"PublishJob not found: {job_id}")

        allowed = _VALID_TRANSITIONS.get(job.status, set())
        if target_status not in allowed:
            raise ValueError(
                f"Invalid transition: {job.status} → {target_status}. "
                f"Allowed: {allowed or 'terminal'}"
            )

        job.status = target_status

        if target_status == "running":
            job.started_at = None  # PublishJob 无 started_at，用 created_at
        elif target_status == "success":
            job.published_at = datetime.utcnow()
            # 041b3: 发布成功时自动播种初始 analytics 快照
            await self._seed_initial_snapshot(job)
        elif target_status == "failed":
            # 存错误信息到 payload_json
            payload = job.payload_json or {}
            payload["last_error"] = error_message
            job.payload_json = payload

        await self.db.flush()
        logger.info("PublishJob %s: %s → %s", job_id, job.status, target_status)
        return job

    # ── 041b3: 发布成功后自动播种初始快照 ─────────────────────────

    async def _seed_initial_snapshot(self, job: PublishJob) -> None:
        """发布成功时自动创建初始 analytics 快照（全零占位）

        用于标记「已发布，待采集数据」状态，后续通过 analytics router 补录真实数据。
        """
        from database.models import AnalyticsSnapshot

        snapshot = AnalyticsSnapshot(
            project_id=job.project_id,
            episode_id=job.episode_id,
            publish_job_id=job.id,
            platform=job.platform,
            external_post_id=job.external_post_id,
            views=0,
            completion_rate=0.0,
            likes=0,
            comments=0,
            shares=0,
            watch_time=0.0,
            source="auto_seed",
            snapshot_at=datetime.utcnow(),
        )
        self.db.add(snapshot)
        await self.db.flush()
        logger.info("Initial analytics snapshot seeded for publish_job %s", job.id)

    # ── 查询 ──────────────────────────────────────────────────────────

    async def get(self, job_id: str) -> Optional[PublishJob]:
        return await self.db.get(PublishJob, job_id)

    async def list_by_episode(
        self,
        episode_id: str,
        status: Optional[str] = None,
    ) -> list[PublishJob]:
        """按 episode 列出发布任务"""
        stmt = select(PublishJob).where(
            PublishJob.episode_id == episode_id
        ).order_by(PublishJob.created_at.desc())
        if status:
            stmt = stmt.where(PublishJob.status == status)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── 关联查询 ──────────────────────────────────────────────────────

    async def get_with_relations(self, job_id: str) -> Optional[dict]:
        """获取发布任务及其关联的交付包和变体"""
        job = await self.db.get(PublishJob, job_id)
        if not job:
            return None

        # 交付包
        pkg_stmt = select(DeliveryPackage).where(
            DeliveryPackage.publish_job_id == job_id
        ).order_by(DeliveryPackage.package_no)
        pkg_result = await self.db.execute(pkg_stmt)
        packages = list(pkg_result.scalars().all())

        # 变体
        var_stmt = select(PublishVariant).where(
            PublishVariant.publish_job_id == job_id
        ).order_by(PublishVariant.created_at)
        var_result = await self.db.execute(var_stmt)
        variants = list(var_result.scalars().all())

        return {
            "job": job,
            "delivery_packages": packages,
            "publish_variants": variants,
        }
