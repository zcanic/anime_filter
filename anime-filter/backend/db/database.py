"""
Database service for AnimePick.
Uses SQLite with in-memory caching for high performance.

Architecture:
- SQLite for persistence (user actions, anime metadata cache)
- In-memory cache for frequently accessed data
- Async-safe with connection pooling
"""

import os
import sqlite3
import threading
from collections import OrderedDict
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from contextlib import contextmanager

from backend.core.config import settings


class LRUCache:
    """Simple LRU cache with size limit and statistics."""

    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self.cache: OrderedDict[int, Dict[str, Any]] = OrderedDict()
        self.hits = 0
        self.misses = 0

    def __contains__(self, key: int) -> bool:
        return key in self.cache

    def __getitem__(self, key: int) -> Dict[str, Any]:
        """Get item using subscript notation."""
        if key in self.cache:
            self.cache.move_to_end(key)
            self.hits += 1
            return self.cache[key]
        self.misses += 1
        raise KeyError(key)

    def __len__(self) -> int:
        return len(self.cache)

    def get(self, key: int) -> Optional[Dict[str, Any]]:
        """Get item from cache, update usage order."""
        if key in self.cache:
            self.cache.move_to_end(key)
            self.hits += 1
            return self.cache[key]
        self.misses += 1
        return None

    def put(self, key: int, value: Dict[str, Any]) -> None:
        """Put item in cache, evict LRU if full."""
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value

        # Evict least recently used if over limit
        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)

    def delete(self, key: int) -> bool:
        """Delete item from cache."""
        if key in self.cache:
            del self.cache[key]
            return True
        return False

    def clear(self) -> None:
        """Clear all items from cache."""
        self.cache.clear()
        self.hits = 0
        self.misses = 0

    def values(self):
        """Get all cached values."""
        return self.cache.values()

    def keys(self):
        """Get all cached keys."""
        return self.cache.keys()

    def items(self):
        """Get all cached items (key-value pairs)."""
        return self.cache.items()

    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total = self.hits + self.misses
        hit_rate = self.hits / total if total > 0 else 0.0
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate,
            "usage_percent": (len(self.cache) / self.max_size) * 100 if self.max_size > 0 else 0.0
        }


