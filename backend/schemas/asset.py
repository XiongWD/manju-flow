"""Asset Pydantic schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AssetCreate(BaseModel):
    project_id: Optional[str] = Field(None, max_length=32, description="项目 ID（可选）")
    type: str = Field(..., max_length=64, description="资产类型")
    uri: Optional[str] = Field(None, max_length=512, description="文件路径或 URL")
    mime_type: Optional[str] = Field(None, max_length=64, description="MIME 类型")
    file_size: Optional[int] = Field(None, description="文件大小（bytes）")
    duration: Optional[float] = Field(None, description="时长（秒，音视频用）")
    width: Optional[int] = Field(None, description="宽度（像素）")
    height: Optional[int] = Field(None, description="高度（像素）")
    metadata_json: Optional[dict] = Field(None, description="元数据（JSON）")
    checksum: Optional[str] = Field(None, max_length=64, description="SHA256 校验和")


class AssetUpdate(BaseModel):
    type: Optional[str] = Field(None, max_length=64, description="资产类型")
    uri: Optional[str] = Field(None, max_length=512, description="文件路径或 URL")
    mime_type: Optional[str] = Field(None, max_length=64, description="MIME 类型")
    file_size: Optional[int] = Field(None, description="文件大小（bytes）")
    duration: Optional[float] = Field(None, description="时长（秒，音视频用）")
    width: Optional[int] = Field(None, description="宽度（像素）")
    height: Optional[int] = Field(None, description="高度（像素）")
    metadata_json: Optional[dict] = Field(None, description="元数据（JSON）")
    checksum: Optional[str] = Field(None, max_length=64, description="SHA256 校验和")


class AssetRead(BaseModel):
    id: str
    project_id: Optional[str] = None
    type: str
    uri: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    metadata_json: Optional[dict] = None
    checksum: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetLinkCreate(BaseModel):
    asset_id: str = Field(..., max_length=32, description="资产 ID")
    owner_type: str = Field(..., max_length=32, description="归属类型（scene/scene_version/qa_run/episode/publish_job）")
    owner_id: str = Field(..., max_length=32, description="归属对象 ID")
    relation_type: Optional[str] = Field(None, max_length=32, description="关联类型（qa_input/qa_evidence/qa_report/cover/final 等）")


class AssetLinkRead(BaseModel):
    id: str
    asset_id: str
    owner_type: str
    owner_id: str
    relation_type: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetWithLinksRead(AssetRead):
    """带关联列表的资产详情"""
    links: list[AssetLinkRead] = []


class UploadResponse(BaseModel):
    """上传响应"""
    asset_id: str
    uri: str
    file_size: int
    mime_type: str
    message: str
