"""Auth Pydantic schemas"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


def _validate_email(v: str) -> str:
    """Basic email validation without email-validator dependency."""
    if "@" not in v or "." not in v.split("@")[-1]:
        raise ValueError("Invalid email address")
    return v


class _EmailStr(str):
    """Lightweight EmailStr that doesn't require email-validator package."""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not isinstance(v, str):
            raise TypeError("string required")
        return _validate_email(v)

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.with_info_plain_validator_function(
            lambda v, _: _validate_email(v) if isinstance(v, str) else v
        )


class UserCreate(BaseModel):
    email: str = Field(..., description="Login email")
    password: str = Field(..., min_length=6)
    display_name: Optional[str] = None


class UserRead(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None
    # 多租户字段（superadmin 为 None）
    workspace_id: Optional[str] = None
    page_permissions: Optional[List[str]] = None

    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    # 登录后前端直接可用，无需再解码 JWT
    workspace_id: Optional[str] = None
    page_permissions: Optional[List[str]] = None
    role: Optional[str] = None
