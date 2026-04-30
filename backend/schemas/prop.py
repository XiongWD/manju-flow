"""Prop Pydantic schemas — 道具与道具状态管理"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ─── Prop ───────────────────────────────────────────────────────────────────

class PropCreate(BaseModel):
    name: str = Field(..., max_length=256, description="道具名称（如：古玉、照片、钥匙）")
    description: Optional[str] = Field(None, description="道具描述")
    category: Optional[str] = Field(None, max_length=64, description="道具类别：weapon/document/electronic/clothing/other")
    reference_asset_id: Optional[str] = Field(None, max_length=32, description="参考图资产 ID")


class PropUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=256, description="道具名称")
    description: Optional[str] = Field(None, description="道具描述")
    category: Optional[str] = Field(None, max_length=64, description="道具类别")
    reference_asset_id: Optional[str] = Field(None, max_length=32, description="参考图资产 ID")


class PropRead(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    reference_asset_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── PropState ──────────────────────────────────────────────────────────────

class PropStateCreate(BaseModel):
    prop_id: str = Field(..., description="道具 ID")
    scene_id: Optional[str] = Field(None, description="关联镜头 ID")
    state_description: Optional[str] = Field(None, description="状态描述（如：完好、碎裂、发光）")
    visual_notes: Optional[str] = Field(None, description="视觉提示（如：泛着绿光、有裂纹）")
    changed_from_state_id: Optional[str] = Field(None, description="从哪个状态变更而来")


class PropStateUpdate(BaseModel):
    state_description: Optional[str] = Field(None, description="状态描述")
    visual_notes: Optional[str] = Field(None, description="视觉提示")


class PropStateRead(BaseModel):
    id: str
    prop_id: str
    scene_id: Optional[str] = None
    state_description: Optional[str] = None
    visual_notes: Optional[str] = None
    changed_from_state_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
