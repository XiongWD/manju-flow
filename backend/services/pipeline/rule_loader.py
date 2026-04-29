"""Rule Loader Draft — 041a.1 Minimal Incision

唯一切口：从数据源加载规则定义，返回结构化列表。

职责边界：
  ✅ 规则定义来源声明（内置 / JSON 文件 / 未来 DB）
  ✅ 统一解析入口
  ✅ 返回结构化的 list[dict]（与 RuleCreate schema 字段对齐）
  ❌ auto/manual boundary 清单（见 rules.py）
  ❌ target_platform fallback 继承（见 rules.py）
  ❌ 规则执行（executor 职责）
  ❌ 数据库持久化
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── 数据源优先级 ───────────────────────────────────────────
# 1. 内置常量（BUILTIN_RULES）— 作为 seed / 兜底
# 2. JSON 文件（rules_file）— 覆盖同 rule_id 的内置规则
# 3. 未来：数据库 — 最高优先级，未实现
# ──────────────────────────────────────────────────────────


class RuleLoader:
    """规则加载器草案

    Usage::

        loader = RuleLoader()
        rules = await loader.load(platform="tiktok")
        # rules: list[dict] — 每项与 RuleCreate schema 对齐
    """

    DEFAULT_RULES_FILE = Path(__file__).parent.parent / "data" / "rules.json"

    def __init__(
        self,
        rules_file: Optional[Path] = None,
        builtin_rules: Optional[list[dict[str, Any]]] = None,
    ) -> None:
        self.rules_file = rules_file or self.DEFAULT_RULES_FILE
        self._builtin: list[dict[str, Any]] = builtin_rules or []
        self._cache: Optional[list[dict[str, Any]]] = None

    # ── 解析入口 ────────────────────────────────────────────

    async def load(
        self,
        *,
        platform: Optional[str] = None,
        subject_type: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """统一解析入口。

        加载顺序：内置 → JSON 文件（同 rule_id 文件优先）→ 过滤。

        Args:
            platform:       平台过滤 (e.g. "tiktok")
            subject_type:   检查对象类型过滤 (asset|scene_version|episode|publish_bundle)
            severity:       严重程度过滤 (BLOCK|FLAG)

        Returns:
            list[dict]: 规则列表，每项字段与 schemas/rule.py.RuleCreate 对齐。
        """
        rules = await self._load_merged()

        if platform:
            rules = [r for r in rules if r.get("platform") == platform]
        if subject_type:
            rules = [r for r in rules if r.get("subject_type") == subject_type]
        if severity:
            rules = [r for r in rules if r.get("severity") == severity]

        return rules

    # ── 内部实现 ────────────────────────────────────────────

    async def _load_merged(self) -> list[dict[str, Any]]:
        """合并内置规则 + 文件规则，带缓存。"""
        if self._cache is not None:
            return self._cache

        merged: dict[str, dict[str, Any]] = {}

        # 1. 内置规则
        for rule in self._builtin:
            rid = rule.get("rule_id", "")
            if rid:
                merged[rid] = rule

        # 2. 文件规则（覆盖内置）
        file_rules = await self._load_from_file()
        for rule in file_rules:
            rid = rule.get("rule_id", "")
            if rid:
                merged[rid] = rule

        self._cache = list(merged.values())
        return self._cache

    async def _load_from_file(self) -> list[dict[str, Any]]:
        """从 JSON 文件加载规则定义。

        支持两种 JSON 结构：
        - 扁平列表: [{"rule_id": "...", ...}, ...]
        - 嵌套字典: {"tiktok": {"hard_rules": [...], "soft_rules": [...]}}

        文件不存在或格式错误时返回空列表（不抛异常）。
        """
        if not self.rules_file.exists():
            return []

        try:
            raw = json.loads(self.rules_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Failed to load rules file %s: %s", self.rules_file, exc)
            return []

        if isinstance(raw, list):
            return [r for r in raw if isinstance(r, dict)]

        if isinstance(raw, dict):
            flat: list[dict[str, Any]] = []
            for v in raw.values():
                if isinstance(v, list):
                    flat.extend(r for r in v if isinstance(r, dict))
                elif isinstance(v, dict):
                    for vv in v.values():
                        if isinstance(vv, list):
                            flat.extend(r for r in vv if isinstance(r, dict))
            return flat

        return []

    def invalidate_cache(self) -> None:
        """失效缓存（规则更新后调用）。"""
        self._cache = None
