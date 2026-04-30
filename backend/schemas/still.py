"""静帧候选 Schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StillCandidateCreate(BaseModel):
    """提交静帧候选"""
    image_path: str = Field(..., max_length=512, description="静帧图片存储路径")
    thumbnail_path: Optional[str] = Field(None, max_length=512, description="缩略图路径")
    prompt_used: Optional[str] = Field(None, description="生成时使用的 prompt")
    seed: Optional[int] = Field(None, description="生成 seed")


class StillCandidateUpdate(BaseModel):
    """更新候选（审核）"""
    status: Optional[str] = Field(None, pattern="^(approved|rejected)$", description="审核状态：approved/rejected")
    review_note: Optional[str] = Field(None, description="审核备注")


class StillCandidateResponse(BaseModel):
    """候选详情响应"""
    id: str
    scene_id: str
    version: int
    image_path: str
    thumbnail_path: Optional[str] = None
    prompt_used: Optional[str] = None
    seed: Optional[int] = None
    status: str
    review_note: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StillLockRequest(BaseModel):
    """锁定静帧请求"""
    candidate_id: str = Field(..., description="要锁定的候选 ID")
