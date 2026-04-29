"""StoryBible Pydantic schemas"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StoryBibleCreate(BaseModel):
    project_id: str
    title: Optional[str] = Field(None, max_length=256)
    summary: Optional[str] = None
    theme: Optional[str] = Field(None, max_length=256)
    conflict: Optional[str] = None
    content: Optional[str] = None
    beat_sheet: Optional[dict] = None


class StoryBibleUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=256)
    summary: Optional[str] = None
    theme: Optional[str] = Field(None, max_length=256)
    conflict: Optional[str] = None
    content: Optional[str] = None
    beat_sheet: Optional[dict] = None
    version: Optional[int] = None


class StoryBibleRead(BaseModel):
    id: str
    project_id: str
    title: Optional[str] = None
    summary: Optional[str] = None
    theme: Optional[str] = None
    conflict: Optional[str] = None
    content: Optional[str] = None
    beat_sheet: Optional[dict] = None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
