"""Analytics schemas — 041b3"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AnalyticsSnapshotCreate(BaseModel):
    """记录 analytics 快照"""
    project_id: Optional[str] = Field(None, description="项目 ID（可自动推断）")
    episode_id: Optional[str] = Field(None, description="剧集 ID")
    publish_job_id: Optional[str] = Field(None, description="发布任务 ID")
    platform: Optional[str] = Field(None, max_length=32, description="平台（tiktok/douyin）")
    external_post_id: Optional[str] = Field(None, max_length=128, description="平台帖子 ID")
    views: Optional[int] = Field(None, description="播放量")
    completion_rate: Optional[float] = Field(None, ge=0, le=100, description="完播率 %")
    likes: Optional[int] = Field(None, description="点赞数")
    comments: Optional[int] = Field(None, description="评论数")
    shares: Optional[int] = Field(None, description="分享数")
    watch_time: Optional[float] = Field(None, ge=0, description="总观看时长（秒）")
    source: str = Field("manual", max_length=32, description="数据来源：manual/api_import/webhook")
    snapshot_at: Optional[datetime] = Field(None, description="快照时间（默认当前）")


class AnalyticsSnapshotRead(BaseModel):
    """analytics 快照读取"""
    id: str
    project_id: Optional[str] = None
    episode_id: Optional[str] = None
    publish_job_id: Optional[str] = None
    platform: Optional[str] = None
    external_post_id: Optional[str] = None
    views: Optional[int] = None
    completion_rate: Optional[float] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None
    watch_time: Optional[float] = None
    source: Optional[str] = None
    snapshot_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalyticsSnapshotSummary(BaseModel):
    """analytics 快照摘要（列表用）"""
    id: str
    episode_id: Optional[str] = None
    publish_job_id: Optional[str] = None
    platform: Optional[str] = None
    views: Optional[int] = None
    completion_rate: Optional[float] = None
    likes: Optional[int] = None
    snapshot_at: datetime

    model_config = {"from_attributes": True}


class EpisodeAnalyticsSummary(BaseModel):
    """Episode analytics 汇总"""
    episode_id: str
    latest_snapshot: Optional[AnalyticsSnapshotRead] = None
    aggregation: dict = Field(default_factory=dict)


class InsightExtractRequest(BaseModel):
    """从 analytics 快照提取洞察"""
    snapshot_id: str = Field(..., description="来源快照 ID")
    category: str = Field(..., description="洞察分类：success/failure/hook/rule/playbook")
    title: str = Field(..., max_length=256, description="洞察标题")
    content: Optional[str] = Field(None, description="洞察内容")
    tags: Optional[list[str]] = Field(None, description="标签")
    confidence: float = Field(0.8, ge=0, le=1, description="置信度")
