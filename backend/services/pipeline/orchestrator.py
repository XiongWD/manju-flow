"""Pipeline Orchestrator — Phase 5 (043a) — Thin wrapper

支持 Mock 和 Real 模式：
- Mock 模式：模拟完整流水线（原 Phase 1.2 逻辑）
- Real 模式：调用真实 API（VideoGenerator, AudioGenerator, Compositor）
- 统一状态机：queued → running → completed / failed / skipped
- 进度百分比追踪
- 失败态语义完整：QA fail 导致 job failed
- 场景重跑：创建新 job + 新 scene_version，保留历史

Phase 5 拆分：
- steps.py: _execute_mock_pipeline, _execute_real_pipeline
- state.py: 进度事件追踪、辅助函数
- config.py: PIPELINE_STEPS, QA_GATES, FALLBACK_CHAIN, TIER_PROVIDER_MAP（追加）
"""

import random
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    Job,
    JobStep,
    Scene,
    SceneVersion,
)

from .config import get_pipeline_mode
from .state import (
    _make_progress_event,
    _record_progress,
    _uuid,
    get_job_progress,
    get_job_latest_progress,
    register_progress_callback,
)
from .steps import _execute_mock_pipeline, _execute_real_pipeline


async def start_scene_job(
    db: AsyncSession,
    scene_id: str,
    project_id: str,
    episode_id: Optional[str] = None,
    parent_version_id: Optional[str] = None,
) -> Job:
    """创建并执行场景生产任务（支持 Mock 和 Real 模式）

    支持：
    - Mock 模式：模拟完整流水线（原 Phase 1.2 逻辑）
    - Real 模式：调用真实 API（VideoGenerator, AudioGenerator, Compositor）
    - 完整状态机流转：queued → running → completed / failed
    - 每步进度百分比
    - QA 失败时 job 设为 failed
    - parent_version_id 用于重跑（版本链追踪）
    """

    # 获取 pipeline 模式
    pipeline_mode = get_pipeline_mode()

    # 获取 scene 信息
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise ValueError(f"Scene {scene_id} not found")

    # 创建 Job（初始状态 queued）
    job = Job(
        id=_uuid(),
        project_id=project_id,
        job_type="scene_production",
        target_type="scene",
        target_id=scene_id,
        worker_type="real" if pipeline_mode == "real" else "mock",
        status="queued",
        metadata_json={
            "scene_no": scene.scene_no,
            "mode": pipeline_mode,
            "parent_version_id": parent_version_id,
        },
    )
    db.add(job)
    await db.flush()

    # 确定新版本号
    max_ver_q = select(func.max(SceneVersion.version_no)).where(
        SceneVersion.scene_id == scene_id
    )
    max_ver_result = await db.execute(max_ver_q)
    max_ver = max_ver_result.scalar() or 0
    new_version_no = max_ver + 1

    # 创建 scene_version
    sv = SceneVersion(
        id=_uuid(),
        scene_id=scene_id,
        parent_version_id=parent_version_id,
        version_no=new_version_no,
        prompt_bundle={"positive": "mock prompt", "negative": "mock negative"},
        model_bundle={"image": "mock-flux", "video": "mock-kling", "audio": "mock-elevenlabs"},
        params={"resolution": "1024x1024", "fps": 30, "seed": random.randint(1, 99999)},
        change_reason="初始生产" if not parent_version_id else f"重跑（基于 v{max_ver}）",
        status="GENERATING",
    )
    db.add(sv)
    await db.flush()

    # 记录初始进度
    _record_progress(_make_progress_event(
        project_id=project_id,
        episode_id=episode_id,
        scene_id=scene_id,
        scene_version_id=sv.id,
        job_id=job.id,
        step_key="",
        job_status="queued",
        step_status="queued",
        progress_percent=0,
        message="任务已入队",
    ))

    # 标记 job 为 running
    job.status = "running"
    job.started_at = datetime.utcnow()
    await db.flush()

    _record_progress(_make_progress_event(
        project_id=project_id,
        episode_id=episode_id,
        scene_id=scene_id,
        scene_version_id=sv.id,
        job_id=job.id,
        step_key="",
        job_status="running",
        step_status="queued",
        progress_percent=0,
        message="开始执行流水线",
    ))

    # 根据模式执行
    if pipeline_mode == "mock":
        await _execute_mock_pipeline(db, job, sv, scene, project_id, episode_id)
    else:
        await _execute_real_pipeline(db, job, sv, scene, project_id, episode_id)

    await db.commit()
    await db.refresh(job)
    return job


