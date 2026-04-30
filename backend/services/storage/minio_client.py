"""MinIO/S3 兼容存储客户端

提供最小可用版本的文件上传、下载、预览功能
"""

import hashlib
from datetime import timedelta
from typing import Optional, Tuple
from urllib.parse import urljoin

from pydantic import BaseModel


class StorageConfig(BaseModel):
    """存储配置"""
    from config import settings
    endpoint: str = settings.MINIO_ENDPOINT
    access_key: str = settings.MINIO_ACCESS_KEY
    secret_key: str = settings.MINIO_SECRET_KEY
    bucket_name: str = settings.MINIO_BUCKET
    use_ssl: bool = settings.MINIO_USE_SSL
    public_url_base: Optional[str] = settings.MINIO_PUBLIC_URL or None


# 懒加载导入，避免依赖问题（minio 可能未安装）
_minio_client = None
_storage_config = None


def get_storage_config() -> StorageConfig:
    """获取存储配置（单例）"""
    global _storage_config
    if _storage_config is None:
        _storage_config = StorageConfig()
    return _storage_config


def _get_minio_client():
    """获取 MinIO 客户端（懒加载）"""
    global _minio_client
    if _minio_client is None:
        try:
            from minio import Minio
            config = get_storage_config()
            _minio_client = Minio(
                config.endpoint.replace("http://", "").replace("https://", ""),
                access_key=config.access_key,
                secret_key=config.secret_key,
                secure=config.use_ssl,
            )
        except ImportError:
            raise ImportError(
                "MinIO client not installed. Run: pip install minio"
            )
    return _minio_client


def _ensure_bucket():
    """确保 bucket 存在"""
    client = _get_minio_client()
    config = get_storage_config()
    if not client.bucket_exists(config.bucket_name):
        client.make_bucket(config.bucket_name)


class MinIOStorageClient:
    """MinIO/S3 存储客户端"""

    def __init__(self, config: Optional[StorageConfig] = None):
        self.config = config or get_storage_config()
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = _get_minio_client()
            _ensure_bucket()
        return self._client

    def _generate_object_name(self, filename: str, prefix: str = "") -> str:
        """生成对象名（包含路径）"""
        # 使用时间戳 + 随机数避免冲突
        import time
        import uuid
        timestamp = int(time.time())
        unique_id = uuid.uuid4().hex[:8]
        ext = os.path.splitext(filename)[1]
        if prefix:
            return f"{prefix}/{timestamp}_{unique_id}{ext}"
        return f"{timestamp}_{unique_id}{ext}"

    def _calculate_checksum(self, file_path: str) -> str:
        """计算文件 SHA256 校验和"""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    async def upload_file(
        self,
        file_path: str,
        object_name: Optional[str] = None,
        content_type: Optional[str] = None,
        metadata: Optional[dict] = None,
        prefix: str = "uploads",
    ) -> Tuple[str, str, int]:
        """
        上传文件到 MinIO

        Args:
            file_path: 本地文件路径
            object_name: 自定义对象名（可选）
            content_type: MIME 类型
            metadata: 元数据
            prefix: 存储前缀

        Returns:
            (object_name, public_url, file_size)
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = os.path.getsize(file_path)

        if object_name is None:
            object_name = self._generate_object_name(os.path.basename(file_path), prefix)

        if content_type is None:
            import mimetypes
            content_type, _ = mimetypes.guess_type(file_path)
            if content_type is None:
                content_type = "application/octet-stream"

        # 计算校验和
        checksum = self._calculate_checksum(file_path)

        # 添加元数据
        if metadata is None:
            metadata = {}
        metadata["sha256"] = checksum

        # 上传文件
        self.client.fput_object(
            bucket_name=self.config.bucket_name,
            object_name=object_name,
            file_path=file_path,
            content_type=content_type,
            metadata=metadata,
        )

        # 生成公开访问 URL
        if self.config.public_url_base:
            public_url = urljoin(self.config.public_url_base, f"{self.config.bucket_name}/{object_name}")
        else:
            public_url = f"{self.config.endpoint}/{self.config.bucket_name}/{object_name}"

        return object_name, public_url, file_size

    async def delete_file(self, object_name: str) -> bool:
        """
        删除文件

        Args:
            object_name: 对象名

        Returns:
            是否成功
        """
        try:
            self.client.remove_object(
                bucket_name=self.config.bucket_name,
                object_name=object_name,
            )
            return True
        except Exception:
            return False

    async def get_presigned_url(
        self,
        object_name: str,
        expires: int = 3600,
    ) -> str:
        """
        生成预签名 URL（临时访问）

        Args:
            object_name: 对象名
            expires: 过期时间（秒）

        Returns:
            预签名 URL
        """
        return self.client.presigned_get_object(
            bucket_name=self.config.bucket_name,
            object_name=object_name,
            expires=timedelta(seconds=expires),
        )

    async def download_file(
        self,
        object_name: str,
        file_path: str,
    ) -> bool:
        """
        下载文件到本地

        Args:
            object_name: 对象名
            file_path: 本地保存路径

        Returns:
            是否成功
        """
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(file_path), exist_ok=True)

            self.client.fget_object(
                bucket_name=self.config.bucket_name,
                object_name=object_name,
                file_path=file_path,
            )
            return True
        except Exception:
            return False


# 全局存储客户端实例
_storage_client_instance: Optional[MinIOStorageClient] = None


def get_storage_client() -> MinIOStorageClient:
    """获取全局存储客户端实例（单例）"""
    global _storage_client_instance
    if _storage_client_instance is None:
        _storage_client_instance = MinIOStorageClient()
    return _storage_client_instance
