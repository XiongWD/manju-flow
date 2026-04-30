"""Pipeline 状态管理 — 进度事件追踪、辅助函数

从 orchestrator.py Phase 5 拆分：
- 进度事件构建、记录、持久化
- WebSocket 广播回调
- Job 进度查询
- Tier/Provider 辅助函数
- Fallback 记录
"""

import asyncio
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import async_session_factory
from database.models import JobEvent, JobStep

from .config import TIER_PROVIDER_MAP


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


# ── 进度存储（内存缓存 + DB 持久化） ──
_progress_events: dict[str, list[dict]] = {}  # job_id -> [events]  # 内存缓存

# WebSocket 广播回调（由 main.py 注册）
_progress_callback: Optional[callable] = None


def register_progress_callback(callback: callable):
    """注册进度广播回调（用于 WebSocket）"""
    global _progress_callback
    _progress_callback = callback


async def _persist_event_to_db(event: dict):
    """将进度事件异步写入数据库（fire-and-forget）"""
    try:
        async with async_session_factory() as session:
            db_event = JobEvent(
                job_id=event.get("job_id", ""),
                event_type=event.get("event_type", "progress"),
                step_key=event.get("step_key"),
                job_status=event.get("job_status"),
                step_status=event.get("step_status"),
                progress_percent=event.get("progress_percent"),
                message=event.get("message"),
                payload_json=event.get("payload"),
            )
            session.add(db_event)
            await session.commit()
    except Exception as e:
        print(f"[Orchestrator] Failed to persist progress event to DB: {e}")


def _record_progress(event: dict):
    """记录进度事件：写内存缓存 + 异步写 DB + 触发广播"""
    job_id = event["job_id"]

    # 1. 写入内存缓存
    if job_id not in _progress_events:
        _progress_events[job_id] = []
    _progress_events[job_id].append(event)

    # 2. 异步写入数据库（fire-and-forget，失败不影响主流程）
    try:
        loop = asyncio.get_running_loop()
        asyncio.ensure_future(_persist_event_to_db(event))
    except RuntimeError:
        # 没有运行中的 event loop（纯 sync 上下文），打印 warning
        print(f"[Orchestrator] WARNING: no event loop, skipping DB persist for job={job_id}")

    # 3. 触发 WebSocket 广播
    if _progress_callback:
        try:
            asyncio.ensure_future(_progress_callback(event))
        except Exception as e:
            # 广播失败不影响主流程
            print(f"[Orchestrator] Progress callback failed: {e}")


async def get_job_progress(job_id: str) -> list[dict]:
    """获取 job 的进度时间线（DB 优先，内存 fallback）"""
    try:
        async with async_session_factory() as session:
            from sqlalchemy import select
            result = await session.execute(
                select(JobEvent).where(JobEvent.job_id == job_id).order_by(JobEvent.created_at.asc())
            )
            db_events = result.scalars().all()
            if db_events:
                return [
                    {
                        "id": e.id,
                        "job_id": e.job_id,
                        "event_type": e.event_type,
                        "step_key": e.step_key,
                        "job_status": e.job_status,
                        "step_status": e.step_status,
                        "progress_percent": e.progress_percent,
                        "message": e.message,
                        "payload": e.payload_json,
                        "timestamp": e.created_at.isoformat() if e.created_at else None,
                    }
                    for e in db_events
                ]
    except Exception as e:
        print(f"[Orchestrator] Failed to read progress from DB, falling back to memory: {e}")
    return _progress_events.get(job_id, [])


async def get_job_latest_progress(job_id: str) -> Optional[dict]:
    """获取 job 的最新进度事件（DB 优先，内存 fallback）"""
    try:
        async with async_session_factory() as session:
            from sqlalchemy import select
            result = await session.execute(
                select(JobEvent).where(JobEvent.job_id == job_id).order_by(JobEvent.created_at.desc()).limit(1)
            )
            db_event = result.scalar_one_or_none()
            if db_event:
                return {
                    "id": db_event.id,
                    "job_id": db_event.job_id,
                    "event_type": db_event.event_type,
                    "step_key": db_event.step_key,
                    "job_status": db_event.job_status,
                    "step_status": db_event.step_status,
                    "progress_percent": db_event.progress_percent,
                    "message": db_event.message,
                    "payload": db_event.payload_json,
                    "timestamp": db_event.created_at.isoformat() if db_event.created_at else None,
                }
    except Exception as e:
        print(f"[Orchestrator] Failed to read latest progress from DB, falling back to memory: {e}")
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
