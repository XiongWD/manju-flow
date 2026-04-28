"""Workspace Pydantic schemas — 首屏聚合数据"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectSummary(BaseModel):
    """项目摘要"""
    id: str
    name: str
    genre: Optional[str] = None
    status: str
    episode_count: int = 0
    created_at: datetime


class EpisodeSummary(BaseModel):
    """剧集摘要"""
    id: str
    project_id: str
    episode_no: int
    title: Optional[str] = None
    status: str
    scene_count: int = 0


class SceneSummary(BaseModel):
    """场景摘要"""
    id: str
    episode_id: str
    scene_no: int
    title: Optional[str] = None
    status: str


class WorkspaceOverview(BaseModel):
    """工作区概览 — 首屏聚合数据"""
    projects: list[ProjectSummary] = []
    recent_episodes: list[EpisodeSummary] = []
    recent_scenes: list[SceneSummary] = []
    stats: dict = {}  # 统计信息，如总项目数、总集数、总场景数等


class ProjectWorkspace(BaseModel):
    """项目工作区 — 单项目聚合数据"""
    project: ProjectSummary
    episodes: list[EpisodeSummary] = []
    scenes: list[SceneSummary] = []
    asset_count: int = 0
