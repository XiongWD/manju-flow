"""Simple in-process broadcast for WebSocket connections."""
import asyncio
import json
import logging
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class BroadcastService:
    def __init__(self, max_connections: int = 100):
        self._connections: dict[str, Set[int]] = {}  # channel -> set of ws id
        self._ws_by_id: dict[int, WebSocket] = {}
        self._max_connections = max_connections
        self._total_count = 0
        self._lock = asyncio.Lock()

    @property
    def total_connections(self) -> int:
        return self._total_count

    @property
    def is_full(self) -> bool:
        return self._total_count >= self._max_connections

    async def connect(self, channel: str, ws: WebSocket) -> bool:
        """Connect a WebSocket. Returns True if accepted, False if rejected (limit reached)."""
        async with self._lock:
            if self._total_count >= self._max_connections:
                logger.warning(
                    "WS connection rejected: limit reached (%d/%d)",
                    self._total_count, self._max_connections,
                )
                return False
            await ws.accept()
            ws_id = id(ws)
            self._ws_by_id[ws_id] = ws
            if channel not in self._connections:
                self._connections[channel] = set()
            self._connections[channel].add(ws_id)
            self._total_count += 1
            logger.info("WS connected to channel %s (total: %d/%d)", channel, self._total_count, self._max_connections)
            return True

    def disconnect(self, channel: str, ws: WebSocket):
        ws_id = id(ws)
        if channel in self._connections:
            if ws_id in self._connections[channel]:
                self._total_count = max(0, self._total_count - 1)
                self._connections[channel].discard(ws_id)
                self._ws_by_id.pop(ws_id, None)
            if not self._connections[channel]:
                del self._connections[channel]

    async def broadcast(self, channel: str, message: dict):
        if channel not in self._connections:
            return
        dead_ids = []
        for ws_id in list(self._connections[channel]):
            ws = self._ws_by_id.get(ws_id)
            if ws is None:
                dead_ids.append(ws_id)
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead_ids.append(ws_id)
        for ws_id in dead_ids:
            self.disconnect(channel, self._ws_by_id.get(ws_id, type('Obj', (), {})()))


broadcast = BroadcastService()
