"""Platform Rule Executor — 041a.2 Phase

最小闭环：
1. 加载规则（RuleLoader）
2. 执行自动规则（基于 asset 元数据，不调 ffmpeg/probeff）
3. 人工规则 → MANUAL_REVIEW_REQUIRED 待审记录
4. 结果写入 qa_runs + qa_issues

不做：
- 不调 ffmpeg / ffprobe / 外部 API
- 不做合规标注资产化（041a.3）
- 不做前端报告页（041a.4）
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Asset, AssetLink, QAIssue, QARun
from services.pipeline.rules import RuleLoader, is_auto_rule


class RuleExecutor:
    """平台规则执行器 — 041a.2

    职责：
    1. 从 RuleLoader 加载平台规则
    2. 对自动规则执行检查（基于 asset 元数据）
    3. 对人工规则生成 MANUAL_REVIEW_REQUIRED 待审记录
    4. 将结果写入 qa_runs + qa_issues

    用法::

        executor = RuleExecutor()
        result = await executor.execute_rules(
            db=db,
            platform="tiktok",
            subject_type="asset",
            subject_id=asset_id,
            project_id=project_id,
            input_asset_id=asset_id,
        )
    """

    # Gate code 用于 qa_runs 记录
    GATE_CODE = "RULE"

    def __init__(self, loader: Optional[RuleLoader] = None):
        self.loader = loader or RuleLoader()

    # ── 主入口 ──────────────────────────────────────────────

    async def execute_rules(
        self,
        db: AsyncSession,
        *,
        platform: str,
        subject_type: str,
        subject_id: str,
        project_id: Optional[str] = None,
        input_asset_id: Optional[str] = None,
        step_key: Optional[str] = None,
    ) -> dict[str, Any]:
        """执行平台规则检查（最小闭环）

        Args:
            db: 数据库 session
            platform: 目标平台 (tiktok/douyin/youtube)
            subject_type: 检查对象类型 (asset/scene_version/episode/publish_bundle)
            subject_id: 检查对象 ID
            project_id: 项目 ID（可选）
            input_asset_id: 输入资产 ID（可选）
            step_key: 关联步骤 key（可选）

        Returns:
            dict: {
                "qa_run_id": str,
                "status": "passed" | "failed" | "needs_review",
                "total_rules": int,
                "auto_passed": int,
                "auto_failed": int,
                "manual_review": int,
                "results": list[dict],
            }
        """
        # 1. 加载规则
        all_rules = await self.loader.load_rules(
            platform=platform,
            subject_type=subject_type,
        )

        if not all_rules:
            return self._empty_result("no_rules", platform, subject_type, subject_id)

        # 2. 获取 asset（如果提供了 input_asset_id）
        asset = None
        if input_asset_id:
            asset = await db.get(Asset, input_asset_id)
        if not project_id and asset:
            project_id = asset.project_id

        # 3. 分离自动规则和人工规则
        auto_rules = [r for r in all_rules if r.get("auto_checkable", False)]
        manual_rules = [r for r in all_rules if r.get("manual_review_required", False)]

        # 4. 执行自动规则
        auto_results: list[dict[str, Any]] = []
        for rule in auto_rules:
            result = self._execute_auto_rule(rule, asset)
            auto_results.append(result)

        # 5. 人工规则 → 待审记录
        manual_results: list[dict[str, Any]] = []
        for rule in manual_rules:
            manual_results.append({
                "rule_id": rule["rule_id"],
                "check_type": rule.get("check_type", "unknown"),
                "passed": None,
                "severity": rule.get("severity", "FLAG"),
                "auto_checkable": False,
                "manual_review_required": True,
                "message": rule.get("failure_message", "需要人工审核"),
            })

        # 6. 汇总
        auto_passed = sum(1 for r in auto_results if r["passed"])
        auto_failed = sum(1 for r in auto_results if not r["passed"])
        manual_review = len(manual_results)
        total = len(auto_results) + manual_review

        # 判定状态
        if auto_failed > 0:
            # 有自动规则失败 → failed（BLOCK 规则）或 needs_review（FLAG 规则）
            has_block_failure = any(
                r["severity"] == "BLOCK" and not r["passed"]
                for r in auto_results
            )
            status = "failed" if has_block_failure else "needs_review"
        elif manual_review > 0:
            status = "needs_review"
        else:
            status = "passed"

        # 7. 写入 qa_runs + qa_issues
        qa_run_id, issue_ids = await self._persist_results(
            db=db,
            platform=platform,
            subject_type=subject_type,
            subject_id=subject_id,
            project_id=project_id,
            input_asset_id=input_asset_id,
            step_key=step_key or "rule_check",
            status=status,
            auto_results=auto_results,
            manual_results=manual_results,
        )

        return {
            "qa_run_id": qa_run_id,
            "status": status,
            "total_rules": total,
            "auto_passed": auto_passed,
            "auto_failed": auto_failed,
            "manual_review": manual_review,
            "results": auto_results + manual_results,
            "qa_issue_ids": issue_ids,
        }

    # ── 自动规则执行 ────────────────────────────────────────

    def _execute_auto_rule(
        self,
        rule: dict[str, Any],
        asset: Optional[Asset],
    ) -> dict[str, Any]:
        """执行单个自动规则（基于 asset 元数据）

        注意：041a.2 阶段只做元数据级检查，不调外部工具。
        - file_exists: 检查 asset.uri 非空
        - duration: 检查 asset.duration 是否在阈值内
        - resolution: 检查 asset.width/height 是否满足阈值
        - loudness: 检查 asset.metadata_json 中的 loudness
        - subtitle_safety: 检查 asset.metadata_json 中的 safe_zone
        - c2pa_manifest: 检查 asset.metadata_json 中的 c2pa

        后续阶段可接入 ffprobe / 实际文件检查。
        """
        check_type = rule.get("check_type", "")
        threshold = rule.get("threshold", {})

        # 从 asset 提取元数据
        meta = {}
        if asset and asset.metadata_json:
            meta = asset.metadata_json

        if check_type == "file_exists":
            passed = bool(asset and asset.uri and asset.uri.strip())
            evidence = {"uri": asset.uri if asset else None}

        elif check_type == "duration":
            duration = asset.duration if asset else 0
            min_dur = threshold.get("min_duration", 0)
            max_dur = threshold.get("max_duration", float("inf"))
            passed = min_dur <= duration <= max_dur
            evidence = {"duration": duration, "min": min_dur, "max": max_dur}

        elif check_type == "resolution":
            width = asset.width if asset else 0
            height = asset.height if asset else 0
            min_w = threshold.get("min_width", 0)
            min_h = threshold.get("min_height", 0)
            passed = width >= min_w and height >= min_h

            # 宽高比检查
            aspect_ratio = threshold.get("aspect_ratio")
            if aspect_ratio and passed:
                passed = self._check_aspect_ratio(width, height, aspect_ratio)

            # FPS 检查
            min_fps = threshold.get("min_fps", 0)
            if min_fps and passed:
                fps = meta.get("fps", 0)
                passed = fps >= min_fps

            evidence = {"width": width, "height": height, "min_width": min_w, "min_height": min_h}

        elif check_type == "loudness":
            loudness = meta.get("loudness_lufs", meta.get("lufs", None))
            if loudness is None:
                passed = True  # 无数据时不阻断
                evidence = {"loudness": None, "reason": "no_loudness_data"}
            else:
                min_lufs = threshold.get("min_lufs", float("-inf"))
                max_lufs = threshold.get("max_lufs", float("inf"))
                passed = min_lufs <= loudness <= max_lufs
                evidence = {"loudness_lufs": loudness, "min": min_lufs, "max": max_lufs}

        elif check_type == "subtitle_safety":
            safe_zone = meta.get("safe_zone")
            if not safe_zone:
                passed = True  # 无字幕数据时不阻断
                evidence = {"safe_zone": None, "reason": "no_subtitle_data"}
            else:
                margin_top = threshold.get("margin_top", 0)
                margin_bottom = threshold.get("margin_bottom", 0)
                margin_sides = threshold.get("margin_sides", 0)
                passed = (
                    safe_zone.get("top", 0) >= margin_top
                    and safe_zone.get("bottom", 0) >= margin_bottom
                    and safe_zone.get("sides", 0) >= margin_sides
                )
                evidence = {"safe_zone": safe_zone, "threshold": threshold}

        elif check_type == "c2pa_manifest":
            has_c2pa = meta.get("c2pa_manifest", False)
            passed = bool(has_c2pa)
            evidence = {"c2pa_manifest": has_c2pa}

        else:
            # 未知自动规则类型，默认通过
            passed = True
            evidence = {"reason": f"unknown_auto_check_type: {check_type}"}

        return {
            "rule_id": rule.get("rule_id", ""),
            "check_type": check_type,
            "passed": passed,
            "severity": rule.get("severity", "FLAG"),
            "auto_checkable": True,
            "manual_review_required": False,
            "message": rule.get("failure_message", "") if not passed else "OK",
            "evidence": evidence,
        }

    @staticmethod
    def _check_aspect_ratio(width: int, height: int, target: str) -> bool:
        """检查宽高比"""
        try:
            parts = target.split(":")
            if len(parts) == 2:
                target_ratio = int(parts[0]) / int(parts[1])
                if height == 0:
                    return False
                actual_ratio = width / height
                return abs(actual_ratio - target_ratio) < 0.1
        except (ValueError, ZeroDivisionError):
            pass
        return True  # 无法计算时不阻断

    # ── 数据库持久化 ────────────────────────────────────────

    async def _persist_results(
        self,
        db: AsyncSession,
        *,
        platform: str,
        subject_type: str,
        subject_id: str,
        project_id: Optional[str],
        input_asset_id: Optional[str],
        step_key: str,
        status: str,
        auto_results: list[dict],
        manual_results: list[dict],
    ) -> tuple[str, list[str]]:
        """将执行结果写入 qa_runs + qa_issues

        Returns:
            (qa_run_id, issue_ids)
        """
        total = len(auto_results) + len(manual_results)
        auto_passed = sum(1 for r in auto_results if r["passed"])
        auto_failed = sum(1 for r in auto_results if not r["passed"])

        score_json = {
            "overall": (auto_passed / total * 100) if total > 0 else 100,
            "auto_passed": auto_passed,
            "auto_failed": auto_failed,
            "manual_review": len(manual_results),
            "total_rules": total,
        }

        # 生成稳定的 qa_run_id
        raw = f"RULE_{platform}_{subject_type}_{subject_id}_{step_key}"
        qa_run_id = hashlib.sha256(raw.encode()).hexdigest()[:32]

        qa_run = QARun(
            id=qa_run_id,
            project_id=project_id,
            gate_code=self.GATE_CODE,
            subject_type=subject_type,
            subject_id=subject_id,
            input_asset_id=input_asset_id,
            step_key=step_key,
            status=status,
            score_json=score_json,
            threshold_snapshot={"platform": platform},
        )
        db.add(qa_run)
        await db.flush()

        # 创建 issues
        issue_ids: list[str] = []

        # 自动规则失败的 issue
        for r in auto_results:
            if not r["passed"]:
                issue_id = self._create_issue(
                    db=db,
                    qa_run_id=qa_run.id,
                    rule_id=r["rule_id"],
                    check_type=r.get("check_type", ""),
                    severity="critical" if r["severity"] == "BLOCK" else "warning",
                    message=r.get("message", "Rule check failed"),
                    evidence=r.get("evidence"),
                    input_asset_id=input_asset_id,
                    subject_type=subject_type,
                    subject_id=subject_id,
                )
                issue_ids.append(issue_id)

        # 人工规则的待审 issue
        for r in manual_results:
            issue_id = self._create_issue(
                db=db,
                qa_run_id=qa_run.id,
                rule_id=r["rule_id"],
                check_type=r.get("check_type", ""),
                severity=r.get("severity", "FLAG").lower(),
                message=r.get("message", "需要人工审核"),
                suggested_action="MANUAL_REVIEW_REQUIRED",
                input_asset_id=input_asset_id,
                subject_type=subject_type,
                subject_id=subject_id,
            )
            issue_ids.append(issue_id)

        # Asset link
        if input_asset_id:
            link = AssetLink(
                id=hashlib.sha256(f"{input_asset_id}_{qa_run.id}_rule_input".encode()).hexdigest()[:32],
                asset_id=input_asset_id,
                owner_type="qa_run",
                owner_id=qa_run.id,
                relation_type="qa_input",
            )
            db.add(link)

        qa_run.finished_at = datetime.utcnow()
        await db.commit()

        return qa_run.id, issue_ids

    def _create_issue(
        self,
        db: AsyncSession,
        *,
        qa_run_id: str,
        rule_id: str,
        check_type: str,
        severity: str,
        message: str,
        evidence: Optional[dict] = None,
        suggested_action: Optional[str] = None,
        input_asset_id: Optional[str] = None,
        subject_type: Optional[str] = None,
        subject_id: Optional[str] = None,
    ) -> str:
        """创建单条 QAIssue"""
        raw = f"{qa_run_id}_{rule_id}_{subject_id}"
        issue_id = hashlib.sha256(raw.encode()).hexdigest()[:32]

        issue = QAIssue(
            id=issue_id,
            qa_run_id=qa_run_id,
            issue_code=f"RULE_{check_type.upper()}",
            severity=severity,
            message=message,
            related_asset_id=input_asset_id,
            related_scene_version_id=subject_id if subject_type == "scene_version" else None,
            suggested_action=suggested_action,
        )
        db.add(issue)
        return issue_id

    # ── 辅助 ────────────────────────────────────────────────

    @staticmethod
    def _empty_result(reason: str, platform: str, subject_type: str, subject_id: str) -> dict:
        return {
            "qa_run_id": None,
            "status": "no_rules",
            "total_rules": 0,
            "auto_passed": 0,
            "auto_failed": 0,
            "manual_review": 0,
            "results": [],
            "qa_issue_ids": [],
            "reason": reason,
        }
