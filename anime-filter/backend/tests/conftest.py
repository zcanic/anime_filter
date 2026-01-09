import os
import shutil
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.core.config import get_settings
from backend.db.database import Database

@pytest.fixture(scope="function")
def test_data_dir():
    """
    Create a temporary directory for test data (function scope for isolation).
    Uses a local .test_data directory to avoid potential system temp dir issues.
    """
    base_dir = Path.cwd() / ".test_data"
    base_dir.mkdir(exist_ok=True)
    
    temp_dir = tempfile.mkdtemp(dir=str(base_dir))
    absolute_temp_dir = Path(temp_dir).resolve()
    
    yield absolute_temp_dir
    
    if absolute_temp_dir.exists():
        try:
            shutil.rmtree(absolute_temp_dir)
        except Exception as e:
            print(f"Warning: Failed to cleanup {absolute_temp_dir}: {e}")

@pytest.fixture(scope="function")
def test_settings(test_data_dir):
    """Override settings to use test data directory."""
    get_settings.cache_clear()

    # Create new settings with patched environment
    # Note: Must use ANIMEPICK_APP_DATA_DIR_OVERRIDE to match the field name in Settings
    with patch.dict(os.environ, {"ANIMEPICK_APP_DATA_DIR_OVERRIDE": str(test_data_dir)}):
        new_settings = get_settings()
        print(f"DEBUG: test_settings created. app_data_dir={new_settings.app_data_dir}")
        print(f"DEBUG: test_data_dir={test_data_dir}")

        # Patch the settings object where it is used
        with patch("backend.core.config.settings", new_settings), \
             patch("backend.core.lifespan.settings", new_settings), \
             patch("backend.db.database.settings", new_settings):
            yield new_settings

@pytest.fixture(scope="function")
def db(test_settings, test_data_dir):
    """
    Initialize a clean database instance for each test.
    Forces reconstruction of the Singleton.
    """
    # Disable singleton for testing
    original_singleton_setting = Database._singleton_enabled
    Database._singleton_enabled = False

    # Reset Singleton (just in case)
    Database._instance = None

    # Patch the settings in all modules before creating Database instance
    with patch("backend.core.config.settings", test_settings), \
         patch("backend.core.lifespan.settings", test_settings), \
         patch("backend.db.database.settings", test_settings):

        # Create new instance (will use patched settings)
        _db = Database()

        # Verify we are using the test directory
        assert str(test_data_dir) in str(_db.db_path)

        yield _db

        # Cleanup
        try:
            if _db:
                # Try to close connections if we can access them
                if hasattr(_db, "_local") and hasattr(_db._local, "conn") and _db._local.conn:
                    try:
                        _db._local.conn.close()
                    except:
                        pass
                # Clear all actions
                try:
                    _db.clear_all_actions()
                except Exception as e:
                    print(f"[Test Cleanup Warning] Failed to clear actions: {e}")
                # Reset thread-local storage to force new connections
                import threading
                _db._local = threading.local()
        except Exception:
            pass
        finally:
            # Reset singleton settings
            Database._instance = None
            Database._singleton_enabled = original_singleton_setting

@pytest.fixture(scope="function")
def client(db):
    """
    FastAPI TestClient with database dependencies mocked.
    """
    from backend.main import create_app
    
    # Create app
    # We need to ensure startup_handler works which imports db
    # We patch module imports so startup_handler gets OUR db
    
    # Important: patch BEFORE creating app if startup happens there?
    # No, starlette TestClient runs startup on context enter.
    
    app = create_app()
    app.state.db = db
    
    with patch("backend.db.database.db", db), \
         patch("backend.db.db", db), \
         patch("backend.services.anime_service.db", db):
        
        with TestClient(app) as c:
            yield c
