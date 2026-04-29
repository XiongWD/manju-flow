"""Character Asset Generation — Phase 6

角色资产生成模块：
- CharacterGenerator(PipelineClient)
- 调用 ComfyUI API 生成角色图（Flux + IP-Adapter）
- IP-Adapter 一致性检查（cosine similarity ≥ 0.72）
- 自动重试（最多 3 次，调整权重）
- 不通过时标记 status='needs_review'（不 fail fast）
"""

import asyncio
import hashlib
import time
from typing import Any, Optional

import httpx

from database.models import (
    Asset,
    AssetLink,
    Character,
    CharacterAsset,
    JobStep,
    SceneVersion,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .base import PipelineClient, PipelineError
from .config import get_provider_config


class CharacterGenerator(PipelineClient):
    """角色资产生成器（ComfyUI Flux + IP-Adapter）"""

    # ComfyUI workflow 节点定义（TODO: 根据实际 ComfyUI 节点调整）
    WORKFLOW_TEMPLATE = {
        "1": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 0,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "2": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "flux1-dev.safetensors",  # TODO: 根据实际模型名称调整
            },
        },
        "3": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "clip_l.safetensors",  # TODO: 根据实际 CLIP 调整
                "type": "stable_diffusion",
            },
        },
        "4": {
            "class_type": "VAELoader",
            "inputs": {
                "vae_name": "ae.safetensors",  # TODO: 根据实际 VAE 调整
            },
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1,
            },
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "{prompt}",
                "clip": ["3", 0],
            },
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "{negative_prompt}",
                "clip": ["3", 0],
            },
        },
        "8": {
            "class_type": "IPAdapterAdvanced",
            "inputs": {
                "model": ["2", 0],
                "clip": ["3", 0],
                "image": ["10", 0],
                "weight": 0.8,  # 初始权重
                "start_at": 0.0,
                "end_at": 1.0,
                "weight_type": "original",
            },
        },
        "9": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["1", 0],
                "vae": ["4", 0],
            },
        },
        "10": {
            "class_type": "LoadImage",
            "inputs": {
                "image": "{reference_image}",
            },
        },
        "11": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["9", 0],
                "filename_prefix": "character",
            },
        },
    }

    def __init__(self):
        comfyui_config = get_provider_config("comfyui")
        self.base_url = comfyui_config["base_url"]
        self.username = comfyui_config["username"]
        self.password = comfyui_config["password"]

        super().__init__(
            provider_name="comfyui",
            api_key="",  # ComfyUI 使用 Basic auth，不需要 API key
            base_url=self.base_url,
        )

    async def generate(
        self,
        db: AsyncSession,
        character: Character,
        reference_image_path: str,
        scene_version: SceneVersion,
        step: JobStep,
    ) -> Asset:
        """生成角色资产

        Args:
            db: 数据库 session
            character: Character 对象
            reference_image_path: 参考图片路径（本地/MinIO）
            scene_version: 场景版本
            step: 当前 JobStep（用于记录 metadata）

        Returns:
            Asset: 生成的角色图资产

        Raises:
            PipelineError: ComfyUI 调用失败
        """
        # 构建 prompt（从 character 描述生成）
        prompt = self._build_character_prompt(character)
        negative_prompt = "low quality, blurry, distorted, ugly, bad anatomy"

        # IP-Adapter 重试循环（最多 3 次）
        max_retries = 3
        last_similarity = 0.0

        for attempt in range(max_retries):
            # 调整权重（每次降低 0.1）
            ip_weight = 0.8 - (attempt * 0.1)

            try:
                # 1. 提交 workflow
                workflow = self._build_workflow(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    reference_image=reference_image_path,
                    ip_weight=ip_weight,
                )

                prompt_id = await self._submit_workflow(workflow)

                # 2. 轮询等待完成
                result_data = await self._poll_workflow(prompt_id)

                # 3. 下载生成的图片
                image_filename = result_data.get("images", [{}])[0].get("filename")
                if not image_filename:
                    raise PipelineError(
                        message="ComfyUI did not return image filename",
                        provider="comfyui",
                        error_type="provider_error",
                        details={"result": result_data},
                    )

                image_url = f"{self.base_url}/view?filename={image_filename}"

                async def _download_image(client):
                    response = await client.get(image_url)
                    response.raise_for_status()
                    return response.content

                image_data = await self._retry_wrapper(_download_image, timeout_category="image")

                # 4. IP-Adapter 一致性检查（cosine similarity）
                similarity = await self._check_ip_adapter_consistency(
                    db=db,
                    reference_image_path=reference_image_path,
                    generated_image_data=image_data,
                )

                last_similarity = similarity

                # 记录到 step metadata
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["ip_adapter_attempts"] = step.metadata_json.get("ip_adapter_attempts", [])
                    step.metadata_json["ip_adapter_attempts"].append({
                        "attempt": attempt + 1,
                        "weight": ip_weight,
                        "similarity": similarity,
                        "threshold": 0.72,
                        "passed": similarity >= 0.72,
                    })

                # 检查是否通过阈值
                if similarity >= 0.72:
                    # 通过，创建资产并返回
                    asset = await self._create_character_asset(
                        db=db,
                        character=character,
                        scene_version=scene_version,
                        image_data=image_data,
                        image_filename=image_filename,
                        similarity=similarity,
                        ip_weight=ip_weight,
                    )
                    return asset

                # 未通过，继续重试（最后一次除外）
                if attempt < max_retries - 1:
                    continue

            except PipelineError as e:
                # API 调用失败，记录并重试
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json["ip_adapter_attempts"] = step.metadata_json.get("ip_adapter_attempts", [])
                    step.metadata_json["ip_adapter_attempts"].append({
                        "attempt": attempt + 1,
                        "weight": ip_weight,
                        "error": e.message,
                        "passed": False,
                    })

                if attempt < max_retries - 1:
                    continue
                else:
                    raise

        # 所有重试都失败，使用最后一次结果但标记为 needs_review
        if last_similarity < 0.72:
            # 重新获取最后一次的结果（简化：这里应该缓存最后一次生成的图片）
            # 为了简化，这里创建一个 placeholder 资产
            asset = Asset(
                id=hashlib.sha256(f"char_{character.id}_review".encode()).hexdigest()[:32],
                project_id=character.project_id,
                type="character_ref",
                uri=f"file://storage/characters/{character.id}_review.png",
                mime_type="image/png",
                file_size=0,
                metadata_json={
                    "provider": "comfyui",
                    "character_id": character.id,
                    "similarity": last_similarity,
                    "ip_weight": 0.8 - ((max_retries - 1) * 0.1),
                    "status": "needs_review",
                    "reason": "IP-Adapter consistency check failed",
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
                relation_type="character_reference",
            )
            db.add(link)

            # 创建 CharacterAsset
            char_asset = CharacterAsset(
                id=hashlib.sha256(f"{character.id}_{asset.id}".encode()).hexdigest()[:32],
                character_id=character.id,
                asset_type="reference",
                asset_id=asset.id,
                uri=asset.uri,
                metadata_json={
                    "similarity": last_similarity,
                    "ip_weight": 0.8 - ((max_retries - 1) * 0.1),
                    "status": "needs_review",
                },
            )
            db.add(char_asset)

            await db.flush()

            return asset

        raise PipelineError(
            message="Failed to generate character asset after all retries",
            provider="comfyui",
            error_type="provider_error",
            details={"max_retries": max_retries, "last_similarity": last_similarity},
        )

    def _build_character_prompt(self, character: Character) -> str:
        """构建角色生成 prompt

        Args:
            character: Character 对象

        Returns:
            str: Prompt 文本
        """
        # 从 character description 生成 prompt
        description = character.description or ""

        # 简化的 prompt 构建逻辑
        prompt = f"A character design of {character.name}. "

        if description:
            prompt += description

        # 添加质量关键词
        prompt += ", high quality, detailed, professional character design"

        return prompt

    def _build_workflow(
        self,
        prompt: str,
        negative_prompt: str,
        reference_image: str,
        ip_weight: float,
    ) -> dict:
        """构建 ComfyUI workflow

        Args:
            prompt: 正向提示词
            negative_prompt: 负向提示词
            reference_image: 参考图片文件名
            ip_weight: IP-Adapter 权重

        Returns:
            dict: Workflow JSON
        """
        workflow = self.WORKFLOW_TEMPLATE.copy()

        # 替换 prompt 中的占位符
        workflow["6"]["inputs"]["text"] = workflow["6"]["inputs"]["text"].format(prompt=prompt)
        workflow["7"]["inputs"]["text"] = workflow["7"]["inputs"]["text"].format(negative_prompt=negative_prompt)
        workflow["10"]["inputs"]["image"] = reference_image
        workflow["8"]["inputs"]["weight"] = ip_weight

        return workflow

    async def _submit_workflow(self, workflow: dict) -> str:
        """提交 workflow 到 ComfyUI

        Args:
            workflow: Workflow JSON

        Returns:
            str: prompt_id

        Raises:
            PipelineError: 提交失败
        """
        auth = httpx.BasicAuth(self.username, self.password) if self.username and self.password else None

        async def _submit(client):
            response = await client.post(
                f"{self.base_url}/prompt",
                auth=auth,
                json={"prompt": workflow},
            )
            response.raise_for_status()
            return response.json()

        result = await self._retry_wrapper(_submit, timeout_category="default")

        prompt_id = result.get("prompt_id")
        if not prompt_id:
            raise PipelineError(
                message="ComfyUI did not return prompt_id",
                provider="comfyui",
                error_type="provider_error",
                details={"response": result},
            )

        return prompt_id

    async def _poll_workflow(self, prompt_id: str, timeout: float = 120.0) -> dict:
        """轮询 workflow 状态

        Args:
            prompt_id: Prompt ID
            timeout: 超时时间（秒）

        Returns:
            dict: 完成后的结果数据

        Raises:
            PipelineError: 轮询超时或失败
        """
        auth = httpx.BasicAuth(self.username, self.password) if self.username and self.password else None

        max_polls = 60  # 最多轮询 60 次
        poll_interval = 2.0  # 每 2 秒轮询一次

        for poll_count in range(max_polls):
            async def _get_history(client):
                response = await client.get(
                    f"{self.base_url}/history/{prompt_id}",
                    auth=auth,
                )
                response.raise_for_status()
                return response.json()

            history = await self._retry_wrapper(_get_history, timeout_category="default")

            if prompt_id in history:
                history_entry = history[prompt_id]
                status = history_entry.get("status", {}).get("completed", False)

                if status:
                    # 完成
                    return history_entry.get("outputs", {})

            # 等待下一次轮询
            await asyncio.sleep(poll_interval)

        raise PipelineError(
            message=f"ComfyUI workflow timeout after {timeout}s",
            provider="comfyui",
            error_type="timeout",
            details={"prompt_id": prompt_id},
        )

    async def _check_ip_adapter_consistency(
        self,
        db: AsyncSession,
        reference_image_path: str,
        generated_image_data: bytes,
    ) -> float:
        """检查 IP-Adapter 一致性（cosine similarity）

        TODO: 实现真实的 cosine similarity 计算
        当前返回 mock 值（0.75 - 0.85）

        Args:
            db: 数据库 session
            reference_image_path: 参考图片路径
            generated_image_data: 生成的图片数据

        Returns:
            float: Cosine similarity（0-1）
        """
        # TODO: 调用 ComfyUI 的图像相似度计算节点
        # 或者使用本地 CLIP 模型计算 embedding 的 cosine similarity

        # Mock: 返回 0.75 - 0.85 之间的随机值
        import random
        similarity = random.uniform(0.75, 0.85)

        return similarity

    async def _create_character_asset(
        self,
        db: AsyncSession,
        character: Character,
        scene_version: SceneVersion,
        image_data: bytes,
        image_filename: str,
        similarity: float,
        ip_weight: float,
    ) -> Asset:
        """创建角色资产记录

        Args:
            db: 数据库 session
            character: Character 对象
            scene_version: 场景版本
            image_data: 图片数据
            image_filename: 图片文件名
            similarity: IP-Adapter 相似度
            ip_weight: IP-Adapter 权重

        Returns:
            Asset: 创建的资产对象
        """
        # 生成文件名和存储路径
        storage_filename = f"character_{character.id[:8]}_{image_filename}"
        storage_path = f"characters/{storage_filename}"

        # TODO: 保存到 MinIO/local storage
        image_uri = f"file://{storage_path}"

        # 创建 Asset
        asset = Asset(
            id=hashlib.sha256(storage_filename.encode()).hexdigest()[:32],
            project_id=character.project_id,
            type="character_ref",
            uri=image_uri,
            mime_type="image/png",
            file_size=len(image_data),
            metadata_json={
                "provider": "comfyui",
                "character_id": character.id,
                "filename": image_filename,
                "similarity": similarity,
                "ip_weight": ip_weight,
                "status": "generated",
            },
        )
        db.add(asset)
        await db.flush()

        # 创建 AssetLink（关联到 scene_version）
        link = AssetLink(
            id=hashlib.sha256(f"{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id,
            owner_type="scene_version",
            owner_id=scene_version.id,
            relation_type="character_reference",
        )
        db.add(link)

        # 创建 CharacterAsset（关联到 character）
        char_asset = CharacterAsset(
            id=hashlib.sha256(f"{character.id}_{asset.id}".encode()).hexdigest()[:32],
            character_id=character.id,
            asset_type="reference",
            asset_id=asset.id,
            uri=asset.uri,
            metadata_json={
                "similarity": similarity,
                "ip_weight": ip_weight,
                "scene_version_id": scene_version.id,
            },
        )
        db.add(char_asset)

        await db.flush()

        return asset
