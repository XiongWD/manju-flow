"""Auth router — register, login, refresh, me, logout"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select

from database.connection import async_session_factory
from database.models import User
from schemas.auth import TokenResponse, UserCreate, UserLogin, UserRead
from services.auth import (
    build_token_data,
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


# ── POST /register ──
@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, body: UserCreate):
    async with async_session_factory() as session:
        # Check email uniqueness
        existing = await session.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already registered")

        user = User(
            email=body.email,
            password_hash=hash_password(body.password),
            display_name=body.display_name,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return user


# ── POST /login ──
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: UserLogin):
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Update last login
    async with async_session_factory() as session:
        user.last_login_at = datetime.now(timezone.utc)
        session.add(user)
        await session.commit()

    token_data = await build_token_data(user)
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        workspace_id=token_data.get("workspace_id"),
        page_permissions=token_data.get("page_permissions"),
        role=user.role,
    )


# ── POST /refresh ──
@router.post("/refresh", response_model=TokenResponse)
async def refresh(refresh_token: str):
    from jose import JWTError, jwt
    from services.auth import ALGORITHM, JWT_SECRET

    credentials_exception = HTTPException(
        status_code=401, detail="Invalid refresh token"
    )
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise credentials_exception

    token_data = await build_token_data(user)
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        workspace_id=token_data.get("workspace_id"),
        page_permissions=token_data.get("page_permissions"),
        role=user.role,
    )


# ── GET /me ──
@router.get("/me", response_model=UserRead)
async def me(current_user=Depends(get_current_user)):
    """返回当前用户信息，附带 workspace_id 和 page_permissions。"""
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "last_login_at": current_user.last_login_at,
        "workspace_id": current_user.workspace_id,
        "page_permissions": current_user.page_permissions,
    }
    return UserRead(**user_dict)


# ── POST /logout (stub) ──
@router.post("/logout")
async def logout(current_user=Depends(get_current_user)):
    """Stub: token blacklist will be added in Phase 6."""
    return {"detail": "Logged out"}
