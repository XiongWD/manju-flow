"""视频生成 Provider 抽象接口

所有视频生成 provider 必须实现此接口。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class VideoGenerateResult:
    """视频生成结果"""
    video_url: str  # 视频 URL 或本地路径
    provider: str  # 使用的 provider 名称
    task_id: str  # provider 返回的任务 ID
    model: str  # 使用的模型名
    duration_seconds: Optional[float] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class VideoGenerateRequest:
    """视频生成请求"""
    prompt: str
    negative_prompt: str = ""
    image_url: Optional[str] = None  # 图生视频时的参考图
    model: str = "default"
    duration: int = 5  # 秒
    seed: Optional[int] = None
    aspect_ratio: str = "16:9"
    extra_params: dict = field(default_factory=dict)


class VideoProvider(ABC):
    """视频生成 Provider 抽象接口

    所有视频生成 provider 必须实现此接口。
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider 唯一标识（如 kling, seedance, runway, mock）"""
        ...

    @abstractmethod
    async def generate(self, request: VideoGenerateRequest) -> VideoGenerateResult:
        """提交视频生成任务"""
        ...

    @abstractmethod
    async def poll(self, task_id: str) -> VideoGenerateResult:
        """轮询视频生成任务状态，返回最终结果或抛出异常"""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """检查 provider 是否可用（API key 是否配置等）"""
        ...
