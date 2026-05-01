"""Centralized configuration from environment variables."""

from __future__ import annotations

import os
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, EnvSettingsSource, SettingsConfigDict

# Project root = parent of backend/
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_DB_PATH = os.path.join(_PROJECT_ROOT, "data", "manju.db")
_DEFAULT_DB_URL = f"sqlite+aiosqlite:///{_DEFAULT_DB_PATH}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(_PROJECT_ROOT, ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── App ──
    APP_NAME: str = "Manju"
    DEBUG: bool = False
    DB_AUTO_CREATE: bool = True
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" or "text"

    # ── Database ──
    DATABASE_URL: str = Field(default=_DEFAULT_DB_URL)

    # ── Auth ──
    JWT_SECRET: str = "manju-dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MANJU_ADMIN_EMAIL: str = ""
    MANJU_ADMIN_PASSWORD: str = ""

    # ── CORS ──
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ── Cache ──
    CACHE_TTL_SECONDS: int = 300

    # ── WebSocket ──
    MAX_WS_CONNECTIONS: int = 100

    # ── Upload ──
    MAX_UPLOAD_BYTES: int = 104857600  # 100MB

    # ── Auth Middleware ──
    AUTH_PROTECTED_PREFIXES: str = (
        "/api/projects,/api/episodes,/api/scenes,/api/characters,/api/assets,"
        "/api/jobs,/api/publish,/api/qa,/api/knowledge,/api/files,"
        "/api/story-bibles,/api/prompts,/api/settings,/api/locations,/api/shots"
    )

    # ── Storage ──
    STORAGE_LOCAL_PATH: str = Field(
        default_factory=lambda: os.path.join(os.path.dirname(__file__), "storage_data"),
    )
    MINIO_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "manju-assets"
    MINIO_USE_SSL: bool = False
    MINIO_PUBLIC_URL: str = ""

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Replace default env source with our custom one that handles comma-separated lists
        return (
            _CommaAwareEnvSource(settings_cls),
            init_settings,
            dotenv_settings,
            file_secret_settings,
        )


# Need to import after class definition to avoid circular issues
from pydantic_settings import PydanticBaseSettingsSource


class _CommaAwareEnvSource(EnvSettingsSource):
    """Env source that handles comma-separated values for list[str] fields."""

    def prepare_field_value(self, field_name: str, field_info: Any, value: Any, value_is_complex: bool) -> Any:
        # For list fields with a comma-separated string that isn't JSON, split it
        if value is not None and isinstance(value, str) and self.field_is_complex(field_info):
            import json
            try:
                return json.loads(value)
            except (json.JSONDecodeError, ValueError):
                return [s.strip() for s in value.split(",") if s.strip()]
        return super().prepare_field_value(field_name, field_info, value, value_is_complex)


_JWT_DEFAULT = "manju-dev-secret-change-in-production"


def validate_config() -> None:
    """Validate security-critical settings at startup."""
    import logging

    logger = logging.getLogger("manju.config")
    env = os.getenv("ENVIRONMENT", "development").lower()
    if settings.JWT_SECRET == _JWT_DEFAULT:
        if env in ("development", "debug"):
            logger.warning("Using default JWT_SECRET — do not use in production!")
        else:
            logger.error(
                "JWT_SECRET is set to default value in %s environment. Refusing to start.",
                env,
            )
            raise SystemExit(1)

    # DATABASE_URL 校验
    if not settings.DATABASE_URL:
        logger.error("DATABASE_URL is not set")
        raise SystemExit(1)

    # ACCESS_TOKEN_EXPIRE_MINUTES 校验
    if settings.ACCESS_TOKEN_EXPIRE_MINUTES < 1:
        logger.error("ACCESS_TOKEN_EXPIRE_MINUTES must be >= 1")
        raise SystemExit(1)

    # MAX_UPLOAD_BYTES 校验
    if settings.MAX_UPLOAD_BYTES < 0:
        logger.error("MAX_UPLOAD_BYTES must be >= 0")
        raise SystemExit(1)


settings = Settings()
