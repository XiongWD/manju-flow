"""Story Bible CRUD 路由"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.models import StoryBible
from schemas.story_bible import StoryBibleCreate, StoryBibleUpdate, StoryBibleRead

router = APIRouter(prefix="/api/story-bibles", tags=["story-bibles"])


@router.post("/", response_model=StoryBibleRead, status_code=201)
async def create_story_bible(body: StoryBibleCreate, db: AsyncSession = Depends(get_db)):
    """创建 Story Bible"""
    obj = StoryBible(**body.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/", response_model=list[StoryBibleRead])
async def list_story_bibles(project_id: str, db: AsyncSession = Depends(get_db)):
    """按项目获取 Story Bible 列表"""
    result = await db.execute(
        select(StoryBible)
        .where(StoryBible.project_id == project_id)
        .order_by(StoryBible.created_at.desc())
    )
    return result.scalars().all()


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
async def delete_story_bible(story_bible_id: str, db: AsyncSession = Depends(get_db)):
    """删除 Story Bible"""
    obj = await db.get(StoryBible, story_bible_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Story Bible 不存在")
    await db.delete(obj)
    await db.flush()
