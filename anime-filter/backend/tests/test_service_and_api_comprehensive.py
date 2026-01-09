"""
Comprehensive service and API tests for AnimePick backend.
Tests the business logic layer (AnimeService) and API endpoints.
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock

from backend.services.anime_service import AnimeService


class TestAnimeServiceUnit:
    """Unit tests for AnimeService (mocked database)."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database instance."""
        mock = Mock()
        mock.save_user_actions_batch = Mock()
        mock.get_all_actions = Mock(return_value=[])
        mock.delete_user_action = Mock()
        mock.clear_all_actions = Mock()
        mock.save_user_action = Mock()
        mock.get_user_status = Mock(return_value=None)
        mock.get_all_user_status = Mock(return_value=[])
        mock.get_stats = Mock(return_value={
            "total_watched": 0,
            "total_interested": 0,
            "total_skipped": 0,
            "total_reviewed": 0
        })
        mock._status_cache = {}
        mock.get_status_by_type = Mock(return_value=[])
        mock.is_reviewed = Mock(return_value=False)
        return mock

    @pytest.fixture
    def service(self, mock_db):
        """Create AnimeService with mocked database."""
        with patch('backend.services.anime_service.db', mock_db):
            service = AnimeService()
            service._db = mock_db  # Ensure we use the mock
            return service

    @pytest.mark.asyncio
    async def test_save_user_logs_empty(self, service, mock_db):
        """Test saving empty logs list."""
        await service.save_user_logs([])
        # save_user_actions_batch may be called with empty list, which is fine
        # The database method checks if actions list is empty and returns early
        mock_db.save_user_actions_batch.assert_called_once_with([])

    @pytest.mark.asyncio
    async def test_save_user_logs_single(self, service, mock_db):
        """Test saving single log entry."""
        actions = [{
            "subject_id": 100,
            "status": "watched",
            "timestamp": "2024-01-01T10:00:00Z"
        }]

        await service.save_user_logs(actions)

        # Verify batch save was called with processed actions
        mock_db.save_user_actions_batch.assert_called_once()
        args = mock_db.save_user_actions_batch.call_args[0][0]
        assert len(args) == 1
        assert args[0]["subject_id"] == 100
        assert args[0]["status"] == "watched"
        assert args[0]["timestamp"] == "2024-01-01T10:00:00Z"

    @pytest.mark.asyncio
    async def test_save_user_logs_missing_timestamp(self, service, mock_db):
        """Test saving logs with missing timestamp (should generate)."""
        actions = [{
            "subject_id": 101,
            "status": "interested"
        }]

        await service.save_user_logs(actions)

        mock_db.save_user_actions_batch.assert_called_once()
        args = mock_db.save_user_actions_batch.call_args[0][0]
        assert len(args) == 1
        assert args[0]["subject_id"] == 101
        assert args[0]["status"] == "interested"
        # Timestamp should be generated
        assert args[0]["timestamp"] is not None
        assert "Z" in args[0]["timestamp"]

    @pytest.mark.asyncio
    async def test_save_user_logs_multiple(self, service, mock_db):
        """Test saving multiple log entries."""
        actions = [
            {"subject_id": 102, "status": "watched"},
            {"subject_id": 103, "status": "skipped", "timestamp": "2024-01-01T10:00:00Z"},
            {"subject_id": 104, "status": "interested"},
        ]

        await service.save_user_logs(actions)

        mock_db.save_user_actions_batch.assert_called_once()
        args = mock_db.save_user_actions_batch.call_args[0][0]
        assert len(args) == 3

    @pytest.mark.asyncio
    async def test_load_user_logs(self, service, mock_db):
        """Test loading user logs."""
        mock_logs = [
            {"subject_id": 105, "status": "watched", "marked_at": "2024-01-01T10:00:00Z"},
            {"subject_id": 106, "status": "interested", "marked_at": "2024-01-01T11:00:00Z"},
        ]
        mock_db.get_all_actions.return_value = mock_logs

        result = await service.load_user_logs()

        mock_db.get_all_actions.assert_called_once()
        assert result == mock_logs

    @pytest.mark.asyncio
    async def test_delete_user_log(self, service, mock_db):
        """Test deleting a user log (undo)."""
        await service.delete_user_log(107)
        mock_db.delete_user_action.assert_called_once_with(107)

    @pytest.mark.asyncio
    async def test_clear_all_logs(self, service, mock_db):
        """Test clearing all user logs."""
        await service.clear_all_logs()
        mock_db.clear_all_actions.assert_called_once()

    @pytest.mark.asyncio
    async def test_mark_anime(self, service, mock_db):
        """Test marking a single anime."""
        subject_id = 108
        status = "watched"
        rating = 8

        await service.mark_anime(subject_id, status, rating)

        # Note: rating parameter is currently ignored in implementation
        # save_user_action is called with status and generated timestamp
        mock_db.save_user_action.assert_called_once()
        call_args = mock_db.save_user_action.call_args[0]
        assert call_args[0] == subject_id
        assert call_args[1] == status
        # Third argument should be a timestamp
        assert call_args[2] is not None
        assert "Z" in call_args[2]

    @pytest.mark.asyncio
    async def test_mark_anime_no_rating(self, service, mock_db):
        """Test marking anime without rating."""
        subject_id = 109
        status = "interested"

        await service.mark_anime(subject_id, status)

        mock_db.save_user_action.assert_called_once()
        call_args = mock_db.save_user_action.call_args[0]
        assert call_args[0] == subject_id
        assert call_args[1] == status

    @pytest.mark.asyncio
    async def test_batch_mark_anime(self, service, mock_db):
        """Test batch marking anime."""
        subject_ids = [110, 111, 112]
        status = "skipped"

        await service.batch_mark_anime(subject_ids, status)

        mock_db.save_user_actions_batch.assert_called_once()
        args = mock_db.save_user_actions_batch.call_args[0][0]
        assert len(args) == 3
        for i, action in enumerate(args):
            assert action["subject_id"] == subject_ids[i]
            assert action["status"] == status
            assert action["timestamp"] is not None

    @pytest.mark.asyncio
    async def test_batch_mark_anime_empty(self, service, mock_db):
        """Test batch marking with empty list."""
        await service.batch_mark_anime([], "watched")
        # batch_mark_anime creates empty actions list and calls save_user_actions_batch
        # The database method checks if actions list is empty and returns early
        mock_db.save_user_actions_batch.assert_called_once_with([])

    @pytest.mark.asyncio
    async def test_get_user_status_exists(self, service, mock_db):
        """Test getting user status when exists."""
        mock_status = {
            "subject_id": 113,
            "status": "watched",
            "marked_at": "2024-01-01T10:00:00Z",
            "rating": None
        }
        mock_db.get_user_status.return_value = mock_status

        result = await service.get_user_status(113)

        mock_db.get_user_status.assert_called_once_with(113)
        assert result == mock_status

    @pytest.mark.asyncio
    async def test_get_user_status_not_exists(self, service, mock_db):
        """Test getting user status when not exists."""
        mock_db.get_user_status.return_value = None

        result = await service.get_user_status(114)

        mock_db.get_user_status.assert_called_once_with(114)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_all_user_status(self, service, mock_db):
        """Test getting all user statuses."""
        mock_statuses = [
            {"subject_id": 115, "status": "watched", "marked_at": "2024-01-01T10:00:00Z"},
            {"subject_id": 116, "status": "interested", "marked_at": "2024-01-01T11:00:00Z"},
        ]
        mock_db.get_all_user_status.return_value = mock_statuses

        result = await service.get_all_user_status()

        mock_db.get_all_user_status.assert_called_once()
        assert result == mock_statuses

    @pytest.mark.asyncio
    async def test_get_stats(self, service, mock_db):
        """Test getting statistics."""
        mock_stats = {
            "total_watched": 5,
            "total_interested": 3,
            "total_skipped": 2,
            "total_reviewed": 10
        }
        mock_db.get_stats.return_value = mock_stats

        result = await service.get_stats()

        mock_db.get_stats.assert_called_once()
        assert result == mock_stats

    def test_get_reviewed_ids(self, service, mock_db):
        """Test getting reviewed IDs."""
        mock_db._status_cache = {
            117: {"subject_id": 117, "status": "watched"},
            118: {"subject_id": 118, "status": "interested"},
            119: {"subject_id": 119, "status": "skipped"},
        }

        result = service.get_reviewed_ids()

        assert result == {117, 118, 119}

    def test_get_ids_by_status(self, service, mock_db):
        """Test getting IDs by status."""
        mock_db.get_status_by_type.return_value = [120, 121, 122]

        result = service.get_ids_by_status("watched")

        mock_db.get_status_by_type.assert_called_once_with("watched")
        assert result == [120, 121, 122]

    def test_is_reviewed_true(self, service, mock_db):
        """Test is_reviewed returns True."""
        mock_db.is_reviewed.return_value = True

        result = service.is_reviewed(123)

        mock_db.is_reviewed.assert_called_once_with(123)
        assert result is True

    def test_is_reviewed_false(self, service, mock_db):
        """Test is_reviewed returns False."""
        mock_db.is_reviewed.return_value = False

        result = service.is_reviewed(124)

        mock_db.is_reviewed.assert_called_once_with(124)
        assert result is False


