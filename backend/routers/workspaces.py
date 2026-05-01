"""Workspaces 路由 — 多租户管理 API

端点清单：
  Manager 端（/api/workspaces）：
    GET    /api/workspaces/me                     获取我的 workspace 信息
    PATCH  /api/workspaces/me                     更新 workspace 基本信息
    GET    /api/workspaces/me/members             成员列表
    POST   /api/workspaces/me/members             邀请 employer
    PATCH  /api/workspaces/me/members/{user_id}/permissions  修改成员权限
    DELETE /api/workspaces/me/members/{user_id}  移除成员

  Superadmin 端（/api/system）：
    GET    /api/system/managers                   所有 manager 列表
    POST   /api/system/managers                   创建 manager 账号（+ 可选 workspace）
    PATCH  /api/system/managers/{user_id}/status  启用/禁用 manager
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.models import User, Workspace, WorkspaceMember
from schemas.workspace_member import (
    ManagerCreate,
    ManagerRead,
    MemberInvite,
    MemberPermissionUpdate,
    MemberRead,
    WorkspaceRead,
    WorkspaceUpdate,
)
from services.auth import (
    AuthenticatedUser,
    get_current_user,
    hash_password,
    require_manager,
    require_superadmin,
    require_workspace_member,
)

logger = logging.getLogger(__name__)

# ── 两个独立 router ──
router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])
system_router = APIRouter(prefix="/api/system", tags=["system"])


# ═══════════════════════════════════════════════════════════════════════════
# Manager 端 — 管理自己的 workspace
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/me", response_model=WorkspaceRead)
async def get_my_workspace(
    current_user: AuthenticatedUser = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    """获取当前 manager 的 workspace 信息，附带 employer 数量。"""
    ws = await db.get(Workspace, current_user.workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    employer_count_result = await db.execute(
        select(func.count()).select_from(WorkspaceMember).where(
            WorkspaceMember.workspace_id == ws.id,
            WorkspaceMember.role == "employer",
        )
    )
    employer_count = employer_count_result.scalar() or 0

    return WorkspaceRead(
        id=ws.id,
        name=ws.name,
        owner_id=ws.owner_id,
        max_employers=ws.max_employers,
        is_active=ws.is_active,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
        employer_count=employer_count,
    )


@router.patch("/me", response_model=WorkspaceRead)
async def update_my_workspace(
    body: WorkspaceUpdate,
    current_user: AuthenticatedUser = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    """更新 workspace 名称 / employer 上限 / 启用状态。"""
    ws = await db.get(Workspace, current_user.workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(ws, k, v)
    ws.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ws)
    return WorkspaceRead.model_validate(ws)


# ── 成员管理 ──────────────────────────────────────────────────────────────

@router.get("/me/members", response_model=list[MemberRead])
async def list_members(
    current_user: AuthenticatedUser = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    """列出 workspace 所有成员（包含自己）。"""
    result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == current_user.workspace_id)
        .order_by(WorkspaceMember.created_at)
    )
    rows = result.all()
    members = []
    for member, user in rows:
        members.append(MemberRead(
            id=member.id,
            workspace_id=member.workspace_id,
            user_id=member.user_id,
            role=member.role,
            page_permissions=member.page_permissions,
            invited_by=member.invited_by,
            created_at=member.created_at,
            email=user.email,
            display_name=user.display_name,
        ))
    return members


@router.post("/me/members", response_model=MemberRead, status_code=201)
async def invite_member(
    body: MemberInvite,
    current_user: AuthenticatedUser = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    """
    邀请 employer 加入 workspace。
    - 被邀请人必须已注册且 role='employer'
    - workspace employer 数量不得超过 max_employers
    """
    # 查目标用户
    user_result = await db.execute(select(User).where(User.email == body.email))
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.role != "employer":
        raise HTTPException(
            status_code=400,
            detail=f"User role is '{target_user.role}', only employer accounts can be invited",
        )
    if not target_user.is_active:
        raise HTTPException(status_code=400, detail="User account is disabled")

    # 检查是否已在 workspace
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == current_user.workspace_id,
            WorkspaceMember.user_id == target_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member of this workspace")

    # 检查 employer 上限
    ws = await db.get(Workspace, current_user.workspace_id)
    count_result = await db.execute(
        select(func.count()).select_from(WorkspaceMember).where(
            WorkspaceMember.workspace_id == current_user.workspace_id,
            WorkspaceMember.role == "employer",
        )
    )
    current_count = count_result.scalar() or 0
    if current_count >= ws.max_employers:
        raise HTTPException(
            status_code=400,
            detail=f"Workspace employer limit reached ({ws.max_employers})",
        )

    member = WorkspaceMember(
        workspace_id=current_user.workspace_id,
        user_id=target_user.id,
        role="employer",
        page_permissions=body.page_permissions,
        invited_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return MemberRead(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        role=member.role,
        page_permissions=member.page_permissions,
        invited_by=member.invited_by,
        created_at=member.created_at,
        email=target_user.email,
        display_name=target_user.display_name,
    )


@router.patch("/me/members/{user_id}/permissions", response_model=MemberRead)
async def update_member_permissions(
    user_id: str,
    body: MemberPermissionUpdate,
    current_user: AuthenticatedUser = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    """修改 employer 的页面权限列表。传 null 清空所有权限。"""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == current_user.workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this workspace")
    if member.role != "employer":
        raise HTTPException(status_code=400, detail="Cannot modify permissions of a manager")

    member.page_permissions = body.page_permissions
    await db.commit()
    await db.refresh(member)

    user = await db.get(User, user_id)
    return MemberRead(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        role=member.role,
        page_permissions=member.page_permissions,
        invited_by=member.invited_by,
        created_at=member.created_at,
        email=user.email if user else None,
        display_name=user.display_name if user else None,
    )


@router.delete("/me/members/{user_id}", status_code=204)
async def remove_member(
    user_id: str,
    current_user: AuthenticatedUser = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    """将 employer 从 workspace 移除。不可移除自己（manager）。"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the workspace")

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == current_user.workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this workspace")

    await db.delete(member)
    await db.commit()
    return None


