"""Optional auth middleware — protects routes listed in AUTH_PROTECTED_PREFIXES."""

import logging

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from jose import jwt, JWTError

from services.auth import JWT_SECRET, ALGORITHM

logger = logging.getLogger(__name__)

# Prefixes that require authentication (configurable via env)
from config import settings

AUTH_PROTECTED_PREFIXES = settings.AUTH_PROTECTED_PREFIXES.split(",")

# Always-exempt paths (static files, health, docs, auth itself)
AUTH_EXEMPT_PREFIXES = ["/api/auth", "/docs", "/openapi.json", "/health", "/ws/"]


class AuthMiddleware(BaseHTTPMiddleware):
    """If AUTH_PROTECTED_PREFIXES is non-empty, requests matching those
    prefixes must carry a valid JWT in the Authorization header.
    Set AUTH_PROTECTED_PREFIXES="" to disable protection (dev mode)."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path: str = request.url.path

        # Skip if no prefixes configured (dev mode)
        protected = [p.strip() for p in AUTH_PROTECTED_PREFIXES if p.strip()]
        if not protected:
            return await call_next(request)

        # Check if path is exempt
        for exempt in AUTH_EXEMPT_PREFIXES:
            if path.startswith(exempt):
                return await call_next(request)

        # Check if path needs protection
        needs_auth = any(path.startswith(prefix) for prefix in protected)
        if not needs_auth:
            return await call_next(request)

        # Validate JWT
        auth_header: str | None = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"code": "AUTH_REQUIRED", "message": "Authorization header required"},
            )

        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            return JSONResponse(
                status_code=401,
                content={"code": "AUTH_REQUIRED", "message": "Bearer token is empty"},
            )

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            if payload.get("type") != "access":
                return JSONResponse(
                    status_code=401,
                    content={"code": "INVALID_TOKEN", "message": "Token type must be 'access'"},
                )
            # Attach user info to request state for downstream use
            request.state.user_id = payload.get("sub")
            request.state.user_email = payload.get("email")
            request.state.user_role = payload.get("role")
        except JWTError as e:
            logger.warning("JWT validation failed: %s", e)
            return JSONResponse(
                status_code=401,
                content={"code": "INVALID_TOKEN", "message": "Invalid or expired token"},
            )

        return await call_next(request)
