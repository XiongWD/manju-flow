"""Compose — Phase 3

合成模块：
- Compositor class
- compose() method（合并视频+音频）
- 调用本地 ffmpeg（subprocess）
- check_ffmpeg_available() 方法
"""

import hashlib
import os
import subprocess
from pathlib import Path

from database.models import Asset, AssetLink, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from .base import PipelineError


class Compositor:
    """合成器（使用 ffmpeg 合并视频+音频）"""

    def __init__(self, output_dir: str = "./storage/output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def check_ffmpeg_available() -> bool:
        """检查 ffmpeg 是否可用

        Returns:
            bool: ffmpeg 是否在 PATH 中且可执行
        """
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    async def compose(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        video_asset: Asset,
        audio_asset: Asset,
    ) -> Asset:
        """合成视频+音频

        Args:
            db: 数据库 session
            scene_version: 场景版本
            video_asset: 视频资产
            audio_asset: 音频资产

        Returns:
            Asset: 合成后的视频资产

        Raises:
            PipelineError: ffmpeg 不可用或合成失败
        """
        # 检查 ffmpeg
        if not self.check_ffmpeg_available():
            raise PipelineError(
                message="ffmpeg is not available on this system",
                error_type="config_error",
                details={
                    "video_asset_id": video_asset.id,
                    "audio_asset_id": audio_asset.id,
                },
            )

        # 提取视频和音频路径（从 URI）
        video_path = self._uri_to_path(video_asset.uri)
        audio_path = self._uri_to_path(audio_asset.uri)

        if not video_path or not os.path.exists(video_path):
            raise PipelineError(
                message=f"Video file not found: {video_path}",
                error_type="provider_error",
                details={"video_asset_id": video_asset.id, "video_uri": video_asset.uri},
            )

        if not audio_path or not os.path.exists(audio_path):
            raise PipelineError(
                message=f"Audio file not found: {audio_path}",
                error_type="provider_error",
                details={"audio_asset_id": audio_asset.id, "audio_uri": audio_asset.uri},
            )

        # 生成输出文件名
        output_filename = f"composed_{scene_version.id[:8]}.mp4"
        output_path = self.output_dir / output_filename

        # 构造 ffmpeg 命令
        # -i video_path: 输入视频
        # -i audio_path: 输入音频
        # -c:v copy: 视频流直接复制（不重新编码）
        # -c:a aac: 音频编码为 AAC
        # -map 0:v:0: 使用第一个输入的视频流
        # -map 1:a:0: 使用第二个输入的音频流
        # -shortest: 以较短的流为基准
        cmd = [
            "ffmpeg",
            "-y",  # 覆盖输出文件
            "-i", str(video_path),
            "-i", str(audio_path),
            "-c:v", "copy",
            "-c:a", "aac",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            str(output_path),
        ]

        try:
            # 执行 ffmpeg
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5分钟超时
            )

            if result.returncode != 0:
                raise PipelineError(
                    message=f"ffmpeg failed with return code {result.returncode}",
                    error_type="provider_error",
                    details={
                        "stderr": result.stderr,
                        "stdout": result.stdout,
                        "cmd": " ".join(cmd),
                    },
                )

        except subprocess.TimeoutExpired:
            raise PipelineError(
                message="ffmpeg timeout after 300s",
                error_type="timeout",
                details={"cmd": " ".join(cmd)},
            )

        except FileNotFoundError:
            raise PipelineError(
                message="ffmpeg not found in PATH",
                error_type="config_error",
                details={"cmd": " ".join(cmd)},
            )

        # 检查输出文件
        if not os.path.exists(output_path):
            raise PipelineError(
                message=f"ffmpeg output file not created: {output_path}",
                error_type="provider_error",
                details={"cmd": " ".join(cmd)},
            )

        # 获取文件大小
        file_size = os.path.getsize(output_path)

        # 获取时长（使用 ffprobe）
        duration = await self._get_video_duration(str(output_path))

        # 创建 Asset
        asset = Asset(
            id=hashlib.sha256(output_filename.encode()).hexdigest()[:32],
            project_id=scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
            type="video",
            uri=f"file://{output_path}",
            mime_type="video/mp4",
            file_size=file_size,
            duration=duration,
            metadata_json={
                "video_asset_id": video_asset.id,
                "audio_asset_id": audio_asset.id,
                "method": "ffmpeg",
                "cmd": " ".join(cmd),
            },
        )
        db.add(asset)
        await db.flush()

        # 创建 AssetLink
        link = AssetLink(
            id=hashlib.sha256(f"{asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
            asset_id=asset.id,
            owner_type="scene_version",
            owner_id=scene_version.id,
            relation_type="output",
        )
        db.add(link)
        await db.flush()

        return asset

    async def _get_video_duration(self, video_path: str) -> float:
        """获取视频时长（秒）

        Args:
            video_path: 视频文件路径

        Returns:
            float: 时长（秒）
        """
        try:
            # 使用 ffprobe 获取时长
            cmd = [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path,
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                duration_str = result.stdout.strip()
                return float(duration_str)

        except (subprocess.TimeoutExpired, ValueError, FileNotFoundError):
            pass

        # 如果失败，返回 0
        return 0.0

    @staticmethod
    def _uri_to_path(uri: str) -> str | None:
        """将 URI 转换为本地路径

        Args:
            uri: URI（如 file:///path/to/file 或 /path/to/file）

        Returns:
            str | None: 本地路径，如果 URI 格式不支持则返回 None
        """
        if uri.startswith("file://"):
            return uri[7:]
        elif uri.startswith("/"):
            return uri
        else:
            # 其他 URI 类型（如 s3://, minio://）暂不支持
            return None
