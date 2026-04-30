"""Audit logging middleware for write operations."""
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("manju.audit")


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            start = time.time()
            try:
                response = await call_next(request)
                status_code = response.status_code
            except Exception:
                status_code = 500
                raise
            finally:
                duration_ms = round((time.time() - start) * 1000, 2)
                client_ip = request.client.host if request.client else "unknown"
                logger.info(
                    "AUDIT %s %s → %d [%s] %.1fms",
                    request.method,
                    request.url.path,
                    status_code,
                    client_ip,
                    duration_ms,
                )
            return response
        return await call_next(request)