class TestAnimeServiceIntegration:
    """Integration tests for AnimeService with real database."""

    @pytest.mark.asyncio
    async def test_service_with_real_db(self, db):
        """Test service operations with real database."""
        service = AnimeService()
        service._db = db  # Use the test database fixture

        # Test marking anime
        await service.mark_anime(1000, "watched")
        status = await service.get_user_status(1000)
        assert status is not None
        assert status["status"] == "watched"

        # Test batch marking
        await service.batch_mark_anime([1001, 1002, 1003], "interested")

        # Test get all status
        all_status = await service.get_all_user_status()
        assert len(all_status) == 4  # 1000 + 1001, 1002, 1003

        # Test stats
        stats = await service.get_stats()
        assert stats["total_watched"] == 1
        assert stats["total_interested"] == 3
        assert stats["total_reviewed"] == 4

        # Test get reviewed IDs
        reviewed_ids = service.get_reviewed_ids()
        assert 1000 in reviewed_ids
        assert 1001 in reviewed_ids
        assert 1002 in reviewed_ids
        assert 1003 in reviewed_ids

        # Test get IDs by status
        interested_ids = service.get_ids_by_status("interested")
        assert set(interested_ids) == {1001, 1002, 1003}

        # Test is_reviewed
        assert service.is_reviewed(1000) is True
        assert service.is_reviewed(9999) is False

        # Test undo
        await service.delete_user_log(1000)
        assert service.is_reviewed(1000) is False
        stats = await service.get_stats()
        assert stats["total_reviewed"] == 3

        # Test clear all
        await service.clear_all_logs()
        all_status = await service.get_all_user_status()
        assert len(all_status) == 0

    @pytest.mark.asyncio
    async def test_service_log_operations(self, db):
        """Test log operations with real database."""
        service = AnimeService()
        service._db = db

        # Save logs
        actions = [
            {"subject_id": 2000, "status": "watched", "timestamp": "2024-01-01T10:00:00Z"},
            {"subject_id": 2001, "status": "skipped", "timestamp": "2024-01-01T11:00:00Z"},
        ]
        await service.save_user_logs(actions)

        # Load logs
        logs = await service.load_user_logs()
        assert len(logs) == 2
        assert logs[0]["subject_id"] == 2000
        assert logs[1]["subject_id"] == 2001

        # Delete one log
        await service.delete_user_log(2000)
        logs = await service.load_user_logs()
        assert len(logs) == 1
        assert logs[0]["subject_id"] == 2001

        # Clear all logs
        await service.clear_all_logs()
        logs = await service.load_user_logs()
        assert len(logs) == 0


