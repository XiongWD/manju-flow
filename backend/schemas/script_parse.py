"""剧本解析相关 Schema"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Request ──

class ScriptParseRequest(BaseModel):
    script_text: Optional[str] = Field(None, description="剧本文本（不传则用 episode.script）")


# ── ShotImportReport ──

class ShotImportReportRead(BaseModel):
    id: str
    parse_report_id: str
    scene_id: Optional[str] = None
    shot_no: Optional[int] = None
    title: Optional[str] = None
    location_name: Optional[str] = None
    character_names: Optional[list] = None
    dialogue: Optional[str] = None
    action: Optional[str] = None
    estimated_duration: Optional[float] = None
    prop_hints: Optional[list] = None
    import_status: str
    error_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── ScriptIssue ──

class ScriptIssueRead(BaseModel):
    id: str
    parse_report_id: str
    issue_type: str
    severity: str
    line_number: Optional[int] = None
    original_text: Optional[str] = None
    message: Optional[str] = None
    suggested_fix: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── ScriptParseReport ──

class ScriptParseReportRead(BaseModel):
    id: str
    episode_id: str
    total_shots: int
    parsed_shots: int
    failed_shots: int
    parse_method: str
    raw_issues: Optional[dict] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Combined response ──

class ScriptParseResponse(BaseModel):
    parse_report: ScriptParseReportRead
    shot_reports: list[ShotImportReportRead]
    issues: list[ScriptIssueRead]
