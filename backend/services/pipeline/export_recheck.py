"""Export Recheck — 042c

导出后重验最小闭环：
1. 从 delivery_package 收集资产
2. 对每个资产执行 RuleExecutor（目标平台规则）
3. 将重验结果写入 qa_runs + qa_issues（gate_code=EXPORT_RECHECK）
4. 回写 delivery_package / publish_variant / publish_job 关联链

不做：
- 不做复杂导出编排
- 不调 ffmpeg / ffprobe / 外部 API
- 不做前端报告页
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    Asset,
    AssetLink,
    DeliveryPackage,
    PublishJob,
    PublishVariant,
    QAIssue,
    QARun,
)
from services.pipeline.rule_executor import RuleExecutor

logger = logging.getLogger(__name__)

# Gate code for export recheck
GATE_CODE = "EXPORT_RECHECK"


class ExportRechecker:
    """导出后重验器

    对 delivery_package 内资产重新执行平台规则检查，
    结果写入 qa_runs/qa_issues 并关联到 delivery 链。
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.executor = RuleExecutor()

    async def recheck_package(
        self,
        delivery_package_id: str,
        platform: Optional[str] = None,
    ) -> dict[str, Any]:
        """对交付包执行导出后重验

        Args:
            delivery_package_id: 交付包 ID
            platform: 目标平台（不传则从关联的 publish_variant 推断）

        Returns:
            dict: {
                "delivery_package_id": str,
                "qa_run_ids": list[str],
                "overall_status": "passed" | "failed" | "needs_review" | "no_assets",
                "total_assets_checked": int,
                "summary": {passed: int, failed: int, needs_review: int},
                "publish_job_id": str | None,
            }
        """
        # 1. 获取 delivery_package
        pkg = await self.db.get(DeliveryPackage, delivery_package_id)
        if not pkg:
            raise ValueError(f"DeliveryPackage not found: {delivery_package_id}")

        # 2. 推断平台
        if not platform:
            platform = await self._infer_platform(pkg)

        # 3. 收集资产
        asset_ids = await self._collect_asset_ids(delivery_package_id)
        if not asset_ids:
            logger.warning("No assets in delivery package %s, skipping recheck", delivery_package_id)
            return {
                "delivery_package_id": delivery_package_id,
                "qa_run_ids": [],
                "overall_status": "no_assets",
                "total_assets_checked": 0,
                "summary": {"passed": 0, "failed": 0, "needs_review": 0},
                "publish_job_id": pkg.publish_job_id,
            }

        # 4. 逐资产执行规则检查
        qa_run_ids: list[str] = []
        all_results: list[dict[str, Any]] = []
        status_counts = {"passed": 0, "failed": 0, "needs_review": 0}

        for asset_id in asset_ids:
            result = await self.executor.execute_rules(
                db=self.db,
                platform=platform or "tiktok",
                subject_type="delivery_package",
                subject_id=delivery_package_id,
                project_id=pkg.project_id,
                input_asset_id=asset_id,
                step_key="export_recheck",
            )

            qa_run_id = result.get("qa_run_id")
            if qa_run_id:
                qa_run_ids.append(qa_run_id)
                # 给 qa_run 打上 EXPORT_RECHECK gate_code
                await self._tag_qa_run(qa_run_id, delivery_package_id, platform)

            status = result.get("status", "no_rules")
            if status in status_counts:
                status_counts[status] += 1
            all_results.append(result)

        # 5. 判定总体状态
        if status_counts["failed"] > 0:
            overall_status = "failed"
        elif status_counts["needs_review"] > 0:
            overall_status = "needs_review"
        elif status_counts["passed"] > 0:
            overall_status = "passed"
        else:
            overall_status = "no_assets"

        # 6. 回写 delivery_package 的 manifest_json（附加 recheck 结果）
        manifest = pkg.manifest_json or {}
        manifest["recheck"] = {
            "platform": platform,
            "overall_status": overall_status,
            "qa_run_ids": qa_run_ids,
            "status_counts": status_counts,
            "checked_at": datetime.utcnow().isoformat(),
        }
        pkg.manifest_json = manifest

        # 7. 回写 publish_job（如果有关联）
        if pkg.publish_job_id:
            await self._backfill_publish_job(
                pkg.publish_job_id, overall_status, qa_run_ids, platform
            )

        # 8. 回写 publish_variant（如果有关联）
        await self._backfill_variants(
            delivery_package_id, overall_status, qa_run_ids
        )

        await self.db.flush()
        logger.info(
            "Export recheck completed: pkg=%s, platform=%s, status=%s, assets=%d",
            delivery_package_id, platform, overall_status, len(asset_ids),
        )

        return {
            "delivery_package_id": delivery_package_id,
            "qa_run_ids": qa_run_ids,
            "overall_status": overall_status,
            "total_assets_checked": len(asset_ids),
            "summary": status_counts,
            "publish_job_id": pkg.publish_job_id,
        }

    # ── 内部方法 ────────────────────────────────────────────

    async def _collect_asset_ids(self, delivery_package_id: str) -> list[str]:
        """收集交付包内的资产 ID"""
        stmt = select(AssetLink.asset_id).where(
            AssetLink.owner_type == "delivery_package",
            AssetLink.owner_id == delivery_package_id,
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _infer_platform(self, pkg: DeliveryPackage) -> Optional[str]:
        """从关联的 publish_variant 推断平台"""
        stmt = select(PublishVariant.platform).where(
            PublishVariant.delivery_package_id == pkg.id,
        ).limit(1)
        result = await self.db.execute(stmt)
        platform = result.scalar_one_or_none()
        return platform

    async def _tag_qa_run(
        self,
        qa_run_id: str,
        delivery_package_id: str,
        platform: Optional[str],
    ) -> None:
        """将 qa_run 标记为 EXPORT_RECHECK 并关联 delivery_package"""
        qa_run = await self.db.get(QARun, qa_run_id)
        if not qa_run:
            return

        qa_run.gate_code = GATE_CODE
        qa_run.step_key = "export_recheck"

        # 在 threshold_snapshot 中记录关联
        snapshot = qa_run.threshold_snapshot or {}
        snapshot["delivery_package_id"] = delivery_package_id
        snapshot["platform"] = platform
        snapshot["recheck_type"] = "post_export"
        qa_run.threshold_snapshot = snapshot

        # 创建 asset_link 关联 delivery_package → qa_run
        link = AssetLink(
            id=hashlib.sha256(
                f"{delivery_package_id}_{qa_run_id}_recheck".encode()
            ).hexdigest()[:32],
            asset_id=qa_run.evidence_asset_id or qa_run_id,
            owner_type="delivery_package",
            owner_id=delivery_package_id,
            relation_type="qa_recheck",
        )
        self.db.add(link)

    async def _backfill_publish_job(
        self,
        publish_job_id: str,
        overall_status: str,
        qa_run_ids: list[str],
        platform: Optional[str],
    ) -> None:
        """回写发布任务的 payload_json（附加重验结果）"""
        job = await self.db.get(PublishJob, publish_job_id)
        if not job:
            return

        payload = job.payload_json or {}
        payload["export_recheck"] = {
            "status": overall_status,
            "qa_run_ids": qa_run_ids,
            "platform": platform,
            "checked_at": datetime.utcnow().isoformat(),
        }
        job.payload_json = payload

    async def _backfill_variants(
        self,
        delivery_package_id: str,
        overall_status: str,
        qa_run_ids: list[str],
    ) -> None:
        """回写平台变体的 metadata_json（附加重验结果）"""
        stmt = select(PublishVariant).where(
            PublishVariant.delivery_package_id == delivery_package_id,
        )
        result = await self.db.execute(stmt)
        variants = result.scalars().all()

        for variant in variants:
            meta = variant.metadata_json or {}
            meta["export_recheck"] = {
                "status": overall_status,
                "qa_run_ids": qa_run_ids,
                "checked_at": datetime.utcnow().isoformat(),
            }
            variant.metadata_json = meta
