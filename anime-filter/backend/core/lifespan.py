"""
Application lifespan handlers.
Initializes database and loads cache at startup.
"""

import sys
from pathlib import Path
from fastapi import FastAPI

from backend.core.config import settings


async def startup_handler(app: FastAPI) -> None:
    """
    Called when the application starts.
    - Ensure data directory exists
    - Initialize database
    - Load status cache into memory
    - Migrate legacy CSV if exists
    """
    print(f"[Startup] {settings.app_name}", file=sys.stderr)
    print(f"[Startup] Data dir: {settings.app_data_dir}", file=sys.stderr)

    # Ensure directory exists
    settings.app_data_dir.mkdir(parents=True, exist_ok=True)

    # Use existing db from app.state if already set (e.g., in tests)
    # Otherwise import the singleton instance
    if not hasattr(app.state, 'db') or app.state.db is None:
        from backend.db import db
        # Store in app state for access in routes
        app.state.db = db
    else:
        # Use the already set db instance (from tests)
        db = app.state.db

    # Migrate legacy CSV if it exists and DB is empty
    await _migrate_legacy_csv(db)

    # Load all statuses into memory (if not already loaded)
    if not db._cache_loaded:
        db.load_cache()

    app.state.settings = settings

    print(f"[Startup] Ready!", file=sys.stderr)


async def shutdown_handler(app: FastAPI) -> None:
    """Called when application shuts down."""
    print(f"[Shutdown] {settings.app_name}", file=sys.stderr)


async def _migrate_legacy_csv(db) -> None:
    """
    Migrate data from legacy user_actions.csv to SQLite.
    Only runs if CSV exists and DB is empty.
    Uses streaming and batching to handle large files efficiently.
    """
    csv_path = settings.user_actions_csv

    if not csv_path.exists():
        return

    # Check if DB already has data
    existing = db.get_all_user_status()
    if existing:
        print(f"[Migration] DB has {len(existing)} records, skipping CSV migration", file=sys.stderr)
        return

    print(f"[Migration] Migrating from {csv_path}", file=sys.stderr)

    try:
        import csv
        import time
        from datetime import datetime

        start_time = time.time()
        total_rows = 0
        valid_rows = 0
        batch_size = 1000  # Process in batches to manage memory
        current_batch = []

        with open(csv_path, "r", encoding="utf-8") as f:
            # Estimate total rows (excluding header)
            line_count = sum(1 for _ in f)
            f.seek(0)
            total_estimated = line_count - 1  # Subtract header

            # Create CSV reader
            reader = csv.DictReader(f)

            print(f"[Migration] Estimated {total_estimated:,} rows to migrate", file=sys.stderr)

            for row_num, row in enumerate(reader, 1):
                total_rows += 1

                try:
                    # Validate and convert data
                    subject_id = int(row.get("subject_id", 0))
                    status = str(row.get("status", "")).strip()
                    timestamp = str(row.get("timestamp", "")).strip()

                    # Skip invalid data
                    if subject_id <= 0 or not status or not timestamp:
                        print(f"[Migration] Warning: Skipping invalid row {row_num}: {row}", file=sys.stderr)
                        continue

                    # Validate timestamp format (basic check)
                    if not timestamp.endswith("Z"):
                        # Try to add Z if missing
                        if "T" in timestamp:
                            timestamp = timestamp + "Z"

                    current_batch.append({
                        "subject_id": subject_id,
                        "status": status,
                        "timestamp": timestamp,
                    })
                    valid_rows += 1

                    # Process batch when full
                    if len(current_batch) >= batch_size:
                        db.save_user_actions_batch(current_batch)

                        # Progress report every 10,000 rows
                        if valid_rows % 10000 == 0:
                            elapsed = time.time() - start_time
                            rate = valid_rows / elapsed if elapsed > 0 else 0
                            print(
                                f"[Migration] Progress: {valid_rows:,} rows migrated "
                                f"({rate:.1f} rows/sec)",
                                file=sys.stderr
                            )

                        current_batch = []

                except (ValueError, KeyError) as e:
                    print(f"[Migration] Warning: Error in row {row_num}: {e}, data: {row}", file=sys.stderr)
                    continue

        # Process remaining batch
        if current_batch:
            db.save_user_actions_batch(current_batch)

        # Final statistics
        elapsed_time = time.time() - start_time
        migration_rate = valid_rows / elapsed_time if elapsed_time > 0 else 0

        print(
            f"[Migration] Completed: {valid_rows:,} of {total_rows:,} rows migrated "
            f"in {elapsed_time:.2f} seconds ({migration_rate:.1f} rows/sec)",
            file=sys.stderr
        )

        if valid_rows > 0:
            # Optionally rename old CSV
            backup_path = csv_path.with_suffix(".csv.migrated")
            try:
                csv_path.rename(backup_path)
                print(f"[Migration] Renamed CSV to {backup_path}", file=sys.stderr)
            except Exception as rename_error:
                print(f"[Migration] Warning: Could not rename CSV: {rename_error}", file=sys.stderr)

        # Verify migration integrity
        db_records = len(db.get_all_user_status())
        print(f"[Migration] Database now has {db_records:,} records", file=sys.stderr)

        if db_records != valid_rows:
            print(
                f"[Migration] Warning: Record count mismatch. "
                f"Migrated {valid_rows:,} rows, but DB has {db_records:,} records.",
                file=sys.stderr
            )

    except Exception as e:
        print(f"[Migration] Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
