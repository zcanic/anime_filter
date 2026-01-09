import sys
import pytest

def test_slowapi_import():
    print(f"DEBUG: sys.path: {sys.path}")
    import slowapi
    assert slowapi is not None
