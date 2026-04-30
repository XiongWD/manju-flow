"""状态传播相关 schemas"""

from typing import Optional

from pydantic import BaseModel


class ProgressInfo(BaseModel):
    """进度信息"""
    total_scenes: int
    completed_scenes: int
    in_progress_scenes: int
    pending_scenes: int
    progress_percent: float
    earliest_stage: Optional[str] = None


class StatusChange(BaseModel):
    """状态变更记录"""
    old: Optional[str] = None
    new: str


class StatusPropagationResponse(BaseModel):
    """状态传播结果"""
    episode_id: str
    episode_status: StatusChange
    episode_progress: ProgressInfo
    project_id: str
    project_status: StatusChange
    project_progress: ProgressInfo
