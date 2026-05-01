"""Character Asset Generation — Phase 6

角色资产生成模块（拆分后）：
- CharacterGenerator(PipelineClient) — 主类
- character_workflow.py: ComfyUI workflow 构建与执行
- character_asset.py: 资产记录创建

保持 import 兼容：from services.pipeline.character import CharacterGenerator
"""

from database.models import Character, JobStep, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from .base import PipelineClient, PipelineError
from .character_asset import build_character_prompt, create_character_asset, create_review_asset
from .character_workflow import ComfyUIWorkflowMixin
from .config import get_provider_config


class CharacterGenerator(ComfyUIWorkflowMixin, PipelineClient):
    """角色资产生成器（ComfyUI Flux + IP-Adapter）"""

    def __init__(self):
        comfyui_config = get_provider_config("comfyui")
        self.base_url = comfyui_config["base_url"]
        self.username = comfyui_config["username"]
        self.password = comfyui_config["password"]

        super().__init__(
            provider_name="comfyui",
            api_key="",
            base_url=self.base_url,
        )

    async def generate(
        self,
        db: AsyncSession,
        character: Character,
        reference_image_path: str,
        scene_version: SceneVersion,
        step: JobStep,
    ):
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
        prompt = build_character_prompt(character)
        negative_prompt = "low quality, blurry, distorted, ugly, bad anatomy"

        max_retries = 3
        last_similarity = 0.0

        for attempt in range(max_retries):
            ip_weight = 0.8 - (attempt * 0.1)

            try:
                workflow = self._build_workflow(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    reference_image=reference_image_path,
                    ip_weight=ip_weight,
                )

                prompt_id = await self._submit_workflow(workflow)
                result_data = await self._poll_workflow(prompt_id)

                image_filename = result_data.get("images", [{}])[0].get("filename")
                if not image_filename:
                    raise PipelineError(
                        message="ComfyUI did not return image filename",
                        provider="comfyui", error_type="provider_error",
                        details={"result": result_data},
                    )

                image_url = f"{self.base_url}/view?filename={image_filename}"

                async def _download_image(client):
                    response = await client.get(image_url)
                    response.raise_for_status()
                    return response.content

                image_data = await self._retry_wrapper(_download_image, timeout_category="image")

                similarity = await self._check_ip_adapter_consistency(
                    db=db,
                    reference_image_path=reference_image_path,
                    generated_image_data=image_data,
                )
                last_similarity = similarity

                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json.setdefault("ip_adapter_attempts", []).append({
                        "attempt": attempt + 1,
                        "weight": ip_weight,
                        "similarity": similarity,
                        "threshold": 0.72,
                        "passed": similarity >= 0.72,
                    })

                if similarity >= 0.72:
                    asset = await create_character_asset(
                        db=db, character=character, scene_version=scene_version,
                        image_data=image_data, image_filename=image_filename,
                        similarity=similarity, ip_weight=ip_weight,
                    )
                    return asset

                if attempt < max_retries - 1:
                    continue

            except PipelineError as e:
                if step:
                    step.metadata_json = step.metadata_json or {}
                    step.metadata_json.setdefault("ip_adapter_attempts", []).append({
                        "attempt": attempt + 1,
                        "weight": ip_weight,
                        "error": e.message,
                        "passed": False,
                    })

                if attempt < max_retries - 1:
                    continue
                else:
                    raise

        # 所有重试都失败
        if last_similarity < 0.72:
            ip_weight = 0.8 - ((max_retries - 1) * 0.1)
            asset = await create_review_asset(
                db=db, character=character, scene_version=scene_version,
                similarity=last_similarity, ip_weight=ip_weight,
            )
            return asset

        raise PipelineError(
            message="Failed to generate character asset after all retries",
            provider="comfyui", error_type="provider_error",
            details={"max_retries": max_retries, "last_similarity": last_similarity},
        )
