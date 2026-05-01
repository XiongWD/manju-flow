"""数据库连接配置 — SQLite async，预留 PostgreSQL 迁移"""

from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import DateTime
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

load_dotenv()

from config import settings

DATABASE_URL = settings.DATABASE_URL

# SQLite 需要 check_same_thread=False
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

async_engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)

async_session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类"""
    pass


class SoftDeleteMixin:
    """软删除 mixin — 为模型添加 deleted_at 字段"""

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, default=None, comment="软删除时间戳，NULL 表示未删除"
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        self.deleted_at = datetime.now(timezone.utc)

    def restore(self) -> None:
        self.deleted_at = None


def not_deleted(cls):
    """返回过滤条件：deleted_at IS NULL

    用法: select(Project).where(not_deleted(Project))
    """
    return cls.deleted_at.is_(None)


def include_deleted(cls):
    """返回 True（不过滤）— 用于管理员查看已删除数据"""
    return True


async def get_or_none(session: AsyncSession, model, pk, *, include_deleted: bool = False):
    """安全的 get，默认过滤已软删除的数据。

    用法: obj = await get_or_none(db, Project, project_id)
    """
    obj = await session.get(model, pk)
    if obj is None:
        return None
    if not include_deleted and hasattr(model, 'deleted_at') and obj.deleted_at is not None:
        return None
    return obj


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖注入用"""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
