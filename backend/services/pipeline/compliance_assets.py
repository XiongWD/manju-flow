"""Compliance Assetifier — 041a.3 Phase

合规标注资产化最小闭环：
1. C2PA 清单资产（c2pa_manifest） — 从 C2PA 签名结果 / 元数据生成
2. 显式水印资产（watermark_explicit） — 记录水印参数 + 证明
3. 隐式水印资产（watermark_implicit） — 记录隐式水印嵌入参数
4. 合规报告资产（rules_report） — 从 RuleExecutor 结果生成

每个资产写入 assets 表，通过 asset_links 绑定到 scene_version / qa_run。

不做：
- 不做真实水印嵌入（只记录参数）
- 不做真实 C2PA 签名（只记录清单结构）
- 不做前端报告页（041a.4）
- 不做发布链（041b）
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Asset, AssetLink


# ── 合规资产类型常量 ──────────────────────────────────────────────

ASSET_TYPE_C2PA_MANIFEST = "c2pa_manifest"
ASSET_TYPE_WATERMARK_EXPLICIT = "watermark_explicit"
ASSET_TYPE_WATERMARK_IMPLICIT = "watermark_implicit"
ASSET_TYPE_RULES_REPORT = "rules_report"

# asset_links relation_type 常量
REL_C2PA_MANIFEST = "c2pa_manifest"
REL_WATERMARK_EXPLICIT = "watermark_explicit"
REL_WATERMARK_IMPLICIT = "watermark_implicit"
REL_RULES_REPORT = "rules_report"


def _stable_id(*parts: str) -> str:
    """生成稳定 ID（确定性哈希）"""
    raw = "_".join(str(p) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


class ComplianceAssetifier:
    """合规标注资产化器

    将合规标注结果转化为可追溯的资产记录，
    通过 asset_links 绑定到业务实体。

    用法::

        af = ComplianceAssetifier()
        c2pa_asset = await af.create_c2pa_manifest_asset(
            db=db,
            scene_version_id=sv_id,
            source_asset_id=asset_id,
            manifest_data={...},
            project_id=pid,
        )
    """

    # ── C2PA 清单资产 ───────────────────────────────────────

    async def create_c2pa_manifest_asset(
        self,
        db: AsyncSession,
        *,
        scene_version_id: str,
        source_asset_id: Optional[str] = None,
        project_id: Optional[str] = None,
        manifest_data: Optional[dict] = None,
        signed: bool = False,
        sign_error: Optional[str] = None,
    ) -> Asset:
        """创建 C2PA 清单资产

        Args:
            db: 数据库 session
            scene_version_id: 关联的场景版本 ID
            source_asset_id: 原始资产 ID
            project_id: 项目 ID
            manifest_data: C2PA 清单内容（可为空表示未签名）
            signed: 是否已实际签名
            sign_error: 签名错误信息（如有）

        Returns:
            Asset: 创建的 C2PA 清单资产
        """
        asset_id = _stable_id(
            "c2pa_manifest", scene_version_id, source_asset_id or "none",
        )

        asset = Asset(
            id=asset_id,
            project_id=project_id,
            type=ASSET_TYPE_C2PA_MANIFEST,
            mime_type="application/json",
            metadata_json={
                "compliance_type": "c2pa_manifest",
                "c2pa_signed": signed,
                "source_asset_id": source_asset_id,
                "scene_version_id": scene_version_id,
                "manifest_data": manifest_data,
                "sign_error": sign_error,
                "created_at": datetime.utcnow().isoformat() + "Z",
            },
        )
        db.add(asset)
        await db.flush()

        # 绑定到 scene_version
        link = AssetLink(
            id=_stable_id(asset_id, scene_version_id, REL_C2PA_MANIFEST),
            asset_id=asset_id,
            owner_type="scene_version",
            owner_id=scene_version_id,
            relation_type=REL_C2PA_MANIFEST,
        )
        db.add(link)
        await db.flush()

        return asset

    # ── 显式水印资产 ───────────────────────────────────────

    async def create_watermark_explicit_asset(
        self,
        db: AsyncSession,
        *,
        scene_version_id: str,
        source_asset_id: Optional[str] = None,
        project_id: Optional[str] = None,
        watermark_type: str = "text",
        position: str = "bottom_right",
        text: Optional[str] = None,
        opacity: float = 0.7,
        size_ratio: float = 0.05,
        applied: bool = False,
        error: Optional[str] = None,
    ) -> Asset:
        """创建显式水印资产记录

        注意：041a.3 只记录参数，不做真实水印嵌入。

        Args:
            db: 数据库 session
            scene_version_id: 关联的场景版本 ID
            source_asset_id: 原始资产 ID
            project_id: 项目 ID
            watermark_type: 水印类型（text/image/logo）
            position: 位置（bottom_right/top_left/center 等）
            text: 水印文字
            opacity: 透明度 0-1
            size_ratio: 大小比例
            applied: 是否已实际应用
            error: 错误信息

        Returns:
            Asset: 显式水印资产记录
        """
        asset_id = _stable_id(
            "watermark_explicit", scene_version_id, source_asset_id or "none",
        )

        asset = Asset(
            id=asset_id,
            project_id=project_id,
            type=ASSET_TYPE_WATERMARK_EXPLICIT,
            mime_type="application/json",
            metadata_json={
                "compliance_type": "watermark_explicit",
                "watermark_type": watermark_type,
                "position": position,
                "text": text,
                "opacity": opacity,
                "size_ratio": size_ratio,
                "applied": applied,
                "source_asset_id": source_asset_id,
                "scene_version_id": scene_version_id,
                "error": error,
                "created_at": datetime.utcnow().isoformat() + "Z",
            },
        )
        db.add(asset)
        await db.flush()

        # 绑定到 scene_version
        link = AssetLink(
            id=_stable_id(asset_id, scene_version_id, REL_WATERMARK_EXPLICIT),
            asset_id=asset_id,
            owner_type="scene_version",
            owner_id=scene_version_id,
            relation_type=REL_WATERMARK_EXPLICIT,
        )
        db.add(link)
        await db.flush()

        return asset

    # ── 隐式水印资产 ───────────────────────────────────────

    async def create_watermark_implicit_asset(
        self,
        db: AsyncSession,
        *,
        scene_version_id: str,
        source_asset_id: Optional[str] = None,
        project_id: Optional[str] = None,
        method: str = "lsb",
        strength: float = 0.5,
        payload_hash: Optional[str] = None,
        embedded: bool = False,
        error: Optional[str] = None,
    ) -> Asset:
        """创建隐式水印资产记录

        注意：041a.3 只记录参数，不做真实隐式水印嵌入。

        Args:
            db: 数据库 session
            scene_version_id: 关联的场景版本 ID
            source_asset_id: 原始资产 ID
            project_id: 项目 ID
            method: 隐式水印方法（lsb/dwt/fft/dct）
            strength: 嵌入强度 0-1
            payload_hash: 嵌入载荷的哈希
            embedded: 是否已实际嵌入
            error: 错误信息

        Returns:
            Asset: 隐式水印资产记录
        """
        asset_id = _stable_id(
            "watermark_implicit", scene_version_id, source_asset_id or "none",
        )

        asset = Asset(
            id=asset_id,
            project_id=project_id,
            type=ASSET_TYPE_WATERMARK_IMPLICIT,
            mime_type="application/json",
            metadata_json={
                "compliance_type": "watermark_implicit",
                "method": method,
                "strength": strength,
                "payload_hash": payload_hash,
                "embedded": embedded,
                "source_asset_id": source_asset_id,
                "scene_version_id": scene_version_id,
                "error": error,
                "created_at": datetime.utcnow().isoformat() + "Z",
            },
        )
        db.add(asset)
        await db.flush()

        # 绑定到 scene_version
        link = AssetLink(
            id=_stable_id(asset_id, scene_version_id, REL_WATERMARK_IMPLICIT),
            asset_id=asset_id,
            owner_type="scene_version",
            owner_id=scene_version_id,
            relation_type=REL_WATERMARK_IMPLICIT,
        )
        db.add(link)
        await db.flush()

        return asset

    # ── 合规报告资产 ───────────────────────────────────────

    async def create_rules_report_asset(
        self,
        db: AsyncSession,
        *,
        qa_run_id: str,
        project_id: Optional[str] = None,
        platform: str = "",
        subject_type: str = "",
        subject_id: str = "",
        rule_results: Optional[list[dict]] = None,
        status: str = "pending",
    ) -> Asset:
        """创建合规报告资产

        将 RuleExecutor 的结果序列化为 JSON 报告资产，
        通过 asset_links 绑定到 qa_run。

        Args:
            db: 数据库 session
            qa_run_id: 关联的 QA 运行 ID
            project_id: 项目 ID
            platform: 目标平台
            subject_type: 检查对象类型
            subject_id: 检查对象 ID
            rule_results: 规则检查结果列表
            status: 整体状态

        Returns:
            Asset: 合规报告资产
        """
        asset_id = _stable_id("rules_report", qa_run_id)

        report_content = {
            "compliance_type": "rules_report",
            "qa_run_id": qa_run_id,
            "platform": platform,
            "subject_type": subject_type,
            "subject_id": subject_id,
            "status": status,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "summary": {
                "total": len(rule_results) if rule_results else 0,
                "passed": sum(1 for r in (rule_results or []) if r.get("passed") is True),
                "failed": sum(1 for r in (rule_results or []) if r.get("passed") is False),
                "manual_review": sum(
                    1 for r in (rule_results or [])
                    if r.get("manual_review_required", False)
                ),
            },
            "results": rule_results or [],
        }

        asset = Asset(
            id=asset_id,
            project_id=project_id,
            type=ASSET_TYPE_RULES_REPORT,
            mime_type="application/json",
            metadata_json=report_content,
        )
        db.add(asset)
        await db.flush()

        # 绑定到 qa_run
        link = AssetLink(
            id=_stable_id(asset_id, qa_run_id, REL_RULES_REPORT),
            asset_id=asset_id,
            owner_type="qa_run",
            owner_id=qa_run_id,
            relation_type=REL_RULES_REPORT,
        )
        db.add(link)
        await db.flush()

        return asset

    # ── 批量资产化：从 RuleExecutor 结果生成全量合规资产 ──

    async def assetify_compliance(
        self,
        db: AsyncSession,
        *,
        scene_version_id: str,
        source_asset_id: Optional[str] = None,
        project_id: Optional[str] = None,
        qa_run_id: Optional[str] = None,
        platform: str = "",
        rule_results: Optional[list[dict]] = None,
        rule_status: str = "pending",
        c2pa_manifest_data: Optional[dict] = None,
        c2pa_signed: bool = False,
        c2pa_error: Optional[str] = None,
        watermark_explicit_params: Optional[dict] = None,
        watermark_implicit_params: Optional[dict] = None,
    ) -> dict[str, Any]:
        """一站式合规标注资产化

        从一次 RuleExecutor 检查的结果 + 可选的 C2PA / 水印参数，
        批量创建 4 类合规资产并绑定。

        Args:
            db: 数据库 session
            scene_version_id: 场景版本 ID
            source_asset_id: 原始资产 ID
            project_id: 项目 ID
            qa_run_id: QA 运行 ID（用于报告绑定）
            platform: 目标平台
            rule_results: 规则检查结果
            rule_status: 规则检查状态
            c2pa_manifest_data: C2PA 清单数据
            c2pa_signed: C2PA 是否已签名
            c2pa_error: C2PA 错误
            watermark_explicit_params: 显式水印参数
            watermark_implicit_params: 隐式水印参数

        Returns:
            dict: {
                "c2pa_manifest_asset_id": str | None,
                "watermark_explicit_asset_id": str | None,
                "watermark_implicit_asset_id": str | None,
                "rules_report_asset_id": str | None,
                "total_assets_created": int,
            }
        """
        result: dict[str, Any] = {
            "c2pa_manifest_asset_id": None,
            "watermark_explicit_asset_id": None,
            "watermark_implicit_asset_id": None,
            "rules_report_asset_id": None,
            "total_assets_created": 0,
        }

        # 1. C2PA 清单资产
        c2pa_asset = await self.create_c2pa_manifest_asset(
            db=db,
            scene_version_id=scene_version_id,
            source_asset_id=source_asset_id,
            project_id=project_id,
            manifest_data=c2pa_manifest_data,
            signed=c2pa_signed,
            sign_error=c2pa_error,
        )
        result["c2pa_manifest_asset_id"] = c2pa_asset.id
        result["total_assets_created"] += 1

        # 2. 显式水印资产
        wm_exp = watermark_explicit_params or {}
        wm_exp_asset = await self.create_watermark_explicit_asset(
            db=db,
            scene_version_id=scene_version_id,
            source_asset_id=source_asset_id,
            project_id=project_id,
            **wm_exp,
        )
        result["watermark_explicit_asset_id"] = wm_exp_asset.id
        result["total_assets_created"] += 1

        # 3. 隐式水印资产
        wm_imp = watermark_implicit_params or {}
        wm_imp_asset = await self.create_watermark_implicit_asset(
            db=db,
            scene_version_id=scene_version_id,
            source_asset_id=source_asset_id,
            project_id=project_id,
            **wm_imp,
        )
        result["watermark_implicit_asset_id"] = wm_imp_asset.id
        result["total_assets_created"] += 1

        # 4. 合规报告资产（需要 qa_run_id）
        if qa_run_id:
            report_asset = await self.create_rules_report_asset(
                db=db,
                qa_run_id=qa_run_id,
                project_id=project_id,
                platform=platform,
                subject_type="scene_version",
                subject_id=scene_version_id,
                rule_results=rule_results,
                status=rule_status,
            )
            result["rules_report_asset_id"] = report_asset.id
            result["total_assets_created"] += 1

        return result
