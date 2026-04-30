"""Centralized configuration from environment variables."""

import os


class Settings:
    # ── App ──
    APP_NAME: str = os.getenv("APP_NAME", "Manju")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    DB_AUTO_CREATE: bool = os.getenv("DB_AUTO_CREATE", "true").lower() != "false"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # ── Database ──
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./manju.db")

    # ── Auth ──
    JWT_SECRET: str = os.getenv("JWT_SECRET", "manju-dev-secret-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    MANJU_ADMIN_EMAIL: str = os.getenv("MANJU_ADMIN_EMAIL", "")
    MANJU_ADMIN_PASSWORD: str = os.getenv("MANJU_ADMIN_PASSWORD", "")

    # ── CORS ──
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

    # ── Cache ──
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "300"))

    # ── Upload ──
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", "104857600"))  # 100MB

    # ── Auth Middleware ──
    AUTH_PROTECTED_PREFIXES: str = os.getenv(
        "AUTH_PROTECTED_PREFIXES",
        "/api/projects,/api/episodes,/api/scenes,/api/characters,/api/assets,"
        "/api/jobs,/api/publish,/api/qa,/api/knowledge,/api/files,"
        "/api/story-bibles,/api/prompts,/api/settings,/api/locations,/api/shots"
    )

    # ── Storage ──
    STORAGE_LOCAL_PATH: str = os.getenv(
        "STORAGE_LOCAL_PATH",
        os.path.join(os.path.dirname(__file__), "storage_data"),
    )
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "manju-assets")
    MINIO_USE_SSL: bool = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    MINIO_PUBLIC_URL: str = os.getenv("MINIO_PUBLIC_URL", "")


settings = Settings()
