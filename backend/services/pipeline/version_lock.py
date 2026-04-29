"""Version Lock Service — Phase 2a (039a)

版本锁定服务：
- 防止 fallback 静默覆盖 locked version
- 提供 READY_TO_LOCK 候选状态
- 提供显式 lock 切换接口
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Scene, SceneVersion


class VersionLockService:
    """版本锁定服务"""

    @staticmethod
    def can_safely_update_locked_version(scene: Scene, new_version_id: str) -> tuple[bool, str]:
        """检查是否可以安全更新 locked_version_id

        规则：
        1. 如果 scene 没有 locked_version_id，可以设置
        2. 如果 scene 有 locked_version_id，只有显式确认才能更新
        3. Fallback 生成的版本不得静默覆盖 locked version

        Args:
            scene: 场景对象
            new_version_id: 欲设置的版本 ID

        Returns:
            tuple[bool, str]: (是否允许, 原因)
        """
        # 没有 locked version，可以设置
        if not scene.locked_version_id:
            return (True, "No locked version, can set")

        # 已有 locked version，不允许静默覆盖
        if scene.locked_version_id != new_version_id:
            return (
                False,
                f"Cannot silently override locked version {scene.locked_version_id[:8]} "
                f"with new version {new_version_id[:8]}. "
                "Use explicit lock API with user confirmation."
            )

        # 同一个 version，允许（幂等）
        return (True, "Same version, idempotent")

    @staticmethod
    async def set_scene_version_ready_to_lock(
        db: AsyncSession,
        scene_version_id: str,
    ) -> Optional[SceneVersion]:
        """将 scene_version 设置为 READY_TO_LOCK 状态

        Args:
            db: 数据库 session
            scene_version_id: 场景版本 ID

        Returns:
            SceneVersion: 更新后的场景版本（如果存在）
        """
        sv = await db.get(SceneVersion, scene_version_id)
        if not sv:
            return None

        # 只有 QA_PASSED 状态才能进入 READY_TO_LOCK
        if sv.status != "QA_PASSED":
            raise ValueError(
                f"Cannot set version {scene_version_id} to READY_TO_LOCK: "
                f"current status is {sv.status}, must be QA_PASSED"
            )

        sv.status = "READY_TO_LOCK"
        sv.updated_at = datetime.utcnow()
        await db.flush()

        return sv

    @staticmethod
    async def explicit_lock_version(
        db: AsyncSession,
        scene_id: str,
        scene_version_id: str,
        force: bool = False,
    ) -> Scene:
        """显式锁定场景版本（需要人工确认）

        Args:
            db: 数据库 session
            scene_id: 场景 ID
            scene_version_id: 欲锁定的版本 ID
            force: 是否强制覆盖（仅用于管理员操作）

        Returns:
            Scene: 更新后的场景

        Raises:
            ValueError: 版本不存在或状态不正确
            PermissionError: 静默覆盖锁定版本
        """
        scene = await db.get(Scene, scene_id)
        if not scene:
            raise ValueError(f"Scene {scene_id} not found")

        sv = await db.get(SceneVersion, scene_version_id)
        if not sv:
            raise ValueError(f"SceneVersion {scene_version_id} not found")

        # 验证版本属于该场景
        if sv.scene_id != scene_id:
            raise ValueError(
                f"SceneVersion {scene_version_id} does not belong to Scene {scene_id}"
            )

        # 检查状态：必须是 QA_PASSED 或 READY_TO_LOCK
        if sv.status not in ("QA_PASSED", "READY_TO_LOCK"):
            raise ValueError(
                f"Cannot lock version with status {sv.status}. "
                "Must be QA_PASSED or READY_TO_LOCK"
            )

        # 检查是否可以安全更新
        can_update, reason = VersionLockService.can_safely_update_locked_version(
            scene, scene_version_id
        )

        if not can_update and not force:
            raise PermissionError(reason)

        # 更新锁定版本
        scene.locked_version_id = scene_version_id
        scene.updated_at = datetime.utcnow()

        # 更新 scene_version 状态为 LOCKED
        sv.status = "LOCKED"
        sv.updated_at = datetime.utcnow()

        await db.flush()

        return scene

    @staticmethod
    async def get_scene_version_tree(
        db: AsyncSession,
        scene_id: str,
    ) -> list[dict]:
        """获取场景版本树（含 fallback 记录）

        Args:
            db: 数据库 session
            scene_id: 场景 ID

        Returns:
            list[dict]: 版本树列表（按 version_no 升序）
        """
        from sqlalchemy import func
        from database.models import JobStep

        # 获取所有版本
        result = await db.execute(
            select(SceneVersion)
            .where(SceneVersion.scene_id == scene_id)
            .order_by(SceneVersion.version_no.asc())
        )
        versions = result.scalars().all()

        tree = []
        for sv in versions:
            # 获取所有关联的 job_steps，提取 fallback_records
            steps_result = await db.execute(
                select(JobStep).where(JobStep.metadata_json["scene_version_id"].astext == sv.id)
            )
            steps = steps_result.scalars().all()

            fallback_records = []
            for step in steps:
                if step.metadata_json and "fallback_records" in step.metadata_json:
                    records = step.metadata_json["fallback_records"]
                    if isinstance(records, list):
                        fallback_records.extend(records)

            tree.append({
                "id": sv.id,
                "version_no": sv.version_no,
                "parent_version_id": sv.parent_version_id,
                "status": sv.status,
                "prompt_bundle": sv.prompt_bundle,
                "model_bundle": sv.model_bundle,
                "params": sv.params,
                "change_reason": sv.change_reason,
                "score_snapshot": sv.score_snapshot,
                "cost_actual": sv.cost_actual,
                "created_at": sv.created_at.isoformat() if sv.created_at else None,
                "updated_at": sv.updated_at.isoformat() if sv.updated_at else None,
                "fallback_records": fallback_records,
            })

        return tree

    @staticmethod
    async def rework_scene_version(
        db: AsyncSession,
        scene_id: str,
        scene_version_id: str,
        change_reason: str,
        project_id: str,
        episode_id: Optional[str] = None,
    ) -> tuple:
        """局部返修：从指定版本派生新版本（042a）

        基于指定的 scene_version 创建新版本链：
