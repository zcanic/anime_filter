"""
AI router - placeholder for future ML features.
"""

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.ai_service import AIService


router = APIRouter()


class RecommendationRequest(BaseModel):
    """Recommendation request."""
    watched_ids: list[int] = []
    liked_ids: list[int] = []
    disliked_ids: list[int] = []
    limit: int = 10


@router.post("/recommend")
async def get_recommendations(request: RecommendationRequest):
    """Get AI recommendations (placeholder)."""
    service = AIService()
    result = await service.get_recommendations(
        watched_ids=request.watched_ids,
        liked_ids=request.liked_ids,
        disliked_ids=request.disliked_ids,
        limit=request.limit,
    )
    return result


@router.get("/models")
async def list_models():
    """List available models."""
    service = AIService()
    models = await service.list_models()
    return {"models": models}
