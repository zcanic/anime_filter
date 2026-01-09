#!/usr/bin/env python3
"""
AnimePick Python Sidecar - FastAPI Backend Entry Point

Startup Protocol:
1. Bind to port 0 (OS assigns random available port)
2. Print "SERVER_PORT:<port>" to stdout for Rust to capture
3. Initialize database and load cache
4. Wait for requests from Tauri

Usage:
    python main.py           # Production mode
    python main.py --dev     # Development mode with reload
"""

import sys
import socket
import signal
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from backend.core.config import settings
from backend.core.lifespan import startup_handler, shutdown_handler
from backend.core.logging import setup_logging
from backend.core.error_handlers import setup_error_handlers
from backend.routers import anime, ai, health


def find_free_port() -> int:
    """Find a free port by binding to port 0."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        s.listen(1)
        return s.getsockname()[1]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan context manager."""
    await startup_handler(app)
    yield
    await shutdown_handler(app)


# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.api_rate_limit])

def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="AnimePick Backend",
        description="AI-powered anime management service",
        version="0.2.0",
        lifespan=lifespan,
    )

    # CORS - Allow Tauri webview with security restrictions
    if settings.security_cors_enabled:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.api_cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE"],  # Only needed HTTP methods
            allow_headers=["Content-Type", "Accept", "Authorization"],  # Only needed headers
            expose_headers=["Content-Length", "X-Request-ID"],  # Expose custom headers
            max_age=600,  # Cache preflight requests for 10 minutes
        )

    # Configure rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Register routers with rate limiting
    app.include_router(health.router, tags=["Health"])
    app.include_router(anime.router, prefix="/api/anime", tags=["Anime"])
    app.include_router(ai.router, prefix="/api/ai", tags=["AI"])

    # Apply rate limiting to all routes
    # limiter.limit(settings.api_rate_limit)(app)  # Incorrect usage, default_limits handles this

    # Setup error handlers and middleware
    setup_error_handlers(app)

    return app


def main() -> None:
    """Main entry point."""
    dev_mode = "--dev" in sys.argv

    # Setup structured logging
    setup_logging(dev_mode=dev_mode)

    port = find_free_port()

    # === CRITICAL: Handshake signal for Rust ===
    print(f"SERVER_PORT:{port}", flush=True)

    import structlog
    logger = structlog.get_logger()
    logger.info(
        "backend_starting",
        port=port,
        dev_mode=dev_mode,
        host="127.0.0.1"
    )

    app = create_app()

    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",
        port=port,
        log_level="info" if dev_mode else "warning",
        access_log=dev_mode,
    )

    server = uvicorn.Server(config)

    # Graceful shutdown handler
    def shutdown(*_):
        print("[Backend] Shutting down...", file=sys.stderr)
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    asyncio.run(server.serve())


if __name__ == "__main__":
    main()
