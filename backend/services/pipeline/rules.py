"""Platform Rules Loader — 041a.1 Phase

规则加载器：
- 从 JSON 文件加载规则定义
- 支持 platform 过滤
- 支持 target_platform 继承（从 Project.platform 继承）
- 分离自动规则和人工规则

自动规则 (auto_checkable=True):
- duration: 时长检查
- resolution: 分辨率检查
- loudness: 响度检查
- subtitle_safety: 字幕安全区检查
- file_exists: 文件存在性检查
- c2pa_manifest: C2PA 标注存在性检查

人工规则 (auto_checkable=False):
- content_risk: 内容语义风险检查
- style_match: 平台风格匹配检查
- cover_quality: 封面吸引力检查
- semantic_relevance: 语义相关性检查
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

# ============================================================
# 自动规则 / 人工规则边界定义
# ============================================================

# 自动规则：由程序直接执行，结果可自动判定
AUTO_RULES = {
    "duration",
    "resolution", 
    "loudness",
    "subtitle_safety",
    "file_exists",
    "c2pa_manifest",
}

# 人工规则：需要人工审核，不能自动通过
MANUAL_RULES = {
    "content_risk",       # 内容语义风险
    "style_match",        # 平台风格匹配
    "cover_quality",       # 封面吸引力
    "semantic_relevance", # 语义相关性
}


def is_auto_rule(check_type: str) -> bool:
    """判断是否为自动规则"""
    return check_type in AUTO_RULES


def is_manual_rule(check_type: str) -> bool:
    """判断是否需要人工规则"""
    return check_type in MANUAL_RULES


# ============================================================
# target_platform 继承配置
# ============================================================

# Platform 继承方案：
# 1. Project.platform 是最终目标平台
# 2. 规则按 platform 分组定义
# 3. 加载规则时自动继承 Project.platform 的规则集合
#
# 示例 JSON 结构：
# {
#   "tiktok": {
#     "hard_rules": [...],   // 硬规则（BLOCK）
#     "soft_rules": [...]   // 软规则（FLAG）
#   },
#   "douyin": {...},
#   "youtube": {...}
# }


# ============================================================
# 规则加载器
# ============================================================

class RuleLoader:
    """规则加载器 — 041a.1 草案

    职责：
    1. 从 JSON 文件加载规则定义
    2. 合并内置规则（BUILTIN_RULES_BY_PLATFORM）
    3. 按 platform / severity / auto_manual 过滤
    4. 支持 target_platform 继承（Project.platform → fallback 链）

    不做：
    - 不执行规则（executor 职责）
    - 不写数据库（qa 落库职责）
    """

    DEFAULT_RULES_FILE = Path(__file__).parent.parent / "data" / "rules.json"

    # target_platform fallback 链
    # 如果 Project.platform 不在内置平台中，沿此链查找最接近的规则集
    PLATFORM_FALLBACK: dict[str, str] = {
        "tiktok_us": "tiktok",
        "tiktok_sea": "tiktok",
        "douyin_cn": "douyin",
        "youtube_shorts": "youtube",
        "instagram_reels": "tiktok",  # 复用 TikTok 规则（同为竖屏短视频）
    }

    def __init__(self, rules_file: Optional[Path] = None):
        self.rules_file = rules_file or self.DEFAULT_RULES_FILE
        self._rules_cache: Optional[list[dict[str, Any]]] = None

    # ── target_platform 解析 ────────────────────────────────

    @staticmethod
    def resolve_platform(platform: str) -> str:
        """解析目标平台，处理 fallback 链。

        Args:
            platform: 原始平台标识（如 "tiktok_us"、"tiktok"）

        Returns:
            归一化后的平台标识（内置平台名）
        """
        return RuleLoader.PLATFORM_FALLBACK.get(platform, platform)

    # ── 规则加载 ─────────────────────────────────────────────

    async def load_rules(
        self,
        platform: Optional[str] = None,
        subject_type: Optional[str] = None,
        severity: Optional[str] = None,
        auto_only: bool = False,
        manual_only: bool = False,
    ) -> list[dict[str, Any]]:
        """加载规则

        Args:
            platform: 目标平台过滤 (tiktok/douyin/youtube)，自动 resolve
            subject_type: 检查对象类型过滤 (asset/scene_version/episode/publish_bundle)
            severity: 严重程度过滤 (BLOCK/FLAG)
            auto_only: 仅返回自动规则
            manual_only: 仅返回人工规则

        Returns:
            list[dict]: 规则列表
        """
        rules = await self._load_all_rules()

        # Platform 过滤（带 resolve）
        if platform:
            resolved = self.resolve_platform(platform)
            rules = [r for r in rules if r.get("platform") == resolved]

        # Subject type 过滤
        if subject_type:
            rules = [r for r in rules if r.get("subject_type") == subject_type]

        # Severity 过滤
        if severity:
            rules = [r for r in rules if r.get("severity") == severity]

        # Auto / Manual 分离
        if auto_only:
            rules = [r for r in rules if r.get("auto_checkable") is True]
        if manual_only:
            rules = [r for r in rules if r.get("manual_review_required") is True]

        return rules

    async def load_auto_rules(
        self,
        platform: Optional[str] = None,
        subject_type: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """便捷方法：仅加载自动规则"""
        return await self.load_rules(
            platform=platform,
            subject_type=subject_type,
            auto_only=True,
        )

    async def load_manual_rules(
        self,
        platform: Optional[str] = None,
        subject_type: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """便捷方法：仅加载人工规则"""
        return await self.load_rules(
            platform=platform,
            subject_type=subject_type,
            manual_only=True,
        )

    async def _load_all_rules(self) -> list[dict[str, Any]]:
        """加载所有规则（文件规则 + 内置规则，带缓存）"""
        if self._rules_cache is not None:
            return self._rules_cache

        rules: list[dict[str, Any]] = []

        # 1. 内置规则
        for platform_rules in BUILTIN_RULES_BY_PLATFORM.values():
            rules.extend(platform_rules)

        # 2. 文件规则（覆盖同 rule_id 的内置规则）
        if self.rules_file.exists():
            try:
                content = self.rules_file.read_text(encoding="utf-8")
                data = json.loads(content)

                file_rules: list[dict[str, Any]] = []
                if isinstance(data, dict):
                    for platform_rules in data.values():
                        if isinstance(platform_rules, dict):
                            for severity_rules in platform_rules.values():
                                if isinstance(severity_rules, list):
                                    file_rules.extend(severity_rules)
                        elif isinstance(platform_rules, list):
                            file_rules.extend(platform_rules)
                elif isinstance(data, list):
                    file_rules = data

                # 文件规则覆盖内置规则（同 rule_id）
                if file_rules:
                    existing_ids = {r.get("rule_id") for r in rules}
                    rules.extend(r for r in file_rules if r.get("rule_id") not in existing_ids)

            except (json.JSONDecodeError, OSError):
                pass

        self._rules_cache = rules
        return rules

    def get_platform_rules(
        self,
        platform: str,
    ) -> dict[str, list[dict[str, Any]]]:
        """获取指定平台的所有规则（按 severity 分组）

        Args:
            platform: 目标平台

        Returns:
            dict: {"hard_rules": [...], "soft_rules": [...]}
        """
        # 同步方法，用于 orchestrator 同步上下文
        # 实际数据来自 BUILTIN_RULES_BY_PLATFORM
        resolved = self.resolve_platform(platform)
        all_rules = BUILTIN_RULES_BY_PLATFORM.get(resolved, [])
        return {
            "hard_rules": [r for r in all_rules if r.get("severity") == "BLOCK"],
            "soft_rules": [r for r in all_rules if r.get("severity") == "FLAG"],
        }

    def invalidate_cache(self):
        """失效缓存（用于规则更新后）"""
        self._rules_cache = None


# ============================================================
# 自动规则 / 人工规则边界 — 041a.1 清单
# ============================================================
#
# | check_type          | auto_checkable | manual_review_required | 分类     |
# |---------------------|---------------|----------------------|---------|
# | duration            | True          | False                | 自动     |
# | resolution          | True          | False                | 自动     |
# | loudness            | True          | False                | 自动     |
# | subtitle_safety     | True          | False                | 自动     |
# | file_exists         | True          | False                | 自动     |
# | c2pa_manifest       | True          | False                | 自动     |
# |---------------------|---------------|----------------------|---------|
# | content_risk        | False         | True                 | 人工     |
# | style_match         | False         | True                 | 人工     |
# | cover_quality       | False         | True                 | 人工     |
# | semantic_relevance  | False         | True                 | 人工     |
#
# 判定标准：
# - 自动规则：可通过 ffmpeg/probeff/文件系统 API 在 1s 内完成，
#   结果为布尔值或数值比较，无需 LLM/人工判断
# - 人工规则：需要 LLM 推理或人工审美判断，
#   结果为概率分数，无法给出确定通过/失败
#
# 注意：自动规则也可以是 FLAG 级别（如建议时长），
#       人工规则也可以是 BLOCK 级别（如内容合规红线）
#

# ============================================================
# 内置规则定义（041a.1 阶段）
# ============================================================

# BUILTIN_RULES_BY_PLATFORM: 平台 → 规则列表映射
# target_platform 接入建议：
# - 新平台只需在此 dict 中增加 key + 规则列表
# - 如需 fallback，在 RuleLoader.PLATFORM_FALLBACK 中配置
# - 规则列表引用下方常量（TIKTOK_HARD_RULES 等）
# - 未来可改为从数据库加载，此处作为 seed

BUILTIN_RULES_BY_PLATFORM: dict[str, list[dict[str, Any]]] = {
    "tiktok": [],  # 填充在下方
    # "douyin": DOUYIN_HARD_RULES + DOUYIN_SOFT_RULES,
    # "youtube": YOUTUBE_HARD_RULES + YOUTUBE_SOFT_RULES,
}

# TikTok 硬规则（BLOCK）- 必须通过
TIKTOK_HARD_RULES = [
    {
        "rule_id": "tiktok_duration_hard",
        "platform": "tiktok",
        "name": "TikTok 时长硬规则",
        "severity": "BLOCK",
        "subject_type": "asset",
        "check_type": "duration",
        "threshold": {"min_duration": 5.0, "max_duration": 180.0},
        "evidence_requirements": {"require_duration": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "视频时长必须在 5-180 秒范围内",
    },
    {
        "rule_id": "tiktok_resolution_hard",
        "platform": "tiktok",
        "name": "TikTok 分辨率硬规则",
        "severity": "BLOCK",
        "subject_type": "asset",
        "check_type": "resolution",
        "threshold": {"min_width": 720, "min_height": 1280},
        "evidence_requirements": {"require_resolution": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "视频分辨率必须至少 720x1280",
    },
    {
        "rule_id": "tiktok_loudness_hard",
        "platform": "tiktok",
        "name": "TikTok 响度硬规则",
        "severity": "BLOCK",
        "subject_type": "asset",
        "check_type": "loudness",
        "threshold": {"min_lufs": -14.0, "max_lufs": -9.0},
        "evidence_requirements": {"require_loudness": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "音频响度必须在 -14 到 -9 LUFS 范围内",
    },
    {
        "rule_id": "tiktok_subtitle_safety_hard",
        "platform": "tiktok",
        "name": "TikTok 字幕安全区硬规则",
        "severity": "BLOCK",
        "subject_type": "asset",
        "check_type": "subtitle_safety",
        "threshold": {"margin_top": 150, "margin_bottom": 150, "margin_sides": 50},
        "evidence_requirements": {"require_safe_zone": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "字幕必须在安全区域内",
    },
    {
        "rule_id": "tiktok_file_exists_hard",
        "platform": "tiktok",
        "name": "TikTok 文件存在性硬规则",
        "severity": "BLOCK",
        "subject_type": "asset",
        "check_type": "file_exists",
        "threshold": {},
        "evidence_requirements": {"require_file": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "视频文件必须存在",
    },
    {
        "rule_id": "tiktok_c2pa_manifest_hard",
        "platform": "tiktok",
        "name": "TikTok C2PA 标注硬规则",
        "severity": "BLOCK",
        "subject_type": "asset",
        "check_type": "c2pa_manifest",
        "threshold": {},
        "evidence_requirements": {"require_c2pa": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "C2PA 标注必须存在",
    },
]

# TikTok 软规则（FLAG）- 建议通过
TIKTOK_SOFT_RULES = [
    {
        "rule_id": "tiktok_content_risk_soft",
        "platform": "tiktok",
        "name": "TikTok 内容风险软规则",
        "severity": "FLAG",
        "subject_type": "scene_version",
        "check_type": "content_risk",
        "threshold": {"max_risk_score": 0.3},
        "evidence_requirements": {"require_risk_check": True},
        "auto_checkable": False,
        "manual_review_required": True,
        "failure_message": "内容可能存在风险，需要人工审核",
    },
    {
        "rule_id": "tiktok_style_match_soft",
        "platform": "tiktok",
        "name": "TikTok 风格匹配软规则",
        "severity": "FLAG",
        "subject_type": "scene_version",
        "check_type": "style_match",
        "threshold": {"min_style_score": 0.7},
        "evidence_requirements": {"require_style_check": True},
        "auto_checkable": False,
        "manual_review_required": True,
        "failure_message": "内容风格与 TikTok 平台匹配度可能不足",
    },
    {
        "rule_id": "tiktok_cover_quality_soft",
        "platform": "tiktok",
        "name": "TikTok 封面质量软规则",
        "severity": "FLAG",
        "subject_type": "asset",
        "check_type": "cover_quality",
        "threshold": {"min_cover_score": 0.6},
        "evidence_requirements": {"require_cover_check": True},
        "auto_checkable": False,
        "manual_review_required": True,
        "failure_message": "封面质量可能不足，需要人工审核",
    },
    {
        "rule_id": "tiktok_semantic_relevance_soft",
        "platform": "tiktok",
        "name": "TikTok 语义相关性软规则",
        "severity": "FLAG",
        "subject_type": "scene_version",
        "check_type": "semantic_relevance",
        "threshold": {"min_relevance_score": 0.5},
        "evidence_requirements": {"require_semantic_check": True},
        "auto_checkable": False,
        "manual_review_required": True,
        "failure_message": "内容语义与主题相关性可能不足",
    },
    {
        "rule_id": "tiktok_duration_soft",
        "platform": "tiktok",
        "name": "TikTok 建议时长软规则",
        "severity": "FLAG",
        "subject_type": "asset",
        "check_type": "duration",
        "threshold": {"min_duration": 15.0, "max_duration": 60.0},
        "evidence_requirements": {"require_duration": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "建议时长在 15-60 秒范围内以获得更好推荐",
    },
    {
        "rule_id": "tiktok_resolution_soft",
        "platform": "tiktok",
        "name": "TikTok 建议分辨率软规则",
        "severity": "FLAG",
        "subject_type": "asset",
        "check_type": "resolution",
        "threshold": {"min_width": 1080, "min_height": 1920},
        "evidence_requirements": {"require_resolution": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "建议分辨率为 1080x1920 以获得最佳画质",
    },
    {
        "rule_id": "tiktok_loudness_soft",
        "platform": "tiktok",
        "name": "TikTok 建议响度软规则",
        "severity": "FLAG",
        "subject_type": "asset",
        "check_type": "loudness",
        "threshold": {"min_lufs": -13.0, "max_lufs": -10.0},
        "evidence_requirements": {"require_loudness": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "建议响度在 -13 到 -10 LUFS 范围内",
    },
    {
        "rule_id": "tiktok_aspect_ratio_soft",
        "platform": "tiktok",
        "name": "TikTok 宽高比软规则",
        "severity": "FLAG",
        "subject_type": "asset",
        "check_type": "resolution",
        "threshold": {"aspect_ratio": "9:16"},
        "evidence_requirements": {"require_aspect_ratio": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "建议宽高比为 9:16",
    },
    {
        "rule_id": "tiktok_fps_soft",
        "platform": "tiktok",
        "name": "TikTok 帧率软规则",
        "severity": "FLAG",
        "subject_type": "asset",
        "check_type": "resolution",
        "threshold": {"min_fps": 24},
        "evidence_requirements": {"require_fps": True},
        "auto_checkable": True,
        "manual_review_required": False,
        "failure_message": "���议帧率至少 24fps",
    },
]

# 合并 TikTok 所有规则
TIKTOK_ALL_RULES = TIKTOK_HARD_RULES + TIKTOK_SOFT_RULES

# 填充 BUILTIN_RULES_BY_PLATFORM
BUILTIN_RULES_BY_PLATFORM["tiktok"] = TIKTOK_ALL_RULES


def get_rules_by_platform(
    platform: str,
    severity: Optional[str] = None,
) -> list[dict[str, Any]]:
    """获取指定平台的规则

    Args:
        platform: 目标平台 (tiktok/douyin/youtube)
        severity: 严重程度过滤 (BLOCK/FLAG)，不传则返回全部

    Returns:
        list[dict]: 规则列表
    """
    rules = TIKTOK_ALL_RULES if platform == "tiktok" else []

    if severity:
        rules = [r for r in rules if r.get("severity") == severity]

    return rules


def get_hard_rules(platform: str) -> list[dict[str, Any]]:
    """获取指定平台的硬规则（BLOCK）"""
    return get_rules_by_platform(platform, severity="BLOCK")


def get_soft_rules(platform: str) -> list[dict[str, Any]]:
    """获取指定平台的软规则（FLAG）"""
    return get_rules_by_platform(platform, severity="FLAG")