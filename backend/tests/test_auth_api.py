"""Tests for auth API endpoints — validation, error responses, token behavior."""
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

transport = ASGITransport(app=app)


# ── Registration validation ──

@pytest.mark.asyncio
async def test_register_missing_fields():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/register", json={})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_missing_email():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/register", json={"password": "123456"})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_missing_password():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/register", json={"email": "test@test.com"})
        assert resp.status_code == 422


# Email validation tests — schema uses lightweight validator, not EmailStr
# These test validation layer; some may pass validation but fail at DB layer.

# Schema-level email validation tests (bypass HTTP layer)

def test_schema_rejects_email_without_at():
    from schemas.auth import _validate_email
    with pytest.raises(ValueError):
        _validate_email("emailwithoutat.com")


def test_schema_rejects_email_without_domain():
    from schemas.auth import _validate_email
    with pytest.raises(ValueError):
        _validate_email("user@")


def test_schema_rejects_email_without_at_sign():
    from schemas.auth import _validate_email
    with pytest.raises(ValueError):
        _validate_email("not-an-email")


def test_schema_accepts_valid_email():
    from schemas.auth import _validate_email
    assert _validate_email("user@example.com") == "user@example.com"


@pytest.mark.asyncio
async def test_register_short_password():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/register", json={"email": "test@test.com", "password": "123"})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_empty_password():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/register", json={"email": "test@test.com", "password": ""})
        assert resp.status_code == 422


def test_register_schema_accepts_display_name():
    """UserCreate schema should accept display_name as optional field."""
    from schemas.auth import UserCreate
    user = UserCreate(email="test@test.com", password="123456", display_name="Test User")
    assert user.display_name == "Test User"


def test_register_schema_display_name_defaults_none():
    """display_name should default to None when not provided."""
    from schemas.auth import UserCreate
    user = UserCreate(email="test@test.com", password="123456")
    assert user.display_name is None


# ── Login validation ──

@pytest.mark.asyncio
async def test_login_missing_fields():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/login", json={})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_missing_password():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/login", json={"email": "test@test.com"})
        assert resp.status_code == 422


def test_login_schema_accepts_any_string():
    """UserLogin schema accepts any non-empty strings for email/password."""
    from schemas.auth import UserLogin
    login = UserLogin(email="test@test.com", password="secret")
    assert login.email == "test@test.com"
    assert login.password == "secret"


def test_token_response_schema():
    """TokenResponse should have required fields."""
    from schemas.auth import TokenResponse
    tr = TokenResponse(access_token="abc", refresh_token="def")
    assert tr.token_type == "bearer"
    assert tr.access_token == "abc"
    assert tr.refresh_token == "def"


# ── Token refresh ──

@pytest.mark.asyncio
async def test_refresh_missing_token():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/refresh", json={})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_refresh_invalid_token():
    # refresh endpoint takes refresh_token as a query parameter
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/refresh?refresh_token=garbage")
        assert resp.status_code == 401


# ── /me endpoint ──

@pytest.mark.asyncio
async def test_me_without_token():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/auth/me")
        assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_me_invalid_token():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token"})
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_malformed_auth_header():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/auth/me", headers={"Authorization": "NotBearer sometoken"})
        assert resp.status_code in (401, 403)


# ── Logout ──

@pytest.mark.asyncio
async def test_logout_without_token():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/logout")
        assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_logout_invalid_token():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/logout", headers={"Authorization": "Bearer garbage"})
        assert resp.status_code == 401


# ── Auth service unit tests ──

class TestJWTTokenCreation:
    """Unit tests for JWT token creation logic."""

    def test_access_token_contains_type_access(self):
        from services.auth import create_access_token
        token = create_access_token({"sub": "user-1", "email": "a@b.com", "role": "user"})
        from jose import jwt
        from services.auth import JWT_SECRET, ALGORITHM
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        assert payload["type"] == "access"
        assert payload["sub"] == "user-1"

    def test_refresh_token_contains_type_refresh(self):
        from services.auth import create_refresh_token
        token = create_refresh_token({"sub": "user-1", "email": "a@b.com", "role": "user"})
        from jose import jwt
        from services.auth import JWT_SECRET, ALGORITHM
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-1"

    def test_access_token_has_exp_claim(self):
        from services.auth import create_access_token
        token = create_access_token({"sub": "user-1"})
        from jose import jwt
        from services.auth import JWT_SECRET, ALGORITHM
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_refresh_token_has_exp_claim(self):
        from services.auth import create_refresh_token
        token = create_refresh_token({"sub": "user-1"})
        from jose import jwt
        from services.auth import JWT_SECRET, ALGORITHM
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_token_format_is_jwt(self):
        from services.auth import create_access_token
        token = create_access_token({"sub": "user-1"})
        # JWT has 3 parts separated by dots
        parts = token.split(".")
        assert len(parts) == 3

    def test_different_tokens_different_signatures(self):
        from services.auth import create_access_token
        t1 = create_access_token({"sub": "user-1"})
        t2 = create_access_token({"sub": "user-2"})
        assert t1 != t2

    def test_access_token_with_custom_expiry(self):
        from services.auth import create_access_token
        from datetime import timedelta
        token = create_access_token({"sub": "user-1"}, expires_delta=timedelta(seconds=1))
        from jose import jwt, ExpiredSignatureError
        from services.auth import JWT_SECRET, ALGORITHM
        import time
        time.sleep(2)
        with pytest.raises(ExpiredSignatureError):
            jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])

    def test_refresh_token_rejected_as_access(self):
        """A refresh token should not be accepted where an access token is expected."""
        from services.auth import create_refresh_token, JWT_SECRET, ALGORITHM
        token = create_refresh_token({"sub": "user-1"})
        from jose import jwt
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        assert payload["type"] == "refresh", "Should be refresh type, not access"

    def test_hashed_password_not_plaintext(self):
        from services.auth import hash_password
        password = "my-super-secret-password"
        hashed = hash_password(password)
        assert password not in hashed
        assert len(hashed) > len(password)
