
logger = logging.getLogger(__name__)
"""Job 路由 — 生产任务管理（增强版）

增强：
- 状态过滤（queued / running / completed / failed / cancelled）
- 重跑接口 POST /{job_id}/retry
- 取消接口 POST /{job_id}/cancel
- 进度时间线 GET /{job_id}/progress
- 最新进度 GET /{job_id}/latest-progress
"""
import logging


import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import async_session_factory, get_db
from database.models import Job, JobStep, Scene
from services.pipeline.orchestrator import (

    cancel_job,
    get_job_with_steps,
    get_job_latest_progress,
    get_job_progress,
    retry_scene,
    start_scene_job,
)
from services.pipeline.runner import submit_scene_job_bg

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/")
async def list_jobs(
    project_id: str = Query(None),
    status: str = Query(None),
    target_id: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    search: str = Query("", description="搜索关键词"),
    db: AsyncSession = Depends(get_db),
):
    """获取 Job 列表，支持状态和目标过滤"""
    limit = min(limit, 200)
    q = select(Job)
    if project_id:
        q = q.where(Job.project_id == project_id)
    if status:
        q = q.where(Job.status == status)
    if target_id:
        q = q.where(Job.target_id == target_id)
    if search:
        q = q.filter(or_(
            Job.job_type.ilike(f"%{search}%"),
            Job.error_message.ilike(f"%{search}%"),
        ))
    # count
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(Job.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    jobs = result.scalars().all()

    return {
        "items": [
            {
                "id": j.id,
                "project_id": j.project_id,
                "job_type": j.job_type,
                "target_type": j.target_type,
                "target_id": j.target_id,
                "worker_type": j.worker_type,
                "status": j.status,
                "retry_count": j.retry_count,
                "cost_actual": j.cost_actual,
                "error_message": j.error_message,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "finished_at": j.finished_at.isoformat() if j.finished_at else None,
            }
            for j in jobs
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """获取 Job 详情（含 steps 和最新进度）"""
    job_detail = await get_job_with_steps(db, job_id)
    if not job_detail:
        raise HTTPException(404, "Job not found")
    return {"data": job_detail}


@router.get("/{job_id}/progress")
async def get_job_progress_timeline(job_id: str):
    """获取 Job 进度时间线（DB 优先，内存 fallback）"""
    events = await get_job_progress(job_id)
    return {"data": events}


@router.get("/{job_id}/latest-progress")
async def get_job_latest(job_id: str):
    """获取 Job 最新进度事件（DB 优先，内存 fallback）"""
    progress = await get_job_latest_progress(job_id)
    if not progress:
        raise HTTPException(404, "No progress data")
    return {"data": progress}


@router.post("/{job_id}/retry")
async def retry_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """重跑任务：基于原始 job 的 target 创建新 job + 新 scene_version"""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    if job.target_type != "scene" or not job.target_id:
        raise HTTPException(400, "Only scene jobs can be retried")

    # 状态校验：只有 failed/cancelled 的 job 才能重跑
    if job.status not in ("failed", "cancelled"):
        raise HTTPException(409, f"Job status '{job.status}' cannot be retried; only failed or cancelled jobs can be retried")

    try:
        new_job = await retry_scene(
            db=db,
            scene_id=job.target_id,
            project_id=job.project_id,
        )
        return {"data": {"job_id": new_job.id, "status": new_job.status, "message": "重跑任务已创建"}}
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/{job_id}/cancel")
async def cancel_job_endpoint(job_id: str, db: AsyncSession = Depends(get_db)):
    """取消任务（仅 queued/running 状态可取消）"""
    try:
        job = await cancel_job(db, job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        return {"data": {"job_id": job.id, "status": job.status, "message": "任务已取消"}}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/mock-scene-job")
async def create_mock_scene_job(
    scene_id: str = Query(...),
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """启动 mock 场景生产任务（后台执行，不阻塞请求）"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    # 创建占位 Job 记录，立即返回
    job = Job(
        id=uuid.uuid4().hex,
        project_id=project_id,
        job_type="scene_production",
        target_type="scene",
        target_id=scene_id,
        worker_type="mock",
        status="queued",
        metadata_json={"scene_id": scene_id, "mode": "mock"},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # 后台执行完整 pipeline（自带独立 db session）
    asyncio.create_task(submit_scene_job_bg(scene_id, project_id))

    return {"data": {"job_id": job.id, "status": job.status, "message": "任务已提交到后台"}}


@router.post("/scene-job")
async def create_scene_job(
    scene_id: str = Query(...),
    project_id: str = Query(...),
    episode_id: Optional[str] = Query(None),
    parent_version_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """创建并后台执行场景生产任务（不阻塞请求）"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    # 先创建 Job 记录（轻量），立即返回
    job = Job(
        id=uuid.uuid4().hex,
        project_id=project_id,
        job_type="scene_production",
        target_type="scene",
        target_id=scene_id,
        worker_type="real",
        status="queued",
        metadata_json={"scene_id": scene_id, "mode": "auto"},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # 后台执行完整 pipeline（自带独立 db session）
    asyncio.create_task(submit_scene_job_bg(
        scene_id=scene_id,
        project_id=project_id,
        episode_id=episode_id,
        parent_version_id=parent_version_id,
    ))

    return {"data": {"job_id": job.id, "status": job.status, "message": "任务已提交到后台"}}