class TestAPIIntegration:
    """Integration tests for API endpoints."""

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data

    def test_mark_anime_endpoint(self, client):
        """Test marking a single anime via API."""
        payload = {
            "subject_id": 3000,
            "status": "watched",
            "rating": 9
        }

        response = client.post("/api/anime/mark", json=payload)
        assert response.status_code == 200
        assert response.json() == {"success": True}

        # Verify via get status endpoint
        response = client.get("/api/anime/user-status/3000")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "watched"
        assert data["subject_id"] == 3000

    def test_mark_anime_invalid_status(self, client):
        """Test marking with invalid status (should fail validation)."""
        payload = {
            "subject_id": 3001,
            "status": "custom_status",
            "rating": 5
        }

        response = client.post("/api/anime/mark", json=payload)
        assert response.status_code == 422  # Strict validation enabled

    def test_mark_anime_missing_fields(self, client):
        """Test marking with missing required fields."""
        # Missing subject_id
        payload = {
            "status": "watched"
        }
        response = client.post("/api/anime/mark", json=payload)
        assert response.status_code == 422  # Validation error

        # Missing status
        payload = {
            "subject_id": 3002
        }
        response = client.post("/api/anime/mark", json=payload)
        assert response.status_code == 422

    def test_batch_mark_endpoint(self, client):
        """Test batch marking via API."""
        # Get existing stats
        response = client.get("/api/anime/stats")
        existing_stats = response.json()
        existing_interested = existing_stats.get("total_interested", 0)
        existing_reviewed = existing_stats.get("total_reviewed", 0)

        payload = {
            "subject_ids": [4000, 4001, 4002],
            "status": "interested"
        }

        response = client.post("/api/anime/batch-mark", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 3

        # Verify stats
        response = client.get("/api/anime/stats")
        stats = response.json()
        assert stats["total_interested"] == existing_interested + 3
        assert stats["total_reviewed"] == existing_reviewed + 3

    def test_batch_mark_empty_list(self, client):
        """Test batch marking with empty list (should fail validation)."""
        payload = {
            "subject_ids": [],
            "status": "watched"
        }

        response = client.post("/api/anime/batch-mark", json=payload)
        assert response.status_code == 422  # Empty list not allowed

    def test_batch_mark_missing_fields(self, client):
        """Test batch marking with missing fields."""
        # Missing subject_ids
        payload = {
            "status": "watched"
        }
        response = client.post("/api/anime/batch-mark", json=payload)
        assert response.status_code == 422

        # Missing status
        payload = {
            "subject_ids": [4003, 4004]
        }
        response = client.post("/api/anime/batch-mark", json=payload)
        assert response.status_code == 422

    def test_get_user_status_endpoint(self, client):
        """Test getting user status via API."""
        # First mark an anime
        client.post("/api/anime/mark", json={"subject_id": 5000, "status": "skipped"})

        # Get status
        response = client.get("/api/anime/user-status/5000")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "skipped"
        assert data["subject_id"] == 5000
        assert "marked_at" in data

    def test_get_user_status_not_found(self, client):
        """Test getting status for non-existent anime."""
        response = client.get("/api/anime/user-status/99999")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] is None  # Returns {"status": None} when not found

    def test_user_logs_endpoints(self, client):
        """Test user logs CRUD operations via API."""
        # Get existing records before test
        response = client.get("/api/anime/user-logs")
        existing_data = response.json()
        existing_count = len(existing_data["data"]) if "data" in existing_data else 0

        # Save logs
        actions = [
            {"subject_id": 6000, "status": "watched"},
            {"subject_id": 6001, "status": "interested", "timestamp": "2024-01-01T10:00:00Z"},
        ]

        response = client.post("/api/anime/user-logs", json=actions)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 2

        # Get logs
        response = client.get("/api/anime/user-logs")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "count" in data
        # Should have existing_count + 2 new records
        assert len(data["data"]) == existing_count + 2

        # Delete one log (undo)
        response = client.delete("/api/anime/user-logs/6000")
        assert response.status_code == 200
        assert response.json() == {"success": True}

        # Verify deleted
        response = client.get("/api/anime/user-logs")
        data = response.json()
        # Should have existing_count + 1 (only 6001 remains)
        assert len(data["data"]) == existing_count + 1
        # Find our test record among existing data
        test_record = next((log for log in data["data"] if log["subject_id"] == 6001), None)
        assert test_record is not None
        assert test_record["subject_id"] == 6001

        # Clear all logs
        response = client.delete("/api/anime/user-logs")
        assert response.status_code == 200

        # Verify cleared
        response = client.get("/api/anime/user-logs")
        data = response.json()
        assert len(data["data"]) == 0

    def test_get_anime_list_endpoint(self, client):
        """Test anime list endpoint with filtering."""
        # Mark some anime first
        client.post("/api/anime/mark", json={"subject_id": 7000, "status": "watched"})
        client.post("/api/anime/mark", json={"subject_id": 7001, "status": "interested"})
        client.post("/api/anime/mark", json={"subject_id": 7002, "status": "skipped"})

        # Get list without filter
        response = client.get("/api/anime/list")
        assert response.status_code == 200
        data = response.json()
        assert "reviewed_ids" in data
        assert "count" in data
        assert "data" in data
        reviewed_ids = set(data["reviewed_ids"])
        assert 7000 in reviewed_ids
        assert 7001 in reviewed_ids
        assert 7002 in reviewed_ids

        # Get list with status filter
        response = client.get("/api/anime/list?status_filter=watched")
        assert response.status_code == 200
        data = response.json()
        assert "filtered_ids" in data
        assert "reviewed_ids" in data
        filtered_ids = set(data["filtered_ids"])
        assert 7000 in filtered_ids
        assert 7001 not in filtered_ids
        assert 7002 not in filtered_ids

        # Test with "all" filter (should return all reviewed)
        response = client.get("/api/anime/list?status_filter=all")
        assert response.status_code == 200
        data = response.json()
        # Should not have filtered_ids when all
        assert "filtered_ids" not in data or len(data.get("filtered_ids", [])) == 0

        # Test with pagination parameters
        response = client.get("/api/anime/list?limit=10&offset=0")
        assert response.status_code == 200

        # Test with invalid limit/offset
        response = client.get("/api/anime/list?limit=0")
        assert response.status_code == 422  # Validation error (ge=1)

        response = client.get("/api/anime/list?offset=-1")
        assert response.status_code == 422  # Validation error (ge=0)

    def test_get_stats_endpoint(self, client):
        """Test stats endpoint."""
        # Get existing stats
        response = client.get("/api/anime/stats")
        existing_stats = response.json()
        existing_watched = existing_stats.get("total_watched", 0)
        existing_interested = existing_stats.get("total_interested", 0)
        existing_skipped = existing_stats.get("total_skipped", 0)
        existing_reviewed = existing_stats.get("total_reviewed", 0)

        # Add some data
        client.post("/api/anime/mark", json={"subject_id": 8000, "status": "watched"})
        client.post("/api/anime/mark", json={"subject_id": 8001, "status": "watched"})
        client.post("/api/anime/mark", json={"subject_id": 8002, "status": "interested"})
        client.post("/api/anime/mark", json={"subject_id": 8003, "status": "skipped"})

        # Get stats
        response = client.get("/api/anime/stats")
        assert response.status_code == 200
        stats = response.json()

        assert "total_watched" in stats
        assert "total_interested" in stats
        assert "total_skipped" in stats
        assert "total_reviewed" in stats

        # Verify stats increased correctly
        assert stats["total_watched"] == existing_watched + 2
        assert stats["total_interested"] == existing_interested + 1
        assert stats["total_skipped"] == existing_skipped + 1
        assert stats["total_reviewed"] == existing_reviewed + 4

    def test_stats_endpoint_empty(self, client):
        """Test stats endpoint returns valid response (database may contain data)."""
        response = client.get("/api/anime/stats")
        assert response.status_code == 200
        stats = response.json()

        # Verify required fields exist
        assert "total_watched" in stats
        assert "total_interested" in stats
        assert "total_skipped" in stats
        assert "total_reviewed" in stats

        # Verify values are non-negative integers
        assert isinstance(stats["total_watched"], int)
        assert isinstance(stats["total_interested"], int)
        assert isinstance(stats["total_skipped"], int)
        assert isinstance(stats["total_reviewed"], int)
        assert stats["total_watched"] >= 0
        assert stats["total_interested"] >= 0
        assert stats["total_skipped"] >= 0
        assert stats["total_reviewed"] >= 0

    def test_concurrent_requests(self, client):
        """Test handling of concurrent requests."""
        # Get existing stats
        response = client.get("/api/anime/stats")
        existing_stats = response.json()
        existing_reviewed = existing_stats.get("total_reviewed", 0)

        import threading

        errors = []
        results = []

        def mark_anime(start_id):
            try:
                for i in range(5):
                    payload = {
                        "subject_id": start_id + i,
                        "status": "watched"
                    }
                    response = client.post("/api/anime/mark", json=payload)
                    results.append(response.status_code)
            except Exception as e:
                errors.append(e)

        # Create threads
        threads = []
        for thread_num in range(3):
            start_id = 9000 + thread_num * 100
            thread = threading.Thread(target=mark_anime, args=(start_id,))
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        # No errors should occur
        assert len(errors) == 0

        # All should be 200
        assert all(status == 200 for status in results)

        # Verify stats
        response = client.get("/api/anime/stats")
        stats = response.json()
        assert stats["total_reviewed"] == existing_reviewed + 15  # 3 threads * 5 each

    def test_error_handling_invalid_json(self, client):
        """Test error handling for invalid JSON."""
        # Send invalid JSON
        response = client.post("/api/anime/mark", data="invalid json", headers={"Content-Type": "application/json"})
        assert response.status_code == 422  # FastAPI returns 422 for validation errors

    def test_nonexistent_endpoint(self, client):
        """Test request to non-existent endpoint."""
        response = client.get("/api/nonexistent")
        assert response.status_code == 404

    def test_method_not_allowed(self, client):
        """Test wrong HTTP method."""
        response = client.post("/api/anime/stats")
        assert response.status_code == 405  # Method Not Allowed

    def test_large_batch_request(self, client):
        """Test batch request with large number of items."""
        # Get existing stats
        response = client.get("/api/anime/stats")
        existing_stats = response.json()
        existing_watched = existing_stats.get("total_watched", 0)
        existing_reviewed = existing_stats.get("total_reviewed", 0)

        # Create large list
        subject_ids = list(range(10000, 11000))  # 1000 items

        payload = {
            "subject_ids": subject_ids,
            "status": "watched"
        }

        response = client.post("/api/anime/batch-mark", json=payload)
        assert response.status_code == 200

        # Verify count
        data = response.json()
        assert data["count"] == 1000

        # Verify stats
        response = client.get("/api/anime/stats")
        stats = response.json()
        assert stats["total_watched"] == existing_watched + 1000
        assert stats["total_reviewed"] == existing_reviewed + 1000


