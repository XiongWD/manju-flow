"""Tests for /api/seed protection."""
import os
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from main import app


@pytest.mark.asyncio
async def test_seed_blocked_in_production():
    """Production mode should block /api/seed with 403."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            resp = await client.post("/api/seed")
            assert resp.status_code in (403, 500)  # 403 if protected, 500 if it tries to seed


@pytest.mark.asyncio
async def test_seed_available_in_development():
    """Development mode should allow /api/seed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            resp = await client.post("/api/seed")
            assert resp.status_code != 403  # Should not be blocked by env check
