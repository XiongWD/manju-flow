"""Tests for middleware stack — CORS, auth middleware, error handling."""
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

transport = ASGITransport(app=app)


# ── CORS ──

@pytest.mark.asyncio
async def test_cors_preflight_health():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.options("/api/health", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        })
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_cors_preflight_auth():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.options("/api/auth/login", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST"
        })
        assert resp.status_code == 200


# ── Error handling ──

@pytest.mark.asyncio
async def test_404_returns_json():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/nonexistent-endpoint")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_404_has_json_content_type():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/nonexistent-endpoint")
        content_type = resp.headers.get("content-type", "")
        assert "application/json" in content_type


@pytest.mark.asyncio
async def test_method_not_allowed():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.patch("/api/auth/login")
        assert resp.status_code == 405


# ── Health endpoint ──

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/health")
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_health_returns_json():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/health")
        data = resp.json()
        assert isinstance(data, dict)


# ── Auth middleware ──

@pytest.mark.asyncio
async def test_auth_middleware_exempts_auth_routes():
    """Auth routes should not be blocked by AuthMiddleware."""
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # POST /api/auth/login without any token — should reach the endpoint (422), not 401 from middleware
        resp = await c.post("/api/auth/login", json={})
        assert resp.status_code == 422  # validation error, not auth block


@pytest.mark.asyncio
async def test_auth_middleware_exempts_health():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/health")
        assert resp.status_code == 200


# ── Middleware stack integrity ──

def test_app_has_auth_middleware():
    """Verify AuthMiddleware is registered in the app."""
    from middleware.auth import AuthMiddleware
    middleware_classes = [type(mw.cls) if mw.cls else None for mw in app.user_middleware]
    # Check both Starlette and FastAPI middleware registration
    all_classes = []
    for mw in app.user_middleware:
        if mw.cls:
            all_classes.append(mw.cls)
    assert any(c.__name__ == "AuthMiddleware" for c in all_classes), \
        "AuthMiddleware should be in middleware stack"


def test_app_has_cors_middleware():
    """Verify CORSMiddleware is registered."""
    all_classes = [mw.cls for mw in app.user_middleware if mw.cls]
    assert any(c.__name__ == "CORSMiddleware" for c in all_classes), \
        "CORSMiddleware should be in middleware stack"


def test_app_has_audit_log_middleware():
    """Verify AuditLogMiddleware is registered."""
    from middleware.audit_log import AuditLogMiddleware
    all_classes = [mw.cls for mw in app.user_middleware if mw.cls]
    assert any(issubclass(c, AuditLogMiddleware) or c.__name__ == "AuditLogMiddleware" for c in all_classes), \
        "AuditLogMiddleware should be in middleware stack"