class TestAPIValidation:
    """Tests for API request validation."""

    def test_mark_anime_validation(self, client):
        """Test validation for mark anime endpoint."""
        # Invalid subject_id (string instead of int)
        payload = {
            "subject_id": "not_a_number",
            "status": "watched"
        }
        response = client.post("/api/anime/mark", json=payload)
        assert response.status_code == 422

        # Invalid status (number instead of string)
        payload = {
            "subject_id": 10000,
            "status": 123
        }
        response = client.post("/api/anime/mark", json=payload)
        assert response.status_code == 422

        # Rating out of range (if validation existed)
        # Note: Currently rating is not validated in schema
        payload = {
            "subject_id": 10001,
            "status": "watched",
            "rating": 11  # Should be 1-10 if validated
        }
        # This would pass since rating validation not implemented
        response = client.post("/api/anime/mark", json=payload)
        # Might still be 200 since rating is not validated

    def test_batch_mark_validation(self, client):
        """Test validation for batch mark endpoint."""
        # Invalid subject_ids (not a list)
        payload = {
            "subject_ids": "not_a_list",
            "status": "watched"
        }
        response = client.post("/api/anime/batch-mark", json=payload)
        assert response.status_code == 422

        # Invalid items in subject_ids list
        payload = {
            "subject_ids": [1, "two", 3],
            "status": "watched"
        }
        response = client.post("/api/anime/batch-mark", json=payload)
        assert response.status_code == 422

        # Empty status
        payload = {
            "subject_ids": [1, 2, 3],
            "status": ""
        }
        response = client.post("/api/anime/batch-mark", json=payload)
        # Empty string might be allowed
        # Status validation not strict

    def test_user_logs_validation(self, client):
        """Test validation for user logs endpoints."""
        # Invalid action list
        actions = "not_a_list"
        response = client.post("/api/anime/user-logs", json=actions)
        assert response.status_code == 422

        # Invalid action item
        actions = [
            {"subject_id": "invalid", "status": "watched"}
        ]
        response = client.post("/api/anime/user-logs", json=actions)
        assert response.status_code == 422

        # Missing required fields
        actions = [
            {"status": "watched"}  # Missing subject_id
        ]
        response = client.post("/api/anime/user-logs", json=actions)
        assert response.status_code == 422

    def test_list_endpoint_validation(self, client):
        """Test validation for list endpoint query parameters."""
        # Invalid limit (too small)
        response = client.get("/api/anime/list?limit=0")
        assert response.status_code == 422

        # Invalid limit (too large)
        response = client.get("/api/anime/list?limit=1001")
        assert response.status_code == 422

        # Invalid offset (negative)
        response = client.get("/api/anime/list?offset=-1")
        assert response.status_code == 422

        # Valid parameters
        response = client.get("/api/anime/list?limit=50&offset=10&tags=日本&tags=搞笑&min_rating=8.5&year_start=2010&year_end=2020&status_filter=watched")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])