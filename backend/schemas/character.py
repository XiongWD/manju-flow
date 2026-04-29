"""Character Pydantic schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CharacterCreate(BaseModel):
    project_id: str
    name: str = Field(..., max_length=128)
    role_type: Optional[str] = Field(None, max_length=32)
    description: Optional[str] = None
    voice_profile: Optional[dict] = None
    canonical_asset_id: Optional[str] = Field(None, max_length=32)
    episode_ids: Optional[list[str]] = Field(None, description="关联剧集 ID 列表")


class CharacterUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    role_type: Optional[str] = Field(None, max_length=32)
    description: Optional[str] = None
    voice_profile: Optional[dict] = None
    canonical_asset_id: Optional[str] = Field(None, max_length=32)
    episode_ids: Optional[list[str]] = Field(None, description="关联剧集 ID 列表")


class CharacterRead(BaseModel):
    id: str
    project_id: str
    name: str
    role_type: Optional[str] = None
    description: Optional[str] = None
    voice_profile: Optional[dict] = None
    canonical_asset_id: Optional[str] = None
    episode_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
