"""Location 路由 — 地点 CRUD"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Location, Project
from schemas.location import LocationCreate, LocationUpdate, LocationRead

router = APIRouter(prefix="/api", tags=["locations"])


@router.get("/projects/{project_id}/locations", response_model=list[LocationRead])
async def list_locations(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取项目下的地点列表"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    result = await db.execute(
        select(Location)
        .where(Location.project_id == project_id)
        .order_by(Location.created_at.desc())
    )
    return result.scalars().all()


@router.post("/projects/{project_id}/locations", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create_location(
    project_id: str,
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建地点"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    location = Location(project_id=project_id, **body.model_dump())
    db.add(location)
    await db.flush()
    await db.refresh(location)
    return location


@router.get("/locations/{location_id}", response_model=LocationRead)
async def get_location(
    location_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取地点详情"""
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.put("/locations/{location_id}", response_model=LocationRead)
async def update_location(
    location_id: str,
    body: LocationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新地点"""
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(location, key, value)
    await db.flush()
    await db.refresh(location)
    return location


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: str,
    db: AsyncSession = Depends(get_db),
):
    """删除地点"""
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    await db.delete(location)
    await db.flush()
