"""Pipeline Orchestrator — Phase 5 (043a)

支持 Mock 和 Real 模式：
- Mock 模式：模拟完整流水线（原 Phase 1.2 逻辑）
- Real 模式：调用真实 API（VideoGenerator, AudioGenerator, Compositor）
- 统一状态机：queued → running → completed / failed / skipped
- 进度百分比追踪
- 失败态语义完整：QA fail 导致 job failed
- 场景重跑：创建新 job + 新 scene_version，保留历史
"""

import asyncio
import random
import time
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    Asset,
    AssetLink,
    Character,
    Episode,
    Job,
    JobStep,
    Project,
    QAIssue,
    QARun,
    Scene,
    SceneVersion,
)

from .base import PipelineError
from .config import get_pipeline_mode
from .audio import AudioGenerator
from .character import CharacterGenerator
from .c2pa import C2PASigner
from .compose import Compositor
from .qa import QAGate
from .config_audio import resolve_voice_config, resolve_bgm_config, resolve_mix_config
from .tier_config import resolve_episode_tier, VALID_TIERS
from .version_lock import VersionLockService
from .video import VideoGenerator

# Pipeline 步骤定义（Mock 和 Real 通用）
PIPELINE_STEPS = [
    {"key": "character_assets", "label": "角色资产生成", "tool": "character_gen"},
    {"key": "video_generation", "label": "视频生成", "tool": "video_gen"},
    {"key": "audio_generation", "label": "音频生成", "tool": "audio_gen"},
    {"key": "compose", "label": "合成混音", "tool": "compose"},
    {"key": "qa_check", "label": "质检检查", "tool": "qa_gate"},
    {"key": "c2pa_sign", "label": "C2PA 签名", "tool": "c2pa_sign"},
]

# QA gate codes per step
QA_GATES = {
    "character_assets": "G2",  # 043b 实现
    "video_generation": "G6",
    "audio_generation": "G8",
    "compose": "G9",
}

# Fallback chain: SSS -> SS -> S -> A_FALLBACK -> NEEDS_REVIEW
FALLBACK_CHAIN = {
    "SSS": "SS",
    "SS": "S",
    "S": "A_FALLBACK",
    "A_FALLBACK": "NEEDS_REVIEW",
}

# Provider mapping per tier
TIER_PROVIDER_MAP = {
    "SSS": {
        "video": "lora_seedance",
        "audio": "elevenlabs",
    },
    "SS": {
        "video": "seedance",
        "audio": "elevenlabs",
    },
    "S": {
        "video": "kling",
        "audio": "elevenlabs",
    },
    "A": {
        "video": "kling",
        "audio": "fish_audio",
    },
    "A_FALLBACK": {
        "video": "kling",
        "audio": "fish_audio",
    },
}

# ── Progress Event Schema (unified for WS / polling) ──

def _make_progress_event(
    *,
    project_id: str,
    episode_id: Optional[str] = None,
    scene_id: str,
    scene_version_id: str,
    job_id: str,
    step_key: str,
    job_status: str,
    step_status: str,
    progress_percent: int,
    message: str,
) -> dict:
    """构建统一进度事件 payload"""
    return {
        "project_id": project_id,
        "episode_id": episode_id,
        "scene_id": scene_id,
        "scene_version_id": scene_version_id,
        "job_id": job_id,
        "step_key": step_key,
        "job_status": job_status,
        "step_status": step_status,
        "progress_percent": progress_percent,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
    }


def _uuid() -> str:
    import uuid
    return uuid.uuid4().hex


# ── 进度存储（内存，生产环境应换 Redis / DB） ──
_progress_events: dict[str, list[dict]] = {}  # job_id -> [events]

# WebSocket 广播回调（由 main.py 注册）
_progress_callback: Optional[callable] = None


def register_progress_callback(callback: callable):
    """注册进度广播回调（用于 WebSocket）"""
    global _progress_callback
    _progress_callback = callback


def _record_progress(event: dict):
    """记录进度事件并触发广播"""
    job_id = event["job_id"]
    if job_id not in _progress_events:
        _progress_events[job_id] = []
    _progress_events[job_id].append(event)

    # 触发 WebSocket 广播
    if _progress_callback:
        try:
            _progress_callback(event)
        except Exception as e:
            # 广播失败不影响主流程
            print(f"[Orchestrator] Progress callback failed: {e}")


def get_job_progress(job_id: str) -> list[dict]:
    """获取 job 的进度时间线"""
    return _progress_events.get(job_id, [])


