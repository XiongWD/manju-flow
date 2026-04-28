"""Project Pydantic schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=256)
    genre: Optional[str] = Field(None, max_length=64)
    market: Optional[str] = Field(None, max_length=32)
    platform: Optional[str] = Field(None, max_length=32)
    tier: Optional[str] = Field(None, max_length=16)
    budget_limit: Optional[float] = None
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=256)
    genre: Optional[str] = Field(None, max_length=64)
    market: Optional[str] = Field(None, max_length=32)
    platform: Optional[str] = Field(None, max_length=32)
    tier: Optional[str] = Field(None, max_length=16)
    budget_limit: Optional[float] = None
    status: Optional[str] = Field(None, max_length=32)
    description: Optional[str] = None


class ProjectRead(BaseModel):
    id: str
    name: str
    genre: Optional[str] = None
    market: Optional[str] = None
    platform: Optional[str] = None
    tier: Optional[str] = None
    budget_limit: Optional[float] = None
    status: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
