"""
Unified error handling middleware for AnimePick backend.

Features:
1. Global exception handler for all uncaught exceptions
2. Structured error responses with consistent format
3. Request ID tracking for error correlation
4. Structured logging of all errors
5. Custom error types for business logic errors
"""

import uuid
import traceback
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Union
from contextvars import ContextVar

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
import structlog

# Context variable for request ID (for correlation)
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)

# Initialize structured logger
logger = structlog.get_logger()


class ErrorResponse(BaseModel):
    """Standard error response format."""
    error: str
    detail: Optional[Union[str, Dict[str, Any]]] = None
    request_id: Optional[str] = None
    timestamp: str
    path: Optional[str] = None
    method: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "error": "validation_error",
                "detail": {"field": "subject_id", "msg": "must be positive integer"},
                "request_id": "req_1234567890",
                "timestamp": "2024-01-01T10:00:00Z",
                "path": "/api/anime/mark",
                "method": "POST"
            }
        }


class AnimePickError(Exception):
    """Base exception for AnimePick application errors."""
    def __init__(
        self,
        error_type: str,
        detail: Optional[Union[str, Dict[str, Any]]] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST
    ):
        self.error_type = error_type
        self.detail = detail
        self.status_code = status_code
        super().__init__(error_type)


class ValidationError(AnimePickError):
    """Validation error with specific field details."""
    def __init__(self, detail: Union[str, Dict[str, Any]]):
        super().__init__("validation_error", detail, status.HTTP_422_UNPROCESSABLE_CONTENT)


class NotFoundError(AnimePickError):
    """Resource not found error."""
    def __init__(self, detail: str):
        super().__init__("not_found", detail, status.HTTP_404_NOT_FOUND)


class RateLimitError(AnimePickError):
    """Rate limit exceeded error."""
    def __init__(self, detail: str):
        super().__init__("rate_limit_exceeded", detail, status.HTTP_429_TOO_MANY_REQUESTS)


class DatabaseError(AnimePickError):
    """Database operation error."""
    def __init__(self, detail: str):
        super().__init__("database_error", detail, status.HTTP_500_INTERNAL_SERVER_ERROR)


def get_request_id() -> str:
    """Get or generate request ID for current request."""
    request_id = request_id_var.get()
    if request_id is None:
        request_id = f"req_{uuid.uuid4().hex[:10]}"
        request_id_var.set(request_id)
    return request_id


def create_error_response(
    request: Request,
    error_type: str,
    detail: Optional[Union[str, Dict[str, Any]]] = None,
    status_code: int = status.HTTP_400_BAD_REQUEST
) -> JSONResponse:
    """Create standardized error response."""
    request_id = get_request_id()

    error_response = ErrorResponse(
        error=error_type,
        detail=detail,
        request_id=request_id,
        timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        path=request.url.path if request else None,
        method=request.method if request else None
    )

    # Log the error
    logger.error(
        "http_error",
        error_type=error_type,
        detail=detail,
        request_id=request_id,
        path=request.url.path if request else None,
        method=request.method if request else None,
        status_code=status_code,
        client_ip=request.client.host if request and request.client else None
    )

    return JSONResponse(
        status_code=status_code,
        content=error_response.model_dump()
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors."""
    # Format validation errors in a user-friendly way
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })

    return create_error_response(
        request,
        "validation_error",
        {"errors": errors} if errors else "Invalid request data",
        status.HTTP_422_UNPROCESSABLE_CONTENT
    )


async def animepick_error_handler(request: Request, exc: AnimePickError) -> JSONResponse:
    """Handle AnimePick application errors."""
    return create_error_response(
        request,
        exc.error_type,
        exc.detail,
        exc.status_code
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all other uncaught exceptions."""
    # Log the full traceback for debugging
    logger.error(
        "unhandled_exception",
        exception_type=type(exc).__name__,
        exception_message=str(exc),
        request_id=get_request_id(),
        path=request.url.path,
        method=request.method,
        traceback=traceback.format_exc()
    )

    # Don't expose internal details in production
    detail = "Internal server error"
    if isinstance(exc, ValueError):
        detail = str(exc)

    return create_error_response(
        request,
        "internal_server_error",
        detail,
        status.HTTP_500_INTERNAL_SERVER_ERROR
    )


from starlette.middleware.base import BaseHTTPMiddleware


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to add request ID to all requests."""

    async def dispatch(self, request: Request, call_next):
        # Generate request ID
        request_id = get_request_id()

        # Store in request state for easy access
        request.state.request_id = request_id

        # Add request ID to response headers
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        # Log request completion
        logger.info(
            "request_completed",
            request_id=request_id,
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            client_ip=request.client.host if request.client else None
        )

        return response


def setup_error_handlers(app: FastAPI) -> None:
    """Set up all error handlers for the FastAPI application."""

    # Add request ID middleware
    app.add_middleware(RequestIDMiddleware)

    # Register exception handlers
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(AnimePickError, animepick_error_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # Add custom error types to app state for easy access
    app.state.ErrorResponse = ErrorResponse
    app.state.AnimePickError = AnimePickError
    app.state.ValidationError = ValidationError
    app.state.NotFoundError = NotFoundError
    app.state.RateLimitError = RateLimitError
    app.state.DatabaseError = DatabaseError

    logger.info("error_handlers_initialized")