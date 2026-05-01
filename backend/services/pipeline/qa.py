"""QA Gate — Phase 4

QA Gate 模块（拆分后）：
- QAGate 类保留在此文件，负责 run_gate 编排
- 具体检查实现在 qa_checks.py

保持 import 兼容：from services.pipeline.qa import QAGate
"""

import hashlib
import json

from database.models import Asset, AssetLink, QAIssue, QARun
from sqlalchemy.ext.asyncio import AsyncSession

from services.storage.service import get_storage_service

from .base import PipelineError
from .qa_checks import (
    check_character_asset_exists,
    check_character_asset_linked,
    check_duration,
    check_file_exists,
    check_file_size,
    check_ip_adapter_similarity,
    check_media_format,
    get_severity,
    get_suggested_action,
)


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
                "min_assets": 1,
            },
        },
        "G3": {
            "name": "IP-Adapter Cosine Similarity 检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["character_ref"],
            "checks": ["ip_adapter_similarity"],
            "thresholds": {
                "min_similarity": 0.72,
            },
        },
        "G6": {
            "name": "视频质量检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["video", "mixed_audio"],
            "checks": ["file_exists", "file_size", "duration", "media_format"],
            "thresholds": {
                "min_file_size": 1024,
                "min_duration": 0.5,
                "min_width": 640,
                "min_height": 480,
                "min_fps": 15,
            },
        },
        "G8": {
            "name": "音频质量检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["audio"],
            "checks": ["file_exists", "file_size", "duration", "media_format"],
            "thresholds": {
                "min_file_size": 512,
                "min_duration": 0.1,
                "require_audio": True,
            },
        },
        "G9": {
            "name": "合成质量检查",
            "subject_types": ["scene_version", "asset"],
            "asset_types": ["mixed_audio"],
            "checks": ["file_exists", "file_size", "duration", "media_format"],
            "thresholds": {
                "min_file_size": 1024,
                "min_duration": 0.5,
                "min_width": 640,
                "min_height": 480,
                "min_fps": 15,
                "require_audio": True,
            },
        },
    }

    async def run_gate(
        self,
        db: AsyncSession,
        gate_code: str,
        subject_type: str,
        subject_id: str,
        input_asset_id,
        step_key: str,
        project_id=None,
    ) -> QARun:
        """执行 QA Gate 检查"""
        if gate_code not in self.GATES:
            raise ValueError(f"Unknown gate code: {gate_code}")

        gate_def = self.GATES[gate_code]

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

        if not project_id:
            project_id = asset.project_id

        check_results = await self._run_checks(db, asset, gate_code, gate_def)

        total_checks = len(gate_def["checks"])
        passed_checks = sum(1 for r in check_results if r["passed"])
        overall_score = (passed_checks / total_checks) * 100 if total_checks > 0 else 0
        status = "passed" if passed_checks == total_checks else "failed"

        qa_run = QARun(
            id=hashlib.sha256(f"{gate_code}_{subject_id}_{input_asset_id}".encode()).hexdigest()[:32],
            project_id=project_id,
            gate_code=gate_code,
            subject_type=subject_type,
            subject_id=subject_id,
            input_asset_id=input_asset_id,
            evidence_asset_id=None,
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

        # 创建 evidence asset
        evidence_data = {
            "gate_code": gate_code,
            "gate_name": gate_def["name"],
            "status": status,
            "overall_score": overall_score,
            "asset": {
                "id": asset.id, "type": asset.type, "uri": asset.uri,
                "file_size": asset.file_size, "duration": asset.duration,
            },
            "checks": check_results,
            "thresholds": gate_def["thresholds"],
        }

        evidence_filename = f"qa_{gate_code}_{subject_id[:8]}_{qa_run.id[:8]}.json"
        storage_svc = get_storage_service()
        save_result = await storage_svc.save_json(evidence_data, evidence_filename, prefix="qa")

        evidence_asset = Asset(
            id=hashlib.sha256(evidence_filename.encode()).hexdigest()[:32],
            project_id=project_id,
            type="qa_evidence",
            uri=save_result["uri"],
            mime_type="application/json",
            file_size=save_result["size"],
            metadata_json={
                "gate_code": gate_code, "qa_run_id": qa_run.id,
                "status": status, "checksum": save_result["checksum"],
            },
        )
        db.add(evidence_asset)
        await db.flush()
        qa_run.evidence_asset_id = evidence_asset.id

        evidence_link = AssetLink(
            id=hashlib.sha256(f"{evidence_asset.id}_{qa_run.id}".encode()).hexdigest()[:32],
            asset_id=evidence_asset.id, owner_type="qa_run", owner_id=qa_run.id,
            relation_type="evidence",
        )
        db.add(evidence_link)

        if input_asset_id:
            input_link = AssetLink(
                id=hashlib.sha256(f"{input_asset_id}_{qa_run.id}".encode()).hexdigest()[:32],
                asset_id=input_asset_id, owner_type="qa_run", owner_id=qa_run.id,
                relation_type="qa_input",
            )
            db.add(input_link)

        failed_checks = [r for r in check_results if not r["passed"]]
        if failed_checks:
            for failed_check in failed_checks:
                issue = QAIssue(
                    id=hashlib.sha256(f"{qa_run.id}_{failed_check['check']}_{subject_id}".encode()).hexdigest()[:32],
                    qa_run_id=qa_run.id,
                    issue_code=f"{gate_code}_{failed_check['check'].upper()}_FAIL",
                    severity=get_severity(failed_check["check"]),
                    message=failed_check["message"],
                    evidence_asset_id=evidence_asset.id,
                    related_asset_id=input_asset_id,
                    related_scene_version_id=subject_id if subject_type == "scene_version" else None,
                    suggested_action=get_suggested_action(gate_code, failed_check["check"]),
                )
                db.add(issue)

        await db.commit()
        await db.refresh(qa_run)
        return qa_run

    async def _run_checks(self, db, asset, gate_code, gate_def):
        """执行所有检查"""
        results = []
        for check_name in gate_def["checks"]:
            if check_name == "file_exists":
                result = await check_file_exists(asset)
            elif check_name == "file_size":
                result = check_file_size(asset, gate_def["thresholds"])
            elif check_name == "duration":
                result = check_duration(asset, gate_def["thresholds"])
            elif check_name == "character_asset_exists":
                result = await check_character_asset_exists(db, asset, gate_def["thresholds"])
            elif check_name == "character_asset_linked":
                result = await check_character_asset_linked(db, asset)
            elif check_name == "ip_adapter_similarity":
                result = check_ip_adapter_similarity(asset, gate_def["thresholds"])
            elif check_name == "media_format":
                result = await check_media_format(asset, gate_def["thresholds"])
            else:
                result = {
                    "check": check_name, "passed": True, "score": 100,
                    "message": f"Check {check_name} not implemented, skipping",
                }
            results.append(result)
        return results
