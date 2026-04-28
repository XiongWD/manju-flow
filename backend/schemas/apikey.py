"""ApiKey Pydantic schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ApiKeyCreate(BaseModel):
    name: str = Field(..., max_length=128, description="密钥名称/用途")
    provider: Optional[str] = Field(None, max_length=64, description="kling/seedance/elevenlabs/fish 等")


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    provider: Optional[str] = Field(None, max_length=64)
    is_active: Optional[bool] = None


class ApiKeyRead(BaseModel):
    id: str
    name: str
    key_prefix: str
    provider: Optional[str] = None
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreated(BaseModel):
    """创建成功后返回完整密钥（仅此一次）"""
    id: str
    name: str
    key: str = Field(..., description="完整密钥（仅创建时返回）")
    key_prefix: str
    provider: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
