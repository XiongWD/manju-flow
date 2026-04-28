"""Mock Pipeline Orchestrator — Phase 1.2 增强版

不依赖真实外部 API，用同步伪异步方式模拟完整流水线：
character_assets → video_generation → audio_generation → compose → qa_check

增强：
- 完整状态机：queued → running → completed / failed / skipped
- 进度百分比追踪
- 统一 ProgressEvent 结构（为 WS/轮询预留）
- 失败态语义完整：QA fail 导致 job failed
- 场景重跑：创建新 job + 新 scene_version，保留历史
- 取消支持（stub）
"""

import asyncio
import random
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    Asset,
    AssetLink,
    Job,
    JobStep,
    QAIssue,
    QARun,
    Scene,
    SceneVersion,
)

# Mock pipeline 步骤定义
PIPELINE_STEPS = [
    {"key": "character_assets", "label": "角色资产生成", "tool": "mock_character_gen"},
    {"key": "video_generation", "label": "视频生成", "tool": "mock_kling_api"},
    {"key": "audio_generation", "label": "音频生成", "tool": "mock_elevenlabs"},
    {"key": "compose", "label": "合成混音", "tool": "mock_ffmpeg"},
    {"key": "qa_check", "label": "质检检查", "tool": "mock_qa_gate"},
]

# Mock QA gate codes per step
QA_GATES = {
    "character_assets": "G2",
    "video_generation": "G6",
    "audio_generation": "G8",
    "compose": "G9",
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


def _record_progress(event: dict):
    """记录进度事件"""
    job_id = event["job_id"]
    if job_id not in _progress_events:
        _progress_events[job_id] = []
    _progress_events[job_id].append(event)


def get_job_progress(job_id: str) -> list[dict]:
    """获取 job 的进度时间线"""
    return _progress_events.get(job_id, [])


def get_job_latest_progress(job_id: str) -> Optional[dict]:
    """获取 job 的最新进度事件"""
    events = _progress_events.get(job_id, [])
    return events[-1] if events else None


async def start_mock_scene_job(
    db: AsyncSession,
    scene_id: str,
    project_id: str,
    episode_id: Optional[str] = None,
    parent_version_id: Optional[str] = None,
) -> Job:
    """创建并执行 mock 场景生产任务。

    支持：
    - 完整状态机流转：queued → running → completed / failed
    - 每步进度百分比
    - QA 失败时 job 设为 failed
    - parent_version_id 用于重跑（版本链追踪）
    """

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
        worker_type="mock",
        status="queued",
        metadata_json={
            "scene_no": scene.scene_no,
            "mode": "mock",
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
        change_reason="初始 mock 生产" if not parent_version_id else f"重跑（基于 v{max_ver}）",
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

    total_steps = len(PIPELINE_STEPS)
    has_failure = False
    failed_step_key = None
    failed_message = ""

    # 执行每个步骤
    for step_idx, step_def in enumerate(PIPELINE_STEPS):
        step = JobStep(
            id=_uuid(),
            job_id=job.id,
            step_key=step_def["key"],
            tool_name=step_def["tool"],
            input_json={"scene_id": scene_id, "scene_version_id": sv.id},
            status="queued",
        )
        db.add(step)
        await db.flush()

        step_base_percent = int((step_idx / total_steps) * 100)
        step_end_percent = int(((step_idx + 1) / total_steps) * 100)

        # 记录步骤开始
        _record_progress(_make_progress_event(
            project_id=project_id,
            episode_id=episode_id,
            scene_id=scene_id,
            scene_version_id=sv.id,
            job_id=job.id,
            step_key=step_def["key"],
            job_status="running",
            step_status="running",
            progress_percent=step_base_percent,
            message=f"正在执行：{step_def['label']}",
        ))

        # 标记步骤为 running
        step.status = "running"
        await db.flush()

        # Mock 延迟
        await asyncio.sleep(0.3)

        # 随机决定该步是否失败（15% 失败率，模拟真实场景）
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
                scene_id=scene_id,
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
                    input_json={"scene_id": scene_id, "scene_version_id": sv.id},
                    status="skipped",
                )
                db.add(skip_step)
            break

        # 步骤成功
        mock_uri = f"mock://assets/{step_def['key']}/{_uuid()[:8]}.dat"
        step.status = "completed"
        step.output_json = {"uri": mock_uri, "mock": True}
        step.finished_at = datetime.utcnow()

        # 创建 mock asset
        asset_type = {
            "character_assets": "character_ref",
            "video_generation": "video",
            "audio_generation": "audio",
            "compose": "mixed_audio",
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

        # 创建 asset_link
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

        # 记录步骤完成
        _record_progress(_make_progress_event(
            project_id=project_id,
            episode_id=episode_id,
            scene_id=scene_id,
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
        sv.status = "GENERATING"  # 未完成，保持 GENERATING
        scene.status = "DRAFT"  # 回到 DRAFT，等待重跑

        _record_progress(_make_progress_event(
            project_id=project_id,
            episode_id=episode_id,
            scene_id=scene_id,
            scene_version_id=sv.id,
            job_id=job.id,
            step_key=failed_step_key or "",
            job_status="failed",
            step_status="failed",
            progress_percent=job.progress_percent if hasattr(job, 'progress_percent') else 0,
            message=f"任务失败：{failed_message}",
        ))
    else:
        job.status = "completed"
        sv.status = "QA_PASSED"
        sv.score_snapshot = {"overall": random.uniform(80, 95)}
        sv.cost_actual = round(random.uniform(0.5, 3.5), 2)
        scene.status = "QA_PASSED"
        scene.locked_version_id = sv.id
        job.cost_actual = sv.cost_actual

        _record_progress(_make_progress_event(
            project_id=project_id,
            episode_id=episode_id,
            scene_id=scene_id,
            scene_version_id=sv.id,
            job_id=job.id,
            step_key="",
            job_status="completed",
            step_status="completed",
            progress_percent=100,
            message="任务完成",
        ))

    job.finished_at = datetime.utcnow()
    await db.commit()
    await db.refresh(job)
    return job


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
    return await start_mock_scene_job(
        db=db,
        scene_id=scene_id,
        project_id=project_id,
        episode_id=episode_id,
        parent_version_id=parent_version_id,
    )


async def cancel_job(db: AsyncSession, job_id: str) -> Optional[Job]:
    """取消任务（仅限 queued/running 状态）。

    生产环境需要实现真正的取消逻辑（kill worker task）。
    Mock 模式下只改状态。
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
