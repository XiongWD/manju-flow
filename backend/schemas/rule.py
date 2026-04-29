"""Platform Rules Pydantic Schemas

041a.1 Phase: Rules Schema Definition

Schema 支持的字段：
- rule_id: 规则唯一标识
- platform: 目标平台 (tiktok/douyin/youtube 等)
- name: 规则名称
- severity: 严重程度 (BLOCK|FLAG)
- subject_type: 检查对象类型 (asset|scene_version|episode|publish_bundle)
- check_type: 检查类型 (duration|resolution|loudness|subtitle_safety|file_exists|c2pa_manifest|content_risk|style_match|cover_quality|semantic_relevance)
- threshold: 阈值配置 (JSON，不同 check_type 有不同结构)
- evidence_requirements: 证据需求配置
- auto_checkable: 是否可自动检查
- manual_review_required: 是否需要人工审核
- failure_message: 失败消息模板
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class RuleCreate(BaseModel):
    """创建规则"""
    rule_id: str = Field(..., max_length=64, description="规则唯一标识")
    platform: str = Field(..., max_length=32, description="目标平台 (tiktok/douyin/youtube 等)")
    name: str = Field(..., max_length=256, description="规则名称")
    severity: str = Field(..., max_length=16, description="严重程度 (BLOCK|FLAG)")
    subject_type: str = Field(..., max_length=32, description="检查对象类型 (asset|scene_version|episode|publish_bundle)")
    check_type: str = Field(..., max_length=64, description="检查类型")
    threshold: dict = Field(..., description="阈值配置 (JSON)")
    evidence_requirements: dict = Field(default_factory=dict, description="证据需求配置")
    auto_checkable: bool = Field(..., description="是否可自动检查")
    manual_review_required: bool = Field(..., description="是否需要人工审核")
    failure_message: str = Field(..., description="失败消息模板")


class RuleUpdate(BaseModel):
    """更新规则"""
    rule_id: Optional[str] = Field(None, max_length=64, description="规则唯一标识")
    platform: Optional[str] = Field(None, max_length=32, description="目标平台")
    name: Optional[str] = Field(None, max_length=256, description="规则名称")
    severity: Optional[str] = Field(None, max_length=16, description="严重程度")
    subject_type: Optional[str] = Field(None, max_length=32, description="检查对象类型")
    check_type: Optional[str] = Field(None, max_length=64, description="检查类型")
    threshold: Optional[dict] = Field(None, description="阈值配置")
    evidence_requirements: Optional[dict] = Field(None, description="证据需求配置")
    auto_checkable: Optional[bool] = Field(None, description="是否可自动检查")
    manual_review_required: Optional[bool] = Field(None, description="是否需要人工审核")
    failure_message: Optional[str] = Field(None, description="失败消息模板")


class RuleRead(BaseModel):
    """读取规则"""
    id: str
    rule_id: str
    platform: str
    name: str
    severity: str
    subject_type: str
    check_type: str
    threshold: dict
    evidence_requirements: dict
    auto_checkable: bool
    manual_review_required: bool
    failure_message: str
    created_at: Any  # datetime
    updated_at: Any  # datetime

    model_config = {"from_attributes": True}


class RuleExecutionResult(BaseModel):
    """规则执行结果"""
    rule_id: str
    platform: str
    subject_type: str
    subject_id: str
    passed: bool
    severity: str
    auto_checkable: bool
    manual_review_required: bool
    evidence: Optional[dict] = None
    failure_reason: Optional[str] = None
    qa_run_id: Optional[str] = None
    qa_issue_ids: list[str] = Field(default_factory=list)


class RulesReportSummary(BaseModel):
    """规则报告摘要"""
    total: int
    passed: int
    failed: int
    block_count: int
    flag_count: int
    manual_review_count: int


class RulesReportResponse(BaseModel):
    """规则报告响应（对齐前端 RulesReportResponse）"""
    results: list[RuleExecutionResult]
    summary: RulesReportSummary
