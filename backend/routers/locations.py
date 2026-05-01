"""Location 路由 — 地点 CRUD"""
import logging


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db, get_or_none
from database.models import Location, Project, User
from services.auth import get_current_user
from schemas.location import LocationCreate, LocationUpdate, LocationRead


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["locations"])


@router.get("/projects/{project_id}/locations")
async def list_locations(
    project_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取项目下的地点列表"""
    skip = (page - 1) * page_size
    limit = min(page_size, 200)
    project = await get_or_none(db, Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    q = select(Location).where(Location.project_id == project_id)
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(Location.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return {"items": result.scalars().all(), "total": total, "skip": skip, "limit": limit}


@router.post("/projects/{project_id}/locations", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create_location(
    project_id: str,
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建地点"""
    project = await get_or_none(db, Project, project_id)
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
    current_user: User = Depends(get_current_user),
):
    """删除地点"""
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    await db.delete(location)
    await db.flush()
