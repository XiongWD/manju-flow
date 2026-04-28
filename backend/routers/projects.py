"""项目 CRUD 路由 — 完整实现"""

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.models import Project
from schemas.project import ProjectCreate, ProjectUpdate, ProjectRead

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("/", response_model=ProjectRead, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """创建项目"""
    project = Project(**body.model_dump())
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.get("/", response_model=list[ProjectRead])
async def list_projects(db: AsyncSession = Depends(get_db)):
    """获取项目列表"""
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()


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
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """删除项目"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    await db.delete(project)
    await db.flush()
