"""Structured JSON logging configuration for the application."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

from app.core.request_context import request_id_var, user_id_var


class _JsonFormatter(logging.Formatter):
    """Emit one JSON object per log line with request context fields."""

    _SKIP = frozenset(
        {
            "msg",
            "args",
            "levelname",
            "levelno",
            "pathname",
            "filename",
            "module",
            "exc_info",
            "exc_text",
            "stack_info",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
            "name",
            "message",
            "taskName",
        }
    )

    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        log: dict = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.message,
            "request_id": request_id_var.get("-"),
            "user_id": user_id_var.get("-"),
        }
        # Attach any extra= fields the caller passed
        for key, value in record.__dict__.items():
            if key not in self._SKIP and not key.startswith("_"):
                log[key] = value

        if record.exc_info:
            log["exc"] = self.formatException(record.exc_info)

        return json.dumps(log, default=str, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Replace all root handlers with a single JSON stream handler."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Suppress uvicorn's own access log — our middleware covers it
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    # Reduce noise from httpx / sqlalchemy / httpcore
    for name in ("httpx", "httpcore", "sqlalchemy.engine"):
        logging.getLogger(name).setLevel(logging.WARNING)
