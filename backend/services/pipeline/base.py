"""Pipeline Client Base — Phase 0

统一的 API 调用基类，封装：
- httpx.AsyncClient
- 超时配置（视频300s、音频120s、其他60s）
- 重试策略（最多3次，指数退避）
- 成本追踪 record_cost()
- 错误包装 PipelineError
"""

import asyncio
import time
from typing import Any, Optional

import httpx


class PipelineError(Exception):
    """Pipeline 统一异常类"""

    def __init__(
        self,
        message: str,
        provider: Optional[str] = None,
        error_type: str = "provider_error",  # provider_error | timeout | config_error | network_error
        details: Optional[dict] = None,
    ):
        self.message = message
        self.provider = provider
        self.error_type = error_type
        self.details = details or {}
        super().__init__(self.message)


class PipelineClient:
    """Pipeline API 调用基类"""

    # 默认超时配置（秒）
    DEFAULT_TIMEOUTS = {
        "video": 300.0,  # 视频生成：5分钟
        "audio": 120.0,  # 音频生成：2分钟
        "image": 60.0,   # 图像生成：1分钟
        "compose": 60.0, # 合成：1分钟
        "default": 60.0, # 默认：1分钟
    }

    def __init__(self, provider_name: str, api_key: str, base_url: str):
        self.provider_name = provider_name
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

        # 成本追踪（USD）
        self._cost_tracker = {}

    def get_timeout(self, category: str = "default") -> float:
        """获取超时时间"""
        return self.DEFAULT_TIMEOUTS.get(category, self.DEFAULT_TIMEOUTS["default"])

    def record_cost(self, step_key: str, cost_usd: float, metadata: Optional[dict] = None):
        """记录成本（USD）

        Args:
            step_key: 步骤标识（如 "video_generation"）
            cost_usd: 成本金额
            metadata: 额外元数据（如 token 数、生成时长等）
        """
        if step_key not in self._cost_tracker:
            self._cost_tracker[step_key] = {"total_cost": 0.0, "attempts": []}

        self._cost_tracker[step_key]["total_cost"] += cost_usd
        self._cost_tracker[step_key]["attempts"].append({
            "cost_usd": cost_usd,
            "timestamp": time.time(),
            **(metadata or {}),
        })

    def get_cost_summary(self) -> dict:
        """获取成本汇总"""
        total = sum(attempts["total_cost"] for attempts in self._cost_tracker.values())
        return {
            "total_cost_usd": round(total, 4),
            "by_step": {
                step: round(data["total_cost"], 4)
                for step, data in self._cost_tracker.items()
            },
        }

    async def _retry_wrapper(
        self,
        func,
        max_retries: int = 3,
        backoff_base: float = 1.0,
        timeout_category: str = "default",
        **kwargs
    ) -> Any:
        """重试包装器（指数退避）

        Args:
            func: 异步函数
            max_retries: 最大重试次数
            backoff_base: 退避基数（秒）
            timeout_category: 超时类别
            **kwargs: 传递给 func 的参数

        Raises:
            PipelineError: 所有重试失败后抛出
        """
        last_exception = None
        timeout = self.get_timeout(timeout_category)

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    return await func(client, **kwargs)

            except httpx.TimeoutException as e:
                last_exception = PipelineError(
                    message=f"{self.provider_name} timeout after {timeout}s",
                    provider=self.provider_name,
                    error_type="timeout",
                    details={"attempt": attempt + 1, "timeout": timeout},
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff_base * (2 ** attempt))

            except httpx.HTTPStatusError as e:
                last_exception = PipelineError(
                    message=f"{self.provider_name} HTTP error: {e.response.status_code}",
                    provider=self.provider_name,
                    error_type="provider_error",
                    details={
                        "attempt": attempt + 1,
                        "status_code": e.response.status_code,
                        "response_text": e.response.text[:500],  # 只保留前500字符
                    },
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff_base * (2 ** attempt))

            except httpx.RequestError as e:
                last_exception = PipelineError(
                    message=f"{self.provider_name} network error: {str(e)}",
                    provider=self.provider_name,
                    error_type="network_error",
                    details={"attempt": attempt + 1, "error": str(e)},
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff_base * (2 ** attempt))

            except Exception as e:
                last_exception = PipelineError(
                    message=f"{self.provider_name} unexpected error: {str(e)}",
                    provider=self.provider_name,
                    error_type="provider_error",
                    details={"attempt": attempt + 1, "error_type": type(e).__name__},
                )
                break  # 非预期错误不重试

        # 所有重试失败，抛出最后一个异常
        if last_exception:
            raise last_exception
        raise PipelineError(
            message="Unknown error occurred",
            provider=self.provider_name,
            error_type="provider_error",
        )

    def reset_costs(self):
        """重置成本追踪（用于新 job）"""
        self._cost_tracker = {}
