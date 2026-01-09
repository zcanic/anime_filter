from backend.db.database import Database

def test_singleton_pattern(db):
    """Ensure the database acts as a singleton."""
    # Enable singleton for this test
    original_setting = Database._singleton_enabled
    Database._singleton_enabled = True
    Database._instance = None  # Reset to ensure clean test

    try:
        # Create first instance
        db1 = Database()
        # Create second instance - should be the same
        db2 = Database()
        assert db1 is db2
        assert Database._instance is db1
    finally:
        Database._singleton_enabled = original_setting

def test_save_user_action(db):
    """Test saving a single action updates cache and stats."""
    db.save_user_action(1, "watched", "2024-01-01T10:00:00Z")
    
    # Check cache
    status = db.get_user_status(1)
    assert status is not None
    assert status["subject_id"] == 1
    assert status["status"] == "watched"
    assert status["marked_at"] == "2024-01-01T10:00:00Z"
    
    # Check stats
    stats = db.get_stats()
    assert stats["total_watched"] == 1
    assert stats["total_reviewed"] == 1

def test_update_user_action(db):
    """Test that adding a new action for the same ID updates current status."""
    # Action 1: Interested
    db.save_user_action(1, "interested", "2024-01-01T10:00:00Z")
    assert db.get_user_status(1)["status"] == "interested"
    
    # Action 2: Watched (Update)
    db.save_user_action(1, "watched", "2024-01-01T11:00:00Z")
    status = db.get_user_status(1)
    assert status["status"] == "watched"
    assert status["marked_at"] == "2024-01-01T11:00:00Z"
    
    # Verify both actions exist in log history
    actions = db.get_all_actions()
    assert len(actions) == 2
    assert actions[0]["status"] == "interested"
    assert actions[1]["status"] == "watched"

def test_delete_user_action_undo(db):
    """Test undo functionality (deleting latest action reverts status)."""
    # Sequence: Interested -> Watched
    db.save_user_action(1, "interested", "2024-01-01T10:00:00Z")
    db.save_user_action(1, "watched", "2024-01-01T11:00:00Z")
    
    assert db.get_user_status(1)["status"] == "watched"
    
    # Delete latest (watched)
    db.delete_user_action(1)
    
    # Should revert to interested
    status = db.get_user_status(1)
    assert status is not None
    assert status["status"] == "interested"
    assert status["marked_at"] == "2024-01-01T10:00:00Z"
    
    # Delete again (interested)
    db.delete_user_action(1)
    
    # Should be empty
    assert db.get_user_status(1) is None
    assert len(db.get_all_actions()) == 0

def test_batch_save(db):
    """Test saving multiple actions at once."""
    actions = [
        {"subject_id": 1, "status": "watched"},
        {"subject_id": 2, "status": "skipped"},
        {"subject_id": 3, "status": "interested"},
    ]
    db.save_user_actions_batch(actions)
    
    stats = db.get_stats()
    assert stats["total_watched"] == 1
    assert stats["total_skipped"] == 1
    assert stats["total_interested"] == 1
    assert stats["total_reviewed"] == 3
    
    assert db.is_reviewed(2) is True
    assert db.is_reviewed(4) is False

def test_load_cache_persistence(db):
    """Test that cache is correctly loaded from disk after restart."""
    # Save some data
    db.save_user_action(1, "watched", "2024-01-01T10:00:00Z")
    
    # Simulate restart: clear cache memory, reset loaded flag
    db._status_cache.clear()
    db._cache_loaded = False
    assert db.get_user_status(1) is None
    
    # Load cache from disk
    db.load_cache()
    
    status = db.get_user_status(1)
    assert status is not None
    assert status["status"] == "watched"

def test_get_status_by_type(db):
    db.save_user_action(1, "watched", "2024-01-01T10:00:00Z")
    db.save_user_action(2, "watched", "2024-01-01T10:00:00Z")
    db.save_user_action(3, "skipped", "2024-01-01T10:00:00Z")
    
    watched_ids = db.get_status_by_type("watched")
    assert set(watched_ids) == {1, 2}
    
    skipped_ids = db.get_status_by_type("skipped")
    assert set(skipped_ids) == {3}
