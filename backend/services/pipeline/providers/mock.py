"""Mock 视频生成 Provider

用于测试和开发环境，无需真实 API 调用。
"""

import asyncio
import uuid

from .base import VideoGenerateRequest, VideoGenerateResult, VideoProvider


class MockVideoProvider(VideoProvider):
    """Mock 视频生成 Provider，用于测试和开发"""

    def __init__(self):
        self._name = "mock"
        self._generated_tasks: dict[str, VideoGenerateResult] = {}

    @property
    def name(self) -> str:
        return self._name

    async def is_available(self) -> bool:
        return True

    async def generate(self, request: VideoGenerateRequest) -> VideoGenerateResult:
        task_id = str(uuid.uuid4())[:12]
        result = VideoGenerateResult(
            video_url=f"mock://videos/{task_id}.mp4",
            provider=self.name,
            task_id=task_id,
            model=request.model,
            duration_seconds=request.duration,
            metadata={"mock": True, "prompt_length": len(request.prompt)},
        )
        self._generated_tasks[task_id] = result
        return result

    async def poll(self, task_id: str) -> VideoGenerateResult:
        await asyncio.sleep(0.1)  # 模拟少量延迟
        if task_id not in self._generated_tasks:
            raise ValueError(f"Mock task {task_id} not found")
        return self._generated_tasks[task_id]
