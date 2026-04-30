"""In-memory TTL cache with namespace support."""
import time
import threading
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

from config import settings
_DEFAULT_TTL = settings.CACHE_TTL_SECONDS


class TTLCache:
    """Thread-safe in-memory cache with TTL expiration."""

    def __init__(self, default_ttl: int = _DEFAULT_TTL):
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()
        self._default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        with self._lock:
            ttl = ttl if ttl is not None else self._default_ttl
            self._store[key] = (time.time() + ttl, value)

    def invalidate(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        with self._lock:
            keys_to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._store[k]

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


# Global singleton
cache = TTLCache()
