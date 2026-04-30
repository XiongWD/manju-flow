"""Location Pydantic schemas — 地点管理"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    name: str = Field(..., max_length=256, description="地点名称（如：灵异古铺、现代办公室）")
    description: Optional[str] = Field(None, description="地点描述")
    visual_style: Optional[str] = Field(None, max_length=256, description="视觉风格描述")
    reference_asset_id: Optional[str] = Field(None, max_length=32, description="参考图资产 ID")


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=256, description="地点名称")
    description: Optional[str] = Field(None, description="地点描述")
    visual_style: Optional[str] = Field(None, max_length=256, description="视觉风格描述")
    reference_asset_id: Optional[str] = Field(None, max_length=32, description="参考图资产 ID")


class LocationRead(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    visual_style: Optional[str] = None
    reference_asset_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
