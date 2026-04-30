"""Tests for rate limiting — unit tests against slowapi limiter."""
import pytest
from limits.strategies import MovingWindowRateLimiter
from limits.storage.memory import MemoryStorage
from limits import parse


@pytest.fixture
def rl():
    """Fresh rate limiter for each test."""
    return MovingWindowRateLimiter(MemoryStorage())


def test_limiter_login_limit(rl):
    """Login: 10/min — first 10 pass, next 5 rejected."""
    limit = parse("10/minute")
    passed = 0
    rejected = 0
    for i in range(15):
        if rl.hit(limit, "127.0.0.1:/api/auth/login"):
            passed += 1
        else:
            rejected += 1
    assert passed == 10, f"Expected 10 passed, got {passed}"
    assert rejected == 5, f"Expected 5 rejected, got {rejected}"


def test_limiter_register_limit(rl):
    """Register: 5/min — first 5 pass, next 3 rejected."""
    limit = parse("5/minute")
    passed = 0
    rejected = 0
    for i in range(8):
        if rl.hit(limit, "127.0.0.1:/api/auth/register"):
            passed += 1
        else:
            rejected += 1
    assert passed == 5, f"Expected 5 passed, got {passed}"
    assert rejected == 3, f"Expected 3 rejected, got {rejected}"


def test_global_limit_allows_normal_usage(rl):
    """Global 100/min: 50 requests should all pass."""
    limit = parse("100/minute")
    for i in range(50):
        assert rl.hit(limit, "127.0.0.1:global"), f"Request {i+1} should pass"


def test_different_ips_separate_limits(rl):
    """Different IPs should have independent rate limits."""
    limit = parse("5/minute")
    # Exhaust IP 1
    for i in range(5):
        assert rl.hit(limit, "192.168.1.1:/api/auth/login")
    # IP 1 should be blocked
    assert not rl.hit(limit, "192.168.1.1:/api/auth/login"), "IP 1 should be blocked"
    # IP 2 should still pass
    assert rl.hit(limit, "192.168.1.2:/api/auth/login"), "IP 2 should pass"


def test_limiter_decorator_on_auth_endpoints():
    """Verify slowapi decorators are applied to auth endpoints."""
    from routers.auth import login, register
    assert hasattr(login, "__wrapped__"), "login should be wrapped by slowapi"
    assert hasattr(register, "__wrapped__"), "register should be wrapped by slowapi"


def test_rate_limit_module_exports_limiter():
    """Verify rate_limit module exports a limiter instance."""
    from middleware.rate_limit import limiter
    assert limiter is not None
    assert hasattr(limiter, "reset")
