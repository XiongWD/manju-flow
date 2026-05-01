"""Story Bible CRUD 路由"""
import logging


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.models import StoryBible, User
from services.auth import get_current_user
from schemas.story_bible import StoryBibleCreate, StoryBibleUpdate, StoryBibleRead


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/story-bibles", tags=["story-bibles"])


@router.post("", response_model=StoryBibleRead, status_code=201)
async def create_story_bible(body: StoryBibleCreate, db: AsyncSession = Depends(get_db)):
    """创建 Story Bible"""
    obj = StoryBible(**body.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("")
async def list_story_bibles(
    project_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """按项目获取 Story Bible 列表"""
    skip = (page - 1) * page_size
    limit = min(page_size, 200)
    q = select(StoryBible).where(StoryBible.project_id == project_id)
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(StoryBible.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return {"items": result.scalars().all(), "total": total, "skip": skip, "limit": limit}


@router.get("/{story_bible_id}", response_model=StoryBibleRead)
async def get_story_bible(story_bible_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个 Story Bible"""
    obj = await db.get(StoryBible, story_bible_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Story Bible 不存在")
    return obj


@router.patch("/{story_bible_id}", response_model=StoryBibleRead)
async def update_story_bible(story_bible_id: str, body: StoryBibleUpdate, db: AsyncSession = Depends(get_db)):
    """更新 Story Bible"""
    obj = await db.get(StoryBible, story_bible_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Story Bible 不存在")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{story_bible_id}", status_code=204)
async def delete_story_bible(story_bible_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """删除 Story Bible"""
    obj = await db.get(StoryBible, story_bible_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Story Bible 不存在")
    await db.delete(obj)
    await db.flush()
