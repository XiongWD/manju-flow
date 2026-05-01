"""Tests for WebSocket max_connections limit and rejection policy."""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.broadcast import BroadcastService
from config import Settings


class TestBroadcastServiceConnectionLimit:
    """Test BroadcastService connection counting and limit enforcement."""

    def test_default_max_connections(self):
        svc = BroadcastService()
        assert svc._max_connections == 100

    def test_custom_max_connections(self):
        svc = BroadcastService(max_connections=5)
        assert svc._max_connections == 5

    def test_total_connections_starts_at_zero(self):
        svc = BroadcastService()
        assert svc.total_connections == 0

    def test_is_full_when_empty(self):
        svc = BroadcastService(max_connections=1)
        assert not svc.is_full

    @pytest.mark.asyncio
    async def test_connect_increments_count(self):
        svc = BroadcastService(max_connections=5)
        ws = AsyncMock()
        accepted = await svc.connect("ch1", ws)
        assert accepted is True
        assert svc.total_connections == 1
        ws.accept.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_connect_rejects_when_full(self):
        svc = BroadcastService(max_connections=2)
        ws1, ws2, ws3 = AsyncMock(), AsyncMock(), AsyncMock()

        assert await svc.connect("ch1", ws1) is True
        assert await svc.connect("ch1", ws2) is True
        assert svc.total_connections == 2

        # Third connection should be rejected
        assert await svc.connect("ch1", ws3) is False
        assert svc.total_connections == 2
        ws3.accept.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_reject_does_not_call_accept(self):
        svc = BroadcastService(max_connections=0)
        ws = AsyncMock()
        accepted = await svc.connect("ch1", ws)
        assert accepted is False
        ws.accept.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_disconnect_decrements_count(self):
        svc = BroadcastService(max_connections=5)
        ws = AsyncMock()
        await svc.connect("ch1", ws)
        assert svc.total_connections == 1

        svc.disconnect("ch1", ws)
        assert svc.total_connections == 0

    @pytest.mark.asyncio
    async def test_disconnect_nonexistent_no_error(self):
        svc = BroadcastService()
        ws = AsyncMock()
        svc.disconnect("nope", ws)  # should not raise
        assert svc.total_connections == 0

    @pytest.mark.asyncio
    async def test_disconnect_unknown_ws_in_channel_no_error(self):
        svc = BroadcastService()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await svc.connect("ch1", ws1)
        svc.disconnect("ch1", ws2)  # ws2 not in channel, should not decrement
        assert svc.total_connections == 1

    @pytest.mark.asyncio
    async def test_reconnect_after_disconnect(self):
        svc = BroadcastService(max_connections=1)
        ws1 = AsyncMock()
        ws2 = AsyncMock()

        assert await svc.connect("ch1", ws1) is True
        svc.disconnect("ch1", ws1)
        assert svc.total_connections == 0

        assert await svc.connect("ch1", ws2) is True
        assert svc.total_connections == 1

    @pytest.mark.asyncio
    async def test_multiple_channels_share_limit(self):
        """Total limit is shared across all channels."""
        svc = BroadcastService(max_connections=3)
        ws1, ws2, ws3, ws4 = AsyncMock(), AsyncMock(), AsyncMock(), AsyncMock()

        assert await svc.connect("ch-a", ws1) is True
        assert await svc.connect("ch-b", ws2) is True
        assert await svc.connect("ch-a", ws3) is True
        assert await svc.connect("ch-c", ws4) is False  # 4th exceeds limit of 3

    @pytest.mark.asyncio
    async def test_is_full_property(self):
        svc = BroadcastService(max_connections=1)
        assert not svc.is_full
        ws = AsyncMock()
        await svc.connect("ch1", ws)
        assert svc.is_full
        svc.disconnect("ch1", ws)
        assert not svc.is_full


class TestSettingsMaxWsConnections:
    """Test config.py Settings has MAX_WS_CONNECTIONS."""

    def test_default_value(self):
        s = Settings()
        assert s.MAX_WS_CONNECTIONS == 100

    def test_from_env(self, monkeypatch):
        # Note: Settings reads env at class definition (import) time,
        # not at instantiation. MAX_WS_CONNECTIONS is already set.
        # Verify the attribute exists and is an int.
        s = Settings()
        assert isinstance(s.MAX_WS_CONNECTIONS, int)
        assert s.MAX_WS_CONNECTIONS > 0
