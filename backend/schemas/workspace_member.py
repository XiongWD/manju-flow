"""Workspace & WorkspaceMember Pydantic schemas"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Workspace ────────────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256, description="Workspace 名称")
    max_employers: int = Field(5, ge=1, le=20, description="employer 上限数量")


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=256)
    max_employers: Optional[int] = Field(None, ge=1, le=20)
    is_active: Optional[bool] = None


class WorkspaceRead(BaseModel):
    id: str
    name: str
    owner_id: str
    max_employers: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # 附加字段（聚合查询时填充）
    employer_count: Optional[int] = None

    model_config = {"from_attributes": True}


# ── WorkspaceMember ───────────────────────────────────────────────────────────

class MemberInvite(BaseModel):
    """邀请 employer 加入 workspace"""
    email: str = Field(..., description="被邀请人邮箱（必须已注册且 role=employer）")
    page_permissions: Optional[List[str]] = Field(
        None,
        description="允许访问的页面路径列表，如 [\"/workspace/story\"]；为 null 代表无权限",
        examples=[["/workspace/story", "/workspace/characters"]],
    )


class MemberPermissionUpdate(BaseModel):
    """修改 employer 的页面权限"""
    page_permissions: Optional[List[str]] = Field(
        None,
        description="新的页面权限列表；传 null 清空所有权限",
    )


class MemberRead(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    role: str
    page_permissions: Optional[List[str]] = None
    invited_by: Optional[str] = None
    created_at: datetime
    # 附加字段（join 查询时填充）
    email: Optional[str] = None
    display_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── System（superadmin 视角）────────────────────────────────────────────────

class ManagerCreate(BaseModel):
    """superadmin 创建 manager 账号"""
    email: str
    password: str = Field(..., min_length=8)
    display_name: Optional[str] = None
    workspace_name: Optional[str] = Field(None, description="同时创建 workspace；为 null 则不创建")


class ManagerRead(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None
    employer_count: Optional[int] = None

    model_config = {"from_attributes": True}
