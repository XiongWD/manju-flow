"""状态传播服务

当子实体状态变更时，自动计算并更新父实体的聚合状态。

传播规则：
- Scene.shot_stage 变更 → 重新计算 Episode 状态
- Episode 状态变更 → 重新计算 Project 状态
"""

from __future__ import annotations

from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Scene, Episode, Project


# shot_stage 有序阶段列表（从早到晚）
_STAGE_ORDER = [
    "draft",
    "script_parsed",
    "still_generating",
    "still_review",
    "still_locked",
    "video_generating",
    "video_review",
    "video_locked",
    "compose_ready",
    "delivery",
]

_COMPLETED_STAGES = {"video_locked", "compose_ready", "delivery"}
_IN_PROGRESS_STAGES = {
    "still_generating", "still_review", "still_locked",
    "video_generating", "video_review",
}
_PENDING_STAGES = {"draft", "script_parsed"}


class StatusPropagationService:
    """状态传播服务"""

    async def propagate_scene_change(self, db: AsyncSession, scene_id: str):
        """Scene 状态变更后调用

        1. 查找所属 Episode
        2. 收集该 Episode 下所有 Scene
        3. 计算进度并更新 Episode 状态
        4. 触发 Episode → Project 传播
        """
        scene = await db.get(Scene, scene_id)
        if not scene:
            return None

        episode_id = scene.episode_id
        result = await self.propagate_episode_change(db, episode_id)
        return result

    async def propagate_episode_change(self, db: AsyncSession, episode_id: str):
        """Episode 状态变更后调用

        1. 收集该 Episode 下所有 Scene
        2. 计算进度并更新 Episode 状态
        3. 查找所属 Project
        4. 收集该 Project 下所有 Episode
        5. 计算进度并更新 Project 状态
        """
        # ── Episode 级别 ──
        episode = await db.get(Episode, episode_id)
        if not episode:
            return None

        scenes_result = await db.execute(
            select(Scene).where(Scene.episode_id == episode_id)
        )
        scenes = list(scenes_result.scalars().all())

        episode_progress = self._compute_episode_progress(scenes)
        new_episode_status = self._derive_episode_status(episode_progress)
        old_episode_status = episode.status

        if new_episode_status != old_episode_status:
            episode.status = new_episode_status

        # ── Project 级别 ──
        project_id = episode.project_id
        episodes_result = await db.execute(
            select(Episode).where(Episode.project_id == project_id)
        )
        episodes = list(episodes_result.scalars().all())

        project_progress = self._compute_project_progress(episodes)
        new_project_status = self._derive_project_status(project_progress)

        project = await db.get(Project, project_id)
        old_project_status = project.status if project else None
        if project and new_project_status != old_project_status:
            project.status = new_project_status

        await db.commit()

        return {
            "episode_id": episode_id,
            "episode_status": {"old": old_episode_status, "new": new_episode_status},
            "episode_progress": episode_progress,
            "project_id": project_id,
            "project_status": {"old": old_project_status, "new": new_project_status},
            "project_progress": project_progress,
        }

    def _compute_episode_progress(self, scenes: List[Scene]) -> dict:
        """计算剧集进度"""
        if not scenes:
            return {
                "total_scenes": 0,
                "completed_scenes": 0,
                "in_progress_scenes": 0,
                "pending_scenes": 0,
                "progress_percent": 0.0,
                "earliest_stage": None,
            }

        completed = 0
        in_progress = 0
        pending = 0
        earliest_idx = len(_STAGE_ORDER)  # 最大值，表示最晚

        for s in scenes:
            stage = s.shot_stage or "draft"
            stage_idx = _STAGE_ORDER.index(stage) if stage in _STAGE_ORDER else 0

            if stage in _COMPLETED_STAGES:
                completed += 1
            elif stage in _IN_PROGRESS_STAGES:
                in_progress += 1
            else:
                pending += 1

            if stage_idx < earliest_idx:
                earliest_idx = stage_idx

        total = len(scenes)
        return {
            "total_scenes": total,
            "completed_scenes": completed,
            "in_progress_scenes": in_progress,
            "pending_scenes": pending,
            "progress_percent": round(completed / total * 100, 1) if total > 0 else 0.0,
            "earliest_stage": _STAGE_ORDER[earliest_idx] if total > 0 else None,
        }

    def _compute_project_progress(self, episodes: List[Episode]) -> dict:
        """计算项目进度（基于 episode 状态汇总）"""
        if not episodes:
            return {
                "total_scenes": 0,
                "completed_scenes": 0,
                "in_progress_scenes": 0,
                "pending_scenes": 0,
                "progress_percent": 0.0,
                "earliest_stage": None,
            }

        # 简化：基于 episode.status 汇总
        # COMPLETED 的 episode 视为已完成
        completed_eps = sum(1 for e in episodes if e.status == "COMPLETED")
        in_progress_eps = sum(1 for e in episodes if e.status == "IN_PRODUCTION")
        total_eps = len(episodes)

        return {
            "total_scenes": total_eps,
            "completed_scenes": completed_eps,
            "in_progress_scenes": in_progress_eps,
            "pending_scenes": total_eps - completed_eps - in_progress_eps,
            "progress_percent": round(completed_eps / total_eps * 100, 1) if total_eps > 0 else 0.0,
            "earliest_stage": None,  # 项目级别无 shot_stage
        }

    def _derive_episode_status(self, progress: dict) -> str:
        """根据进度推导 episode 状态

        - all pending → "DRAFT"
        - any in_progress or mixed → "IN_PRODUCTION"
        - all completed → "COMPLETED"
        """
        total = progress["total_scenes"]
        if total == 0:
            return "DRAFT"

        if progress["completed_scenes"] == total:
            return "COMPLETED"
        if progress["in_progress_scenes"] > 0:
            return "IN_PRODUCTION"
        # 有 completed + pending 的混合情况也算 IN_PRODUCTION
        if progress["completed_scenes"] > 0:
            return "IN_PRODUCTION"
        return "DRAFT"

    def _derive_project_status(self, progress: dict) -> str:
        """根据进度推导 project 状态（同 episode 逻辑）"""
        total = progress["total_scenes"]
        if total == 0:
            return "DRAFT"

        if progress["completed_scenes"] == total:
            return "COMPLETED"
        if progress["in_progress_scenes"] > 0:
            return "IN_PRODUCTION"
        if progress["completed_scenes"] > 0:
            return "IN_PRODUCTION"
        return "DRAFT"
