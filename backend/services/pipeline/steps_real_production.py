"""Pipeline Steps — Real 流水线生产步骤处理

从 steps_real_handlers.py 拆分：视频/音频/合成/C2PA/QA 步骤
"""

import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Asset, Job, JobStep, Scene, SceneVersion

from .audio import AudioGenerator
from .base import PipelineError
from .c2pa import C2PASigner
from .compose import Compositor
from .config import PIPELINE_STEPS, QA_GATES
from .config_audio import resolve_bgm_config, resolve_mix_config, resolve_voice_config
from .state import _make_progress_event, _record_progress
from .steps_common import _run_qa_gate, _skip_remaining_steps


async def execute_production_step(
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
):
    """执行视频/音频/合成/C2PA/QA 等生产步骤

    Returns:
        (asset, None) 成功，(None, failure_tuple) 失败，(None, None) 跳过
    """
    try:
        start_time = time.time()

        if step_def["key"] == "video_generation":
            from .video import VideoGenerator
            video_gen = VideoGenerator()
            asset = await video_gen.generate(
                db=db, scene_version=sv,
                prompt_bundle=sv.prompt_bundle or {}, step=step,
            )
            step_assets["video"] = asset

        elif step_def["key"] == "audio_generation":
            # 音频生成 — 配置继承接入点
            voice_config = await resolve_voice_config(
                db, project_id=project_id, episode_id=episode_id, scene_version=sv,
            )
            bgm_config = await resolve_bgm_config(
                db, project_id=project_id, episode_id=episode_id, scene_version=sv,
            )
            mix_config = await resolve_mix_config(
                db, project_id=project_id, episode_id=episode_id, scene_version=sv,
            )

            step_assets["mix_config"] = mix_config

            step.metadata_json = step.metadata_json or {}
            step.metadata_json["resolved_voice_config"] = voice_config
            step.metadata_json["resolved_bgm_config"] = bgm_config
            step.metadata_json["resolved_mix_config"] = mix_config

            audio_gen = AudioGenerator()
            text = sv.prompt_bundle.get("text", "Hello, this is a test.") if sv.prompt_bundle else "Hello, this is a test."

            voice_asset = await audio_gen.generate(
                db=db, scene_version=sv, text=text,
                voice_config=voice_config, step=step,
            )
            step_assets["voice"] = voice_asset

            bgm_asset = await audio_gen.generate_bgm(
                db=db, scene_version=sv, bgm_config=bgm_config, step=step,
            )
            step_assets["bgm"] = bgm_asset

            loudness_asset = await audio_gen.create_loudness_asset(
                db=db, scene_version=sv,
                voice_asset=voice_asset, bgm_asset=bgm_asset, step=step,
            )
            step_assets["loudness"] = loudness_asset

            alignment_asset = await audio_gen.create_alignment_asset(
                db=db, scene_version=sv, voice_asset=voice_asset, step=step,
            )
            step_assets["alignment"] = alignment_asset

            asset = voice_asset

        elif step_def["key"] == "compose":
            video_asset = step_assets.get("video")
            voice_asset = step_assets.get("voice")
            if not video_asset or not voice_asset:
                raise PipelineError(
                    message="Video or voice asset not found for composition",
                    error_type="provider_error",
                )

            mix_config = step_assets.get("mix_config", {})
            compositor = Compositor()
            asset = await compositor.compose(
                db=db, scene_version=sv,
                video_asset=video_asset, audio_asset=voice_asset,
                mix_config=mix_config,
            )
            step_assets["composed"] = asset

        elif step_def["key"] == "c2pa_sign":
            if not C2PASigner.check_c2patool_available():
                step.status = "skipped"
                step.finished_at = datetime.now(timezone.utc)
                step_end_percent = int(((step_idx + 1) / len(PIPELINE_STEPS)) * 100)
                _record_progress(_make_progress_event(
                    project_id=project_id, episode_id=episode_id,
                    scene_id=scene.id, scene_version_id=sv.id,
                    job_id=job.id, step_key=step_def["key"],
                    job_status="running", step_status="skipped",
                    progress_percent=step_end_percent,
                    message=f"跳过：{step_def['label']}（c2patool 不可用）",
                ))
                await db.flush()
                return (None, None)

            compose_asset = step_assets.get("composed")
            if not compose_asset:
                raise PipelineError(
                    message="No composed asset for C2PA signing",
                    error_type="provider_error",
                )

            c2pa_signer = C2PASigner()
            asset = await c2pa_signer.sign(
                db=db, scene_version=sv, input_asset=compose_asset, step=step,
            )
            step_assets["c2pa_signed"] = asset

        elif step_def["key"] == "qa_check":
            asset = step_assets.get("composed")
            if not asset:
                raise PipelineError(
                    message="No composed asset for final QA",
                    error_type="provider_error",
                )

        else:
            raise PipelineError(
                message=f"Unknown step: {step_def['key']}",
                error_type="provider_error",
            )

        # 步骤成功
        duration = time.time() - start_time
        step.status = "completed"
        step.output_json = {"asset_id": asset.id}
        step.metadata_json = {"duration": duration, **(asset.metadata_json or {})}
        step.finished_at = datetime.now(timezone.utc)

        # QA Gate
        if step_def["key"] in QA_GATES:
            gate_result = await _run_qa_gate(
                db, QA_GATES[step_def["key"]], sv, asset, step_def,
                project_id, episode_id, job.id, scene.id, step_idx,
            )
            if gate_result:
                step.status = "failed"
                step.error_message = gate_result[2]
                return (None, gate_result)

        step_end_percent = int(((step_idx + 1) / len(PIPELINE_STEPS)) * 100)
        _record_progress(_make_progress_event(
            project_id=project_id, episode_id=episode_id,
            scene_id=scene.id, scene_version_id=sv.id,
            job_id=job.id, step_key=step_def["key"],
            job_status="running", step_status="completed",
            progress_percent=step_end_percent,
            message=f"完成：{step_def['label']}",
        ))

        return (asset, None)

    except PipelineError as e:
        step.status = "failed"
        step.error_message = e.message
        step.metadata_json = step.metadata_json or {}
        step.metadata_json["error"] = {
            "message": e.message, "provider": e.provider,
            "error_type": e.error_type, "details": e.details,
        }
        step.finished_at = datetime.now(timezone.utc)

        step_base_percent = int((step_idx / len(PIPELINE_STEPS)) * 100)
        _record_progress(_make_progress_event(
            project_id=project_id, episode_id=episode_id,
            scene_id=scene.id, scene_version_id=sv.id,
            job_id=job.id, step_key=step_def["key"],
            job_status="running", step_status="failed",
            progress_percent=step_base_percent,
            message=e.message,
        ))
        await _skip_remaining_steps(db, job.id, scene.id, sv.id, step_idx)
        return (None, (True, step_def["key"], e.message))
