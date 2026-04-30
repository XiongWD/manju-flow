"""视频生成 Provider 抽象层

提供统一的视频生成接口，支持多个 provider（Kling、Seedance、Mock 等）。
"""

from .base import VideoProvider, VideoGenerateRequest, VideoGenerateResult
from .mock import MockVideoProvider
from .registry import VideoProviderRegistry, video_provider_registry

# 注册默认 providers
video_provider_registry.register(MockVideoProvider(), priority=100)  # mock 最低优先级