# ═══════════════════════════════════════════════════════════════════════════
# Superadmin 端 — 系统管理
# ═══════════════════════════════════════════════════════════════════════════

@system_router.get("/managers", response_model=list[ManagerRead])
async def list_managers(
    current_user: AuthenticatedUser = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """列出所有 manager，附带 workspace 和 employer 数量。"""
    result = await db.execute(
        select(User, Workspace)
        .outerjoin(Workspace, Workspace.owner_id == User.id)
        .where(User.role == "manager")
        .order_by(User.created_at)
    )
    rows = result.all()
    managers = []
    for user, ws in rows:
        employer_count = 0
        if ws:
            count_result = await db.execute(
                select(func.count()).select_from(WorkspaceMember).where(
                    WorkspaceMember.workspace_id == ws.id,
                    WorkspaceMember.role == "employer",
                )
            )
            employer_count = count_result.scalar() or 0

        managers.append(ManagerRead(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            workspace_id=ws.id if ws else None,
            workspace_name=ws.name if ws else None,
            employer_count=employer_count,
        ))
    return managers


@system_router.post("/managers", response_model=ManagerRead, status_code=201)
async def create_manager(
    body: ManagerCreate,
    current_user: AuthenticatedUser = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """
    创建 manager 账号。
    - 若 workspace_name 不为 null，同时创建 workspace 并注册为成员。
    """
    # 邮箱唯一性检查
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    new_user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        role="manager",
        is_active=True,
    )
    db.add(new_user)
    await db.flush()  # 获取 new_user.id

    ws = None
    if body.workspace_name:
        ws = Workspace(
            name=body.workspace_name,
            owner_id=new_user.id,
            max_employers=5,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(ws)
        await db.flush()

        member = WorkspaceMember(
            workspace_id=ws.id,
            user_id=new_user.id,
            role="manager",
            page_permissions=None,
            invited_by=current_user.id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(member)

    await db.commit()
    await db.refresh(new_user)

    return ManagerRead(
        id=new_user.id,
        email=new_user.email,
        display_name=new_user.display_name,
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        workspace_id=ws.id if ws else None,
        workspace_name=ws.name if ws else None,
        employer_count=0,
    )


@system_router.patch("/managers/{user_id}/status", response_model=ManagerRead)
async def toggle_manager_status(
    user_id: str,
    is_active: bool,
    current_user: AuthenticatedUser = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """启用或禁用 manager 账号。禁用后该 manager 无法登录。"""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "manager":
        raise HTTPException(status_code=400, detail="User is not a manager")

    user.is_active = is_active
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    ws_result = await db.execute(select(Workspace).where(Workspace.owner_id == user.id))
    ws = ws_result.scalar_one_or_none()

    return ManagerRead(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        workspace_id=ws.id if ws else None,
        workspace_name=ws.name if ws else None,
        employer_count=None,
    )
