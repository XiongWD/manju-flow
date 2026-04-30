"""Simple in-process broadcast for WebSocket connections."""
import json
import logging
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class BroadcastService:
    def __init__(self):
        self._connections: dict[str, Set[WebSocket]] = {}  # channel -> set of ws

    async def connect(self, channel: str, ws: WebSocket):
        await ws.accept()
        if channel not in self._connections:
            self._connections[channel] = set()
        self._connections[channel].add(ws)
        logger.info("WS connected to channel %s (total: %d)", channel, len(self._connections[channel]))

    def disconnect(self, channel: str, ws: WebSocket):
        if channel in self._connections:
            self._connections[channel].discard(ws)
            if not self._connections[channel]:
                del self._connections[channel]

    async def broadcast(self, channel: str, message: dict):
        if channel not in self._connections:
            return
        dead = []
        for ws in self._connections[channel]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(channel, ws)


broadcast = BroadcastService()
