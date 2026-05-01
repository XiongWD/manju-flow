"""Pipeline Steps — Real 流水线执行

从 steps.py 拆分：_execute_real_pipeline 主循环
"""

from typing import Optional

from database.models import Job, JobStep, Scene, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from .config import PIPELINE_STEPS
from .state import _make_progress_event, _record_progress, _uuid
from .steps_common import _finalize_job
from .steps_real_character import execute_character_step
from .steps_real_production import execute_production_step


async def _execute_real_pipeline(
    db: AsyncSession,
    job: Job,
    sv: SceneVersion,
    scene: Scene,
    project_id: str,
    episode_id: Optional[str],
):
    """执行 Real 流水线（调用真实 API）

    步骤：
    1. character_assets: 跳过（043b 实现）
    2. video_generation: VideoGenerator
    3. audio_generation: AudioGenerator
    4. compose: Compositor
    5. qa_check: QA Gate（在每个步骤后调用）
    """
    total_steps = len(PIPELINE_STEPS)
    has_failure = False
    failed_step_key = None
    failed_message = ""

    # 存储步骤产物
    step_assets = {}

    for step_idx, step_def in enumerate(PIPELINE_STEPS):
        step = JobStep(
            id=_uuid(),
            job_id=job.id,
            step_key=step_def["key"],
            tool_name=step_def["tool"],
            input_json={"scene_id": scene.id, "scene_version_id": sv.id},
            status="queued",
        )
        db.add(step)
        await db.flush()

        step_base_percent = int((step_idx / total_steps) * 100)

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

        # Real 模式：角色资产生成
        if step_def["key"] == "character_assets":
            result = await execute_character_step(
                db, job, sv, scene, project_id, episode_id,
                step, step_def, step_idx, step_assets,
            )
            if result is not None:
                has_failure, failed_step_key, failed_message = result
                break
            continue

        # Real 模式：执行生产步骤
        asset_or_error = await execute_production_step(
            db, job, sv, scene, project_id, episode_id,
            step, step_def, step_idx, step_assets,
        )
        asset, failure = asset_or_error

        if asset is None and failure is None:
            # 步骤被跳过（如 c2pa_sign）
            continue

        if failure:
            has_failure, failed_step_key, failed_message = failure
            break

    # 最终状态
    await _finalize_job(
        db, job, sv, scene, project_id, episode_id,
        has_failure, failed_step_key, failed_message,
    )
