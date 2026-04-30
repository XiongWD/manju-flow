"""成本追踪相关 Schema"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ── 请求 / 响应 ──────────────────────────────────────────────────────────

class CostRecordCreate(BaseModel):
    """记录成本请求"""

    project_id: str = Field(..., description="项目 ID")
    cost_type: str = Field(..., description="成本类型：image_generate/video_generate/audio_generate/storage/api_call")
    provider: Optional[str] = Field(None, description="Provider 名称：kling/seedance/mock 等")
    model: Optional[str] = Field(None, description="使用的模型")
    scene_id: Optional[str] = Field(None, description="关联镜头 ID")
    scene_version_id: Optional[str] = Field(None, description="关联版本 ID")
    job_id: Optional[str] = Field(None, description="关联 Job ID")
    input_tokens: Optional[int] = Field(None, description="输入 token 数")
    output_tokens: Optional[int] = Field(None, description="输出 token 数")
    duration_seconds: Optional[float] = Field(None, description="生成内容时长（秒）")
    api_calls: int = Field(1, description="API 调用次数")
    retry_count: int = Field(0, description="重试次数")
    cost_usd: float = Field(0.0, description="实际费用（美元）")
    estimated_cost_usd: Optional[float] = Field(None, description="估算费用（美元）")
    metadata_json: Optional[str] = Field(None, description="额外信息 JSON")


class CostRecordResponse(BaseModel):
    """成本记录完整响应"""

    id: str
    project_id: str
    scene_id: Optional[str] = None
    scene_version_id: Optional[str] = None
    job_id: Optional[str] = None
    cost_type: str
    provider: Optional[str] = None
    model: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    duration_seconds: Optional[float] = None
    api_calls: int
    retry_count: int
    cost_usd: float
    estimated_cost_usd: Optional[float] = None
    metadata_json: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── 汇总结构 ─────────────────────────────────────────────────────────────

class CostTypeSummary(BaseModel):
    """按类型 / Provider 汇总结构"""

    total_cost_usd: float = 0.0
    total_estimated_cost_usd: float = 0.0
    count: int = 0
    total_api_calls: int = 0
    total_duration_seconds: float = 0.0


class DailyCostItem(BaseModel):
    """按天汇总条目"""

    date: str
    cost_usd: float
    estimated_cost_usd: float
    api_calls: int


class ProjectCostSummary(BaseModel):
    """项目成本汇总"""

    total_cost_usd: float
    total_estimated_cost_usd: float
    total_api_calls: int
    by_type: Dict[str, CostTypeSummary] = {}
    by_provider: Dict[str, CostTypeSummary] = {}
    by_day: List[DailyCostItem] = []
    record_count: int


class EpisodeCostSummary(BaseModel):
    """剧集成本汇总"""

    episode_id: str
    total_cost_usd: float
    total_estimated_cost_usd: float
    total_api_calls: int
    scene_count: int
    by_type: Dict[str, CostTypeSummary] = {}
    record_count: int
