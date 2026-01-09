"""
Anime service - business logic layer.
All data operations go through the database singleton.
"""

from datetime import datetime, timezone
from typing import Optional
from backend.db import db


class AnimeService:
    """
    Service for anime-related operations.
    Uses the database singleton for all persistence.
    """

    def __init__(self):
        self._db = db

    # =========================================================================
    # User Action Operations
    # =========================================================================

    async def save_user_logs(self, actions: list[dict]) -> None:
        """Save multiple user actions."""
        processed = []
        for action in actions:
            processed.append({
                "subject_id": action.get("subject_id"),
                "status": action.get("status"),
                "timestamp": action.get("timestamp") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            })

        self._db.save_user_actions_batch(processed)

    async def load_user_logs(self) -> list[dict]:
        """Load all user action logs."""
        return self._db.get_all_actions()

    async def delete_user_log(self, subject_id: int) -> None:
        """Delete the latest action for a subject (undo)."""
        self._db.delete_user_action(subject_id)

    async def clear_all_logs(self) -> None:
        """Clear all user data."""
        self._db.clear_all_actions()

    # =========================================================================
    # Status Operations (from cache)
    # =========================================================================

    async def mark_anime(
        self,
        subject_id: int,
        status: str,
        rating: Optional[int] = None,
    ) -> None:
        """Mark a single anime with status."""
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        self._db.save_user_action(subject_id, status, timestamp)

    async def batch_mark_anime(
        self,
        subject_ids: list[int],
        status: str,
    ) -> None:
        """Mark multiple anime with same status."""
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        actions = [
            {"subject_id": sid, "status": status, "timestamp": timestamp}
            for sid in subject_ids
        ]
        self._db.save_user_actions_batch(actions)

    async def get_user_status(self, subject_id: int) -> Optional[dict]:
        """Get current status for a single anime."""
        return self._db.get_user_status(subject_id)

    async def get_all_user_status(self) -> list[dict]:
        """Get all current statuses."""
        return self._db.get_all_user_status()

    async def get_stats(self) -> dict:
        """Get statistics."""
        return self._db.get_stats()

    # =========================================================================
    # Filtering Helpers
    # =========================================================================

    def get_reviewed_ids(self) -> set[int]:
        """Get set of all reviewed anime IDs (for filtering)."""
        return set(self._db._status_cache.keys())

    def get_ids_by_status(self, status: str) -> list[int]:
        """Get all IDs with a specific status."""
        return self._db.get_status_by_type(status)

    def is_reviewed(self, subject_id: int) -> bool:
        """Check if anime has been reviewed."""
        return self._db.is_reviewed(subject_id)
