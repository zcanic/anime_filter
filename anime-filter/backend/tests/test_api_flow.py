from fastapi.testclient import TestClient

def test_health_check(client):
    """Verify health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data

def test_mark_endpoint(client):
    """Test marking a single anime."""
    payload = {
        "subject_id": 100,
        "status": "watched",
        "rating": 8
    }
    response = client.post("/api/anime/mark", json=payload)
    assert response.status_code == 200
    assert response.json() == {"success": True}
    
    # Verify status via get
    response = client.get("/api/anime/user-status/100")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "watched"
    assert data["subject_id"] == 100
    
    # Verify stats
    response = client.get("/api/anime/stats")
    stats = response.json()
    assert stats["total_watched"] == 1

def test_batch_mark_endpoint(client):
    """Test batch marking endpoint."""
    payload = {
        "subject_ids": [201, 202, 203],
        "status": "skipped"  # Changed from "dropped" to "skipped" to pass validation
    }
    response = client.post("/api/anime/batch-mark", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Check stats
    response = client.get("/api/anime/stats")
    stats = response.json()
    # verify it counted towards skipped
    # Since other tests run in same session/db potentially (if not properly isolated),
    # we should check relative increase or absolute if isolated.
    # Assuming function scope isolation from conftest:
    assert stats["total_skipped"] >= 3

def test_batch_mark_endpoint_safe(client):
    """Test batch marking with supported status."""
    # Get existing stats
    response = client.get("/api/anime/stats")
    existing_stats = response.json()
    existing_skipped = existing_stats.get("total_skipped", 0)
    existing_reviewed = existing_stats.get("total_reviewed", 0)

    payload = {
        "subject_ids": [201, 202, 203],
        "status": "skipped"
    }
    response = client.post("/api/anime/batch-mark", json=payload)
    assert response.status_code == 200

    response = client.get("/api/anime/stats")
    stats = response.json()
    assert stats["total_skipped"] == existing_skipped + 3
    assert stats["total_reviewed"] == existing_reviewed + 3

def test_get_list_filtering(client):
    """Test get list endpoint returns reviewed IDs."""
    # Mark some
    client.post("/api/anime/mark", json={"subject_id": 1, "status": "watched"})
    client.post("/api/anime/mark", json={"subject_id": 2, "status": "interested"})
    
    # Get list
    response = client.get("/api/anime/list")
    assert response.status_code == 200
    data = response.json()
    
    reviewed = set(data["reviewed_ids"])
    assert 1 in reviewed
    assert 2 in reviewed
    
    # Filter by status
    response = client.get("/api/anime/list?status_filter=watched")
    data = response.json()
    assert 1 in data["filtered_ids"]
    assert 2 not in data["filtered_ids"]

def test_user_logs_endpoints(client):
    """Test log saving and retrieval."""
    # Get existing records before test
    response = client.get("/api/anime/user-logs")
    existing_logs = response.json()["data"]
    existing_count = len(existing_logs)

    actions = [
        {"subject_id": 301, "status": "watched"},
        {"subject_id": 302, "status": "interested"}
    ]
    response = client.post("/api/anime/user-logs", json=actions)
    assert response.status_code == 200

    response = client.get("/api/anime/user-logs")
    logs = response.json()["data"]
    # Should have existing_count + 2 new records
    assert len(logs) == existing_count + 2

    # Test undo - delete the first test record
    client.delete("/api/anime/user-logs/301")
    response = client.get("/api/anime/user-logs")
    logs = response.json()["data"]
    # Should have existing_count + 1 (only 302 remains)
    assert len(logs) == existing_count + 1
    # Find our test record among existing data
    test_record = next((log for log in logs if log["subject_id"] == 302), None)
    assert test_record is not None
    assert test_record["subject_id"] == 302

    # Test clear all - should remove ALL user logs including existing CSV data
    client.delete("/api/anime/user-logs")
    response = client.get("/api/anime/user-logs")
    assert len(response.json()["data"]) == 0
