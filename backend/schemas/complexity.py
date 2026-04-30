"""镜头复杂度评分相关 Schema"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ComplexityBreakdown(BaseModel):
    """评分明细结构化表示"""

    duration_score: float = Field(description="时长复杂度分")
    duration_detail: str = Field(description="时长评分说明")
    character_score: float = Field(description="角色复杂度分")
    character_count: int = Field(description="角色数量")
    character_detail: str = Field(description="角色评分说明")
    location_score: float = Field(description="地点复杂度分")
    location_detail: str = Field(description="地点评分说明")
    action_score: float = Field(description="动作复杂度分")
    action_keywords_found: List[str] = Field(description="检测到的动作关键词")
    action_detail: str = Field(description="动作评分说明")
    style_score: float = Field(description="风格复杂度分")
    style_keywords_found: List[str] = Field(description="检测到的风格关键词")
    style_detail: str = Field(description="风格评分说明")


class ComplexityProfileResponse(BaseModel):
    """复杂度评分完整响应"""

    id: str
    scene_id: str
    overall_score: float
    character_count: int
    has_location: bool
    duration_score: float
    character_score: float
    action_score: float
    style_score: float
    breakdown: Optional[dict] = None
    calculated_at: datetime

    model_config = {"from_attributes": True}


class ComplexitySceneItem(BaseModel):
    """剧集复杂度汇总中的单镜头项"""

    scene_id: str
    scene_no: Optional[int] = None
    title: Optional[str] = None
    overall_score: float
    character_count: int
    has_location: bool


class ComplexityEpisodeSummary(BaseModel):
    """剧集下所有镜头复杂度汇总"""

    episode_id: str
    scene_count: int
    avg_score: float
    max_score: float
    min_score: float
    scenes: List[ComplexitySceneItem]