n        - 新版本的 parent_version_id 指向基准版本
        - change_reason 记录返修原因
        - 触发新的 job 执行

        Args:
            db: 数据库 session
            scene_id: 场景 ID
            scene_version_id: 基准版本 ID
            change_reason: 返修原因
            project_id: 项目 ID
            episode_id: 剧集 ID

        Returns:
            tuple[Job, SceneVersion]: (新 job, 新 scene_version)

        Raises:
            ValueError: 版本不存在或不属于该场景
        """
        from services.pipeline.orchestrator import start_scene_job
        from sqlalchemy import func

        scene = await db.get(Scene, scene_id)
        if not scene:
            raise ValueError(f"Scene {scene_id} not found")

        base_sv = await db.get(SceneVersion, scene_version_id)
        if not base_sv:
            raise ValueError(f"SceneVersion {scene_version_id} not found")

        if base_sv.scene_id != scene_id:
            raise ValueError(
                f"SceneVersion {scene_version_id} does not belong to Scene {scene_id}"
            )

        # 计算新版本号
        max_no_result = await db.execute(
            select(func.max(SceneVersion.version_no)).where(
                SceneVersion.scene_id == scene_id
            )
        )
        max_no = max_no_result.scalar() or 0
        new_version_no = max_no + 1

        # 创建新 scene_version
        new_sv = SceneVersion(
            scene_id=scene_id,
            parent_version_id=scene_version_id,
            version_no=new_version_no,
            prompt_bundle=base_sv.prompt_bundle,
            model_bundle=base_sv.model_bundle,
            params=base_sv.params,
            change_reason=change_reason,
            status="GENERATING",
        )
        db.add(new_sv)
        await db.flush()

        # 启动新 job
        job = await start_scene_job(
            db=db,
            scene_id=scene_id,
            project_id=project_id,
            episode_id=episode_id,
            parent_version_id=new_sv.id,
        )

        return (job, new_sv)

    @staticmethod
    async def get_version_diff(
        db: AsyncSession,
        scene_id: str,
        version_a_id: str,
        version_b_id: str,
    ) -> dict:
        """版本对比（042a）

        比较两个场景版本的差异，返回字段级 diff。

        Args:
            db: 数据库 session
            scene_id: 场景 ID
            version_a_id: 版本 A ID
            version_b_id: 版本 B ID

        Returns:
            dict: 包含两个版本详情和字段级差异
        """
        sv_a = await db.get(SceneVersion, version_a_id)
        sv_b = await db.get(SceneVersion, version_b_id)

        if not sv_a:
            raise ValueError(f"Version A {version_a_id} not found")
        if not sv_b:
            raise ValueError(f"Version B {version_b_id} not found")
        if sv_a.scene_id != scene_id:
            raise ValueError(f"Version A does not belong to scene {scene_id}")
        if sv_b.scene_id != scene_id:
            raise ValueError(f"Version B does not belong to scene {scene_id}")

        # 定义要对比的字段
        diff_fields = [
            ("prompt_bundle", "Prompt 配置"),
            ("model_bundle", "模型配置"),
            ("params", "生成参数"),
            ("status", "状态"),
            ("score_snapshot", "QA 评分"),
            ("cost_actual", "实际成本"),
            ("change_reason", "变更原因"),
        ]

        diffs = []
        changed_fields = []
        for field, label in diff_fields:
            val_a = getattr(sv_a, field)
            val_b = getattr(sv_b, field)
            changed = val_a != val_b
            diffs.append({
                "field": field,
                "label": label,
                "value_a": val_a,
                "value_b": val_b,
                "changed": changed,
            })
            if changed:
                changed_fields.append(field)

        return {
            "version_a": {
                "id": sv_a.id,
                "version_no": sv_a.version_no,
                "parent_version_id": sv_a.parent_version_id,
                "status": sv_a.status,
                "prompt_bundle": sv_a.prompt_bundle,
                "model_bundle": sv_a.model_bundle,
                "params": sv_a.params,
                "change_reason": sv_a.change_reason,
                "score_snapshot": sv_a.score_snapshot,
                "cost_actual": sv_a.cost_actual,
                "created_at": sv_a.created_at.isoformat() if sv_a.created_at else None,
                "updated_at": sv_a.updated_at.isoformat() if sv_a.updated_at else None,
                "fallback_records": [],
            },
            "version_b": {
                "id": sv_b.id,
                "version_no": sv_b.version_no,
                "parent_version_id": sv_b.parent_version_id,
                "status": sv_b.status,
                "prompt_bundle": sv_b.prompt_bundle,
                "model_bundle": sv_b.model_bundle,
                "params": sv_b.params,
                "change_reason": sv_b.change_reason,
                "score_snapshot": sv_b.score_snapshot,
                "cost_actual": sv_b.cost_actual,
                "created_at": sv_b.created_at.isoformat() if sv_b.created_at else None,
                "updated_at": sv_b.updated_at.isoformat() if sv_b.updated_at else None,
                "fallback_records": [],
            },
            "diffs": diffs,
            "changed_fields": changed_fields,
        }

    @staticmethod
    async def get_fallback_history(
        db: AsyncSession,
        scene_id: str,
    ) -> list[dict]:
        """获取场景的 fallback 历史（从所有 job_steps 提取）

        Args:
            db: 数据库 session
            scene_id: 场景 ID

        Returns:
            list[dict]: fallback 历史记录（按时间降序）
        """
        from database.models import JobStep, Job

        # 获取场景的所有 jobs
        jobs_result = await db.execute(
            select(Job).where(Job.target_id == scene_id, Job.target_type == "scene")
        )
        jobs = jobs_result.scalars().all()

        all_fallbacks = []
        for job in jobs:
            # 获取该 job 的所有 steps
            steps_result = await db.execute(
                select(JobStep).where(JobStep.job_id == job.id)
            )
            steps = steps_result.scalars().all()

            for step in steps:
                if step.metadata_json and "fallback_records" in step.metadata_json:
                    records = step.metadata_json["fallback_records"]
                    if isinstance(records, list):
                        all_fallbacks.extend(records)

        # 按 timestamp 降序
        all_fallbacks.sort(
            key=lambda x: x.get("timestamp", ""),
            reverse=True,
        )

        return all_fallbacks
