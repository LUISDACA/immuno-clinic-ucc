"""Unit tests for structured JSON logging — _JsonFormatter and configure_logging."""

from __future__ import annotations

import json
import logging
import sys

import pytest
from app.core.logging_config import _JsonFormatter, configure_logging
from app.core.request_context import request_id_var, user_id_var


class TestJsonFormatter:
    def _record(
        self,
        msg: str = "hello",
        level: int = logging.INFO,
        extra: dict | None = None,
        exc_info=None,
    ) -> logging.LogRecord:
        record = logging.LogRecord(
            name="test.logger",
            level=level,
            pathname="",
            lineno=0,
            msg=msg,
            args=(),
            exc_info=exc_info,
        )
        if extra:
            for k, v in extra.items():
                setattr(record, k, v)
        return record

    def test_output_is_valid_json(self):
        fmt = _JsonFormatter()
        parsed = json.loads(fmt.format(self._record()))
        assert isinstance(parsed, dict)

    def test_required_fields_present(self):
        fmt = _JsonFormatter()
        parsed = json.loads(fmt.format(self._record("test message", logging.WARNING)))
        assert parsed["level"] == "WARNING"
        assert parsed["msg"] == "test message"
        assert "ts" in parsed
        assert "logger" in parsed
        assert "request_id" in parsed
        assert "user_id" in parsed

    def test_default_context_vars_are_dash(self):
        token_rid = request_id_var.set("-")
        token_uid = user_id_var.set("-")
        try:
            fmt = _JsonFormatter()
            parsed = json.loads(fmt.format(self._record()))
            assert parsed["request_id"] == "-"
            assert parsed["user_id"] == "-"
        finally:
            request_id_var.reset(token_rid)
            user_id_var.reset(token_uid)

    def test_context_vars_are_included_when_set(self):
        token_rid = request_id_var.set("req-abc")
        token_uid = user_id_var.set("user-xyz")
        try:
            fmt = _JsonFormatter()
            parsed = json.loads(fmt.format(self._record()))
            assert parsed["request_id"] == "req-abc"
            assert parsed["user_id"] == "user-xyz"
        finally:
            request_id_var.reset(token_rid)
            user_id_var.reset(token_uid)

    def test_extra_fields_attached_to_log(self):
        fmt = _JsonFormatter()
        parsed = json.loads(
            fmt.format(self._record(extra={"method": "GET", "status": 200, "duration_ms": 42}))
        )
        assert parsed["method"] == "GET"
        assert parsed["status"] == 200
        assert parsed["duration_ms"] == 42

    def test_exception_info_formatted(self):
        try:
            raise RuntimeError("oops")
        except RuntimeError:
            exc = sys.exc_info()
        fmt = _JsonFormatter()
        parsed = json.loads(fmt.format(self._record(exc_info=exc)))
        assert "exc" in parsed
        assert "RuntimeError" in parsed["exc"]
        assert "oops" in parsed["exc"]

    @pytest.mark.parametrize(
        "level,name",
        [
            (logging.DEBUG, "DEBUG"),
            (logging.WARNING, "WARNING"),
            (logging.ERROR, "ERROR"),
            (logging.CRITICAL, "CRITICAL"),
        ],
    )
    def test_level_names_mapped_correctly(self, level, name):
        fmt = _JsonFormatter()
        parsed = json.loads(fmt.format(self._record(level=level)))
        assert parsed["level"] == name

    def test_internal_logrecord_attrs_not_leaked(self):
        fmt = _JsonFormatter()
        parsed = json.loads(fmt.format(self._record()))
        for key in ("exc_info", "exc_text", "stack_info", "lineno", "filename", "pathname"):
            assert key not in parsed

    def test_logger_name_is_preserved(self):
        fmt = _JsonFormatter()
        parsed = json.loads(fmt.format(self._record()))
        assert parsed["logger"] == "test.logger"


class TestConfigureLogging:
    def test_root_handler_is_json_formatter(self):
        configure_logging("INFO")
        root = logging.getLogger()
        assert any(isinstance(h.formatter, _JsonFormatter) for h in root.handlers)

    def test_level_set_from_string(self):
        configure_logging("DEBUG")
        assert logging.getLogger().level == logging.DEBUG

        configure_logging("WARNING")
        assert logging.getLogger().level == logging.WARNING

    def test_noisy_loggers_silenced(self):
        configure_logging()
        for name in ("httpx", "httpcore", "sqlalchemy.engine"):
            assert logging.getLogger(name).level == logging.WARNING

    def test_uvicorn_access_silenced(self):
        configure_logging()
        assert logging.getLogger("uvicorn.access").level == logging.WARNING
