"""Tests for JWT_SECRET configuration validation."""
import os
import pytest
from config import settings, validate_config, _JWT_DEFAULT


class TestJWTSecretValidation:
    def test_default_secret_in_production_raises(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", _JWT_DEFAULT)
        monkeypatch.setenv("ENVIRONMENT", "production")
        # Re-create settings to pick up env
        from config import Settings
        from config import settings as _s
        # settings is module-level singleton; we patch its attribute directly
        _s.JWT_SECRET = _JWT_DEFAULT
        with pytest.raises(SystemExit):
            validate_config()

    def test_custom_secret_in_production_ok(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "my-real-secret-key-32chars!")
        monkeypatch.setenv("ENVIRONMENT", "production")
        from config import settings as _s
        _s.JWT_SECRET = "my-real-secret-key-32chars!"
        validate_config()  # should not raise

    def test_default_secret_in_dev_warns(self, monkeypatch, caplog):
        monkeypatch.setenv("JWT_SECRET", _JWT_DEFAULT)
        monkeypatch.setenv("ENVIRONMENT", "development")
        from config import settings as _s
        _s.JWT_SECRET = _JWT_DEFAULT
        with caplog.at_level("WARNING"):
            validate_config()
        assert "default JWT_SECRET" in caplog.text
