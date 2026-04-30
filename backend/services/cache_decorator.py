"""Decorator for caching async function results."""
from functools import wraps
from services.cache import cache


def cached(prefix: str, ttl: int | None = None):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key based on function name + arguments
            cache_key = f"{prefix}:{func.__name__}:{hash((args, tuple(sorted(kwargs.items()))))}"
            result = cache.get(cache_key)
            if result is not None:
                return result
            result = await func(*args, **kwargs)
            cache.set(cache_key, result, ttl=ttl)
            return result
        return wrapper
    return decorator
