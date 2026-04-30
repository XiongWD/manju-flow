"""Prop 路由 — 道具与道具状态 CRUD"""
import logging


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Prop, PropState, Project, Scene
from schemas.prop import PropCreate, PropUpdate, PropRead, PropStateCreate, PropStateUpdate, PropStateRead


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["props"])


# ─── Prop CRUD ──────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/props")
async def list_props(
    project_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """获取项目下的道具列表"""
    limit = min(limit, 200)
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    q = select(Prop).where(Prop.project_id == project_id)
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(Prop.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return {"items": result.scalars().all(), "total": total, "skip": skip, "limit": limit}


@router.post("/projects/{project_id}/props", response_model=PropRead, status_code=status.HTTP_201_CREATED)
async def create_prop(
    project_id: str,
    body: PropCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建道具"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    prop = Prop(project_id=project_id, **body.model_dump())
    db.add(prop)
    await db.flush()
    await db.refresh(prop)
    return prop


@router.get("/props/{prop_id}", response_model=PropRead)
async def get_prop(
    prop_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取道具详情"""
    prop = await db.get(Prop, prop_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Prop not found")
    return prop


@router.put("/props/{prop_id}", response_model=PropRead)
async def update_prop(
    prop_id: str,
    body: PropUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新道具"""
    prop = await db.get(Prop, prop_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Prop not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(prop, key, value)
    await db.flush()
    await db.refresh(prop)
    return prop


@router.delete("/props/{prop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prop(
    prop_id: str,
    db: AsyncSession = Depends(get_db),
):
    """删除道具"""
    prop = await db.get(Prop, prop_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Prop not found")
    await db.delete(prop)
    await db.flush()


# ─── PropState CRUD ─────────────────────────────────────────────────────────

@router.get("/scenes/{scene_id}/prop-states", response_model=list[PropStateRead])
async def list_prop_states(
    scene_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取镜头关联的道具状态列表"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    # 分页豁免：列表固定小
    result = await db.execute(
        select(PropState)
        .where(PropState.scene_id == scene_id)
        .order_by(PropState.created_at.desc())
    )
    return result.scalars().all()


@router.post("/scenes/{scene_id}/prop-states", response_model=PropStateRead, status_code=status.HTTP_201_CREATED)
async def create_prop_state(
    scene_id: str,
    body: PropStateCreate,
    db: AsyncSession = Depends(get_db),
):
    """为镜头添加道具状态"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    # 验证 prop 存在
    prop = await db.get(Prop, body.prop_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Prop not found")
    # 如果 body 中没指定 scene_id，用路径中的
    state = PropState(scene_id=scene_id, **body.model_dump())
    db.add(state)
    await db.flush()
    await db.refresh(state)
    return state


@router.put("/prop-states/{state_id}", response_model=PropStateRead)
async def update_prop_state(
    state_id: str,
    body: PropStateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新道具状态"""
    state = await db.get(PropState, state_id)
    if not state:
        raise HTTPException(status_code=404, detail="PropState not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(state, key, value)
    await db.flush()
    await db.refresh(state)
    return state
