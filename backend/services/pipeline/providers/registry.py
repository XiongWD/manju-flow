"""视频 Provider 注册中心

管理所有视频生成 provider 的注册、查询和优先级排序。
"""

from typing import Optional

from .base import VideoProvider


class VideoProviderRegistry:
    """视频 Provider 注册中心"""

    def __init__(self):
        self._providers: dict[str, VideoProvider] = {}
        self._fallback_chain: list[tuple[int, str]] = []  # (priority, name)，按优先级排列

    def register(self, provider: VideoProvider, priority: int = 0):
        """注册 provider，priority 越小越优先"""
        self._providers[provider.name] = provider
        # 更新 fallback chain（去重后重新排序）
        self._fallback_chain = [
            (p, n) for p, n in self._fallback_chain if n != provider.name
        ]
        self._fallback_chain.append((priority, provider.name))
        self._fallback_chain.sort(key=lambda x: x[0])

    def get(self, name: str) -> Optional[VideoProvider]:
        """按名称获取 provider"""
        return self._providers.get(name)

    def get_available_chain(self) -> list[VideoProvider]:
        """获取已注册的 provider 链（按优先级排序）

        注意：is_available 是 async 方法，这里返回所有已注册的 provider。
        调用方需要自行检查 is_available。
        """
        return [self._providers[name] for _, name in self._fallback_chain]

    def list_providers(self) -> list[str]:
        """列出所有已注册的 provider 名称"""
        return list(self._providers.keys())


# 全局单例
video_provider_registry = VideoProviderRegistry()
