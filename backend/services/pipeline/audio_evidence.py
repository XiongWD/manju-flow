"""Audio Generation — BGM 与证据资产

从 audio.py 拆分：BGM 生成、响度检测、对齐报告
"""

import hashlib
import json
import time
from typing import Optional

from database.models import Asset, AssetLink, JobStep, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from services.storage.service import get_storage_service


class BGMMixin:
    """BGM 生成 mixin"""

    async def generate_bgm(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        bgm_config: dict,
        step: JobStep,
    ) -> Asset:
        """生成 BGM / 背景音乐

        040a 阶段：mock placeholder。
        真实 provider 替换入口：替换此方法为真实 Suno / 等价 API 调用。
        """
        provider = bgm_config.get("provider", "suno")
        style = bgm_config.get("style", "cinematic")
        volume = bgm_config.get("volume", 0.3)
        duration_sec = bgm_config.get("duration_sec", 10.0)

        mock_note = {
            "mock": True,
            "mock_reason": "040a BGM provider not yet integrated",
            "real_provider_replacement": "替换 generate_bgm() 方法为真实 Suno / 等价 API 调用",
            "bgm_config_source": "config_audio.py resolve_bgm_config()",
        }

        filename = f"bgm_{scene_version.id[:8]}_{style[:8]}.mp3"
        storage_svc = get_storage_service()
        save_result = await storage_svc.save_bytes(
            b"", filename, mime_type="audio/mpeg", prefix="audio/bgm",
        )

        asset = Asset(
            id=hashlib.sha256(f"bgm_{filename}".encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="audio",
            uri=save_result["uri"],
            mime_type="audio/mpeg",
            file_size=save_result["size"],
            duration=duration_sec,
            metadata_json={
                "provider": provider, "style": style, "volume": volume,
                "duration_sec": duration_sec, "source": "bgm_generation",
                "mock": mock_note,
            },
        )
        db.add(asset)
        await db.flush()

        link = AssetLink(
            id=hashlib.sha256(f"bgm_link_{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id, owner_type="scene_version",
            owner_id=scene_version.id, relation_type="output",
        )
        db.add(link)

        if step:
            step.metadata_json = step.metadata_json or {}
            step.metadata_json["bgm_generation"] = mock_note
            step.metadata_json["bgm_asset_id"] = asset.id

        await db.flush()
        return asset


class EvidenceMixin:
    """音频证据资产 mixin（响度检测、对齐报告）"""

    async def create_loudness_asset(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        voice_asset: Asset,
        bgm_asset: Optional[Asset],
        step: JobStep,
    ) -> Asset:
        """创建响度检测 JSON 证据资产（040a mock）"""
        loudness_data = {
            "source": "loudness_detection",
            "mock": True,
            "mock_reason": "040a real loudness measurement not yet integrated",
            "integrated_lufs": -16.0,
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

        filename = f"loudness_{scene_version.id[:8]}.json"
        storage_svc = get_storage_service()
        save_result = await storage_svc.save_json(loudness_data, filename, prefix="detection")

        asset = Asset(
            id=hashlib.sha256(f"loudness_{filename}".encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="detection_json",
            uri=save_result["uri"],
            mime_type="application/json",
            file_size=save_result["size"],
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

        link = AssetLink(
            id=hashlib.sha256(f"loudness_link_{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id, owner_type="scene_version",
            owner_id=scene_version.id, relation_type="qa_evidence",
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
        """创建对齐报告 JSON 证据资产（040a mock）"""
        alignment_data = {
            "source": "alignment_report",
            "mock": True,
            "mock_reason": "040a real forced alignment not yet integrated",
            "voice_asset_id": voice_asset.id,
            "segments": [
                {"start": 0.0, "end": 2.5, "text": "Hello, this is a test.", "confidence": 0.95},
                {"start": 2.5, "end": 5.0, "text": "Welcome to Manju.", "confidence": 0.92},
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

        filename = f"alignment_{scene_version.id[:8]}.json"
        storage_svc = get_storage_service()
        save_result = await storage_svc.save_json(alignment_data, filename, prefix="detection")

        asset = Asset(
            id=hashlib.sha256(f"alignment_{filename}".encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="detection_json",
            uri=save_result["uri"],
            mime_type="application/json",
            file_size=save_result["size"],
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

        link = AssetLink(
            id=hashlib.sha256(f"alignment_link_{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id, owner_type="scene_version",
            owner_id=scene_version.id, relation_type="qa_evidence",
        )
        db.add(link)

        if step:
            step.metadata_json = step.metadata_json or {}
            step.metadata_json["alignment_asset_id"] = asset.id

        await db.flush()
        return asset
