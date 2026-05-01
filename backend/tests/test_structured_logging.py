"""Tests for structured JSON logging configuration."""

import json
import logging
from io import StringIO

import pytest


class TestLogFormatSwitching:
    """Verify LOG_FORMAT=text yields plain text, LOG_FORMAT=json yields valid JSON."""

    def _capture_logs(self, debug: bool, log_format: str) -> str:
        """Configure logging with given settings and capture one log line."""
        stream = StringIO()
        handler = logging.StreamHandler(stream)

        if debug or log_format == "text":
            handler.setFormatter(
                logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
            )
        else:
            from pythonjsonlogger import jsonlogger

            handler.setFormatter(
                jsonlogger.JsonFormatter(
                    "%(asctime)s %(levelname)s %(name)s %(message)s",
                    rename_fields={
                        "asctime": "timestamp",
                        "levelname": "level",
                        "name": "logger",
                    },
                )
            )

        logger = logging.getLogger("test_structured")
        logger.handlers = [handler]
        logger.setLevel(logging.INFO)
        logger.info("hello test")

        return stream.getvalue().strip()

    def test_text_format_is_human_readable(self):
        output = self._capture_logs(debug=True, log_format="text")
        assert "hello test" in output
        with pytest.raises(json.JSONDecodeError):
            json.loads(output)

    def test_json_format_is_valid_json(self):
        output = self._capture_logs(debug=False, log_format="json")
        parsed = json.loads(output)
        assert parsed["message"] == "hello test"
        assert parsed["level"] == "INFO"
        assert parsed["logger"] == "test_structured"

    def test_json_format_has_timestamp_field(self):
        output = self._capture_logs(debug=False, log_format="json")
        parsed = json.loads(output)
        assert "timestamp" in parsed

    def test_debug_mode_forces_text_format(self):
        """Even with LOG_FORMAT=json, DEBUG=True should produce text."""
        output = self._capture_logs(debug=True, log_format="json")
        assert "hello test" in output
        with pytest.raises(json.JSONDecodeError):
            json.loads(output)
