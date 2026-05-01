"""Alembic 环境配置 — 异步模式"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from database.connection import Base
from database.models import *  # noqa: F401,F403 — 确保所有模型被注册

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# 从项目根目录的 .env 读取 DATABASE_URL
import os
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))         # backend/alembic/
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_HERE))    # project root
load_dotenv(os.path.join(_PROJECT_ROOT, ".env"))

_default_db = f"sqlite+aiosqlite:///{os.path.join(_PROJECT_ROOT, 'data', 'manju.db')}"
db_url = os.getenv("DATABASE_URL", _default_db)
config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """离线模式生成 SQL 脚本"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """异步模式执行 migration"""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """在线模式直接执行 migration"""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
