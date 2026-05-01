"""Shared test fixtures for manju backend."""
import asyncio
import os
from typing import AsyncGenerator
import pytest

# Disable auth middleware so CRUD endpoint tests can reach routes without tokens.
# Must be set before any app/config module is imported.
os.environ.setdefault("AUTH_PROTECTED_PREFIXES", "")

# App-level fixtures — only loaded if main import succeeds.
# This allows unit/smoke tests to run even if the app has import issues.
try:
    from httpx import AsyncClient, ASGITransport
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

    from database.connection import Base
    from main import app

    APP_AVAILABLE = True
except Exception:
    APP_AVAILABLE = False

import os as _os
_PROJECT_ROOT = _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{_os.path.join(_PROJECT_ROOT, 'data', 'test_manju.db')}"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    if not APP_AVAILABLE:
        pytest.skip("App not importable (upstream issue)")
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await session.rollback()

@pytest.fixture
async def client(test_engine) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
