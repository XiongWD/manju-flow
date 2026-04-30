"""C2PA Signing — Phase 7

C2PA 签名模块：
- C2PASigner 类
- 调用本地 c2patool 对视频文件进行签名
- 注入 C2PA 元数据（生成信息、时间戳、工具标识）
- 非阻塞步骤：c2patool 不可用时跳过，不 fail
"""

import asyncio
import hashlib
import logging

logger = logging.getLogger(__name__)
import json
import os
import subprocess
import time
from typing import Optional
from datetime import datetime, timezone

from database.models import Asset, AssetLink, JobStep, SceneVersion
from sqlalchemy.ext.asyncio import AsyncSession

from services.storage.service import get_storage_service

from .base import PipelineError
from .config import get_c2pa_config


class C2PASigner:
    """C2PA 签名器（调用 c2patool）"""

    # C2PA 元数据模板
    MANIFEST_TEMPLATE = {
        "claim_generator": "manju-pipeline-043b",
        "claim_generator_version": "1.0.0",
        "title": "Manju Production Video",
        "format": "mp4",
        "created": None,  # ISO 8601 格式
        "assertions": [],
    }

    def __init__(self):
        c2pa_config = get_c2pa_config()
        self.tool_path = c2pa_config.get("tool_path", "c2patool")
        self.signing_key_path = c2pa_config.get("signing_key_path", "")

    def check_c2patool_available(self) -> bool:
        """检查 c2patool 是否可用

        Returns:
            bool: True 表示可用，False 表示不可用
        """
        try:
            # 尝试运行 c2patool --version
            result = subprocess.run(
                [self.tool_path, "--version"],
                capture_output=True,
                timeout=5,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception) as e:
            logger.warning("c2patool not available: %s", e)
            return False

    async def sign(
        self,
        db: AsyncSession,
        scene_version: SceneVersion,
        input_asset: Asset,
        step: JobStep,
    ) -> Asset:
        """对视频文件进行 C2PA 签名

        Args:
            db: 数据库 session
            scene_version: 场景版本
            input_asset: 输入资产（视频）
            step: 当前 JobStep（用于记录 metadata）

        Returns:
            Asset: 带签名的视频资产

        Raises:
            PipelineError: 签名失败（仅在需要签名时）
        """
        # 检查 c2patool 是否可用
        if not self.check_c2patool_available():
            # c2patool 不可用，记录警告并跳过（非阻塞步骤）
            logger.warning("c2patool not available, skipping C2PA signing")

            if step:
                step.metadata_json = step.metadata_json or {}
                step.metadata_json["c2pa_skipped"] = True
                step.metadata_json["c2pa_reason"] = "c2patool not available"

            # 创建一个引用原资产的 Asset（不实际签名）
            output_asset = Asset(
                id=hashlib.sha256(f"{input_asset.id}_c2pa_skip".encode()).hexdigest()[:32],
                project_id=input_asset.project_id,
                type=input_asset.type,
                uri=input_asset.uri,  # 使用原 URI
                mime_type=input_asset.mime_type,
                file_size=input_asset.file_size,
                duration=input_asset.duration,
                metadata_json={
                    "c2pa_signed": False,
                    "c2pa_skipped": True,
                    "reason": "c2patool not available",
                    "source_asset_id": input_asset.id,
                },
            )
            db.add(output_asset)
            await db.flush()

            # 创建 AssetLink
            link = AssetLink(
                id=hashlib.sha256(f"{output_asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
                asset_id=output_asset.id,
                owner_type="scene_version",
                owner_id=scene_version.id,
                relation_type="c2pa_signed",
            )
            db.add(link)

            await db.flush()

            return output_asset

        # c2patool 可用，执行签名
        try:
            start_time = time.time()

            # 1. 准备输入文件路径和输出文件路径
            # TODO: 从 input_asset.uri 解析出实际文件路径
            # 简化：假设 URI 格式为 file://storage/xxx/xxx.mp4
            input_path = input_asset.uri.replace("file://", "")

            # 构造输出文件名
            input_filename = os.path.basename(input_path)
            output_filename = f"c2pa_{input_filename}"
            output_path = os.path.join(os.path.dirname(input_path), output_filename)

            # 2. 构造 C2PA manifest
            manifest = self._build_manifest(
                scene_version=scene_version,
                input_asset=input_asset,
            )

            # 3. 执行 c2patool sign
            # 命令格式：c2patool <input_path> -s <signing_key_path> -o <output_path>
            cmd = [
                self.tool_path,
                input_path,
                "-s", self.signing_key_path,
                "-o", output_path,
            ]

            # 注入 manifest 数据（TODO: 根据 c2patool 实际 API 调整）
            # c2patool 可能支持 -m 参数注入 manifest，或者使用配置文件
            if manifest:
                manifest_json = json.dumps(manifest, ensure_ascii=False)
                # TODO: 将 manifest 写入临时文件或通过参数传递
                # 这里假设 c2patool 支持 -m 参数
                cmd.extend(["-m", manifest_json])

            # 在线程池中运行 subprocess（避免阻塞 async）
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, subprocess.run, cmd, dict(
                capture_output=True,
                timeout=60,  # 60 秒超时
            ))

            duration = time.time() - start_time

            # 4. 检查输出文件是否存在
            if not os.path.exists(output_path):
                raise PipelineError(
                    message="C2PA signing failed: output file not created",
                    error_type="provider_error",
                    details={"cmd": cmd, "output_path": output_path},
                )

            # 5. 通过 StorageService 保存签名后的文件
            storage_svc = get_storage_service()
            save_result = await storage_svc.save_local_file(
                output_path, output_filename,
                mime_type=input_asset.mime_type or "application/octet-stream",
                prefix="c2pa",
            )
            # 清理临时文件
            if os.path.exists(output_path):
                os.unlink(output_path)

            output_asset = Asset(
                id=hashlib.sha256(output_filename.encode()).hexdigest()[:32],
                project_id=input_asset.project_id,
                type=input_asset.type,
                uri=save_result["uri"],
                mime_type=input_asset.mime_type,
                file_size=save_result["size"],
                duration=input_asset.duration,
                metadata_json={
                    "c2pa_signed": True,
                    "c2pa_tool": self.tool_path,
                    "c2pa_manifest": manifest,
                    "source_asset_id": input_asset.id,
                    "signing_duration": duration,
                },
            )
            db.add(output_asset)
            await db.flush()

            # 创建 AssetLink
            link = AssetLink(
                id=hashlib.sha256(f"{output_asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
                asset_id=output_asset.id,
                owner_type="scene_version",
                owner_id=scene_version.id,
                relation_type="c2pa_signed",
            )
            db.add(link)

            # 记录到 step metadata
            if step:
                step.metadata_json = step.metadata_json or {}
                step.metadata_json["c2pa_signed"] = True
                step.metadata_json["c2pa_duration"] = duration
                step.metadata_json["c2pa_output_path"] = output_path

            await db.flush()

            return output_asset

        except subprocess.TimeoutExpired as e:
            raise PipelineError(
                message="C2PA signing timeout",
                error_type="timeout",
                details={"cmd": cmd, "timeout": 60},
            )
        except Exception as e:
            # C2PA 签名失败，记录警告但不 fail（非阻塞步骤）
            logger.error("C2PA signing failed: %s", e)

            if step:
                step.metadata_json = step.metadata_json or {}
                step.metadata_json["c2pa_skipped"] = True
                step.metadata_json["c2pa_error"] = str(e)

            # 创建一个引用原资产的 Asset
            output_asset = Asset(
                id=hashlib.sha256(f"{input_asset.id}_c2pa_error".encode()).hexdigest()[:32],
                project_id=input_asset.project_id,
                type=input_asset.type,
                uri=input_asset.uri,
                mime_type=input_asset.mime_type,
                file_size=input_asset.file_size,
                duration=input_asset.duration,
                metadata_json={
                    "c2pa_signed": False,
                    "c2pa_skipped": True,
                    "reason": "c2pa signing failed",
                    "c2pa_error": str(e),
                    "source_asset_id": input_asset.id,
                },
            )
            db.add(output_asset)
            await db.flush()

            # 创建 AssetLink
            link = AssetLink(
                id=hashlib.sha256(f"{output_asset.id}_{scene_version.id}".encode()).hexdigest()[:32],
                asset_id=output_asset.id,
                owner_type="scene_version",
                owner_id=scene_version.id,
                relation_type="c2pa_signed",
            )
            db.add(link)

            await db.flush()

            return output_asset

    def _build_manifest(
        self,
        scene_version: SceneVersion,
        input_asset: Asset,
    ) -> dict:
        """构建 C2PA manifest

        Args:
            scene_version: 场景版本
            input_asset: 输入资产

        Returns:
            dict: C2PA manifest JSON
        """
        manifest = self.MANIFEST_TEMPLATE.copy()

        # 设置创建时间
        manifest["created"] = datetime.now(timezone.utc).isoformat() + "Z"

        # 添加断言（assertions）
        # TODO: 根据实际需求添加更多断言信息
        manifest["assertions"] = [
            {
                "label": "org.manju.production.metadata",
                "data": {
                    "scene_version_id": scene_version.id,
                    "scene_version_no": scene_version.version_no,
                    "scene_id": scene_version.scene_id,
                    "project_id": scene_version.scene.project_id if hasattr(scene_version.scene, 'project_id') else None,
                    "prompt_bundle": scene_version.prompt_bundle,
                    "model_bundle": scene_version.model_bundle,
                    "source_asset_id": input_asset.id,
                    "production_timestamp": datetime.now(timezone.utc).isoformat() + "Z",
                },
            },
            {
                "label": "org.manju.production.creative_work",
                "data": {
                    "title": f"Manju Production - Scene {scene_version.scene_id}",
                    "format": "video/mp4",
                    "creator": "Manju Production Pipeline",
                    "generator": "manju-pipeline-043b",
                },
            },
        ]

        return manifest
