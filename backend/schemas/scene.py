"""Scene Pydantic schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SceneCreate(BaseModel):
    episode_id: str = Field(..., description="所属剧集 ID")
    scene_no: int = Field(..., description="镜头序号")
    title: Optional[str] = Field(None, max_length=256, description="场景标题")
    duration: Optional[float] = Field(None, description="时长（秒）")
    status: str = Field(default="DRAFT", max_length=32, description="状态")


class SceneUpdate(BaseModel):
    scene_no: Optional[int] = Field(None, description="镜头序号")
    title: Optional[str] = Field(None, max_length=256, description="场景标题")
    duration: Optional[float] = Field(None, description="时长（秒）")
    status: Optional[str] = Field(None, max_length=32, description="状态")
    locked_version_id: Optional[str] = Field(None, max_length=32, description="锁定版本 ID")


class SceneRead(BaseModel):
    id: str
    episode_id: str
    scene_no: int
    title: Optional[str] = None
    duration: Optional[float] = None
    status: str
    locked_version_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SceneVersionRead(BaseModel):
    """场景版本读取模型"""
    id: str
    scene_id: str
    parent_version_id: Optional[str] = None
    version_no: int
    status: str
    prompt_bundle: Optional[dict] = None
    model_bundle: Optional[dict] = None
    params: Optional[dict] = None
    change_reason: Optional[str] = None
    score_snapshot: Optional[dict] = None
    cost_actual: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SceneVersionSummary(BaseModel):
    """场景版本摘要（用于列表/嵌套展示）"""
    id: str
    version_no: int
    status: str
    score_snapshot: Optional[dict] = None
    cost_actual: Optional[float] = None

    model_config = {"from_attributes": True}


class SceneWithVersionSummary(SceneRead):
    """带最新版本摘要的场景"""
    latest_version: Optional[SceneVersionSummary] = None


class SceneWithVersionsRead(SceneRead):
    """带版本列表的场景详情"""
    latest_version: Optional[SceneVersionRead] = None
