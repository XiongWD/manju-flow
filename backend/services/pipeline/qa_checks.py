"""QA Gate — 检查实现

从 qa.py 拆分：各检查方法 + 辅助函数
"""

import json
import os
import shutil
import subprocess
from typing import Optional

from database.models import Asset, AssetLink, CharacterAsset
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _get_ffprobe_path() -> Optional[str]:
    """获取 ffprobe 可执行文件路径"""
    return shutil.which("ffprobe")


def _probe_media(uri: str) -> Optional[dict]:
    """使用 ffprobe 获取媒体文件信息"""
    ffprobe = _get_ffprobe_path()
    if not ffprobe:
        return None

    local_path = None
    if uri and uri.startswith("file://"):
        local_path = uri[7:]
    elif uri and os.path.exists(uri):
        local_path = uri

    if not local_path or not os.path.exists(local_path):
        return None

    try:
        result = subprocess.run(
            [ffprobe, "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", local_path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
        pass
    return None


async def check_file_exists(asset: Asset) -> dict:
    """检查文件是否存在"""
    exists = bool(asset.uri and asset.uri.strip())
    return {
        "check": "file_exists",
        "passed": exists,
        "score": 100 if exists else 0,
        "message": "File exists" if exists else f"File not found (URI: {asset.uri})",
    }


def check_file_size(asset: Asset, thresholds: dict) -> dict:
    """检查文件大小"""
    file_size = asset.file_size or 0
    min_size = thresholds.get("min_file_size", 0)
    passed = file_size >= min_size
    return {
        "check": "file_size",
        "passed": passed,
        "score": 100 if passed else 0,
        "message": f"File size: {file_size} bytes (min: {min_size})",
        "details": {"file_size": file_size, "min_size": min_size},
    }


def check_duration(asset: Asset, thresholds: dict) -> dict:
    """检查时长"""
    duration = asset.duration or 0
    min_duration = thresholds.get("min_duration", 0)
    passed = duration >= min_duration
    return {
        "check": "duration",
        "passed": passed,
        "score": 100 if passed else 0,
        "message": f"Duration: {duration}s (min: {min_duration}s)",
        "details": {"duration": duration, "min_duration": min_duration},
    }


async def check_character_asset_exists(
    db: AsyncSession, asset: Asset, thresholds: dict,
) -> dict:
    """G2 检查：验证是否生成了角色资产"""
    char_asset_q = select(CharacterAsset).where(CharacterAsset.asset_id == asset.id)
    result = await db.execute(char_asset_q)
    char_asset = result.scalar_one_or_none()
    exists = char_asset is not None
    return {
        "check": "character_asset_exists",
        "passed": exists,
        "score": 100 if exists else 0,
        "message": "Character asset exists" if exists else "Character asset record not found",
        "details": {
            "asset_id": asset.id,
            "char_asset_id": char_asset.id if char_asset else None,
        },
    }


async def check_character_asset_linked(db: AsyncSession, asset: Asset) -> dict:
    """G2 检查：验证角色资产是否关联到场景版本"""
    link_q = select(AssetLink).where(
        AssetLink.asset_id == asset.id,
        AssetLink.relation_type == "character_reference",
    )
    result = await db.execute(link_q)
    link = result.scalar_one_or_none()
    linked = link is not None
    return {
        "check": "character_asset_linked",
        "passed": linked,
        "score": 100 if linked else 0,
        "message": "Character asset linked to scene_version" if linked else "Character asset not linked",
        "details": {
            "asset_id": asset.id,
            "link_id": link.id if link else None,
            "owner_type": link.owner_type if link else None,
            "owner_id": link.owner_id if link else None,
        },
    }


def check_ip_adapter_similarity(asset: Asset, thresholds: dict) -> dict:
    """G3 检查：IP-Adapter cosine similarity"""
    similarity = 0.0
    if asset.metadata_json:
        similarity = asset.metadata_json.get("similarity", 0.0)
    min_similarity = thresholds.get("min_similarity", 0.72)
    passed = similarity >= min_similarity
    score = int((similarity / 1.0) * 100)
    return {
        "check": "ip_adapter_similarity",
        "passed": passed,
        "score": score,
        "message": f"IP-Adapter similarity: {similarity:.3f} (min: {min_similarity})",
        "details": {"similarity": similarity, "min_similarity": min_similarity},
    }


async def check_media_format(asset: Asset, thresholds: dict) -> dict:
    """使用 ffprobe 检查媒体格式硬指标"""
    ffprobe = _get_ffprobe_path()
    if not ffprobe:
        return {
            "check": "media_format", "passed": False, "score": 0,
            "message": "ffprobe not available, cannot perform media QA",
            "details": {"ffprobe_available": False},
        }

    probe = _probe_media(asset.uri)
    if probe is None:
        return {
            "check": "media_format", "passed": False, "score": 0,
            "message": f"Failed to probe media: {asset.uri}",
            "details": {"uri": asset.uri},
        }

    issues = []
    format_info = probe.get("format", {})
    streams = probe.get("streams", [])

    duration = float(format_info.get("duration", 0))
    min_duration = thresholds.get("min_duration", 0.5)
    if duration < min_duration:
        issues.append(f"Duration {duration:.2f}s < min {min_duration}s")

    video_streams = [s for s in streams if s.get("codec_type") == "video"]
    if video_streams:
        vs = video_streams[0]
        width = int(vs.get("width", 0))
        height = int(vs.get("height", 0))
        fps_raw = vs.get("r_frame_rate", "0/1")
        try:
            fps = float(fps_raw.split("/")[0]) / float(fps_raw.split("/")[1]) if "/" in fps_raw else float(fps_raw)
        except (ValueError, ZeroDivisionError):
            fps = 0.0

        min_width = thresholds.get("min_width", 0)
        min_height = thresholds.get("min_height", 0)
        min_fps = thresholds.get("min_fps", 0)

        if min_width and width < min_width:
            issues.append(f"Width {width} < min {min_width}")
        if min_height and height < min_height:
            issues.append(f"Height {height} < min {min_height}")
        if min_fps and fps < min_fps:
            issues.append(f"FPS {fps:.1f} < min {min_fps}")

    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    require_audio = thresholds.get("require_audio", False)
    if require_audio and not audio_streams:
        issues.append("No audio stream found")

    passed = len(issues) == 0
    return {
        "check": "media_format", "passed": passed, "score": 100 if passed else 0,
        "message": "Media format OK" if passed else f"Media format issues: {'; '.join(issues)}",
        "details": {
            "duration": duration,
            "video_streams": len(video_streams),
            "audio_streams": len(audio_streams),
            "issues": issues,
            "ffprobe_available": True,
        },
    }


def get_severity(check_name: str) -> str:
    """获取问题严重程度"""
    if check_name in ("character_asset_exists", "character_asset_linked", "ip_adapter_similarity"):
        return "warning"
    return "critical"


def get_suggested_action(gate_code: str, check_name: str) -> str:
    """获取建议修复动作"""
    actions = {
        "G2": {
            "character_asset_exists": "角色资产未生成，检查角色资产生成步骤",
            "character_asset_linked": "角色资产未关联到场景版本，检查资产链接配置",
        },
        "G3": {
            "ip_adapter_similarity": "IP-Adapter 相似度不足，建议手动审查或调整参考图",
        },
        "G6": {
            "file_exists": "检查视频生成输出路径配置",
            "file_size": "视频文件过小，可能生成失败，重试生成",
            "duration": "视频时长不足，检查 prompt 和参数配置",
            "media_format": "视频媒体格式不符合要求（分辨率/帧率/时长），检查生成参数",
        },
        "G8": {
            "file_exists": "检查音频生成输出路径配置",
            "file_size": "音频文件过小，可能生成失败，重试生成",
            "duration": "音频时长不足，检查 TTS 文本和配置",
            "media_format": "音频媒体格式不符合要求（缺音轨/时长），检查生成配置",
        },
        "G9": {
            "file_exists": "检查合成输出路径配置",
            "file_size": "合成文件过小，ffmpeg 可能失败，检查日志",
            "duration": "合成时长不足，检查视频和音频时长匹配",
            "media_format": "合成媒体格式不符合要求（分辨率/音轨），检查 ffmpeg 合成参数",
        },
    }
    return actions.get(gate_code, {}).get(check_name, "联系技术支持")
