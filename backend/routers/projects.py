"""项目 CRUD 路由 — 完整实现"""
import logging


import secrets

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.models import Project
from schemas.project import ProjectCreate, ProjectUpdate, ProjectRead
from services.broadcast import broadcast


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("/", response_model=ProjectRead, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """创建项目"""
    project = Project(**body.model_dump())
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.get("/")
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    search: str = Query("", description="搜索关键词"),
    db: AsyncSession = Depends(get_db),
):
    """获取项目列表"""
    limit = min(limit, 200)
    base_q = select(Project)
    if search:
        base_q = base_q.filter(or_(
            Project.name.ilike(f"%{search}%"),
            Project.description.ilike(f"%{search}%"),
            Project.genre.ilike(f"%{search}%"),
        ))
    total_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = total_result.scalar() or 0
    q = base_q.order_by(Project.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个项目"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(project_id: str, body: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    """更新项目"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await db.flush()
    await db.refresh(project)
    await broadcast.broadcast(f"project:{project_id}", {"type": "updated", "entity": "project", "id": project_id})
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """删除项目"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    await db.delete(project)
    await db.flush()
    await broadcast.broadcast(f"project:{project_id}", {"type": "deleted", "entity": "project", "id": project_id})
