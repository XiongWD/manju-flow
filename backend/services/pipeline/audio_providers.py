"""Audio Generation — TTS Provider 实现

从 audio.py 拆分：ElevenLabs 和 Fish Audio 的调用逻辑
"""

import hashlib
from typing import Optional

from database.models import Asset, AssetLink, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from services.storage.service import get_storage_service

from .base import PipelineError


class ElevenLabsMixin:
    """ElevenLabs TTS 调用 mixin"""

    async def _call_elevenlabs(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        text: str,
        voice_config: dict,
    ) -> Asset:
        """调用 ElevenLabs TTS 生成音频"""
        voice_id = voice_config.get("voice_id") or voice_config.get("elevenlabs_voice_id", "default")
        model_id = voice_config.get("model", "eleven_multilingual_v2")

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": voice_config.get("params", {
                "stability": 0.5,
                "similarity_boost": 0.5,
            }),
        }

        async def _create_tts(client):
            if voice_id != "default":
                response = await client.post(
                    f"{self.elevenlabs_base}/v1/text-to-speech/{voice_id}",
                    headers={"xi-api-key": self.elevenlabs_key},
                    json=payload,
                )
            else:
                response = await client.post(
                    f"{self.elevenlabs_base}/v1/text-to-speech",
                    headers={"xi-api-key": self.elevenlabs_key},
                    json={**payload, "voice_id": "default"},
                )
            response.raise_for_status()
            return response.content

        audio_data = await self._retry_wrapper(_create_tts, timeout_category="audio")

        filename = f"elevenlabs_{scene_version.id[:8]}_{voice_id[:8]}.mp3"
        storage_svc = get_storage_service()
        save_result = await storage_svc.save_bytes(
            audio_data, filename, mime_type="audio/mpeg", prefix="audio",
        )

        asset = Asset(
            id=hashlib.sha256(filename.encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="audio",
            uri=save_result["uri"],
            mime_type="audio/mpeg",
            file_size=save_result["size"],
            metadata_json={
                "provider": "elevenlabs",
                "voice_id": voice_id,
                "model": model_id,
                "text_length": len(text),
                "checksum": save_result["checksum"],
            },
        )
        db.add(asset)
        await db.flush()

        link = AssetLink(
            id=hashlib.sha256(f"{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id, owner_type="scene_version",
            owner_id=scene_version.id, relation_type="output",
        )
        db.add(link)
        await db.flush()

        estimated_cost = len(text) / 1000.0 * 0.15
        self.record_cost("audio_generation", estimated_cost, {
            "provider": "elevenlabs",
            "text_length": len(text),
            "voice_id": voice_id,
        })

        return asset


class FishAudioMixin:
    """Fish Audio TTS 调用 mixin（Fallback）"""

    async def _call_fish_audio(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        text: str,
        voice_config: dict,
    ) -> Asset:
        """调用 Fish Audio TTS 生成音频（Fallback）"""
        voice_id = voice_config.get("voice_id") or voice_config.get("fish_audio_voice_id", "default")
        model_id = voice_config.get("model", "fish-speech-1.4")

        payload = {
            "text": text,
            "voice": voice_id,
            "model": model_id,
        }

        async def _create_tts(client):
            response = await client.post(
                f"{self.fish_audio_base}/v1/tts",
                headers={"Authorization": f"Bearer {self.fish_audio_key}"},
                json=payload,
            )
            response.raise_for_status()
            return response.content

        audio_data = await self._retry_wrapper(_create_tts, timeout_category="audio")

        filename = f"fish_audio_{scene_version.id[:8]}_{voice_id[:8]}.mp3"
        storage_svc = get_storage_service()
        save_result = await storage_svc.save_bytes(
            audio_data, filename, mime_type="audio/mpeg", prefix="audio",
        )

        asset = Asset(
            id=hashlib.sha256(filename.encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="audio",
            uri=save_result["uri"],
            mime_type="audio/mpeg",
            file_size=save_result["size"],
            metadata_json={
                "provider": "fish_audio",
                "voice_id": voice_id,
                "model": model_id,
                "text_length": len(text),
                "checksum": save_result["checksum"],
            },
        )
        db.add(asset)
        await db.flush()

        link = AssetLink(
            id=hashlib.sha256(f"{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id, owner_type="scene_version",
            owner_id=scene_version.id, relation_type="output",
        )
        db.add(link)
        await db.flush()

        estimated_cost = len(text) / 1000.0 * 0.10
        self.record_cost("audio_generation", estimated_cost, {
            "provider": "fish_audio",
            "text_length": len(text),
            "voice_id": voice_id,
        })

        return asset
