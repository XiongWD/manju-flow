"""Tests for audit logging middleware."""
import logging
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_write_request_is_logged(caplog):
    """POST requests should produce audit log entries."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with caplog.at_level(logging.INFO, logger="manju.audit"):
            try:
                resp = await client.post("/api/auth/login", json={"email": "x@x.com", "password": "x"})
            except Exception:
                pass  # endpoint may fail without DB, but audit should still log
        audit_logs = [r for r in caplog.records if r.message.startswith("AUDIT")]
        assert len(audit_logs) >= 1
        assert "POST" in audit_logs[0].message
        assert "/api/auth/login" in audit_logs[0].message


@pytest.mark.asyncio
async def test_read_request_not_logged(caplog):
    """GET requests should NOT produce audit log entries."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with caplog.at_level(logging.INFO, logger="manju.audit"):
            resp = await client.get("/api/health")
        audit_logs = [r for r in caplog.records if r.message.startswith("AUDIT")]
        assert len(audit_logs) == 0
