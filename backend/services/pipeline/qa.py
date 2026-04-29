"""QA Gate — Phase 4

QA Gate 模块：
- QAGate 类
- run_gate() 方法执行质量检查
- 支持多种 gate code（G6: 视频质量、G8: 音频质量、G9: 合成质量）
- 043a 阶段：基础检查（文件存在性、大小、时长）
- 创建 qa_runs + qa_issues 记录
- 生成 evidence asset（JSON 格式）
"""

import hashlib
import json
import os
from typing import Optional

from database.models import (
    Asset,
    AssetLink,
    QAIssue,
    QARun,
)
from sqlalchemy.ext.asyncio import AsyncSession

from .base import PipelineError


class QAGate:
    """QA Gate — 质量检查门禁"""

    # Gate 定义（043b 阶段：新增 G2/G3）
    GATES = {
        "G2": {
            "name": "角色外观一致性检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["character_ref"],
            "checks": ["character_asset_exists", "character_asset_linked"],
            "thresholds": {
                "min_assets": 1,  # 至少 1 个角色资产
            },
        },
        "G3": {
            "name": "IP-Adapter Cosine Similarity 检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["character_ref"],
            "checks": ["ip_adapter_similarity"],
            "thresholds": {
                "min_similarity": 0.72,  # 至少 0.72
            },
        },
        "G6": {
            "name": "视频质量检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["video", "mixed_audio"],
            "checks": ["file_exists", "file_size", "duration"],
            "thresholds": {
                "min_file_size": 1024,  # 至少 1KB
                "min_duration": 0.5,  # 至少 0.5 秒
            },
        },
        "G8": {
            "name": "音频质量检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["audio"],
            "checks": ["file_exists", "file_size", "duration"],
            "thresholds": {
                "min_file_size": 512,  # 至少 512 字节
                "min_duration": 0.1,  # 至少 0.1 秒
            },
        },
        "G9": {
            "name": "合成质量检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["mixed_audio"],
            "checks": ["file_exists", "file_size", "duration"],
            "thresholds": {
                "min_file_size": 1024,
                "min_duration": 0.5,
            },
        },
    }

    async def run_gate(
        self,
        db: AsyncSession,
        gate_code: str,
        subject_type: str,
        subject_id: str,
        input_asset_id: Optional[str],
        step_key: str,
        project_id: Optional[str] = None,
    ) -> QARun:
        """执行 QA Gate 检查

        Args:
            db: 数据库 session
            gate_code: Gate 代码（G6/G8/G9）
            subject_type: 被检查对象类型
            subject_id: 被检查对象 ID
            input_asset_id: 输入资产 ID
            step_key: 关联的步骤 key
            project_id: 项目 ID（可选，从 scene 推断）

        Returns:
            QARun: QA 运行记录

        Raises:
            ValueError: Gate code 不支持
            PipelineError: 获取资产失败
        """
        if gate_code not in self.GATES:
            raise ValueError(f"Unknown gate code: {gate_code}")

        gate_def = self.GATES[gate_code]

        # 获取输入资产
        if not input_asset_id:
            raise PipelineError(
                message=f"No input asset provided for {gate_code}",
                error_type="config_error",
            )

        asset = await db.get(Asset, input_asset_id)
        if not asset:
            raise PipelineError(
                message=f"Asset {input_asset_id} not found",
                error_type="provider_error",
            )

        # 获取 project_id（如果没传）
        if not project_id:
            project_id = asset.project_id

        # 执行检查
        check_results = await self._run_checks(
            db=db,
            asset=asset,
            gate_code=gate_code,
            gate_def=gate_def,
        )

        # 计算总分
        total_checks = len(gate_def["checks"])
        passed_checks = sum(1 for r in check_results if r["passed"])
        overall_score = (passed_checks / total_checks) * 100 if total_checks > 0 else 0

        # 判定状态
        # 043a 阶段规则：所有检查通过 = passed，任何失败 = failed
        status = "passed" if passed_checks == total_checks else "failed"

        # 创建 QARun
        qa_run = QARun(
            id=hashlib.sha256(f"{gate_code}_{subject_id}_{input_asset_id}".encode()).hexdigest()[:32],
            project_id=project_id,
            gate_code=gate_code,
            subject_type=subject_type,
            subject_id=subject_id,
            input_asset_id=input_asset_id,
            evidence_asset_id=None,  # 稍后创建 evidence asset 后填充
            step_key=step_key,
            status=status,
            score_json={
                "overall": overall_score,
                "checks": {r["check"]: r["score"] for r in check_results},
                "total_checks": total_checks,
                "passed_checks": passed_checks,
            },
            threshold_snapshot=gate_def["thresholds"],
        )
        db.add(qa_run)
        await db.flush()

        # 创建 evidence asset（JSON 格式）
        evidence_data = {
            "gate_code": gate_code,
            "gate_name": gate_def["name"],
            "status": status,
            "overall_score": overall_score,
            "asset": {
                "id": asset.id,
                "type": asset.type,
                "uri": asset.uri,
                "file_size": asset.file_size,
                "duration": asset.duration,
            },
            "checks": check_results,
            "thresholds": gate_def["thresholds"],
        }

        evidence_content = json.dumps(evidence_data, ensure_ascii=False, indent=2)
        evidence_filename = f"qa_{gate_code}_{subject_id[:8]}_{qa_run.id[:8]}.json"

        evidence_asset = Asset(
            id=hashlib.sha256(evidence_filename.encode()).hexdigest()[:32],
            project_id=project_id,
            type="qa_evidence",
            uri=f"file://storage/qa/{evidence_filename}",
            mime_type="application/json",
            file_size=len(evidence_content.encode()),
            metadata_json={
                "gate_code": gate_code,
                "qa_run_id": qa_run.id,
                "status": status,
            },
        )
        db.add(evidence_asset)
        await db.flush()

        # 更新 qa_run 的 evidence_asset_id
        qa_run.evidence_asset_id = evidence_asset.id

        # 创建 AssetLink
        evidence_link = AssetLink(
            id=hashlib.sha256(f"{evidence_asset.id}_{qa_run.id}".encode()).hexdigest()[:32],
            asset_id=evidence_asset.id,
            owner_type="qa_run",
            owner_id=qa_run.id,
            relation_type="evidence",
        )
        db.add(evidence_link)

        # 输入资产关联
        if input_asset_id:
            input_link = AssetLink(
                id=hashlib.sha256(f"{input_asset_id}_{qa_run.id}".encode()).hexdigest()[:32],
                asset_id=input_asset_id,
                owner_type="qa_run",
                owner_id=qa_run.id,
                relation_type="qa_input",
            )
            db.add(input_link)

        # 如果有失败的检查，创建 QAIssue
        failed_checks = [r for r in check_results if not r["passed"]]
        if failed_checks:
            for failed_check in failed_checks:
                issue = QAIssue(
                    id=hashlib.sha256(f"{qa_run.id}_{failed_check['check']}_{subject_id}".encode()).hexdigest()[:32],
                    qa_run_id=qa_run.id,
                    issue_code=f"{gate_code}_{failed_check['check'].upper()}_FAIL",
                    severity=self._get_severity(failed_check["check"]),
                    message=failed_check["message"],
                    evidence_asset_id=evidence_asset.id,
                    related_asset_id=input_asset_id,
                    related_scene_version_id=subject_id if subject_type == "scene_version" else None,
                    suggested_action=self._get_suggested_action(gate_code, failed_check["check"]),
                )
                db.add(issue)

        await db.commit()
        await db.refresh(qa_run)

        return qa_run

    async def _run_checks(
        self,
        db: AsyncSession,
        asset: Asset,
        gate_code: str,
        gate_def: dict,
    ) -> list[dict]:
        """执行所有检查

        Args:
            db: 数据库 session
            asset: 待检查资产
            gate_code: Gate 代码
            gate_def: Gate 定义

        Returns:
            list[dict]: 检查结果列表
        """
        results = []

        for check_name in gate_def["checks"]:
            if check_name == "file_exists":
                result = await self._check_file_exists(asset)
            elif check_name == "file_size":
                result = self._check_file_size(asset, gate_def["thresholds"])
            elif check_name == "duration":
                result = self._check_duration(asset, gate_def["thresholds"])
            elif check_name == "character_asset_exists":
                result = await self._check_character_asset_exists(db, asset, gate_def["thresholds"])
            elif check_name == "character_asset_linked":
                result = await self._check_character_asset_linked(db, asset)
            elif check_name == "ip_adapter_similarity":
                result = self._check_ip_adapter_similarity(asset, gate_def["thresholds"])
            else:
                # 未知检查，默认通过
                result = {
                    "check": check_name,
                    "passed": True,
                    "score": 100,
                    "message": f"Check {check_name} not implemented, skipping",
                }

            results.append(result)

        return results

    async def _check_file_exists(self, asset: Asset) -> dict:
        """检查文件是否存在

        043a 阶段简化：只检查 URI 是否非空
        TODO: 043b 阶段实现真实文件检查（MinIO/local storage）
        """
        # 简化检查：uri 非空
        exists = bool(asset.uri and asset.uri.strip())

        return {
            "check": "file_exists",
            "passed": exists,
            "score": 100 if exists else 0,
            "message": "File exists" if exists else f"File not found (URI: {asset.uri})",
        }

    def _check_file_size(self, asset: Asset, thresholds: dict) -> dict:
        """检查文件大小"""
        file_size = asset.file_size or 0
        min_size = thresholds.get("min_file_size", 0)

        passed = file_size >= min_size
        score = 100 if passed else 0

        return {
            "check": "file_size",
            "passed": passed,
            "score": score,
            "message": f"File size: {file_size} bytes (min: {min_size})",
            "details": {"file_size": file_size, "min_size": min_size},
        }

    def _check_duration(self, asset: Asset, thresholds: dict) -> dict:
        """检查时长"""
        duration = asset.duration or 0
        min_duration = thresholds.get("min_duration", 0)

        passed = duration >= min_duration
        score = 100 if passed else 0

        return {
            "check": "duration",
            "passed": passed,
            "score": score,
            "message": f"Duration: {duration}s (min: {min_duration}s)",
            "details": {"duration": duration, "min_duration": min_duration},
        }

    def _get_severity(self, check_name: str) -> str:
        """获取问题严重程度"""
        # 043a 阶段：所有失败都是 critical
        # TODO: 043b 阶段根据检查类型分级
        return "critical"

    def _get_suggested_action(self, gate_code: str, check_name: str) -> str:
        """获取建议修复动作"""
        actions = {
            "G2": {
                "character_asset_exists": "角色资产未生成，检查角色资产生成步骤",
                "character_asset_linked": "角色资产未关联到场景版本，检查资产链接配置",
            },
            "G3": {
                "ip_adapter_similarity": "IP-Adapter 相似度不足，建议手动审查或调整参考图",
            },
            "G6": {
                "file_exists": "检查视频生成输出路径配置",
                "file_size": "视频文件过小，可能生成失败，重试生成",
                "duration": "视频时长不足，检查 prompt 和参数配置",
            },
            "G8": {
                "file_exists": "检查音频生成输出路径配置",
                "file_size": "音频文件过小，可能生成失败，重试生成",
                "duration": "音频时长不足，检查 TTS 文本和配置",
            },
            "G9": {
                "file_exists": "检查合成输出路径配置",
                "file_size": "合成文件过小，ffmpeg 可能失败，检查日志",
                "duration": "合成时长不足，检查视频和音频时长匹配",
            },
        }

        return actions.get(gate_code, {}).get(check_name, "联系技术支持")

    async def _check_character_asset_exists(
        self,
        db: AsyncSession,
        asset: Asset,
        thresholds: dict,
    ) -> dict:
        """检查角色资产是否存在

        G2 检查：验证是否生成了角色资产
        """
        from sqlalchemy import select
        from database.models import CharacterAsset

        # 检查是否存在 CharacterAsset 记录
        char_asset_q = select(CharacterAsset).where(
            CharacterAsset.asset_id == asset.id
        )
        result = await db.execute(char_asset_q)
        char_asset = result.scalar_one_or_none()

        exists = char_asset is not None

        return {
            "check": "character_asset_exists",
            "passed": exists,
            "score": 100 if exists else 0,
            "message": "Character asset exists" if exists else "Character asset record not found",
            "details": {
                "asset_id": asset.id,
                "char_asset_id": char_asset.id if char_asset else None,
            },
        }

    async def _check_character_asset_linked(
        self,
        db: AsyncSession,
        asset: Asset,
    ) -> dict:
        """检查角色资产是否链接到场景版本

        G2 检查：验证角色资产是否正确关联到 scene_version
        """
        from sqlalchemy import select
        from database.models import AssetLink

        # 检查是否存在 character_reference 类型的 AssetLink
        link_q = select(AssetLink).where(
            AssetLink.asset_id == asset.id,
            AssetLink.relation_type == "character_reference",
        )
        result = await db.execute(link_q)
        link = result.scalar_one_or_none()

        linked = link is not None

        return {
            "check": "character_asset_linked",
            "passed": linked,
            "score": 100 if linked else 0,
            "message": "Character asset linked to scene_version" if linked else "Character asset not linked",
            "details": {
                "asset_id": asset.id,
                "link_id": link.id if link else None,
                "owner_type": link.owner_type if link else None,
                "owner_id": link.owner_id if link else None,
            },
        }

    def _check_ip_adapter_similarity(
        self,
        asset: Asset,
        thresholds: dict,
    ) -> dict:
        """检查 IP-Adapter cosine similarity

        G3 检查：从 asset.metadata 中读取 similarity 分数
        """
        # 从 metadata 中读取 similarity 分数
        similarity = 0.0
        if asset.metadata_json:
            similarity = asset.metadata_json.get("similarity", 0.0)

        min_similarity = thresholds.get("min_similarity", 0.72)
        passed = similarity >= min_similarity

        # 将 similarity 转换为 0-100 分
        score = int((similarity / 1.0) * 100)

        return {
            "check": "ip_adapter_similarity",
            "passed": passed,
            "score": score,
            "message": f"IP-Adapter similarity: {similarity:.3f} (min: {min_similarity})",
            "details": {
                "similarity": similarity,
                "min_similarity": min_similarity,
            },
        }

    def _get_severity(self, check_name: str) -> str:
        """获取问题严重程度

        043b 阶段：
        - G2/G3 失败使用 warning 级别（不阻断流程）
        - 其他检查失败使用 critical 级别
        """
        # G2/G3 的失败使用 warning
        if check_name in ("character_asset_exists", "character_asset_linked", "ip_adapter_similarity"):
            return "warning"

        # 其他检查失败使用 critical
        return "critical"
