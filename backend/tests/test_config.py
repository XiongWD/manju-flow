"""Tests for pydantic-settings based config."""

import os

import pytest


class TestDefaults:
    """Verify all fields carry their expected default values."""

    def _fresh_settings(self, monkeypatch):
        """Import Settings with a clean env to get true defaults."""
        # Remove all relevant env vars
        env_keys = (
            "APP_NAME", "DEBUG", "DB_AUTO_CREATE", "LOG_LEVEL",
            "DATABASE_URL", "JWT_SECRET", "ACCESS_TOKEN_EXPIRE_MINUTES",
            "REFRESH_TOKEN_EXPIRE_DAYS", "MANJU_ADMIN_EMAIL",
            "MANJU_ADMIN_PASSWORD", "CORS_ORIGINS", "CACHE_TTL_SECONDS",
            "MAX_WS_CONNECTIONS", "MAX_UPLOAD_BYTES",
            "AUTH_PROTECTED_PREFIXES", "STORAGE_LOCAL_PATH",
            "MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY",
            "MINIO_BUCKET", "MINIO_USE_SSL", "MINIO_PUBLIC_URL",
        )
        for key in list(os.environ):
            if key in env_keys:
                monkeypatch.delenv(key, raising=False)
        from config import Settings
        # Build without env file to get pure defaults
        return Settings(_env_file=None)

    def test_app_name(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.APP_NAME == "Manju"

    def test_debug_default_false(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.DEBUG is False

    def test_db_auto_create_default_true(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.DB_AUTO_CREATE is True

    def test_database_url(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.DATABASE_URL == "sqlite+aiosqlite:///./manju.db"

    def test_jwt_secret(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.JWT_SECRET == "manju-dev-secret-change-in-production"

    def test_access_token_expire(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 60

    def test_refresh_token_expire(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.REFRESH_TOKEN_EXPIRE_DAYS == 7

    def test_cors_origins_default(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.CORS_ORIGINS == ["http://localhost:3000"]

    def test_max_ws_connections(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.MAX_WS_CONNECTIONS == 100

    def test_max_upload_bytes(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.MAX_UPLOAD_BYTES == 104857600

    def test_minio_defaults(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.MINIO_ENDPOINT == "http://localhost:9000"
        assert s.MINIO_ACCESS_KEY == "minioadmin"
        assert s.MINIO_SECRET_KEY == "minioadmin"
        assert s.MINIO_BUCKET == "manju-assets"
        assert s.MINIO_USE_SSL is False
        assert s.MINIO_PUBLIC_URL == ""

    def test_storage_local_path(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.STORAGE_LOCAL_PATH.endswith("storage_data")

    def test_log_level(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.LOG_LEVEL == "INFO"

    def test_admin_fields_empty(self, monkeypatch):
        s = self._fresh_settings(monkeypatch)
        assert s.MANJU_ADMIN_EMAIL == ""
        assert s.MANJU_ADMIN_PASSWORD == ""


class TestEnvOverride:
    """Verify environment variables override defaults."""

    def test_debug_true(self, monkeypatch):
        monkeypatch.setenv("DEBUG", "true")
        from config import Settings
        assert Settings().DEBUG is True

    def test_debug_false(self, monkeypatch):
        monkeypatch.setenv("DEBUG", "false")
        from config import Settings
        assert Settings().DEBUG is False

    def test_int_override(self, monkeypatch):
        monkeypatch.setenv("MAX_WS_CONNECTIONS", "200")
        from config import Settings
        assert Settings().MAX_WS_CONNECTIONS == 200

    def test_jwt_secret_override(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "my-super-secret")
        from config import Settings
        assert Settings().JWT_SECRET == "my-super-secret"

    def test_cors_origins_comma_separated(self, monkeypatch):
        monkeypatch.setenv("CORS_ORIGINS", "http://a.com,http://b.com")
        from config import Settings
        assert Settings().CORS_ORIGINS == ["http://a.com", "http://b.com"]

    def test_cors_origins_json_list(self, monkeypatch):
        monkeypatch.setenv("CORS_ORIGINS", '["http://a.com","http://b.com"]')
        from config import Settings
        assert Settings().CORS_ORIGINS == ["http://a.com", "http://b.com"]

    def test_database_url_override(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
        from config import Settings
        assert Settings().DATABASE_URL == "postgresql+asyncpg://user:pass@localhost/db"


class TestTypeConversion:
    """Verify pydantic handles type coercion correctly."""

    def test_bool_strings(self, monkeypatch):
        for val, expected in [("True", True), ("TRUE", True), ("1", True),
                               ("False", False), ("FALSE", False), ("0", False)]:
            monkeypatch.setenv("DEBUG", val)
            from config import Settings
            assert Settings().DEBUG is expected, f"DEBUG={val!r} should be {expected}"

    def test_int_from_string(self, monkeypatch):
        monkeypatch.setenv("CACHE_TTL_SECONDS", "600")
        from config import Settings
        assert Settings().CACHE_TTL_SECONDS == 600
        assert isinstance(Settings().CACHE_TTL_SECONDS, int)


class TestSingletonImport:
    """Verify the module-level `settings` singleton is usable."""

    def test_settings_is_settings_instance(self):
        from config import settings, Settings
        assert isinstance(settings, Settings)

    def test_settings_has_expected_attrs(self):
        from config import settings
        for attr in ("DEBUG", "DATABASE_URL", "JWT_SECRET", "CORS_ORIGINS",
                      "MAX_WS_CONNECTIONS", "MAX_UPLOAD_BYTES", "MINIO_ENDPOINT"):
            assert hasattr(settings, attr)
