"""Tests for WebSocket endpoint protection."""
import os
import pytest
from unittest.mock import patch
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from main import app

client = TestClient(app)


def test_ws_live_blocked_in_production():
    """Production mode should reject /ws/live."""
    with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/live") as ws:
                ws.close()
        assert exc_info.value.code == 1008


def test_ws_live_accepted_in_development():
    """Development mode should accept /ws/live."""
    with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
        try:
            with client.websocket_connect("/ws/live") as ws:
                pass  # Connection accepted — correct for dev
        except WebSocketDisconnect:
            pytest.fail("WebSocket should be accepted in development")


def test_ws_channel_blocked_in_production():
    """Production mode should reject /ws/{channel}."""
    with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/test-channel") as ws:
                ws.close()
        assert exc_info.value.code == 1008


def test_ws_channel_accepted_in_development():
    """Development mode should accept /ws/{channel}."""
    with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
        try:
            with client.websocket_connect("/ws/test-channel") as ws:
                pass
        except WebSocketDisconnect:
            pytest.fail("WebSocket should be accepted in development")
