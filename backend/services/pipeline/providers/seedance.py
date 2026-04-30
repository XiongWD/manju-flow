"""Seedance 视频生成 Provider

从 VideoGenerator._call_seedance 提取的 API 调用逻辑。
"""

import asyncio
from typing import Optional

import httpx

from ..config import get_provider_config
from ..base import PipelineError
from .base import VideoGenerateRequest, VideoGenerateResult, VideoProvider


class SeedanceVideoProvider(VideoProvider):
    """Seedance 视频生成 Provider"""

    def __init__(self):
        config = get_provider_config("seedance")
        self._api_key = config["key"]
        self._base_url = config["base_url"].rstrip("/")
        self._timeout = config.get("timeout", 300.0)
        # 模型映射
        self._model_map = {
            "default": "seedance-v2",
            "seedance-v2": "seedance-v2",
        }

    @property
    def name(self) -> str:
        return "seedance"

    async def is_available(self) -> bool:
        return bool(self._api_key)

    def _resolve_model(self, model: str) -> str:
        """解析模型名称，映射到 Seedance 实际模型名"""
        return self._model_map.get(model, model)

    async def _retry_request(self, func, timeout_category: str = "default") -> any:
        """带重试的 HTTP 请求"""
        timeout = self._timeout if timeout_category == "video" else 60.0
        last_exception = None
        max_retries = 3
        backoff_base = 1.0

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    return await func(client)
            except httpx.TimeoutException as e:
                last_exception = PipelineError(
                    message=f"Seedance timeout after {timeout}s",
                    provider="seedance",
                    error_type="timeout",
                    details={"attempt": attempt + 1, "timeout": timeout},
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff_base * (2 ** attempt))
            except httpx.HTTPStatusError as e:
                last_exception = PipelineError(
                    message=f"Seedance HTTP error: {e.response.status_code}",
                    provider="seedance",
                    error_type="provider_error",
                    details={
                        "attempt": attempt + 1,
                        "status_code": e.response.status_code,
                        "response_text": e.response.text[:500],
                    },
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff_base * (2 ** attempt))
            except httpx.RequestError as e:
                last_exception = PipelineError(
                    message=f"Seedance network error: {str(e)}",
                    provider="seedance",
                    error_type="network_error",
                    details={"attempt": attempt + 1, "error": str(e)},
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff_base * (2 ** attempt))
            except Exception as e:
                raise PipelineError(
                    message=f"Seedance unexpected error: {str(e)}",
                    provider="seedance",
                    error_type="provider_error",
                    details={"attempt": attempt + 1, "error_type": type(e).__name__},
                )

        raise last_exception  # type: ignore

    async def generate(self, request: VideoGenerateRequest) -> VideoGenerateResult:
        """提交 Seedance 视频生成任务"""
        model = self._resolve_model(request.model)
        payload = {
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt,
            "model": model,
            "duration": request.duration,
            "resolution": request.extra_params.get("resolution", "1280x720"),
            "fps": request.extra_params.get("fps", 30),
        }

        # 1. 创建任务
        async def _create_task(client):
            response = await client.post(
                f"{self._base_url}/v1/videos/generate",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json=payload,
            )
            response.raise_for_status()
            return response.json()

        task_result = await self._retry_request(_create_task, timeout_category="video")
        task_id = task_result.get("task_id")
        if not task_id:
            raise PipelineError(
                message="Seedance API did not return task_id",
                provider="seedance",
                error_type="provider_error",
                details={"response": task_result},
            )

        return VideoGenerateResult(
            video_url="",
            provider=self.name,
            task_id=task_id,
            model=model,
            duration_seconds=request.duration,
            metadata={"status": "submitted", "raw_response": task_result},
        )

    async def poll(self, task_id: str) -> VideoGenerateResult:
        """轮询 Seedance 视频生成任务状态"""
        max_polls = 60
        poll_interval = 5.0
        status_result = None

        for poll_count in range(max_polls):
            async def _get_status(client, _task_id=task_id):
                response = await client.get(
                    f"{self._base_url}/v1/videos/{_task_id}",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                response.raise_for_status()
                return response.json()

            status_result = await self._retry_request(_get_status, timeout_category="default")
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
        else:
            raise PipelineError(
                message=f"Seedance task timed out after {max_polls * poll_interval}s",
                provider="seedance",
                error_type="timeout",
                details={"task_id": task_id},
            )

        video_url = status_result.get("output_url") or status_result.get("url")
        if not video_url:
            raise PipelineError(
                message="Seedance API did not return video URL",
                provider="seedance",
                error_type="provider_error",
                details={"status_result": status_result},
            )

        return VideoGenerateResult(
            video_url=video_url,
            provider=self.name,
            task_id=task_id,
            model=status_result.get("model", ""),
            duration_seconds=status_result.get("duration"),
            metadata={"status": "completed", "raw_response": status_result},
        )
