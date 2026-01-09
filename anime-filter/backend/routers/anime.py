"""
Anime router - REST API for anime operations.
All business logic delegated to AnimeService.
"""

from typing import Optional, Literal
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.services.anime_service import AnimeService


router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class UserAction(BaseModel):
    """User action input."""
    subject_id: int = Field(..., gt=0, description="Anime subject ID (must be positive)")
    status: Literal["watched", "interested", "skipped"] = Field(..., description="Status: watched, interested, or skipped")
    timestamp: Optional[str] = Field(None, description="ISO format timestamp")

    @field_validator('timestamp')
    @classmethod
    def validate_timestamp(cls, v):
        if v is None:
            return v
        # Basic ISO format validation
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
        except ValueError:
            raise ValueError('Timestamp must be in ISO format (e.g., "2024-01-01T10:00:00Z")')
        return v


class MarkRequest(BaseModel):
    """Mark anime request."""
    subject_id: int = Field(..., gt=0, description="Anime subject ID (must be positive)")
    status: Literal["watched", "interested", "skipped"] = Field(..., description="Status: watched, interested, or skipped")
    rating: Optional[int] = Field(None, ge=1, le=10, description="Rating from 1 to 10")

    @field_validator('rating')
    @classmethod
    def validate_rating(cls, v):
        if v is None:
            return v
        if v < 1 or v > 10:
            raise ValueError('Rating must be between 1 and 10')
        return v


class BatchMarkRequest(BaseModel):
    """Batch mark request."""
    subject_ids: list[int] = Field(..., min_length=1, max_length=1000, description="List of subject IDs (1 to 1000 items)")
    status: Literal["watched", "interested", "skipped"] = Field(..., description="Status: watched, interested, or skipped")

    @field_validator('subject_ids')
    @classmethod
    def validate_subject_ids(cls, v):
        if len(v) > 1000:
            raise ValueError('Maximum 1000 subject IDs allowed in batch operation')
        for subject_id in v:
            if subject_id <= 0:
                raise ValueError('Subject IDs must be positive integers')
        return v


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/list")
async def get_anime_list(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    tags: list[str] = Query(default=[], max_length=10),
    min_rating: Optional[float] = Query(None, ge=0.0, le=10.0),
    year_start: Optional[int] = Query(None, ge=1900, le=2100),
    year_end: Optional[int] = Query(None, ge=1900, le=2100),
    status_filter: Optional[Literal["watched", "interested", "skipped", "all"]] = None,
):
    """
    Get filtered anime list.

    Note: For now, anime data is loaded from CSV on the frontend.
    This endpoint is a placeholder for future server-side filtering.
    """
    # Validate year range
    if year_start and year_end and year_end < year_start:
        raise HTTPException(
            status_code=422,
            detail="year_end must be greater than or equal to year_start"
        )

    service = AnimeService()

    # Get reviewed IDs for filtering
    reviewed_ids = service.get_reviewed_ids()

    # If status filter is specified, get those IDs
    if status_filter and status_filter != "all":
        filtered_ids = service.get_ids_by_status(status_filter)
        return {
            "data": [],  # Frontend handles actual anime data
            "filtered_ids": filtered_ids,
            "reviewed_ids": list(reviewed_ids),
            "count": len(filtered_ids),
        }

    return {
        "data": [],  # Frontend handles actual anime data
        "reviewed_ids": list(reviewed_ids),
        "count": 0,
    }


@router.post("/mark")
async def mark_anime(request: MarkRequest):
    """Mark a single anime with status."""
    service = AnimeService()
    await service.mark_anime(
        subject_id=request.subject_id,
        status=request.status,
        rating=request.rating,
    )
    return {"success": True}


@router.post("/batch-mark")
async def batch_mark_anime(request: BatchMarkRequest):
    """Mark multiple anime with same status."""
    service = AnimeService()
    await service.batch_mark_anime(
        subject_ids=request.subject_ids,
        status=request.status,
    )
    return {"success": True, "count": len(request.subject_ids)}


@router.get("/user-status/{subject_id}")
async def get_user_status(subject_id: int):
    """Get current status for a specific anime."""
    service = AnimeService()
    status = await service.get_user_status(subject_id)
    return status or {"status": None}


@router.get("/user-logs")
async def get_all_user_logs():
    """Get all user action logs."""
    service = AnimeService()
    logs = await service.load_user_logs()
    return {"data": logs, "count": len(logs)}


@router.post("/user-logs")
async def save_user_logs(actions: list[UserAction]):
    """Save user action logs."""
    service = AnimeService()
    actions_dict = [a.model_dump() for a in actions]
    await service.save_user_logs(actions_dict)
    return {"success": True, "count": len(actions)}


@router.delete("/user-logs/{subject_id}")
async def delete_user_log(subject_id: int):
    """Delete latest action for a subject (undo)."""
    service = AnimeService()
    await service.delete_user_log(subject_id)
    return {"success": True}


@router.delete("/user-logs")
async def clear_all_user_logs():
    """Clear all user logs (reset)."""
    service = AnimeService()
    await service.clear_all_logs()
    return {"success": True}


@router.get("/stats")
async def get_stats():
    """Get statistics."""
    service = AnimeService()
    stats = await service.get_stats()
    return stats
