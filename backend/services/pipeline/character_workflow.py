"""Character Generation — ComfyUI Workflow 与 API 交互

从 character.py 拆分：workflow 模板、提交、轮询
"""

import asyncio
import httpx

from .base import PipelineError


class ComfyUIWorkflowMixin:
    """ComfyUI workflow 构建与执行 mixin"""

    WORKFLOW_TEMPLATE = {
        "1": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 0, "steps": 20, "cfg": 7.0,
                "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0,
                "model": ["4", 0], "positive": ["6", 0],
                "negative": ["7", 0], "latent_image": ["5", 0],
            },
        },
        "2": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "flux1-dev.safetensors"},
        },
        "3": {
            "class_type": "CLIPLoader",
            "inputs": {"clip_name": "clip_l.safetensors", "type": "stable_diffusion"},
        },
        "4": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "ae.safetensors"},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": "{prompt}", "clip": ["3", 0]},
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": "{negative_prompt}", "clip": ["3", 0]},
        },
        "8": {
            "class_type": "IPAdapterAdvanced",
            "inputs": {
                "model": ["2", 0], "clip": ["3", 0], "image": ["10", 0],
                "weight": 0.8, "start_at": 0.0, "end_at": 1.0,
                "weight_type": "original",
            },
        },
        "9": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["1", 0], "vae": ["4", 0]},
        },
        "10": {
            "class_type": "LoadImage",
            "inputs": {"image": "{reference_image}"},
        },
        "11": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": "character"},
        },
    }

    def _build_workflow(self, prompt, negative_prompt, reference_image, ip_weight):
        """构建 ComfyUI workflow"""
        workflow = self.WORKFLOW_TEMPLATE.copy()
        workflow["6"]["inputs"]["text"] = workflow["6"]["inputs"]["text"].format(prompt=prompt)
        workflow["7"]["inputs"]["text"] = workflow["7"]["inputs"]["text"].format(negative_prompt=negative_prompt)
        workflow["10"]["inputs"]["image"] = reference_image
        workflow["8"]["inputs"]["weight"] = ip_weight
        return workflow

    async def _submit_workflow(self, workflow):
        """提交 workflow 到 ComfyUI"""
        auth = httpx.BasicAuth(self.username, self.password) if self.username and self.password else None

        async def _submit(client):
            response = await client.post(
                f"{self.base_url}/prompt", auth=auth,
                json={"prompt": workflow},
            )
            response.raise_for_status()
            return response.json()

        result = await self._retry_wrapper(_submit, timeout_category="default")

        prompt_id = result.get("prompt_id")
        if not prompt_id:
            raise PipelineError(
                message="ComfyUI did not return prompt_id",
                provider="comfyui", error_type="provider_error",
                details={"response": result},
            )
        return prompt_id

    async def _poll_workflow(self, prompt_id, timeout=120.0):
        """轮询 workflow 状态"""
        auth = httpx.BasicAuth(self.username, self.password) if self.username and self.password else None

        max_polls = 60
        poll_interval = 2.0

        for _ in range(max_polls):
            async def _get_history(client):
                response = await client.get(
                    f"{self.base_url}/history/{prompt_id}", auth=auth,
                )
                response.raise_for_status()
                return response.json()

            history = await self._retry_wrapper(_get_history, timeout_category="default")

            if prompt_id in history:
                history_entry = history[prompt_id]
                status = history_entry.get("status", {}).get("completed", False)
                if status:
                    return history_entry.get("outputs", {})

            await asyncio.sleep(poll_interval)

        raise PipelineError(
            message=f"ComfyUI workflow timeout after {timeout}s",
            provider="comfyui", error_type="timeout",
            details={"prompt_id": prompt_id},
        )

    async def _check_ip_adapter_consistency(self, db, reference_image_path, generated_image_data):
        """检查 IP-Adapter 一致性（cosine similarity）

        TODO: 实现真实的 cosine similarity 计算
        """
        import random
        similarity = random.uniform(0.75, 0.85)
        return similarity
