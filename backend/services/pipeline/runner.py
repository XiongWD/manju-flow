"""后台任务执行器 — 将 pipeline 执行从 API 请求生命周期中解耦

用法：
    from services.pipeline.runner import submit_scene_job_bg
    asyncio.create_task(submit_scene_job_bg(scene_id, project_id))
"""

import asyncio
import logging
import traceback
from typing import Optional

logger = logging.getLogger(__name__)

from database.connection import async_session_factory
from database.models import Scene
from .orchestrator import start_scene_job


# shot_stage 中 still_locked 及之后的状态索引
_STILL_LOCKED_AND_AFTER = {
    "still_locked", "video_generating", "video_review",
    "video_locked", "compose_ready", "delivery",
}


def check_still_locked(scene: Scene) -> bool:
    """检查场景是否有锁定的静帧（shot_stage >= still_locked）"""
    return scene.shot_stage in _STILL_LOCKED_AND_AFTER and bool(scene.locked_still_id)


async def submit_scene_job_bg(
    scene_id: str,
    project_id: str,
    episode_id: Optional[str] = None,
    parent_version_id: Optional[str] = None,
) -> None:
    """在后台执行完整的 scene 生产 pipeline，自带独立 db session。

    必须通过 asyncio.create_task() 调用，不要直接 await。
    """
    async with async_session_factory() as db:
        try:
            # 阻断检查：scene 必须有锁定的静帧
            scene = await db.get(Scene, scene_id)
            if scene and not check_still_locked(scene):
                logger.warning(
                    "Scene %s has no locked still, cannot submit video generation. "
                    "Please complete still review first (current shot_stage=%s)",
                    scene_id, scene.shot_stage,
                )
                return

            await start_scene_job(
                db=db,
                scene_id=scene_id,
                project_id=project_id,
                episode_id=episode_id,
                parent_version_id=parent_version_id,
            )
        except Exception as e:
            logger.error("Background scene job failed: scene=%s error=%s", scene_id, e, exc_info=True)
