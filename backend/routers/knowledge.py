
"""知识沉淀路由 — 041b3

API 端点：
- POST   /api/knowledge/items                 创建知识条目
- GET    /api/knowledge/items                 列出知识条目
- GET    /api/knowledge/items/{item_id}       获取单个知识条目
- PATCH  /api/knowledge/items/{item_id}       更新知识条目
"""
import logging
logger = logging.getLogger(__name__)


from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import async_session_factory
from schemas.knowledge import (

    KnowledgeItemCreate,
    KnowledgeItemRead,
    KnowledgeItemSummary,
    KnowledgeItemUpdate,
)
from services.pipeline.knowledge import KnowledgeService

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


async def _get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


# ── CRUD ───────────────────────────────────────────────────────────────

@router.post("/items", response_model=KnowledgeItemRead)
async def create_knowledge_item(
    req: KnowledgeItemCreate,
    db: AsyncSession = Depends(_get_db),
):
    """创建知识条目"""
    try:
        svc = KnowledgeService(db)
        item = await svc.create(
            project_id=req.project_id,
            episode_id=req.episode_id,
            publish_job_id=req.publish_job_id,
            analytics_snapshot_id=req.analytics_snapshot_id,
            category=req.category,
            title=req.title,
            content=req.content,
            tags=req.tags,
            metadata_json=req.metadata_json,
            confidence=req.confidence,
            is_active=req.is_active,
        )
        await db.commit()
        return item
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create knowledge item: {e}")


@router.get("/items")
async def list_knowledge_items(
    project_id: Optional[str] = Query(None, description="按项目筛选"),
    episode_id: Optional[str] = Query(None, description="按剧集筛选"),
    publish_job_id: Optional[str] = Query(None, description="按发布任务筛选"),
    category: Optional[str] = Query(None, description="按分类筛选"),
    is_active: Optional[bool] = Query(None, description="按生效状态筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(_get_db),
):
    """列出知识条目"""
    skip = (page - 1) * page_size
    limit = min(page_size, 200)
    svc = KnowledgeService(db)
    items = []
    if publish_job_id:
        items = await svc.list_by_publish_job(publish_job_id, limit=limit)
    elif episode_id:
        items = await svc.list_by_episode(episode_id, category=category, limit=limit)
    elif project_id:
        items = await svc.list_by_project(
            project_id, category=category, is_active=is_active, limit=limit
        )
    else:
        return {"items": [], "total": 0, "skip": skip, "limit": limit}
    return {"items": items, "total": len(items), "skip": skip, "limit": limit}


@router.get("/items/{item_id}", response_model=KnowledgeItemRead)
async def get_knowledge_item(
    item_id: str,
    db: AsyncSession = Depends(_get_db),
):
    """获取单个知识条目"""
    svc = KnowledgeService(db)
    item = await svc.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="KnowledgeItem not found")
    return item


@router.patch("/items/{item_id}", response_model=KnowledgeItemRead)
async def update_knowledge_item(
    item_id: str,
    req: KnowledgeItemUpdate,
    db: AsyncSession = Depends(_get_db),
):
    """更新知识条目"""
    try:
        svc = KnowledgeService(db)
        item = await svc.update(
            item_id=item_id,
            title=req.title,
            content=req.content,
            tags=req.tags,
            category=req.category,
            confidence=req.confidence,
            is_active=req.is_active,
        )
        await db.commit()
        return item
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update knowledge item: {e}")
