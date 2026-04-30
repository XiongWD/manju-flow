"""Smoke tests — verify test infrastructure works."""
import pytest


def test_python_works():
    """Basic sanity check."""
    assert 1 + 1 == 2


def test_pytest_asyncio_installed():
    """Verify pytest-asyncio is available."""
    import pytest_asyncio
    assert pytest_asyncio is not None


def test_httpx_installed():
    """Verify httpx is available."""
    import httpx
    assert httpx.AsyncClient is not None
