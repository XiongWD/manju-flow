"""Storage service — MinIO/S3 兼容文件存储"""

from .minio_client import MinIOStorageClient, get_storage_client
from .service import StorageService, get_storage_service

__all__ = [
    "MinIOStorageClient",
    "get_storage_client",
    "StorageService",
    "get_storage_service",
]
