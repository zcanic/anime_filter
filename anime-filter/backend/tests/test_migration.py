import csv
import pytest
import asyncio
from unittest.mock import patch
from backend.core.lifespan import _migrate_legacy_csv

def test_migration_from_csv(test_data_dir, db):
    """Test data migration from legacy CSV to SQLite."""
    # Setup legacy CSV
    csv_path = test_data_dir / "user_actions.csv"
    
    rows = [
        ["subject_id", "status", "timestamp"],
        ["101", "watched", "2023-01-01T00:00:00Z"],
        ["102", "interested", "2023-01-02T00:00:00Z"]
    ]
    
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    # Ensure DB is empty
    db.clear_all_actions()
    
    # Run migration logic (async)
    asyncio.run(_migrate_legacy_csv(db))
    
    # Verify DB content
    actions = db.get_all_actions()
    assert len(actions) == 2
    
    # Check specific values
    a1 = next(a for a in actions if a["subject_id"] == 101)
    
    assert a1["status"] == "watched"
    assert a1["marked_at"] == "2023-01-01T00:00:00Z"

    # Verify CSV is renamed
    assert not csv_path.exists()
    assert (test_data_dir / "user_actions.csv.migrated").exists()

def test_migration_skips_if_db_not_empty(test_data_dir, db):
    """Test migration is skipped if database already has data."""
    # Setup CSV
    csv_path = test_data_dir / "user_actions.csv"
    with open(csv_path, "w") as f:
        f.write("subject_id,status,timestamp\n1,watched,now")
        
    # Populate DB with some data
    db.save_user_action(999, "skipped", "now")
    
    asyncio.run(_migrate_legacy_csv(db))
    
    # Should NOT have migrated
    actions = db.get_all_actions()
    assert len(actions) == 1
    assert actions[0]["subject_id"] == 999
    
    # CSV should still exist (no rename)
    assert csv_path.exists()
