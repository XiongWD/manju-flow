"""Job 路由 — 生产任务管理（增强版）

增强：
- 状态过滤（queued / running / completed / failed / cancelled）
- 重跑接口 POST /{job_id}/retry
- 取消接口 POST /{job_id}/cancel
- 进度时间线 GET /{job_id}/progress
- 最新进度 GET /{job_id}/latest-progress
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import Job, JobStep, Scene
from services.pipeline.orchestrator import (
    cancel_job,
    get_job_with_steps,
    get_job_latest_progress,
    get_job_progress,
    retry_scene,
    start_mock_scene_job,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/")
async def list_jobs(
    project_id: str = Query(None),
    status: str = Query(None),
    target_id: str = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """获取 Job 列表，支持状态和目标过滤"""
    q = select(Job).order_by(Job.created_at.desc()).limit(limit)
    if project_id:
        q = q.where(Job.project_id == project_id)
    if status:
        q = q.where(Job.status == status)
    if target_id:
        q = q.where(Job.target_id == target_id)
    result = await db.execute(q)
    jobs = result.scalars().all()

    return {
        "data": [
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
        ]
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
    """获取 Job 进度时间线（为 WS/轮询预留的统一结构）"""
    events = get_job_progress(job_id)
    return {"data": events}


@router.get("/{job_id}/latest-progress")
async def get_job_latest(job_id: str):
    """获取 Job 最新进度事件"""
    progress = get_job_latest_progress(job_id)
    if not progress:
        raise HTTPException(404, "No progress data")
    return {"data": progress}


@router.post("/{job_id}/retry")
async def retry_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """重跑任务：基于原始 job 的 target 创建新 job + 新 scene_version"""
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if job.target_type != "scene" or not job.target_id:
        raise HTTPException(400, "Only scene jobs can be retried")

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
    """启动 mock 场景生产任务"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")

    job = await start_mock_scene_job(db, scene_id, project_id)
    return {"data": {"job_id": job.id, "status": job.status}}
