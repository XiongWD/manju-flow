"""Knowledge schemas — 041b3"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class KnowledgeItemCreate(BaseModel):
    """创建知识条目"""
    project_id: Optional[str] = Field(None, description="项目 ID")
    episode_id: Optional[str] = Field(None, description="关联剧集 ID")
    publish_job_id: Optional[str] = Field(None, description="关联发布任务 ID")
    analytics_snapshot_id: Optional[str] = Field(None, description="来源分析快照 ID")
    category: str = Field("rule", description="分类：success/failure/hook/rule/playbook")
    title: str = Field(..., max_length=256, description="标题")
    content: Optional[str] = Field(None, description="内容")
    tags: Optional[list[str]] = Field(None, description="标签列表")
    metadata_json: Optional[dict] = Field(None, description="附加元数据")
    confidence: float = Field(1.0, ge=0, le=1, description="置信度 0~1")
    is_active: bool = Field(True, description="是否生效")


class KnowledgeItemUpdate(BaseModel):
    """更新知识条目"""
    title: Optional[str] = Field(None, max_length=256)
    content: Optional[str] = None
    tags: Optional[list[str]] = None
    category: Optional[str] = Field(None, description="分类")
    confidence: Optional[float] = Field(None, ge=0, le=1)
    is_active: Optional[bool] = None


class KnowledgeItemRead(BaseModel):
    """知识条目读取"""
    id: str
    project_id: Optional[str] = None
    episode_id: Optional[str] = None
    publish_job_id: Optional[str] = None
    analytics_snapshot_id: Optional[str] = None
    category: str
    title: str
    content: Optional[str] = None
    tags: Optional[list] = None
    metadata_json: Optional[dict] = None
    confidence: Optional[float] = 1.0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeItemSummary(BaseModel):
    """知识条目摘要（列表用）"""
    id: str
    project_id: Optional[str] = None
    episode_id: Optional[str] = None
    category: str
    title: str
    confidence: Optional[float] = 1.0
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}
