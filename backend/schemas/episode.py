"""Episode Pydantic schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EpisodeCreate(BaseModel):
    project_id: str = Field(..., description="项目 ID")
    episode_no: int = Field(..., description="集号")
    title: Optional[str] = Field(None, max_length=256, description="剧集标题")
    outline: Optional[str] = Field(None, description="剧本大纲")
    script: Optional[str] = Field(None, description="完整剧本")
    duration: Optional[float] = Field(None, description="时长（秒）")
    status: str = Field(default="DRAFTING", max_length=32, description="状态")


class EpisodeUpdate(BaseModel):
    episode_no: Optional[int] = Field(None, description="集号")
    title: Optional[str] = Field(None, max_length=256, description="剧集标题")
    outline: Optional[str] = Field(None, description="剧本大纲")
    script: Optional[str] = Field(None, description="完整剧本")
    duration: Optional[float] = Field(None, description="时长（秒）")
    status: Optional[str] = Field(None, max_length=32, description="状态")
    current_cut_asset_id: Optional[str] = Field(None, max_length=32, description="当前剪辑版资产 ID")


class EpisodeRead(BaseModel):
    id: str
    project_id: str
    episode_no: int
    title: Optional[str] = None
    outline: Optional[str] = None
    script: Optional[str] = None
    duration: Optional[float] = None
    status: str
    current_cut_asset_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EpisodeWithScenesRead(EpisodeRead):
    """带场景列表的剧集详情"""
    scene_count: int = 0
    scenes: list = []  # 运行时填充 SceneWithVersionSummary 字典
    effective_tier: Optional[str] = Field(None, description="有效 Tier 等级")
    tier_source: Optional[str] = Field(None, description="Tier 来源（project_default / episode_override / default_fallback）")


class LockSceneVersionRequest(BaseModel):
    """锁定场景版本请求"""
    scene_id: str = Field(..., description="场景 ID")
    scene_version_id: str = Field(..., description="场景版本 ID")
    force: bool = Field(default=False, description="是否强制覆盖（仅管理员）")


class LockSceneVersionResponse(BaseModel):
    """锁定场景版本响应"""
    scene_id: str
    locked_version_id: str
    status: str = "LOCKED"
