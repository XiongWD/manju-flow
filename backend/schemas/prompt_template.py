"""PromptTemplate Pydantic schemas — Prompt 模板管理"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PromptTemplateCreate(BaseModel):
    name: str = Field(..., max_length=256, description="模板名称")
    category: str = Field("general", max_length=64, description="模板类别：character/location/prop/action/style/general")
    template_text: Optional[str] = Field(None, description="模板文本，可用 {character_desc} {location_desc} 等占位符")
    is_default: bool = Field(False, description="是否为默认模板")


class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=256, description="模板名称")
    category: Optional[str] = Field(None, max_length=64, description="模板类别")
    template_text: Optional[str] = Field(None, description="模板文本")
    is_default: Optional[bool] = Field(None, description="是否为默认模板")


class PromptTemplateRead(BaseModel):
    id: str
    project_id: str
    name: str
    category: str
    template_text: Optional[str] = None
    version: int
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PromptBuildRequest(BaseModel):
    project_id: str = Field(..., description="项目 ID")
    scene_id: str = Field(..., description="镜头 ID")
    template_id: Optional[str] = Field(None, description="模板 ID")
    character_ids: Optional[list[str]] = Field(None, description="角色 ID 列表")
    location_id: Optional[str] = Field(None, description="地点 ID")
    prop_state_ids: Optional[list[str]] = Field(None, description="道具状态 ID 列表")
    action_description: Optional[str] = Field(None, description="动作描述")
    style_override: Optional[str] = Field(None, description="风格覆盖")
