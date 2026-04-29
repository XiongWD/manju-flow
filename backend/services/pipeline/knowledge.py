"""Knowledge Service — 041b3

最小知识沉淀服务：
- CRUD knowledge_item
- 按 project / episode / category 查询
- 与 analytics_snapshot / publish_job 关联

不做复杂推理引擎，不做自动生成。
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import KnowledgeItem

logger = logging.getLogger(__name__)


class KnowledgeService:
    """知识条目服务 — 创建、查询、管理"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── 创建 ──────────────────────────────────────────────────────────

    async def create(
        self,
        project_id: Optional[str] = None,
        episode_id: Optional[str] = None,
        publish_job_id: Optional[str] = None,
        analytics_snapshot_id: Optional[str] = None,
        category: str = "rule",
        title: str = "",
        content: Optional[str] = None,
        tags: Optional[list[str]] = None,
        metadata_json: Optional[dict] = None,
        confidence: float = 1.0,
        is_active: bool = True,
    ) -> KnowledgeItem:
        """创建知识条目"""
        item = KnowledgeItem(
            project_id=project_id,
            episode_id=episode_id,
            publish_job_id=publish_job_id,
            analytics_snapshot_id=analytics_snapshot_id,
            category=category,
            title=title,
            content=content,
            tags=tags,
            metadata_json=metadata_json,
            confidence=confidence,
            is_active=is_active,
        )
        self.db.add(item)
        await self.db.flush()

        logger.info(
            "KnowledgeItem created: id=%s, category=%s, project=%s",
            item.id, category, project_id,
        )
        return item

    # ── 查询 ──────────────────────────────────────────────────────────

    async def get(self, item_id: str) -> Optional[KnowledgeItem]:
        return await self.db.get(KnowledgeItem, item_id)

    async def list_by_project(
        self,
        project_id: str,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 50,
    ) -> list[KnowledgeItem]:
        """按 project 查询知识条目"""
        stmt = select(KnowledgeItem).where(
            KnowledgeItem.project_id == project_id
        ).order_by(KnowledgeItem.created_at.desc()).limit(limit)
        if category:
            stmt = stmt.where(KnowledgeItem.category == category)
        if is_active is not None:
            stmt = stmt.where(KnowledgeItem.is_active == is_active)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_by_episode(
        self,
        episode_id: str,
        category: Optional[str] = None,
        limit: int = 50,
    ) -> list[KnowledgeItem]:
        """按 episode 查询知识条目"""
        stmt = select(KnowledgeItem).where(
            KnowledgeItem.episode_id == episode_id
        ).order_by(KnowledgeItem.created_at.desc()).limit(limit)
        if category:
            stmt = stmt.where(KnowledgeItem.category == category)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_by_publish_job(
        self,
        publish_job_id: str,
        limit: int = 50,
    ) -> list[KnowledgeItem]:
        """按 publish_job 查询关联的知识条目"""
        stmt = select(KnowledgeItem).where(
            KnowledgeItem.publish_job_id == publish_job_id
        ).order_by(KnowledgeItem.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── 更新 ──────────────────────────────────────────────────────────

    async def update(
        self,
        item_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        tags: Optional[list[str]] = None,
        category: Optional[str] = None,
        confidence: Optional[float] = None,
        is_active: Optional[bool] = None,
    ) -> KnowledgeItem:
        """更新知识条目"""
        item = await self.db.get(KnowledgeItem, item_id)
        if not item:
            raise ValueError(f"KnowledgeItem not found: {item_id}")

        if title is not None:
            item.title = title
        if content is not None:
            item.content = content
        if tags is not None:
            item.tags = tags
        if category is not None:
            item.category = category
        if confidence is not None:
            item.confidence = confidence
        if is_active is not None:
            item.is_active = is_active

        await self.db.flush()
        logger.info("KnowledgeItem updated: id=%s", item_id)
        return item
