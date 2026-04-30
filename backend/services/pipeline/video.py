"""Video Generation — Phase 1

视频生成模块：
- VideoGenerator(PipelineClient)
- 主路径：Kling API
- Fallback：Seedance API
- 返回 Asset + AssetLink
- 记录 provider_attempts 到 job_step metadata
"""

import asyncio
import hashlib
import json
import time
from typing import Any, Optional

from database.models import Asset, AssetLink, JobStep, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from services.storage.service import get_storage_service

from .base import PipelineClient, PipelineError
from .config import get_provider_config


class VideoGenerator(PipelineClient):
    """视频生成器（Kling → Seedance fallback）"""

    def __init__(self):
        kling_config = get_provider_config("kling")
        seedance_config = get_provider_config("seedance")

        # 初始化两个 client（按需使用）
        self.kling_key = kling_config["key"]
        self.kling_base = kling_config["base_url"]
        self.seedance_key = seedance_config["key"]
        self.seedance_base = seedance_config["base_url"]

        # Provider 尝试记录
        self._provider_attempts = []

    async def generate(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        prompt_bundle: dict,
        step: JobStep,
    ) -> Asset:
        """生成视频

        Args:
            db: 数据库 session
            scene_version: 场景版本
            prompt_bundle: Prompt 包
            step: 当前 JobStep（用于记录 metadata）

        Returns:
            Asset: 生成的视频资产

        Raises:
            PipelineError: 所有 provider 都失败
        """
        prompt = prompt_bundle.get("positive", "")
        negative_prompt = prompt_bundle.get("negative", "")
        model_bundle = scene_version.model_bundle or {}

        # 清空尝试记录
        self._provider_attempts = []

        # 1. 尝试 Kling
        if self.kling_key:
            try:
                asset = await self._call_kling(
                    db=db,
                    scene_version=scene_version,
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    model_bundle=model_bundle,
                )
                self._provider_attempts.append({
                    "provider": "kling",
                    "success": True,
                    "timestamp": time.time(),
                })
                # 记录到 step metadata
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts
                return asset
            except PipelineError as e:
                self._provider_attempts.append({
                    "provider": "kling",
                    "success": False,
                    "error": e.message,
                    "timestamp": time.time(),
                })
                # 记录到 step metadata
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts

        # 2. Fallback 到 Seedance
        if self.seedance_key:
            try:
                asset = await self._call_seedance(
                    db=db,
                    scene_version=scene_version,
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    model_bundle=model_bundle,
                )
                self._provider_attempts.append({
                    "provider": "seedance",
                    "success": True,
                    "timestamp": time.time(),
                })
                # 记录到 step metadata
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts
                return asset
            except PipelineError as e:
                self._provider_attempts.append({
                    "provider": "seedance",
                    "success": False,
                    "error": e.message,
                    "timestamp": time.time(),
                })
                # 记录到 step metadata
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["provider_attempts"] = self._provider_attempts

        # 所有 provider 都失败
        raise PipelineError(
            message="All video providers failed",
            error_type="provider_error",
            details={"attempts": self._provider_attempts},
        )

    async def _call_kling(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        prompt: str,
        negative_prompt: str,
        model_bundle: dict,
    ) -> Asset:
        """调用 Kling API 生成视频

        API 流程（通用模式，需根据实际文档调整）：
        1. POST 创建任务 → 返回 task_id
        2. GET 轮询状态 → 等待 completed
        3. GET 下载结果视频 → 保存到 MinIO/local storage

        Args:
            db: 数据库 session
            scene_version: 场景版本
            prompt: 正向提示词
            negative_prompt: 负向提示词
            model_bundle: 模型配置

        Returns:
            Asset: 生成的视频资产
        """
        # 构造请求 payload（根据 Kling 实际 API 调整）
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "model": model_bundle.get("video", "kling-v3"),
            "duration": scene_version.params.get("duration", 5.0) if scene_version.params else 5.0,
            "resolution": scene_version.params.get("resolution", "1280x720") if scene_version.params else "1280x720",
            "fps": scene_version.params.get("fps", 30) if scene_version.params else 30,
        }

        # 1. 创建任务
        async def _create_task(client):
            response = await client.post(
                f"{self.kling_base}/v1/videos/generate",
                headers={"Authorization": f"Bearer {self.kling_key}"},
                json=payload,
            )
            response.raise_for_status()
            return response.json()

        task_result = await self._retry_wrapper(_create_task, timeout_category="video")
        task_id = task_result.get("task_id")
        if not task_id:
            raise PipelineError(
                message="Kling API did not return task_id",
                provider="kling",
                error_type="provider_error",
                details={"response": task_result},
            )

        # 2. 轮询状态
        max_polls = 60  # 最多轮询60次（5分钟）
        poll_interval = 5.0  # 每5秒轮询一次

        for poll_count in range(max_polls):
            async def _get_status(client):
                response = await client.get(
                    f"{self.kling_base}/v1/videos/{task_id}",
                    headers={"Authorization": f"Bearer {self.kling_key}"},
                )
                response.raise_for_status()
                return response.json()

            status_result = await self._retry_wrapper(_get_status, timeout_category="default")
            status = status_result.get("status", "unknown")

            if status == "completed":
                break
            elif status in ("failed", "error"):
                raise PipelineError(
                    message=f"Kling task failed: {status_result.get('error', 'Unknown error')}",
                    provider="kling",
                    error_type="provider_error",
                    details={"task_id": task_id, "status_result": status_result},
                )

            # 等待下一次轮询
            await asyncio.sleep(poll_interval)

        # 3. 下载视频
        video_url = status_result.get("output_url") or status_result.get("url")
        if not video_url:
            raise PipelineError(
                message="Kling API did not return video URL",
                provider="kling",
                error_type="provider_error",
                details={"status_result": status_result},
            )

        # 下载视频文件（简化版，实际应流式下载到 storage）
        async def _download_video(client):
            response = await client.get(video_url)
            response.raise_for_status()
            return response.content

        video_data = await self._retry_wrapper(_download_video, timeout_category="video")

        # 生成文件名并保存
        filename = f"kling_{scene_version.id[:8]}_{task_id[:8]}.mp4"
        storage_svc = get_storage_service()
        save_result = await storage_svc.save_bytes(
            video_data, filename, mime_type="video/mp4", prefix="videos",
        )
        video_uri = save_result["uri"]

        # 创建 Asset
        asset = Asset(
            id=hashlib.sha256(filename.encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="video",
            uri=video_uri,
            mime_type="video/mp4",
            file_size=save_result["size"],
            duration=payload["duration"],
            metadata_json={
                "provider": "kling",
                "task_id": task_id,
                "prompt": prompt,
                "model": payload["model"],
                "checksum": save_result["checksum"],
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

        # 记录成本（根据 Kling 实际定价调整）
        estimated_cost = len(video_data) / 1024 / 1024 * 0.01  # 简化估算：$0.01/MB
        self.record_cost("video_generation", estimated_cost, {"provider": "kling", "task_id": task_id})

        return asset


    async def _call_seedance(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        prompt: str,
        negative_prompt: str,
        model_bundle: dict,
    ) -> Asset:
        """调用 Seedance API 生成视频（Fallback）

        API 流程类似 Kling：
        1. POST 创建任务 → 返回 task_id
        2. GET 轮询状态 → 等待 completed
        3. GET 下载结果视频 → 保存到 MinIO/local storage

        Args:
            db: 数据库 session
            scene_version: 场景版本
            prompt: 正向提示词
            negative_prompt: 负向提示词
            model_bundle: 模型配置

        Returns:
            Asset: 生成的视频资产
        """
        # 构造请求 payload（根据 Seedance 实际 API 调整）
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "model": model_bundle.get("video", "seedance-v2"),
            "duration": scene_version.params.get("duration", 5.0) if scene_version.params else 5.0,
            "resolution": scene_version.params.get("resolution", "1280x720") if scene_version.params else "1280x720",
            "fps": scene_version.params.get("fps", 30) if scene_version.params else 30,
        }

        # 1. 创建任务
        async def _create_task(client):
            response = await client.post(
                f"{self.seedance_base}/v1/videos/generate",
                headers={"Authorization": f"Bearer {self.seedance_key}"},
                json=payload,
            )
            response.raise_for_status()
            return response.json()

        task_result = await self._retry_wrapper(_create_task, timeout_category="video")
        task_id = task_result.get("task_id")
        if not task_id:
            raise PipelineError(
                message="Seedance API did not return task_id",
                provider="seedance",
                error_type="provider_error",
                details={"response": task_result},
            )

        # 2. 轮询状态
        max_polls = 60
        poll_interval = 5.0

        for poll_count in range(max_polls):
            async def _get_status(client):
                response = await client.get(
                    f"{self.seedance_base}/v1/videos/{task_id}",
                    headers={"Authorization": f"Bearer {self.seedance_key}"},
                )
                response.raise_for_status()
                return response.json()

            status_result = await self._retry_wrapper(_get_status, timeout_category="default")
            status = status_result.get("status", "unknown")

            if status == "completed":
                break
            elif status in ("failed", "error"):
                raise PipelineError(
                    message=f"Seedance task failed: {status_result.get('error', 'Unknown error')}",
                    provider="seedance",
                    error_type="provider_error",
                    details={"task_id": task_id, "status_result": status_result},
                )

            await asyncio.sleep(poll_interval)

        # 3. 下载视频
        video_url = status_result.get("output_url") or status_result.get("url")
        if not video_url:
            raise PipelineError(
                message="Seedance API did not return video URL",
                provider="seedance",
                error_type="provider_error",
                details={"status_result": status_result},
            )

        async def _download_video(client):
            response = await client.get(video_url)
            response.raise_for_status()
            return response.content

        video_data = await self._retry_wrapper(_download_video, timeout_category="video")

        # 生成文件名并保存
        filename = f"seedance_{scene_version.id[:8]}_{task_id[:8]}.mp4"
        storage_svc = get_storage_service()
        save_result = await storage_svc.save_bytes(
            video_data, filename, mime_type="video/mp4", prefix="videos",
        )
        video_uri = save_result["uri"]

        # 创建 Asset
        asset = Asset(
            id=hashlib.sha256(filename.encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="video",
            uri=video_uri,
            mime_type="video/mp4",
            file_size=save_result["size"],
            duration=payload["duration"],
            metadata_json={
                "provider": "seedance",
                "task_id": task_id,
                "prompt": prompt,
                "model": payload["model"],
                "checksum": save_result["checksum"],
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

        # 记录成本
        estimated_cost = len(video_data) / 1024 / 1024 * 0.008  # 简化估算：$0.008/MB
        self.record_cost("video_generation", estimated_cost, {"provider": "seedance", "task_id": task_id})

        return asset
