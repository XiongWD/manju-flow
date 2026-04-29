"""Delivery Package & Platform Variant — 041b1 Pydantic schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── DeliveryPackage ─────────────────────────────────────────────────────

class DeliveryPackageCreate(BaseModel):
    """创建交付包"""
    episode_id: str = Field(..., description="所属剧集 ID")
    publish_job_id: Optional[str] = Field(None, description="关联发布任务 ID")


class DeliveryPackageUpdate(BaseModel):
    """更新交付包"""
    status: Optional[str] = Field(None, max_length=32, description="状态")
    total_size: Optional[int] = Field(None, description="总文件大小（bytes）")
    asset_count: Optional[int] = Field(None, description="资产数量")
    checksum: Optional[str] = Field(None, max_length=64, description="包级 SHA256")
    manifest_json: Optional[dict] = Field(None, description="包清单")


class DeliveryPackageRead(BaseModel):
    """交付包读取"""
    id: str
    project_id: Optional[str] = None
    episode_id: Optional[str] = None
    publish_job_id: Optional[str] = None
    package_no: int
    status: str
    total_size: Optional[int] = None
    asset_count: int = 0
    checksum: Optional[str] = None
    manifest_json: Optional[dict] = None
    built_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeliveryPackageSummary(BaseModel):
    """交付包摘要（列表用）"""
    id: str
    episode_id: Optional[str] = None
    package_no: int
    status: str
    asset_count: int = 0
    total_size: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── PlatformVariant (enhanced PublishVariant) ──────────────────────────

class PlatformVariantCreate(BaseModel):
    """创建平台变体"""
    publish_job_id: str = Field(..., description="所属发布任务 ID")
    platform: str = Field(..., max_length=32, description="目标平台（tiktok/douyin/youtube_shorts 等）")
    title: Optional[str] = Field(None, max_length=256, description="标题")
    caption: Optional[str] = Field(None, description="文案")
    hashtags: Optional[list[str]] = Field(None, description="标签列表")
    cover_asset_id: Optional[str] = Field(None, max_length=32, description="封面资产 ID")
    delivery_package_id: Optional[str] = Field(None, max_length=32, description="关联交付包 ID")
    resolution: Optional[str] = Field(None, max_length=32, description="分辨率")
    aspect_ratio: Optional[str] = Field(None, max_length=16, description="画面比例")
    bitrate: Optional[str] = Field(None, max_length=32, description="码率")


class PlatformVariantUpdate(BaseModel):
    """更新平台变体"""
    platform: Optional[str] = Field(None, max_length=32)
    title: Optional[str] = Field(None, max_length=256)
    caption: Optional[str] = Field(None)
    hashtags: Optional[list[str]] = Field(None)
    cover_asset_id: Optional[str] = Field(None, max_length=32)
    delivery_package_id: Optional[str] = Field(None, max_length=32)
    is_selected: Optional[bool] = Field(None, description="是否选中发布")
    resolution: Optional[str] = Field(None, max_length=32)
    aspect_ratio: Optional[str] = Field(None, max_length=16)
    bitrate: Optional[str] = Field(None, max_length=32)
    metadata_json: Optional[dict] = Field(None)


class PlatformVariantRead(BaseModel):
    """平台变体读取"""
    id: str
    publish_job_id: str
    platform: Optional[str] = None
    title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[list] = None
    cover_asset_id: Optional[str] = None
    is_selected: bool = False
    delivery_package_id: Optional[str] = None
    resolution: Optional[str] = None
    aspect_ratio: Optional[str] = None
    bitrate: Optional[str] = None
    file_size: Optional[int] = None
    duration: Optional[float] = None
    metadata_json: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Composite ───────────────────────────────────────────────────────────

# ── Export Recheck ──────────────────────────────────────────────────────

class ExportRecheckRequest(BaseModel):
    """导出后重验请求"""
    platform: Optional[str] = Field(None, max_length=32, description="目标平台（不传则从变体推断）")


class ExportRecheckRead(BaseModel):
    """导出后重验结果"""
    delivery_package_id: str
    qa_run_ids: list[str] = []
    overall_status: str = Field(..., description="passed/failed/needs_review/no_assets")
    total_assets_checked: int = 0
    summary: dict = Field(default_factory=dict, description="{passed: int, failed: int, needs_review: int}")
    publish_job_id: Optional[str] = None

    model_config = {"from_attributes": False}


class DeliveryPackageWithVariantsRead(DeliveryPackageRead):
    """带平台变体列表的交付包"""
    variants: list[PlatformVariantRead] = []
