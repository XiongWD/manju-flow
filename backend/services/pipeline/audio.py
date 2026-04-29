"""Audio Generation — Phase 2

音频生成模块：
- AudioGenerator(PipelineClient)
- 主路径：ElevenLabs TTS
- Fallback：Fish Audio TTS
- 返回 Asset + AssetLink
- 记录 provider_attempts 到 job_step metadata
"""

import hashlib
import json
import time
from typing import Optional

from database.models import Asset, AssetLink, JobStep, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from .base import PipelineClient, PipelineError
from .config import get_provider_config


class AudioGenerator(PipelineClient):
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
                    db=db,
                    scene_version=scene_version,
                    text=text,
                    voice_config=voice_config,
                )
                self._provider_attempts.append({
                    "provider": "elevenlabs",
                    "success": True,
                    "timestamp": time.time(),
                })
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts
                return asset
            except PipelineError as e:
                self._provider_attempts.append({
                    "provider": "elevenlabs",
                    "success": False,
                    "error": e.message,
                    "timestamp": time.time(),
                })
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts

        # 2. Fallback 到 Fish Audio
        if self.fish_audio_key:
            try:
                asset = await self._call_fish_audio(
                    db=db,
                    scene_version=scene_version,
                    text=text,
                    voice_config=voice_config,
                )
                self._provider_attempts.append({
                    "provider": "fish_audio",
                    "success": True,
                    "timestamp": time.time(),
                })
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts
                return asset
            except PipelineError as e:
                self._provider_attempts.append({
                    "provider": "fish_audio",
                    "success": False,
                    "error": e.message,
                    "timestamp": time.time(),
                })
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts

        raise PipelineError(
            message="All audio providers failed",
            error_type="provider_error",
            details={"attempts": self._provider_attempts},
        )

    async def _call_elevenlabs(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        text: str,
        voice_config: dict,
    ) -> Asset:
        """调用 ElevenLabs TTS 生成音频

        Args:
            db: 数据库 session
            scene_version: 场景版本
            text: 待合成文本
            voice_config: 声音配置

        Returns:
            Asset: 生成的音频资产
        """
        voice_id = voice_config.get("voice_id") or voice_config.get("elevenlabs_voice_id", "default")
        model_id = voice_config.get("model", "eleven_multilingual_v2")

        # 构造请求 payload（根据 ElevenLabs 实际 API 调整）
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": voice_config.get("params", {
                "stability": 0.5,
                "similarity_boost": 0.5,
            }),
        }

        # 1. 创建 TTS 任务
        async def _create_tts(client):
            if voice_id != "default":
                # 使用指定 voice
                response = await client.post(
                    f"{self.elevenlabs_base}/v1/text-to-speech/{voice_id}",
                    headers={"xi-api-key": self.elevenlabs_key},
                    json=payload,
                )
            else:
                # 使用默认 voice
                response = await client.post(
                    f"{self.elevenlabs_base}/v1/text-to-speech",
                    headers={"xi-api-key": self.elevenlabs_key},
                    json={**payload, "voice_id": "default"},
                )
            response.raise_for_status()
            return response.content

        audio_data = await self._retry_wrapper(_create_tts, timeout_category="audio")

        # 生成文件名
        filename = f"elevenlabs_{scene_version.id[:8]}_{voice_id[:8]}.mp3"
        storage_path = f"audio/{filename}"

        # TODO: 保存到 MinIO/local storage
        audio_uri = f"file://{storage_path}"

        # 创建 Asset
        asset = Asset(
            id=hashlib.sha256(filename.encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="audio",
            uri=audio_uri,
            mime_type="audio/mpeg",
            file_size=len(audio_data),
            metadata_json={
                "provider": "elevenlabs",
                "voice_id": voice_id,
                "model": model_id,
                "text_length": len(text),
            },
        )
        db.add(asset)
        await db.flush()

        # 创建 AssetLink
        link = AssetLink(
            id=hashlib.sha256(f"{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id,
            owner_type="scene_version",
            owner_id=scene_version.id,
            relation_type="output",
        )
        db.add(link)
        await db.flush()

        # 记录成本（根据 ElevenLabs 实际定价调整）
        # 假设：$0.15/1000 字符
        estimated_cost = len(text) / 1000.0 * 0.15
        self.record_cost("audio_generation", estimated_cost, {
            "provider": "elevenlabs",
            "text_length": len(text),
            "voice_id": voice_id,
        })

        return asset

    async def _call_fish_audio(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        text: str,
        voice_config: dict,
    ) -> Asset:
        """调用 Fish Audio TTS 生成音频（Fallback）

        Args:
            db: 数据库 session
            scene_version: 场景版本
            text: 待合成文本
            voice_config: 声音配置

        Returns:
            Asset: 生成的音频资产
        """
        voice_id = voice_config.get("voice_id") or voice_config.get("fish_audio_voice_id", "default")
        model_id = voice_config.get("model", "fish-speech-1.4")

        # 构造请求 payload（根据 Fish Audio 实际 API 调整）
        payload = {
            "text": text,
            "voice": voice_id,
            "model": model_id,
        }

        # 1. 创建 TTS 任务
        async def _create_tts(client):
            response = await client.post(
                f"{self.fish_audio_base}/v1/tts",
                headers={"Authorization": f"Bearer {self.fish_audio_key}"},
                json=payload,
            )
            response.raise_for_status()
            return response.content

        audio_data = await self._retry_wrapper(_create_tts, timeout_category="audio")

        # 生成文件名
        filename = f"fish_audio_{scene_version.id[:8]}_{voice_id[:8]}.mp3"
        storage_path = f"audio/{filename}"

        # TODO: 保存到 MinIO/local storage
        audio_uri = f"file://{storage_path}"

        # 创建 Asset
        asset = Asset(
            id=hashlib.sha256(filename.encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="audio",
            uri=audio_uri,
            mime_type="audio/mpeg",
            file_size=len(audio_data),
            metadata_json={
                "provider": "fish_audio",
                "voice_id": voice_id,
                "model": model_id,
                "text_length": len(text),
            },
        )
        db.add(asset)
        await db.flush()

        # 创建 AssetLink
        link = AssetLink(
            id=hashlib.sha256(f"{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id,
            owner_type="scene_version",
            owner_id=scene_version.id,
            relation_type="output",
        )
        db.add(link)
        await db.flush()

        # 记录成本（假设：$0.10/1000 字符）
        estimated_cost = len(text) / 1000.0 * 0.10
        self.record_cost("audio_generation", estimated_cost, {
            "provider": "fish_audio",
            "text_length": len(text),
            "voice_id": voice_id,
        })

        return asset

    # ── BGM 生成（040a: mock placeholder，显式标注） ───────────────

    async def generate_bgm(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        bgm_config: dict,
        step: JobStep,
    ) -> Asset:
        """生成 BGM / 背景音乐

        040a 阶段：mock placeholder。
        真实 provider 替换入口：替换此方法为真实 Suno / 等价 API 调用，
        保留相同签名和资产创建逻辑。

        Args:
            db: 数据库 session
            scene_version: 场景版本
            bgm_config: BGM 配置（来自 config_audio.py 的三级继承）
            step: 当前 JobStep

        Returns:
            Asset: BGM 音频资产
        """
        provider = bgm_config.get("provider", "suno")
        style = bgm_config.get("style", "cinematic")
        volume = bgm_config.get("volume", 0.3)
        duration_sec = bgm_config.get("duration_sec", 10.0)

        # 显式标注：当前为 mock 实现
        mock_note = {
            "mock": True,
            "mock_reason": "040a BGM provider not yet integrated",
            "real_provider_replacement": "替换 generate_bgm() 方法为真实 Suno / 等价 API 调用",
            "bgm_config_source": "config_audio.py resolve_bgm_config()",
        }

        filename = f"bgm_{scene_version.id[:8]}_{style[:8]}.mp3"
        storage_path = f"audio/bgm/{filename}"
        audio_uri = f"file://{storage_path}"

        asset = Asset(
            id=hashlib.sha256(f"bgm_{filename}".encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="audio",
            uri=audio_uri,
            mime_type="audio/mpeg",
            file_size=0,
            duration=duration_sec,
            metadata_json={
                "provider": provider,
                "style": style,
                "volume": volume,
                "duration_sec": duration_sec,
                "source": "bgm_generation",
                "mock": mock_note,
            },
        )
        db.add(asset)
        await db.flush()

        link = AssetLink(
            id=hashlib.sha256(f"bgm_link_{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id,
            owner_type="scene_version",
            owner_id=scene_version.id,
            relation_type="output",
        )
        db.add(link)

        # 记录到 step metadata，标注为 mock
        if step:
            step.metadata_json = step.metadata_json or {}
            step.metadata_json["bgm_generation"] = mock_note
            step.metadata_json["bgm_asset_id"] = asset.id

        await db.flush()

        return asset

    # ── 检测 / 证据资产 ──────────────────────────────────────────

    async def create_loudness_asset(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        voice_asset: Asset,
        bgm_asset: Optional[Asset],
        step: JobStep,
    ) -> Asset:
        """创建响度检测 JSON 证据资产

        040a 阶段：mock 数据，模拟真实响度检测结果。
        真实替换入口：替换为 actual loudness measurement (LUFS / True Peak)。

        Args:
            db: 数据库 session
            scene_version: 场景版本
            voice_asset: 语音资产
            bgm_asset: BGM 资产（可选）
            step: 当前 JobStep

        Returns:
            Asset: 响度检测 JSON 资产
        """
        loudness_data = {
            "source": "loudness_detection",
            "mock": True,
            "mock_reason": "040a real loudness measurement not yet integrated",
            "integrated_lufs": -16.0,  # EBU R128 目标值
            "true_peak_db": -1.5,
            "loudness_range": 8.0,
            "voice": {
                "asset_id": voice_asset.id,
                "integrated_lufs": -14.0,
                "true_peak_db": -1.0,
            },
            "bgm": {
                "asset_id": bgm_asset.id if bgm_asset else None,
                "integrated_lufs": -22.0,
                "true_peak_db": -3.0,
            } if bgm_asset else None,
            "thresholds": {
                "integrated_lufs_min": -23.0,
                "integrated_lufs_max": -9.0,
                "true_peak_db_max": -1.0,
            },
            "metadata": {
                "measurement_algorithm": "ebu_r128_mock",
                "measurement_tool": "loudness_mock_040a",
                "analysis_timestamp": time.time(),
            },
        }

        content = json.dumps(loudness_data, ensure_ascii=False, indent=2)
        filename = f"loudness_{scene_version.id[:8]}.json"
        asset = Asset(
            id=hashlib.sha256(f"loudness_{filename}".encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="detection_json",
            uri=f"file://storage/detection/{filename}",
            mime_type="application/json",
            file_size=len(content.encode()),
            metadata_json={
                "source": "loudness_detection",
                "gate_codes": ["G8", "G9"],
                "mock": True,
                "mock_reason": "040a real loudness measurement not yet integrated",
                "voice_asset_id": voice_asset.id,
                "bgm_asset_id": bgm_asset.id if bgm_asset else None,
            },
        )
        db.add(asset)
        await db.flush()

        # 关联到 scene_version
        link = AssetLink(
            id=hashlib.sha256(f"loudness_link_{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id,
            owner_type="scene_version",
            owner_id=scene_version.id,
            relation_type="qa_evidence",
        )
        db.add(link)

        if step:
            step.metadata_json = step.metadata_json or {}
            step.metadata_json["loudness_asset_id"] = asset.id

        await db.flush()
        return asset

    async def create_alignment_asset(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        voice_asset: Asset,
        step: JobStep,
    ) -> Asset:
        """创建对齐报告 JSON 证据资产

        040a 阶段：mock 数据，模拟 TTS 文本-音频对齐结果。
        真实替换入口：替换为 forced alignment 结果。

        Args:
            db: 数据库 session
            scene_version: 场景版本
            voice_asset: 语音资产
            step: 当前 JobStep

        Returns:
            Asset: 对齐报告 JSON 资产
        """
        alignment_data = {
            "source": "alignment_report",
            "mock": True,
            "mock_reason": "040a real forced alignment not yet integrated",
            "voice_asset_id": voice_asset.id,
            "segments": [
                {
                    "start": 0.0,
                    "end": 2.5,
                    "text": "Hello, this is a test.",
                    "confidence": 0.95,
                },
                {
                    "start": 2.5,
                    "end": 5.0,
                    "text": "Welcome to Manju.",
                    "confidence": 0.92,
                },
            ],
            "word_timings": [
                {"word": "Hello", "start": 0.0, "end": 0.4, "confidence": 0.98},
                {"word": "this", "start": 0.5, "end": 0.7, "confidence": 0.97},
                {"word": "is", "start": 0.8, "end": 0.9, "confidence": 0.96},
                {"word": "a", "start": 0.9, "end": 1.0, "confidence": 0.95},
                {"word": "test", "start": 1.1, "end": 1.5, "confidence": 0.94},
            ],
            "metadata": {
                "alignment_algorithm": "montreal_forced_aligner_mock",
                "analysis_timestamp": time.time(),
            },
        }

        content = json.dumps(alignment_data, ensure_ascii=False, indent=2)
        filename = f"alignment_{scene_version.id[:8]}.json"

        asset = Asset(
            id=hashlib.sha256(f"alignment_{filename}".encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="detection_json",
            uri=f"file://storage/detection/{filename}",
            mime_type="application/json",
            file_size=len(content.encode()),
            metadata_json={
                "source": "alignment_report",
                "gate_codes": ["G8"],
                "mock": True,
                "mock_reason": "040a real forced alignment not yet integrated",
                "voice_asset_id": voice_asset.id,
            },
        )
        db.add(asset)
        await db.flush()

        # 关联到 scene_version
        link = AssetLink(
            id=hashlib.sha256(f"alignment_link_{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id,
            owner_type="scene_version",
            owner_id=scene_version.id,
            relation_type="qa_evidence",
        )
        db.add(link)

        if step:
            step.metadata_json = step.metadata_json or {}
            step.metadata_json["alignment_asset_id"] = asset.id

        await db.flush()
        return asset
