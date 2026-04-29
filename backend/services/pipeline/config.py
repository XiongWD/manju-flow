"""Pipeline Configuration — Phase 0

统一配置管理：
- 从 os.environ 读取所有 API 配置
- get_pipeline_mode() → "mock" | "real"
- get_provider_config(provider_name) → dict
- 启动时校验：real 模式下缺少必要 key 则 raise
"""

import os
from typing import Optional


def get_pipeline_mode() -> str:
    """获取 pipeline 模式

    Returns:
        "mock" | "real"
    """
    mode = os.getenv("PIPELINE_MODE", "mock").lower()
    if mode not in ("mock", "real"):
        raise ValueError(f"Invalid PIPELINE_MODE: {mode}. Must be 'mock' or 'real'")
    return mode


def get_provider_config(provider_name: str) -> dict:
    """获取 provider 配置

    Args:
        provider_name: provider 名称（kling, seedance, elevenlabs, fish_audio, comfyui）

    Returns:
        dict: {key, base_url, timeout, ...}
    """
    provider_configs = {
        "kling": {
            "key": os.getenv("KLING_API_KEY", ""),
            "base_url": os.getenv("KLING_API_BASE", "https://api.klingai.com"),
            "timeout": 300.0,  # 5分钟
        },
        "seedance": {
            "key": os.getenv("SEEDANCE_API_KEY", ""),
            "base_url": os.getenv("SEEDANCE_API_BASE", "https://api.seedance.com"),
            "timeout": 300.0,
        },
        "elevenlabs": {
            "key": os.getenv("ELEVENLABS_API_KEY", ""),
            "base_url": os.getenv("ELEVENLABS_API_BASE", "https://api.elevenlabs.io"),
            "timeout": 120.0,  # 2分钟
        },
        "fish_audio": {
            "key": os.getenv("FISH_AUDIO_API_KEY", ""),
            "base_url": os.getenv("FISH_AUDIO_API_BASE", "https://api.fish.audio"),
            "timeout": 120.0,
        },
        "comfyui": {
            "username": os.getenv("COMFYUI_USERNAME", ""),
            "password": os.getenv("COMFYUI_PASSWORD", ""),
            "host": os.getenv("COMFYUI_HOST", ""),
            "port": os.getenv("COMFYUI_PORT", "8188"),
            "api_url": os.getenv("COMFYUI_API_URL", ""),
            "timeout": 60.0,
        },
    }

    if provider_name not in provider_configs:
        raise ValueError(f"Unknown provider: {provider_name}")

    config = provider_configs[provider_name].copy()

    # ComfyUI 特殊处理：优先使用 api_url，否则拼接 host:port
    if provider_name == "comfyui":
        if config["api_url"]:
            config["base_url"] = config["api_url"]
        elif config["host"]:
            config["base_url"] = f"http://{config['host']}:{config['port']}"
        else:
            config["base_url"] = ""

    return config


def validate_real_mode_config() -> list[str]:
    """校验 real 模式下必要配置

    Returns:
        list[str]: 缺失的配置项（空列表表示全部 OK）

    Raises:
        ValueError: 如果 PIPELINE_MODE 不是 real
    """
    if get_pipeline_mode() != "real":
        raise ValueError(f"PIPELINE_MODE is '{get_pipeline_mode()}', cannot validate real mode")

    missing = []

    # 检查视频生成 provider（至少一个）
    kling_key = os.getenv("KLING_API_KEY", "")
    seedance_key = os.getenv("SEEDANCE_API_KEY", "")
    if not kling_key and not seedance_key:
        missing.append("KLING_API_KEY or SEEDANCE_API_KEY")

    # 检查音频生成 provider（至少一个）
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
    fish_audio_key = os.getenv("FISH_AUDIO_API_KEY", "")
    if not elevenlabs_key and not fish_audio_key:
        missing.append("ELEVENLABS_API_KEY or FISH_AUDIO_API_KEY")

    # 检查 ComfyUI（可选）
    comfyui_host = os.getenv("COMFYUI_HOST", "")
    comfyui_api_url = os.getenv("COMFYUI_API_URL", "")
    if not comfyui_host and not comfyui_api_url:
        # ComfyUI 是可选的，暂不报错
        pass

    return missing


def get_storage_config() -> dict:
    """获取存储配置"""
    return {
        "storage_root": os.getenv("STORAGE_ROOT", "./storage"),
        "output_dir": os.getenv("OUTPUT_DIR", "./storage/output"),
        "minio_endpoint": os.getenv("MINIO_ENDPOINT", ""),
        "minio_access_key": os.getenv("MINIO_ACCESS_KEY", ""),
        "minio_secret_key": os.getenv("MINIO_SECRET_KEY", ""),
        "minio_bucket": os.getenv("MINIO_BUCKET", "manju-assets"),
        "minio_use_ssl": os.getenv("MINIO_USE_SSL", "false").lower() == "true",
        "minio_public_url": os.getenv("MINIO_PUBLIC_URL", ""),
    }


def get_c2pa_config() -> dict:
    """获取 C2PA 配置"""
    return {
        "tool_path": os.getenv("C2PATOOL_PATH", ""),
        "signing_key_path": os.getenv("C2PA_SIGNING_KEY_PATH", ""),
    }