# 向后兼容：保留原函数名作为别名
start_mock_scene_job = start_scene_job


async def retry_scene(db: AsyncSession, scene_id: str, project_id: str, episode_id: Optional[str] = None) -> Job:
    """重跑场景：创建新 job + 新 scene_version，不覆盖旧记录。"""
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise ValueError(f"Scene {scene_id} not found")

    # 获取当前锁定版本作为 parent
    parent_version_id = scene.locked_version_id

    # 如果没有锁定版本，取最新版本
    if not parent_version_id:
        latest_q = (
            select(SceneVersion)
            .where(SceneVersion.scene_id == scene_id)
            .order_by(SceneVersion.version_no.desc())
            .limit(1)
        )
        latest_result = await db.execute(latest_q)
        latest_sv = latest_result.scalar_one_or_none()
        if latest_sv:
            parent_version_id = latest_sv.id

    # 创建并执行新 job
    return await start_scene_job(
        db=db,
        scene_id=scene_id,
        project_id=project_id,
        episode_id=episode_id,
        parent_version_id=parent_version_id,
    )


async def cancel_job(db: AsyncSession, job_id: str) -> Optional[Job]:
    """取消任务（仅限 queued/running 状态）。

    生产环境需要实现真正的取消逻辑（kill worker task）。
    当前模式只改状态。
    """
    job = await db.get(Job, job_id)
    if not job:
        return None

    if job.status not in ("queued", "running"):
        raise ValueError(f"Cannot cancel job in {job.status} state")

    # 标记未完成的 steps 为 skipped
    steps_q = select(JobStep).where(
        JobStep.job_id == job_id,
        JobStep.status.in_(["queued", "running"]),
    )
    steps_result = await db.execute(steps_q)
    for step in steps_result.scalars():
        step.status = "skipped"
        step.finished_at = datetime.utcnow()

    job.status = "cancelled"
    job.error_message = "Cancelled by user"
    job.finished_at = datetime.utcnow()
    await db.commit()
    await db.refresh(job)
    return job


async def get_job_with_steps(db: AsyncSession, job_id: str) -> Optional[dict]:
    """获取 Job 及其所有 steps 的详细信息，含最新进度。"""
    job = await db.get(Job, job_id)
    if not job:
        return None

    result = {
        "id": job.id,
        "project_id": job.project_id,
        "job_type": job.job_type,
        "target_type": job.target_type,
        "target_id": job.target_id,
        "worker_type": job.worker_type,
        "status": job.status,
        "retry_count": job.retry_count,
        "cost_actual": job.cost_actual,
        "error_message": job.error_message,
        "metadata_json": job.metadata_json,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "steps": [],
        "progress": await get_job_latest_progress(job_id),
    }

    steps_result = await db.execute(
        select(JobStep).where(JobStep.job_id == job_id).order_by(JobStep.created_at)
    )
    for step in steps_result.scalars():
        result["steps"].append({
            "id": step.id,
            "step_key": step.step_key,
            "tool_name": step.tool_name,
            "status": step.status,
            "input_json": step.input_json,
            "output_json": step.output_json,
            "error_message": step.error_message,
            "finished_at": step.finished_at.isoformat() if step.finished_at else None,
        })

    return result
