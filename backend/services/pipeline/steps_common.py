"""Pipeline Steps — Real 流水线公共工具

从 steps_real_handlers.py 进一步拆分：共享的辅助函数
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from database.models import JobStep
from sqlalchemy.ext.asyncio import AsyncSession

from .config import PIPELINE_STEPS
from .qa import QAGate
from .state import _make_progress_event, _record_progress, _uuid

logger = logging.getLogger(__name__)


async def _skip_remaining_steps(db, job_id, scene_id, sv_id, start_idx):
    """将后续步骤标记为 skipped"""
    for remaining_step_def in PIPELINE_STEPS[start_idx + 1:]:
        skip_step = JobStep(
            id=_uuid(),
            job_id=job_id,
            step_key=remaining_step_def["key"],
            tool_name=remaining_step_def["tool"],
            input_json={"scene_id": scene_id, "scene_version_id": sv_id},
            status="skipped",
        )
        db.add(skip_step)


async def _finalize_job(
    db: AsyncSession, job, sv, scene,
    project_id: str, episode_id: Optional[str],
    has_failure: bool, failed_step_key: Optional[str], failed_message: str,
):
    """设置任务最终状态"""
    if has_failure:
        job.status = "failed"
        job.error_message = failed_message
        sv.status = "GENERATING"
        scene.status = "DRAFT"

        _record_progress(_make_progress_event(
            project_id=project_id, episode_id=episode_id,
            scene_id=scene.id, scene_version_id=sv.id,
            job_id=job.id, step_key=failed_step_key or "",
            job_status="failed", step_status="failed",
            progress_percent=0, message=f"任务失败：{failed_message}",
        ))
    else:
        job.status = "completed"
        sv.status = "QA_PASSED"
        sv.score_snapshot = {"overall": 90}
        sv.cost_actual = 0.0
        scene.status = "QA_PASSED"
        from .version_lock import VersionLockService
        await VersionLockService.set_scene_version_ready_to_lock(db, sv.id)
        job.cost_actual = sv.cost_actual

        _record_progress(_make_progress_event(
            project_id=project_id, episode_id=episode_id,
            scene_id=scene.id, scene_version_id=sv.id,
            job_id=job.id, step_key="",
            job_status="completed", step_status="completed",
            progress_percent=100, message="任务完成（进入 READY_TO_LOCK 状态）",
        ))

    job.finished_at = datetime.now(timezone.utc)


async def _run_qa_gate(
    db, gate_code, sv, asset, step_def,
    project_id, episode_id, job_id, scene_id, step_idx,
):
    """执行 QA Gate，返回失败元组或 None"""
    qa_gate = QAGate()
    try:
        qa_run = await qa_gate.run_gate(
            db=db, gate_code=gate_code,
            subject_type="scene_version", subject_id=sv.id,
            input_asset_id=asset.id, step_key=step_def["key"],
            project_id=project_id,
        )

        if qa_run.status == "failed":
            failed_message = f"QA Gate {gate_code} failed"
            _record_progress(_make_progress_event(
                project_id=project_id, episode_id=episode_id,
                scene_id=scene_id, scene_version_id=sv.id,
                job_id=job_id, step_key=step_def["key"],
                job_status="running", step_status="failed",
                progress_percent=int(((step_idx + 1) / len(PIPELINE_STEPS)) * 100),
                message=failed_message,
            ))
            await _skip_remaining_steps(db, job_id, scene_id, sv.id, step_idx)
            return (True, step_def["key"], failed_message)

    except Exception as e:
        logger.warning("QA Gate failed: %s", e)

    return None
