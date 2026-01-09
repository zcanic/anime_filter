"""Core module exports."""

from .config import settings, get_settings
from .lifespan import startup_handler, shutdown_handler

__all__ = ["settings", "get_settings", "startup_handler", "shutdown_handler"]
