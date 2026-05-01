"""Pipeline Steps — Mock 流水线执行

从 steps.py 拆分：_execute_mock_pipeline
"""

import asyncio
import random
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    Asset,
    AssetLink,
    Job,
    JobStep,
    QAIssue,
    QARun,
    SceneVersion,
    Scene,
)

from .config import PIPELINE_STEPS, QA_GATES
from .state import (
    _make_progress_event,
    _record_progress,
    _uuid,
)
from .version_lock import VersionLockService


async def _execute_mock_pipeline(
    db: AsyncSession,
    job: Job,
    sv: SceneVersion,
    scene: Scene,
    project_id: str,
    episode_id: Optional[str],
):
    """执行 Mock 流水线（原 Phase 1.2 逻辑）"""
    total_steps = len(PIPELINE_STEPS)
    has_failure = False
    failed_step_key = None
    failed_message = ""

    for step_idx, step_def in enumerate(PIPELINE_STEPS):
        step = JobStep(
            id=_uuid(),
            job_id=job.id,
            step_key=step_def["key"],
            tool_name=f"mock_{step_def['tool']}",
            input_json={"scene_id": scene.id, "scene_version_id": sv.id},
            status="queued",
        )
        db.add(step)
        await db.flush()

        step_base_percent = int((step_idx / total_steps) * 100)
        step_end_percent = int(((step_idx + 1) / total_steps) * 100)

        _record_progress(_make_progress_event(
            project_id=project_id,
            episode_id=episode_id,
            scene_id=scene.id,
            scene_version_id=sv.id,
            job_id=job.id,
            step_key=step_def["key"],
            job_status="running",
            step_status="running",
            progress_percent=step_base_percent,
            message=f"正在执行：{step_def['label']}",
        ))

        step.status = "running"
        await db.flush()

        # Mock 延迟
        await asyncio.sleep(0.3)

        # 随机决定该步是否失败（15% 失败率）
        step_failed = random.random() < 0.15

        if step_failed:
            step.status = "failed"
            step.error_message = f"Mock 执行失败：{step_def['label']} 超时"
            step.finished_at = datetime.now(timezone.utc)
            has_failure = True
            failed_step_key = step_def["key"]
            failed_message = step.error_message

            _record_progress(_make_progress_event(
                project_id=project_id,
                episode_id=episode_id,
                scene_id=scene.id,
                scene_version_id=sv.id,
                job_id=job.id,
                step_key=step_def["key"],
                job_status="running",
                step_status="failed",
                progress_percent=step_base_percent,
                message=step.error_message,
            ))

            # 后续步骤标记为 skipped
            for remaining_step_def in PIPELINE_STEPS[step_idx + 1:]:
                skip_step = JobStep(
                    id=_uuid(),
                    job_id=job.id,
                    step_key=remaining_step_def["key"],
                    tool_name=remaining_step_def["tool"],
                    input_json={"scene_id": scene.id, "scene_version_id": sv.id},
                    status="skipped",
                )
                db.add(skip_step)
            break

        # 步骤成功
        mock_uri = f"mock://assets/{step_def['key']}/{_uuid()[:8]}.dat"
        step.status = "completed"
        step.output_json = {"uri": mock_uri, "mock": True}
        step.finished_at = datetime.now(timezone.utc)

        asset_type = {
            "character_assets": "character_ref",
            "video_generation": "video",
            "audio_generation": "audio",
            "compose": "video",
            "qa_check": "qa_evidence",
        }.get(step_def["key"], "image")

        asset = Asset(
            id=_uuid(),
            project_id=project_id,
            type=asset_type,
            uri=mock_uri,
            metadata_json={"source": "mock_pipeline", "step": step_def["key"]},
        )
        db.add(asset)
        await db.flush()

        link = AssetLink(
            id=_uuid(),
            asset_id=asset.id,
            owner_type="scene_version",
            owner_id=sv.id,
            relation_type="output",
        )
        db.add(link)

        # QA 步骤（除了 qa_check 本身）
        if step_def["key"] in QA_GATES:
            gate_code = QA_GATES[step_def["key"]]
            passed = random.random() > 0.2  # 80% pass rate

            qa_run = QARun(
                id=_uuid(),
                project_id=project_id,
                gate_code=gate_code,
                subject_type="scene_version",
                subject_id=sv.id,
                input_asset_id=asset.id,
                evidence_asset_id=asset.id,
                step_key=step_def["key"],
                status="passed" if passed else "failed",
                score_json={"overall": random.uniform(70, 98) if passed else random.uniform(30, 69)},
                threshold_snapshot={"min_score": 70},
                finished_at=datetime.now(timezone.utc),
            )
            db.add(qa_run)
            await db.flush()

            if not passed:
                issue = QAIssue(
                    id=_uuid(),
                    qa_run_id=qa_run.id,
                    issue_code=f"{gate_code}_FAIL",
                    severity=random.choice(["critical", "warning"]),
                    message=f"Mock QA 失败：{step_def['label']} 未通过 {gate_code} 门禁",
                    evidence_asset_id=asset.id,
                    related_asset_id=asset.id,
                    related_scene_version_id=sv.id,
                    suggested_action="调整参数后重试",
                )
                db.add(issue)

        _record_progress(_make_progress_event(
            project_id=project_id,
            episode_id=episode_id,
            scene_id=scene.id,
            scene_version_id=sv.id,
            job_id=job.id,
            step_key=step_def["key"],
            job_status="running",
            step_status="completed",
            progress_percent=step_end_percent,
            message=f"完成：{step_def['label']}",
        ))

    # 最终状态
    if has_failure:
        job.status = "failed"
        job.error_message = failed_message
        sv.status = "GENERATING"
        scene.status = "DRAFT"

        _record_progress(_make_progress_event(
            project_id=project_id,
            episode_id=episode_id,
            scene_id=scene.id,
            scene_version_id=sv.id,
            job_id=job.id,
            step_key=failed_step_key or "",
            job_status="failed",
            step_status="failed",
            progress_percent=0,
            message=f"任务失败：{failed_message}",
        ))
    else:
        job.status = "completed"
        sv.status = "QA_PASSED"
        sv.score_snapshot = {"overall": random.uniform(80, 95)}

        sv.cost_actual = round(random.uniform(0.5, 3.5), 2)
        scene.status = "QA_PASSED"
        # 039a: 不再自动设置 locked_version_id，改为 READY_TO_LOCK 候选态
        await VersionLockService.set_scene_version_ready_to_lock(db, sv.id)
        job.cost_actual = sv.cost_actual

        _record_progress(_make_progress_event(
            project_id=project_id,
            episode_id=episode_id,
            scene_id=scene.id,
            scene_version_id=sv.id,
            job_id=job.id,
            step_key="",
            job_status="completed",
            step_status="completed",
            progress_percent=100,
            message="任务完成（进入 READY_TO_LOCK 状态）",
        ))

    job.finished_at = datetime.now(timezone.utc)
