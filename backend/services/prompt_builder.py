"""Prompt Builder 服务 — Prompt 拼接与来源追踪

将 character_desc + location_desc + prop_states + action + style 拼接成完整 prompt，
并记录每个部分的来源（template_id / character_id / location_id / prop_id）。
"""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    Character,
    Location,
    PropState,
    PromptTemplate,
    Scene,
)


# 默认负面 prompt
_DEFAULT_NEGATIVE = "blurry, low quality, watermark, deformed, ugly, bad anatomy, bad hands"


class PromptBuilder:
    """Prompt 拼接与来源追踪"""

    async def build_prompt(
        self,
        db: AsyncSession,
        project_id: str,
        scene_id: str,
        template_id: Optional[str] = None,
        character_ids: Optional[list[str]] = None,
        location_id: Optional[str] = None,
        prop_state_ids: Optional[list[str]] = None,
        action_description: Optional[str] = None,
        style_override: Optional[str] = None,
    ) -> dict:
        """构建 prompt_bundle

        Returns:
            {
                "positive": str,          # 正向 prompt
                "negative": str,          # 负向 prompt
                "sources": {              # 来源追踪
                    "template_id": str,
                    "template_name": str,
                    "characters": [...],
                    "location": {...},
                    "props": [...],
                    "action": str,
                    "style": str,
                },
                "template_version": int,
            }
        """
        character_ids = character_ids or []
        prop_state_ids = prop_state_ids or []

        # ── 1. 加载模板 ──────────────────────────────────────────────────
        template = None
        if template_id:
            template = await db.get(PromptTemplate, template_id)
        if template is None:
            # 查找项目默认模板
            result = await db.execute(
                select(PromptTemplate).where(
                    PromptTemplate.project_id == project_id,
                    PromptTemplate.is_default.is_(True),
                )
            )
            template = result.scalars().first()

        template_text = template.template_text if template and template.template_text else None

        # ── 2. 收集角色描述 ──────────────────────────────────────────────
        character_descs = []
        character_sources = []
        if character_ids:
            result = await db.execute(
                select(Character).where(Character.id.in_(character_ids))
            )
            for char in result.scalars().all():
                desc = f"{char.name}: {char.description}" if char.description else char.name
                character_descs.append(desc)
                character_sources.append({
                    "id": char.id,
                    "name": char.name,
                    "description": char.description,
                })

        character_desc_block = ", ".join(character_descs)

        # ── 3. 收集地点描述 ──────────────────────────────────────────────
        location_source = None
        location_desc_block = ""
        if location_id:
            loc = await db.get(Location, location_id)
            if loc:
                parts = [loc.name]
                if loc.description:
                    parts.append(loc.description)
                if loc.visual_style:
                    parts.append(loc.visual_style)
                location_desc_block = ", ".join(parts)
                location_source = {
                    "id": loc.id,
                    "name": loc.name,
                    "description": loc.description,
                    "visual_style": loc.visual_style,
                }

        # ── 4. 收集道具状态 ─────────────────────────────────────────────
        prop_descs = []
        prop_sources = []
        if prop_state_ids:
            result = await db.execute(
                select(PropState).where(PropState.id.in_(prop_state_ids))
            )
            for ps in result.scalars().all():
                prop = await db.get(ps.__class__.prop.property.mapper.class_, ps.prop_id)
                name = prop.name if prop else "unknown"
                parts = [name]
                if ps.state_description:
                    parts.append(ps.state_description)
                if ps.visual_notes:
                    parts.append(ps.visual_notes)
                prop_descs.append(", ".join(parts))
                prop_sources.append({
                    "id": ps.id,
                    "prop_id": ps.prop_id,
                    "prop_name": name,
                    "state_description": ps.state_description,
                    "visual_notes": ps.visual_notes,
                })

        prop_desc_block = ", ".join(prop_descs)

        # ── 5. 动作与风格 ───────────────────────────────────────────────
        action_block = action_description or ""
        style_block = style_override or ""

        # ── 6. 组装 prompt ─────────────────────────────────────────────
        if template_text:
            positive = template_text.format(
                character_desc=character_desc_block,
                location_desc=location_desc_block,
                prop_desc=prop_desc_block,
                action=action_block,
                style=style_block,
            )
        else:
            # 默认拼接顺序：角色 → 地点 → 道具 → 动作 → 风格
            parts = []
            if character_desc_block:
                parts.append(character_desc_block)
            if location_desc_block:
                parts.append(location_desc_block)
            if prop_desc_block:
                parts.append(prop_desc_block)
            if action_block:
                parts.append(action_block)
            if style_block:
                parts.append(style_block)
            positive = ", ".join(parts)

        # Negative prompt
        negative = _DEFAULT_NEGATIVE

        # ── 7. 来源追踪 ───────────────────────────────────────────────
        sources = {
            "template_id": template.id if template else None,
            "template_name": template.name if template else None,
            "characters": character_sources,
            "location": location_source,
            "props": prop_sources,
            "action": action_description,
            "style": style_override,
        }

        return {
            "positive": positive.strip(),
            "negative": negative,
            "sources": sources,
            "template_version": template.version if template else None,
        }