def get_job_latest_progress(job_id: str) -> Optional[dict]:
    """获取 job 的最新进度事件"""
    events = _progress_events.get(job_id, [])
    return events[-1] if events else None


def _get_provider_for_tier(step_key: str, tier: str) -> str:
    """获取指定 tier 的 provider 名称"""
    if step_key == "video_generation":
        return TIER_PROVIDER_MAP.get(tier, {}).get("video", "kling")
    elif step_key == "audio_generation":
        return TIER_PROVIDER_MAP.get(tier, {}).get("audio", "fish_audio")
    return None


def _record_fallback(
    step: JobStep,
    from_tier: str,
    to_tier: str,
    from_provider: str,
    to_provider: str,
    reason: str,
    trigger_gate: Optional[str] = None,
    scene_version_id: Optional[str] = None,
    retry_count: int = 0,
):
    """记录 fallback 到 job_step.metadata_json.fallback_records"""
    if not step.metadata_json:
        step.metadata_json = {}

    if "fallback_records" not in step.metadata_json:
        step.metadata_json["fallback_records"] = []

    record = {
        "from_tier": from_tier,
        "to_tier": to_tier,
        "from_provider": from_provider,
        "to_provider": to_provider,
        "reason": reason,
        "trigger_gate": trigger_gate,
        "retry_count": retry_count,
        "scene_version_id": scene_version_id,
        "timestamp": datetime.utcnow().isoformat(),
    }

    step.metadata_json["fallback_records"].append(record)
    step.metadata_json["current_tier"] = to_tier
    step.metadata_json["current_provider"] = to_provider


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
            step.finished_at = datetime.utcnow()
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
        step.finished_at = datetime.utcnow()

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
                finished_at=datetime.utcnow(),
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

    job.finished_at = datetime.utcnow()


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

        # Real 模式：角色资产生成
        if step_def["key"] == "character_assets":
            # 从 scene 关联获取 character
            # 路径：scene -> episode -> project -> characters
            try:
                # 重新查询以获取完整的关联关系
                from sqlalchemy import select
                result = await db.execute(
                    select(Scene)
                    .options(
                        selectinload(Scene.episode).selectinload(Episode.project).selectinload(Project.characters)
                    )
                    .where(Scene.id == scene.id)
                )
                scene = result.scalar_one()

                # 获取 project 的 characters
                project = scene.episode.project
                characters = project.characters

                # 如果没有 character，步骤标记 skipped
                if not characters:
                    step.status = "skipped"
                    step.finished_at = datetime.utcnow()

                    _record_progress(_make_progress_event(
                        project_id=project_id,
                        episode_id=episode_id,
                        scene_id=scene.id,
                        scene_version_id=sv.id,
                        job_id=job.id,
                        step_key=step_def["key"],
                        job_status="running",
                        step_status="skipped",
                        progress_percent=step_end_percent,
                        message=f"跳过：{step_def['label']}（未找到角色）",
                    ))

                    await db.flush()
                    continue

                # 使用第一个 character（简化：一个 scene 只关联一个主角色）
                character = characters[0]

                # 获取参考图片路径（从 character.canonical_asset_id）
                if not character.canonical_asset_id:
                    step.status = "skipped"
                    step.finished_at = datetime.utcnow()

                    _record_progress(_make_progress_event(
                        project_id=project_id,
                        episode_id=episode_id,
                        scene_id=scene.id,
                        scene_version_id=sv.id,
                        job_id=job.id,
                        step_key=step_def["key"],
                        job_status="running",
                        step_status="skipped",
                        progress_percent=step_end_percent,
                        message=f"跳过：{step_def['label']}（角色无参考资产）",
                    ))

                    await db.flush()
                    continue

                # 获取参考图片 Asset
                ref_asset_result = await db.execute(
                    select(Asset).where(Asset.id == character.canonical_asset_id)
                )
                ref_asset = ref_asset_result.scalar_one_or_none()

                if not ref_asset:
                    step.status = "skipped"
                    step.finished_at = datetime.utcnow()

                    _record_progress(_make_progress_event(
                        project_id=project_id,
                        episode_id=episode_id,
                        scene_id=scene.id,
                        scene_version_id=sv.id,
                        job_id=job.id,
                        step_key=step_def["key"],
                        job_status="running",
                        step_status="skipped",
                        progress_percent=step_end_percent,
                        message=f"跳过：{step_def['label']}（参考资产未找到）",
                    ))

                    await db.flush()
                    continue

                # 解析参考图片路径（简化：从 URI 提取）
                ref_path = ref_asset.uri.replace("file://", "") if ref_asset.uri else ""

                if not ref_path:
                    step.status = "skipped"
                    step.finished_at = datetime.utcnow()

                    _record_progress(_make_progress_event(
                        project_id=project_id,
                        episode_id=episode_id,
                        scene_id=scene.id,
                        scene_version_id=sv.id,
                        job_id=job.id,
                        step_key=step_def["key"],
                        job_status="running",
                        step_status="skipped",
                        progress_percent=step_end_percent,
                        message=f"跳过：{step_def['label']}（参考图片路径无效）",
                    ))

                    await db.flush()
                    continue

                # 调用 CharacterGenerator().generate()
                character_gen = CharacterGenerator()
                asset = await character_gen.generate(
                    db=db,
                    character=character,
                    reference_image_path=ref_path,
                    scene_version=sv,
                    step=step,
                )
                step_assets["character"] = asset

                # 步骤成功
                duration = time.time() - start_time
                step.status = "completed"
                step.output_json = {"asset_id": asset.id}
                step.metadata_json = {
                    "duration": duration,
                    **asset.metadata_json,
                }
                step.finished_at = datetime.utcnow()

                # 执行 QA Gate（G2）
                if "character_assets" in QA_GATES:
                    gate_code = QA_GATES["character_assets"]
                    qa_gate = QAGate()

                    try:
                        qa_run = await qa_gate.run_gate(
                            db=db,
                            gate_code=gate_code,
                            subject_type="scene_version",
                            subject_id=sv.id,
                            input_asset_id=asset.id,
                            step_key=step_def["key"],
                            project_id=project_id,
                        )

                        if qa_run.status == "failed":
                            # QA 失败，任务失败
                            step.status = "failed"
                            step.error_message = f"QA Gate {gate_code} failed"
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
                                progress_percent=step_end_percent,
                                message=failed_message,
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

                    except Exception as e:
                        # QA Gate 执行异常，记录但继续（不中断流程）
                        print(f"[Orchestrator] QA Gate failed: {e}")

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

                await db.flush()
                continue

            except Exception as e:
                # 步骤失败
                step.status = "failed"
                step.error_message = str(e)
                step.metadata_json = step.metadata_json or {}
                step.metadata_json["error"] = {
                    "message": str(e),
                    "type": "character_generation_error",
                }
                step.finished_at = datetime.utcnow()
                has_failure = True
                failed_step_key = step_def["key"]
                failed_message = str(e)

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
                    message=failed_message,
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

        # Real 模式：执行真实步骤
        try:
            start_time = time.time()

            if step_def["key"] == "video_generation":
                # 视频生成
                video_gen = VideoGenerator()
                asset = await video_gen.generate(
                    db=db,
                    scene_version=sv,
                    prompt_bundle=sv.prompt_bundle or {},
                    step=step,
                )
                step_assets["video"] = asset

            elif step_def["key"] == "audio_generation":
                # =============================================================
                # 音频生成 — 配置继承接入点（来自 config_audio.py 三级继承）
                # 040a: voice/bgm/mix 配置真实从 config_audio.py 读取
                # =============================================================

                # 1. 解析三级继承音频配置
                voice_config = await resolve_voice_config(
                    db, project_id=project_id,
                    episode_id=episode_id, scene_version=sv,
                )
                bgm_config = await resolve_bgm_config(
                    db, project_id=project_id,
                    episode_id=episode_id, scene_version=sv,
                )
                mix_config = await resolve_mix_config(
                    db, project_id=project_id,
                    episode_id=episode_id, scene_version=sv,
                )

                # 缓存 mix_config，供 compose 步骤使用
                step_assets["mix_config"] = mix_config

                # 记录 resolved 配置到 step metadata
                step.metadata_json = step.metadata_json or {}
                step.metadata_json["resolved_voice_config"] = voice_config
                step.metadata_json["resolved_bgm_config"] = bgm_config
                step.metadata_json["resolved_mix_config"] = mix_config

                # 2. 生成语音（Voice TTS，走 ElevenLabs → Fish Audio fallback）
                audio_gen = AudioGenerator()
                text = sv.prompt_bundle.get("text", "Hello, this is a test.") if sv.prompt_bundle else "Hello, this is a test."

                voice_asset = await audio_gen.generate(
                    db=db,
                    scene_version=sv,
                    text=text,
                    voice_config=voice_config,
                    step=step,
                )
                step_assets["voice"] = voice_asset

                # 3. 生成 BGM（040a: mock placeholder，显式标注）
                bgm_asset = await audio_gen.generate_bgm(
                    db=db,
                    scene_version=sv,
                    bgm_config=bgm_config,
                    step=step,
                )
                step_assets["bgm"] = bgm_asset

                # 4. 创建响度检测证据资产
                loudness_asset = await audio_gen.create_loudness_asset(
                    db=db,
                    scene_version=sv,
                    voice_asset=voice_asset,
                    bgm_asset=bgm_asset,
                    step=step,
                )
                step_assets["loudness"] = loudness_asset

                # 5. 创建对齐报告证据资产
                alignment_asset = await audio_gen.create_alignment_asset(
                    db=db,
                    scene_version=sv,
                    voice_asset=voice_asset,
                    step=step,
                )
                step_assets["alignment"] = alignment_asset

                # 主资产为该步的 voice_asset（向后兼容 G8 QA）
                asset = voice_asset

            elif step_def["key"] == "compose":
                # 合成 — 使用 config_audio.py 的 mix_config
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
                    db=db,
                    scene_version=sv,
                    video_asset=video_asset,
                    audio_asset=voice_asset,
                    mix_config=mix_config,
                )
                step_assets["composed"] = asset

            elif step_def["key"] == "c2pa_sign":
                # C2PA 签名（非阻塞步骤）
                if not C2PASigner.check_c2patool_available():
                    # c2patool 不可用，跳过
                    step.status = "skipped"
                    step.finished_at = datetime.utcnow()

                    _record_progress(_make_progress_event(
                        project_id=project_id,
                        episode_id=episode_id,
                        scene_id=scene.id,
                        scene_version_id=sv.id,
                        job_id=job.id,
                        step_key=step_def["key"],
                        job_status="running",
                        step_status="skipped",
                        progress_percent=step_end_percent,
                        message=f"跳过：{step_def['label']}（c2patool 不可用）",
                    ))

                    await db.flush()
                    continue

                # 取 compose 的输出 asset
                compose_asset = step_assets.get("composed")
                if not compose_asset:
                    raise PipelineError(
                        message="No composed asset for C2PA signing",
                        error_type="provider_error",
                    )

                c2pa_signer = C2PASigner()
                asset = await c2pa_signer.sign(
                    db=db,
                    scene_version=sv,
                    input_asset=compose_asset,
                    step=step,
                )
                step_assets["c2pa_signed"] = asset

            elif step_def["key"] == "qa_check":
                # QA 检查（在前面每个步骤后已经调用，这里只是最后标记）
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
            step.metadata_json = {
                "duration": duration,
                **asset.metadata_json,
            }
            step.finished_at = datetime.utcnow()

            # 执行 QA Gate（除了 qa_check 步骤本身）
            if step_def["key"] in QA_GATES:
                gate_code = QA_GATES[step_def["key"]]
                qa_gate = QAGate()

                try:
                    qa_run = await qa_gate.run_gate(
                        db=db,
                        gate_code=gate_code,
                        subject_type="scene_version",
                        subject_id=sv.id,
                        input_asset_id=asset.id,
                        step_key=step_def["key"],
                        project_id=project_id,
                    )

                    if qa_run.status == "failed":
                        # QA 失败，任务失败
                        step.status = "failed"
                        step.error_message = f"QA Gate {gate_code} failed"
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
                            progress_percent=step_end_percent,
                            message=failed_message,
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

                except Exception as e:
                    # QA Gate 执行异常，记录但继续（不中断流程）
                    print(f"[Orchestrator] QA Gate failed: {e}")

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

        except PipelineError as e:
            # 步骤失败
            step.status = "failed"
            step.error_message = e.message
            step.metadata_json = step.metadata_json or {}
            step.metadata_json["error"] = {
                "message": e.message,
                "provider": e.provider,
                "error_type": e.error_type,
                "details": e.details,
            }
            step.finished_at = datetime.utcnow()
            has_failure = True
            failed_step_key = step_def["key"]
            failed_message = e.message

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
                message=failed_message,
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
        sv.score_snapshot = {"overall": 90}  # Real 模式简化
        # TODO: 从步骤汇总成本
        sv.cost_actual = 0.0
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

    job.finished_at = datetime.utcnow()


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
        "progress": get_job_latest_progress(job_id),
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
