"""
AI service - ML operations placeholder.
Will be implemented with actual models later.
"""

import time
from typing import Optional

from backend.core.config import settings


class AIService:
    """
    AI/ML service for recommendations and embeddings.
    Currently a placeholder - will use PyTorch/MLX when implemented.
    """

    def __init__(self):
        self.device = settings.model_device

    async def get_recommendations(
        self,
        watched_ids: list[int],
        liked_ids: list[int],
        disliked_ids: list[int],
        limit: int = 10,
    ) -> dict:
        """
        Get AI-powered anime recommendations.
        TODO: Implement with actual model.
        """
        start_time = time.time()

        # Placeholder - returns empty recommendations
        recommendations = []

        inference_time = (time.time() - start_time) * 1000

        return {
            "recommendations": recommendations,
            "model": "placeholder",
            "inference_time_ms": inference_time,
        }

    async def generate_embeddings(
        self,
        texts: list[str],
        model: Optional[str] = None,
    ) -> dict:
        """Generate vector embeddings."""
        # Placeholder
        return {
            "embeddings": [[0.0] * 384 for _ in texts],
            "dimensions": 384,
            "model": model or settings.embedding_model,
        }

    async def find_similar(self, anime_id: int, limit: int = 10) -> list[dict]:
        """Find similar anime by ID."""
        # Placeholder
        return []

    async def list_models(self) -> list[dict]:
        """List available models."""
        return [
            {"name": settings.embedding_model, "type": "embedding", "loaded": False},
        ]
