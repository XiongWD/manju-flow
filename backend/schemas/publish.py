"""PublishJob Pydantic schemas — 041b2"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PublishJobCreate(BaseModel):
    """创建发布任务"""
    episode_id: str = Field(..., description="所属剧集 ID")
    platform: Optional[str] = Field(None, max_length=32, description="目标平台（tiktok/douyin 等）")
    scheduled_at: Optional[datetime] = Field(None, description="计划发布时间")
    payload_json: Optional[dict] = Field(None, description="发布参数")


class PublishJobUpdate(BaseModel):
    """更新发布任务"""
    platform: Optional[str] = Field(None, max_length=32)
    status: Optional[str] = Field(None, max_length=32)
    scheduled_at: Optional[datetime] = None
    payload_json: Optional[dict] = None


class PublishJobRead(BaseModel):
    """发布任务读取"""
    id: str
    project_id: Optional[str] = None
    episode_id: Optional[str] = None
    platform: Optional[str] = None
    status: str
    scheduled_at: Optional[datetime] = None
    payload_json: Optional[dict] = None
    external_post_id: Optional[str] = None
    created_at: datetime
    published_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PublishJobSummary(BaseModel):
    """发布任务摘要（列表用）"""
    id: str
    episode_id: Optional[str] = None
    platform: Optional[str] = None
    status: str
    scheduled_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
