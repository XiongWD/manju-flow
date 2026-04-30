"""Timeline 导出相关 Schema"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class TimelineFormat(str, Enum):
    json = "json"
    csv = "csv"


class TimelineExportOptions(BaseModel):
    format: TimelineFormat = Field(default=TimelineFormat.json, description="导出格式")
    include_prompts: bool = Field(default=False, description="是否包含 prompt_bundle")
    include_assets: bool = Field(default=False, description="是否包含资产列表")


class TimelineLocationItem(BaseModel):
    name: str
    description: str


class TimelineCharacterItem(BaseModel):
    name: str
    role: str


class TimelineAssetItem(BaseModel):
    id: str
    type: str
    uri: Optional[str] = None
    mime_type: Optional[str] = None


class TimelineSceneItem(BaseModel):
    scene_no: int
    title: str
    duration: Optional[float] = None
    shot_stage: str
    location: Optional[TimelineLocationItem] = None
    characters: List[TimelineCharacterItem] = []
    locked_still_id: Optional[str] = None
    prompt_bundle: Optional[dict] = None
    assets: List[TimelineAssetItem] = []


class TimelineExportResponse(BaseModel):
    episode_id: str
    episode_title: str
    exported_at: str
    total_duration: float
    scene_count: int
    scenes: List[TimelineSceneItem] = []
