"""Audio Generation — Phase 2

音频生成模块（拆分后）：
- AudioGenerator(PipelineClient) — 主类，通过 mixin 组合功能
- ElevenLabs → Fish Audio fallback
- audio_providers.py: TTS 调用实现
- audio_evidence.py: BGM + 证据资产

保持 import 兼容：from services.pipeline.audio import AudioGenerator
"""

import time
from typing import Optional

from database.models import Asset, AssetLink, JobStep, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from .audio_evidence import BGMMixin, EvidenceMixin
from .audio_providers import ElevenLabsMixin, FishAudioMixin
from .base import PipelineClient, PipelineError
from .config import get_provider_config


class AudioGenerator(
    ElevenLabsMixin, FishAudioMixin, BGMMixin, EvidenceMixin, PipelineClient
):
    """音频生成器（ElevenLabs → Fish Audio fallback）"""

    def __init__(self):
        elevenlabs_config = get_provider_config("elevenlabs")
        fish_audio_config = get_provider_config("fish_audio")

        self.elevenlabs_key = elevenlabs_config["key"]
        self.elevenlabs_base = elevenlabs_config["base_url"]
        self.fish_audio_key = fish_audio_config["key"]
        self.fish_audio_base = fish_audio_config["base_url"]

        self._provider_attempts = []

    async def generate(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        text: str,
        voice_config: dict,
        step: JobStep,
    ) -> Asset:
        """生成音频

        Args:
            db: 数据库 session
            scene_version: 场景版本
            text: 待合成文本
            voice_config: 声音配置（provider, voice_id, params）
            step: 当前 JobStep

        Returns:
            Asset: 生成的音频资产

        Raises:
            PipelineError: 所有 provider 都失败
        """
        self._provider_attempts = []

        # 1. 尝试 ElevenLabs
        if self.elevenlabs_key:
            try:
                asset = await self._call_elevenlabs(
                    db=db, scene_version=scene_version,
                    text=text, voice_config=voice_config,
                )
                self._provider_attempts.append({
                    "provider": "elevenlabs", "success": True,
                    "timestamp": time.time(),
                })
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts
                return asset
            except PipelineError as e:
                self._provider_attempts.append({
                    "provider": "elevenlabs", "success": False,
                    "error": e.message, "timestamp": time.time(),
                })
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts

        # 2. Fallback 到 Fish Audio
        if self.fish_audio_key:
            try:
                asset = await self._call_fish_audio(
                    db=db, scene_version=scene_version,
                    text=text, voice_config=voice_config,
                )
                self._provider_attempts.append({
                    "provider": "fish_audio", "success": True,
                    "timestamp": time.time(),
                })
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts
                return asset
            except PipelineError as e:
                self._provider_attempts.append({
                    "provider": "fish_audio", "success": False,
                    "error": e.message, "timestamp": time.time(),
                })
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts

        raise PipelineError(
            message="All audio providers failed",
            error_type="provider_error",
            details={"attempts": self._provider_attempts},
        )
