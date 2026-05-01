"""Pipeline Steps — Real 流水线角色步骤处理

从 steps_real_handlers.py 拆分：character_assets 步骤
"""

import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Asset, Character, Episode, Job, JobStep, Project, Scene, SceneVersion

from .audio import AudioGenerator
from .character import CharacterGenerator
from .config import PIPELINE_STEPS, QA_GATES
from .state import _make_progress_event, _record_progress, _uuid
from .steps_common import _run_qa_gate, _skip_remaining_steps


async def execute_character_step(
    db: AsyncSession,
    job: Job,
    sv: SceneVersion,
    scene: Scene,
    project_id: str,
    episode_id: Optional[str],
    step: JobStep,
    step_def: dict,
    step_idx: int,
    step_assets: dict,
) -> Optional[tuple]:
    """执行 character_assets 步骤

    Returns:
        None 表示继续，(has_failure, failed_step_key, failed_message) 表示中断
    """
    step_end_percent = int(((step_idx + 1) / len(PIPELINE_STEPS)) * 100)

    try:
        result = await db.execute(
            select(Scene)
            .options(
                selectinload(Scene.episode).selectinload(Episode.project).selectinload(Project.characters)
            )
            .where(Scene.id == scene.id)
        )
        scene = result.scalar_one()
        project = scene.episode.project
        characters = project.characters

        if not characters:
            step.status = "skipped"
            step.finished_at = datetime.now(timezone.utc)
            _record_progress(_make_progress_event(
                project_id=project_id, episode_id=episode_id,
                scene_id=scene.id, scene_version_id=sv.id,
                job_id=job.id, step_key=step_def["key"],
                job_status="running", step_status="skipped",
                progress_percent=step_end_percent,
                message=f"跳过：{step_def['label']}（未找到角色）",
            ))
            await db.flush()
            return None

        character = characters[0]

        if not character.canonical_asset_id:
            step.status = "skipped"
            step.finished_at = datetime.now(timezone.utc)
            _record_progress(_make_progress_event(
                project_id=project_id, episode_id=episode_id,
                scene_id=scene.id, scene_version_id=sv.id,
                job_id=job.id, step_key=step_def["key"],
                job_status="running", step_status="skipped",
                progress_percent=step_end_percent,
                message=f"跳过：{step_def['label']}（角色无参考资产）",
            ))
            await db.flush()
            return None

        ref_asset_result = await db.execute(
            select(Asset).where(Asset.id == character.canonical_asset_id)
        )
        ref_asset = ref_asset_result.scalar_one_or_none()

        if not ref_asset:
            step.status = "skipped"
            step.finished_at = datetime.now(timezone.utc)
            _record_progress(_make_progress_event(
                project_id=project_id, episode_id=episode_id,
                scene_id=scene.id, scene_version_id=sv.id,
                job_id=job.id, step_key=step_def["key"],
                job_status="running", step_status="skipped",
                progress_percent=step_end_percent,
                message=f"跳过：{step_def['label']}（参考资产未找到）",
            ))
            await db.flush()
            return None

        ref_path = ref_asset.uri.replace("file://", "") if ref_asset.uri else ""

        if not ref_path:
            step.status = "skipped"
            step.finished_at = datetime.now(timezone.utc)
            _record_progress(_make_progress_event(
                project_id=project_id, episode_id=episode_id,
                scene_id=scene.id, scene_version_id=sv.id,
                job_id=job.id, step_key=step_def["key"],
                job_status="running", step_status="skipped",
                progress_percent=step_end_percent,
                message=f"跳过：{step_def['label']}（参考图片路径无效）",
            ))
            await db.flush()
            return None

        start_time = time.time()
        character_gen = CharacterGenerator()
        asset = await character_gen.generate(
            db=db, character=character,
            reference_image_path=ref_path,
            scene_version=sv, step=step,
        )
        step_assets["character"] = asset

        duration = time.time() - start_time
        step.status = "completed"
        step.output_json = {"asset_id": asset.id}
        step.metadata_json = {"duration": duration, **(asset.metadata_json or {})}
        step.finished_at = datetime.now(timezone.utc)

        if "character_assets" in QA_GATES:
            gate_result = await _run_qa_gate(
                db, QA_GATES["character_assets"], sv, asset, step_def,
                project_id, episode_id, job.id, scene.id, step_idx,
            )
            if gate_result:
                step.status = "failed"
                step.error_message = gate_result[2]
                return gate_result

        _record_progress(_make_progress_event(
            project_id=project_id, episode_id=episode_id,
            scene_id=scene.id, scene_version_id=sv.id,
            job_id=job.id, step_key=step_def["key"],
            job_status="running", step_status="completed",
            progress_percent=step_end_percent,
            message=f"完成：{step_def['label']}",
        ))
        await db.flush()

    except Exception as e:
        step.status = "failed"
        step.error_message = str(e)
        step.metadata_json = step.metadata_json or {}
        step.metadata_json["error"] = {
            "message": str(e), "type": "character_generation_error",
        }
        step.finished_at = datetime.now(timezone.utc)
        _record_progress(_make_progress_event(
            project_id=project_id, episode_id=episode_id,
            scene_id=scene.id, scene_version_id=sv.id,
            job_id=job.id, step_key=step_def["key"],
            job_status="running", step_status="failed",
            progress_percent=int((step_idx / len(PIPELINE_STEPS)) * 100),
            message=str(e),
        ))
        await _skip_remaining_steps(db, job.id, scene.id, sv.id, step_idx)
        return (True, step_def["key"], str(e))

    return None
