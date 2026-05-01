"""Auth service — password hashing, JWT tokens, current-user dependency"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import async_session_factory
from database.models import User, WorkspaceMember

# ── Config ──
ALGORITHM = "HS256"
from config import settings
JWT_SECRET = settings.JWT_SECRET
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

# ── Password hashing (bcrypt via passlib) ──
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ──
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)


async def build_token_data(user: User) -> dict:
    """
    构造 JWT payload，查询 WorkspaceMember 以获取 workspace_id 和 page_permissions。
    superadmin 没有 workspace，返回的对应字段为 None。
    """
    token_data: dict = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "workspace_id": None,
        "page_permissions": None,
    }
    if user.role != "superadmin":
        async with async_session_factory() as session:
            result = await session.execute(
                select(WorkspaceMember).where(WorkspaceMember.user_id == user.id)
            )
            member = result.scalar_one_or_none()
        if member:
            token_data["workspace_id"] = member.workspace_id
            token_data["page_permissions"] = member.page_permissions  # None for manager
    return token_data


# ── FastAPI dependency ──
_bearer_scheme = HTTPBearer()


class AuthenticatedUser:
    """
    经过认证的用户上下文，附带从 JWT 解析的 workspace_id 和 page_permissions，
    避免每次请求额外查询 WorkspaceMember 表。
    """
    def __init__(
        self,
        user: User,
        workspace_id: Optional[str],
        page_permissions: Optional[List[str]],
    ):
        self._user = user
        self.workspace_id = workspace_id
        self.page_permissions = page_permissions

    # 代理 User 属性，让现有代码无感升级
    def __getattr__(self, name: str):
        return getattr(self._user, name)

    @property
    def is_superadmin(self) -> bool:
        return self._user.role == "superadmin"

    @property
    def is_manager(self) -> bool:
        return self._user.role == "manager"

    @property
    def is_employer(self) -> bool:
        return self._user.role == "employer"

    def can_access_page(self, path: str) -> bool:
        """检查 employer 是否有某页面权限；manager/superadmin 始终返回 True。"""
        if self._user.role in ("superadmin", "manager"):
            return True
        if self.page_permissions is None:
            return False
        return any(path.startswith(p) for p in self.page_permissions)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> AuthenticatedUser:
    """Extract Bearer token, decode JWT, return AuthenticatedUser. Raises 401 on failure."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None or payload.get("type") != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return AuthenticatedUser(
        user=user,
        workspace_id=payload.get("workspace_id"),
        page_permissions=payload.get("page_permissions"),
    )


# ── 权限依赖 ────────────────────────────────────────────────────────────────

async def require_superadmin(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """仅 superadmin 可通过。"""
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required",
        )
    return current_user


async def require_manager(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """manager 或 superadmin 可通过（superadmin 可跨 workspace 操作系统管理）。"""
    if current_user.role not in ("manager", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required",
        )
    return current_user


async def require_workspace_member(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """已加入 workspace 的用户（manager / employer）可通过；superadmin 拒绝（无 workspace）。"""
    if current_user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is for workspace members only",
        )
    if not current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No workspace associated with this account",
        )
    return current_user