class Database:
    """
    SQLite database with thread-safe connection pooling.
    Data is loaded into memory at startup for fast access.
    """

    _instance: Optional["Database"] = None
    _lock = threading.Lock()
    _singleton_enabled: bool = True  # Can be disabled for testing

    def __new__(cls):
        """Singleton pattern for database instance."""
        if not cls._singleton_enabled:
            # In test mode, always create new instance
            instance = super().__new__(cls)
            instance._initialized = False
            return instance

        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        # Import settings module dynamically to pick up patches on the module object
        import backend.core.config
        current_settings = backend.core.config.settings

        # print(f"DEBUG: Database init. current_settings.app_data_dir={current_settings.app_data_dir}")
        self.db_path = current_settings.database_path
        # print(f"[Database] DEBUG: Initializing at {self.db_path}")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # Thread-local storage for connections
        self._local = threading.local()

        # Initialize database schema
        self._init_schema()
        
        # CLOSE the initialization connection to avoid locking issues in tests
        # or stepping on toes of other threads immediately.
        if hasattr(self._local, "conn") and self._local.conn:
            self._local.conn.close()
            self._local.conn = None

        # In-memory cache with LRU eviction
        self._status_cache = LRUCache(max_size=settings.cache_max_size)
        self._cache_loaded = False

        self._initialized = True
        print(f"[Database] Initialized at {self.db_path}")

    @contextmanager
    def _get_connection(self):
        """Get a thread-local database connection."""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            try:
                # print(f"[Database] DEBUG: Connecting in thread {threading.get_ident()}")
                self._local.conn = sqlite3.connect(
                    str(self.db_path),
                    check_same_thread=False,
                    timeout=settings.database_timeout_seconds,
                )
                self._local.conn.row_factory = sqlite3.Row
                
                # Enable WAL mode for better concurrent performance
                # But wrap in try-except in case of file system limitations
                try:
                    self._local.conn.execute("PRAGMA journal_mode=WAL")
                    self._local.conn.execute("PRAGMA synchronous=NORMAL")
                except Exception as e:
                    print(f"[Database] WAL Warning: {e}")
                    
            except sqlite3.OperationalError as e:
                print(f"[Database] FATAL CONNECT ERROR: {e}")
                print(f"  Path: {self.db_path}")
                print(f"  Parent Exists: {self.db_path.parent.exists()}")
                try:
                    print(f"  Dir Contents: {os.listdir(self.db_path.parent)}")
                except:
                    pass
                raise

        try:
            yield self._local.conn
        except Exception:
            self._local.conn.rollback()
            raise

    def _init_schema(self):
        """Initialize database tables."""
        with self._get_connection() as conn:
            # User action logs (append-only)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
            """)

            # Current status view (derived from actions)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_status (
                    subject_id INTEGER PRIMARY KEY,
                    status TEXT NOT NULL,
                    rating INTEGER,
                    marked_at TEXT NOT NULL
                )
            """)

            # Indexes
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_actions_subject ON user_actions(subject_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_status_status ON user_status(status)"
            )

            conn.commit()

    def load_cache(self):
        """Load all user statuses into memory cache."""
        if self._cache_loaded:
            return

        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT subject_id, status, rating, marked_at FROM user_status"
            )
            for row in cursor:
                self._status_cache.put(row["subject_id"], {
                    "subject_id": row["subject_id"],
                    "status": row["status"],
                    "rating": row["rating"],
                    "marked_at": row["marked_at"],
                })

        self._cache_loaded = True
        print(f"[Database] Loaded {len(self._status_cache)} statuses into cache")

    # =========================================================================
    # User Actions (append-only log)
    # =========================================================================

    def save_user_action(self, subject_id: int, status: str, timestamp: str):
        """
        Save a single user action and update status cache.
        This is the primary write operation.
        """
        with self._get_connection() as conn:
            # Append to log
            conn.execute(
                "INSERT INTO user_actions (subject_id, status, timestamp) VALUES (?, ?, ?)",
                (subject_id, status, timestamp),
            )

            # Update current status
            conn.execute(
                """
                INSERT OR REPLACE INTO user_status (subject_id, status, rating, marked_at)
                VALUES (?, ?, NULL, ?)
                """,
                (subject_id, status, timestamp),
            )
            conn.commit()

        # Update cache
        self._status_cache.put(subject_id, {
            "subject_id": subject_id,
            "status": status,
            "rating": None,
            "marked_at": timestamp,
        })

    def save_user_actions_batch(self, actions: list[dict]):
        """Batch save multiple actions efficiently."""
        if not actions:
            return

        timestamp = datetime.now().isoformat() + "Z"

        with self._get_connection() as conn:
            for action in actions:
                ts = action.get("timestamp") or timestamp
                conn.execute(
                    "INSERT INTO user_actions (subject_id, status, timestamp) VALUES (?, ?, ?)",
                    (action["subject_id"], action["status"], ts),
                )
                conn.execute(
                    """
                    INSERT OR REPLACE INTO user_status (subject_id, status, rating, marked_at)
                    VALUES (?, ?, NULL, ?)
                    """,
                    (action["subject_id"], action["status"], ts),
                )

                # Update cache
                self._status_cache.put(action["subject_id"], {
                    "subject_id": action["subject_id"],
                    "status": action["status"],
                    "rating": None,
                    "marked_at": ts,
                })

            conn.commit()

    def get_all_actions(self) -> list[dict]:
        """Get all user actions (log format)."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT subject_id, status, timestamp FROM user_actions ORDER BY id"
            )
            return [
                {
                    "subject_id": row["subject_id"],
                    "status": row["status"],
                    "marked_at": row["timestamp"],
                }
                for row in cursor
            ]

    def delete_user_action(self, subject_id: int):
        """
        Delete the latest action for a subject (undo).
        Also recalculates the current status.
        """
        with self._get_connection() as conn:
            # Delete the latest action
            conn.execute(
                """
                DELETE FROM user_actions WHERE id = (
                    SELECT id FROM user_actions 
                    WHERE subject_id = ? 
                    ORDER BY id DESC LIMIT 1
                )
                """,
                (subject_id,),
            )

            # Recalculate current status from remaining actions
            cursor = conn.execute(
                """
                SELECT status, timestamp FROM user_actions 
                WHERE subject_id = ? 
                ORDER BY id DESC LIMIT 1
                """,
                (subject_id,),
            )
            row = cursor.fetchone()

            if row:
                # Update to previous status
                conn.execute(
                    """
                    INSERT OR REPLACE INTO user_status (subject_id, status, rating, marked_at)
                    VALUES (?, ?, NULL, ?)
                    """,
                    (subject_id, row["status"], row["timestamp"]),
                )
                self._status_cache.put(subject_id, {
                    "subject_id": subject_id,
                    "status": row["status"],
                    "rating": None,
                    "marked_at": row["timestamp"],
                })
            else:
                # No more actions, remove status
                conn.execute(
                    "DELETE FROM user_status WHERE subject_id = ?", (subject_id,)
                )
                self._status_cache.delete(subject_id)

            conn.commit()

    def clear_all_actions(self):
        """Clear all user data (reset)."""
        with self._get_connection() as conn:
            conn.execute("DELETE FROM user_actions")
            conn.execute("DELETE FROM user_status")
            conn.commit()

        self._status_cache.clear()

    # =========================================================================
    # User Status (current state, from cache)
    # =========================================================================

    def get_user_status(self, subject_id: int) -> Optional[dict]:
        """Get current status for a single anime (from cache)."""
        return self._status_cache.get(subject_id)

    def get_all_user_status(self) -> list[dict]:
        """Get all current statuses (from cache)."""
        return list(self._status_cache.values())

    def get_status_by_type(self, status: str) -> list[int]:
        """Get all subject IDs with a specific status (from cache)."""
        return [
            sid
            for sid, data in self._status_cache.items()
            if data["status"] == status
        ]

    def get_stats(self) -> dict:
        """Get statistics (from cache)."""
        stats = {"watched": 0, "interested": 0, "skipped": 0}
        for data in self._status_cache.values():
            status = data["status"]
            if status in stats:
                stats[status] += 1

        return {
            "total_watched": stats["watched"],
            "total_interested": stats["interested"],
            "total_skipped": stats["skipped"],
            "total_reviewed": sum(stats.values()),
        }

    def is_reviewed(self, subject_id: int) -> bool:
        """Check if anime has been reviewed (from cache)."""
        return subject_id in self._status_cache

    def get_cache_stats(self) -> dict:
        """Get cache statistics for monitoring."""
        return self._status_cache.stats()


# Singleton instance
# Only create if not in test mode
import sys
if "pytest" not in sys.modules:
    db = Database()
else:
    db = None  # Will be set by test fixtures
