"""Audio Config Inheritance — project → episode → scene

三级音频配置继承解析：
1. project default (via ProjectConfig with config_key="audio_config")
2. episode override (via ProjectConfig with config_key="episode_audio_overrides")
3. scene override (via scene_version.model_bundle)

Follows the same pattern as tier_config.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Episode, Project, ProjectConfig, SceneVersion

# ── ProjectConfig keys ──────────────────────────────────────────────────────

AUDIO_CONFIG_KEY = "audio_config"
EPISODE_AUDIO_OVERRIDES_KEY = "episode_audio_overrides"

# ── Defaults ────────────────────────────────────────────────────────────────

DEFAULT_VOICE_PROVIDER = "elevenlabs"
DEFAULT_BGM_PROVIDER = "suno"

DEFAULT_VOICE_CONFIG = {
    "provider": DEFAULT_VOICE_PROVIDER,
    "voice_id": "default",
    "params": {
        "stability": 0.5,
        "similarity_boost": 0.5,
    },
}

DEFAULT_BGM_CONFIG = {
    "provider": DEFAULT_BGM_PROVIDER,
    "style": "cinematic",
    "volume": 0.3,
    "fade_in": 1.0,
    "fade_out": 2.0,
    "loop": True,
}

DEFAULT_MIX_CONFIG = {
    "voice_volume": 1.0,
    "bgm_volume": 0.3,
    "sample_rate": 44100,
    "format": "mp3",
}


# ── Dataclasses ─────────────────────────────────────────────────────────────

@dataclass
class AudioConfig:
    """统一音频配置——够 040b 前端展示"""
    voice: dict = field(default_factory=lambda: dict(DEFAULT_VOICE_CONFIG))
    bgm: dict = field(default_factory=lambda: dict(DEFAULT_BGM_CONFIG))
    mix: dict = field(default_factory=lambda: dict(DEFAULT_MIX_CONFIG))

    def to_dict(self) -> dict:
        return {"voice": self.voice, "bgm": self.bgm, "mix": self.mix}

    @classmethod
    def from_dict(cls, d: dict) -> AudioConfig:
        return cls(
            voice={**DEFAULT_VOICE_CONFIG, **(d.get("voice") or {})},
            bgm={**DEFAULT_BGM_CONFIG, **(d.get("bgm") or {})},
            mix={**DEFAULT_MIX_CONFIG, **(d.get("mix") or {})},
        )


# ── Resolver ────────────────────────────────────────────────────────────────

async def _get_project_audio_config(db: AsyncSession, project_id: str) -> dict:
    """从 project_configs 读取 project-level audio config"""
    result = await db.execute(
        select(ProjectConfig).where(
            ProjectConfig.project_id == project_id,
            ProjectConfig.config_key == AUDIO_CONFIG_KEY,
        )
    )
    rows = result.scalars().all()
    if not rows:
        return {}

    latest = max(rows, key=lambda x: (x.version or 0, x.updated_at))
    return latest.config_value_json or {}


async def _get_episode_audio_overrides(db: AsyncSession, project_id: str) -> dict:
    """从 project_configs 读取 episode 层 audio overrides"""
    result = await db.execute(
        select(ProjectConfig).where(
            ProjectConfig.project_id == project_id,
            ProjectConfig.config_key == EPISODE_AUDIO_OVERRIDES_KEY,
        )
    )
    rows = result.scalars().all()
    if not rows:
        return {}

    latest = max(rows, key=lambda x: (x.version or 0, x.updated_at))
    value = latest.config_value_json or {}
    return value if isinstance(value, dict) else {}


async def resolve_audio_config(
    db: AsyncSession,
    *,
    project_id: str,
    episode_id: Optional[str] = None,
    scene_version: Optional[SceneVersion] = None,
) -> AudioConfig:
    """解析三级音频配置（project → episode → scene）

    Args:
        db: 数据库 session
        project_id: 项目 ID
        episode_id: 集 ID（可选，用于 episode 层 override）
        scene_version: 场景版本（可选，用于 scene 层 override）

    Returns:
        AudioConfig: 合并后的音频配置
    """
    # 1. project default
    base = AudioConfig.from_dict(await _get_project_audio_config(db, project_id))

    # 2. episode override
    if episode_id:
        overrides = await _get_episode_audio_overrides(db, project_id)
        episode_cfg = overrides.get(episode_id, {})
        if episode_cfg:
            merged = base.to_dict()
            for section in ("voice", "bgm", "mix"):
                if section in episode_cfg:
                    merged[section] = {**merged.get(section, {}), **episode_cfg[section]}
            base = AudioConfig.from_dict(merged)

    # 3. scene override (from scene_version.model_bundle)
    if scene_version and scene_version.model_bundle:
        scene_audio = scene_version.model_bundle.get("audio", {})
        if scene_audio:
            merged = base.to_dict()
            for section in ("voice", "bgm", "mix"):
                if section in scene_audio:
                    merged[section] = {**merged.get(section, {}), **scene_audio[section]}
            base = AudioConfig.from_dict(merged)

    return base


async def resolve_voice_config(
    db: AsyncSession,
    *,
    project_id: str,
    episode_id: Optional[str] = None,
    scene_version: Optional[SceneVersion] = None,
) -> dict:
    """快捷获取 voice config"""
    cfg = await resolve_audio_config(
        db, project_id=project_id, episode_id=episode_id, scene_version=scene_version,
    )
    return cfg.voice


async def resolve_bgm_config(
    db: AsyncSession,
    *,
    project_id: str,
    episode_id: Optional[str] = None,
    scene_version: Optional[SceneVersion] = None,
) -> dict:
    """快捷获取 bgm config"""
    cfg = await resolve_audio_config(
        db, project_id=project_id, episode_id=episode_id, scene_version=scene_version,
    )
    return cfg.bgm


async def resolve_mix_config(
    db: AsyncSession,
    *,
    project_id: str,
    episode_id: Optional[str] = None,
    scene_version: Optional[SceneVersion] = None,
) -> dict:
    """快捷获取 mix config"""
    cfg = await resolve_audio_config(
        db, project_id=project_id, episode_id=episode_id, scene_version=scene_version,
    )
    return cfg.mix
