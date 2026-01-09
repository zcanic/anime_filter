"""
Health check router.
Provides endpoints for Rust to verify the sidecar is alive.
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    timestamp: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Called periodically by Tauri to verify the Python sidecar is running.
    Returns quickly to avoid blocking the Rust side.
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        version="0.2.0",
    )


@router.get("/ping")
async def ping() -> dict:
    """Simple ping endpoint for quick connectivity tests."""
    return {"pong": True}
