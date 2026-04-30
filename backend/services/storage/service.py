"""统一存储服务 — 所有生成资产必须通过此服务保存

提供统一存储入口：
- MinIO 可用时使用 MinIO
- MinIO 不可用时 fallback 到本地文件系统
"""

import hashlib
import json
import os
import tempfile
from typing import Optional

from .minio_client import MinIOStorageClient, get_storage_client, get_storage_config


class StorageService:
    """统一存储入口：MinIO 优先，local fallback"""

    def __init__(self):
        self._minio_client: Optional[MinIOStorageClient] = None
        self._minio_available: Optional[bool] = None
        self._local_base: str = os.getenv(
            "STORAGE_LOCAL_PATH",
            os.path.join(os.path.dirname(__file__), "..", "..", "storage_data"),
        )

    def _ensure_local_dir(self, subpath: str) -> str:
        """确保本地目录存在，返回完整路径"""
        full = os.path.join(self._local_base, subpath)
        os.makedirs(full, exist_ok=True)
        return full

    @property
    def is_minio_available(self) -> bool:
        """检查 MinIO 是否可用（带缓存）"""
        if self._minio_available is None:
            try:
                client = get_storage_client()
                client.client.bucket_exists(get_storage_config().bucket_name)
                self._minio_available = True
                self._minio_client = client
            except Exception:
                self._minio_available = False
        return self._minio_available

    async def save_bytes(
        self,
        data: bytes,
        filename: str,
        mime_type: str = "application/octet-stream",
        prefix: str = "assets",
        metadata: Optional[dict] = None,
    ) -> dict:
        """保存 bytes 数据，返回 {"uri": str, "size": int, "checksum": str}

        MinIO 可用时用 MinIO，否则存本地文件。
        """
        checksum = hashlib.sha256(data).hexdigest()
        file_size = len(data)

        if self.is_minio_available:
            # 写入临时文件再上传 MinIO
            suffix = os.path.splitext(filename)[1] or ".bin"
            tmp_path = tempfile.mktemp(suffix=suffix)
            with open(tmp_path, "wb") as f:
                f.write(data)
            try:
                object_name, public_url, _ = await self._minio_client.upload_file(
                    file_path=tmp_path,
                    object_name=None,
                    content_type=mime_type,
                    metadata=metadata,
                    prefix=prefix,
                )
                return {"uri": public_url, "size": file_size, "checksum": checksum}
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        else:
            # Local fallback
            dir_path = self._ensure_local_dir(prefix)
            local_path = os.path.join(dir_path, filename)
            with open(local_path, "wb") as f:
                f.write(data)
            uri = f"file://{local_path}"
            return {"uri": uri, "size": file_size, "checksum": checksum}

    async def save_json(
        self,
        data: dict,
        filename: str,
        prefix: str = "assets",
    ) -> dict:
        """保存 JSON 数据"""
        content = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        return await self.save_bytes(
            content, filename, mime_type="application/json", prefix=prefix
        )

    async def save_local_file(
        self,
        file_path: str,
        filename: str,
        mime_type: str = "application/octet-stream",
        prefix: str = "assets",
        metadata: Optional[dict] = None,
    ) -> dict:
        """保存一个已存在的本地文件，返回 {"uri": str, "size": int, "checksum": str}

        用于 ffmpeg 等工具输出到临时文件的场景。
        """
        with open(file_path, "rb") as f:
            data = f.read()
        return await self.save_bytes(
            data, filename, mime_type=mime_type, prefix=prefix, metadata=metadata
        )

    async def exists(self, uri: str) -> bool:
        """检查 URI 对应的资源是否存在"""
        if uri.startswith("file://"):
            return os.path.exists(uri[7:])
        # MinIO / HTTP URI — 简化处理，不做网络检查
        return True

    async def resolve_local_path(self, uri: str) -> Optional[str]:
        """如果是 file:// URI，返回本地路径；否则 None"""
        if uri.startswith("file://"):
            path = uri[7:]
            return path if os.path.exists(path) else None
        return None


# 全局单例
_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """获取全局 StorageService 单例"""
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
