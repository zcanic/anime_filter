"""
Structured logging configuration for AnimePick backend.

Features:
1. Structured JSON logging in production
2. Human-readable console logging in development
3. Request ID correlation
4. Log level configuration
5. Async-safe logging
"""

import sys
import logging
from typing import Dict, Any

import structlog
from structlog.types import Processor, EventDict


def setup_logging(dev_mode: bool = False) -> None:
    """
    Configure structured logging for the application.

    Args:
        dev_mode: If True, use human-readable console logging.
                  If False, use structured JSON logging for production.
    """

    # Common processors for all environments
    processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.ExtraAdder(),
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
    ]

    if dev_mode:
        # Development: human-readable console output
        processors.extend([
            structlog.dev.ConsoleRenderer(colors=True)
        ])
    else:
        # Production: structured JSON output
        processors.extend([
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer()
        ])

    # Configure structlog
    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s" if dev_mode else "",
        stream=sys.stderr,
        level=logging.DEBUG if dev_mode else logging.INFO,
    )

    # Set log levels for third-party libraries
    logging.getLogger("uvicorn.access").setLevel(
        logging.DEBUG if dev_mode else logging.WARNING
    )
    logging.getLogger("uvicorn.error").setLevel(
        logging.DEBUG if dev_mode else logging.WARNING
    )
    logging.getLogger("sqlite3").setLevel(
        logging.WARNING if dev_mode else logging.ERROR
    )

    # Test logging
    logger = structlog.get_logger()
    logger.info(
        "logging_initialized",
        mode="development" if dev_mode else "production",
        log_level="DEBUG" if dev_mode else "INFO"
    )


def get_logger(name: str = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


# Convenience logger for immediate use
logger = get_logger(__name__)


class RequestContext:
    """Context manager for adding request context to logs."""

    def __init__(self, **context: Dict[str, Any]):
        self.context = context
        self.token = None

    def __enter__(self):
        self.token = structlog.contextvars.bind_contextvars(**self.context)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.token:
            structlog.contextvars.unbind_contextvars(self.token)

    @classmethod
    def with_request_context(cls, request_id: str, path: str, method: str, client_ip: str = None):
        """Create a request context with common fields."""
        context = {
            "request_id": request_id,
            "path": path,
            "method": method,
        }
        if client_ip:
            context["client_ip"] = client_ip
        return cls(**context)