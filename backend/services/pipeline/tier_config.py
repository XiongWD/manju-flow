"""Tier 配置解析工具。"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Episode, Project, ProjectConfig

VALID_TIERS = ("A", "S", "SS", "SSS")
DEFAULT_TIER = "A"
EPISODE_TIER_OVERRIDES_KEY = "episode_tier_overrides"


def normalize_tier(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    tier = str(value).strip().upper()
    return tier if tier in VALID_TIERS else None


def get_project_default_tier(project: Project) -> str:
    return normalize_tier(project.tier) or DEFAULT_TIER


async def _get_episode_override_map(db: AsyncSession, project_id: str) -> dict:
    result = await db.execute(
        select(ProjectConfig).where(
            ProjectConfig.project_id == project_id,
            ProjectConfig.config_key == EPISODE_TIER_OVERRIDES_KEY,
        )
    )
    rows = result.scalars().all()
    if not rows:
        return {}

    latest = max(rows, key=lambda x: (x.version or 0, x.updated_at))
    value = latest.config_value_json or {}
    return value if isinstance(value, dict) else {}


async def resolve_episode_tier(
    db: AsyncSession,
    *,
    episode: Optional[Episode] = None,
    episode_id: Optional[str] = None,
) -> dict[str, str]:
    if episode is None:
        if not episode_id:
            raise ValueError("episode or episode_id is required")
        episode = await db.get(Episode, episode_id)

    if episode is None:
        raise ValueError("Episode not found")

    project = await db.get(Project, episode.project_id)
    if project is None:
        return {"tier": DEFAULT_TIER, "source": "default_fallback"}

    project_tier = get_project_default_tier(project)
    overrides = await _get_episode_override_map(db, project.id)
    override_tier = normalize_tier(overrides.get(episode.id))
    if override_tier:
        return {"tier": override_tier, "source": "episode_override"}

    return {"tier": project_tier, "source": "project_default"}
