#!/bin/bash
# Comprehensive test runner for AnimePick backend

set -e  # Exit on error

echo "=========================================="
echo "Running AnimePick Backend Test Suite"
echo "=========================================="
echo ""

# Activate virtual environment if exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Set PYTHONPATH
export PYTHONPATH=$PYTHONPATH:$(pwd)/..

echo "Python path: $PYTHONPATH"
echo "Python version: $(python --version)"
echo ""

# Run tests with different scopes
echo "1. Running existing unit tests..."
python -m pytest tests/test_database.py -v
echo ""

echo "2. Running existing API flow tests..."
python -m pytest tests/test_api_flow.py -v
echo ""

echo "3. Running comprehensive database tests..."
python -m pytest tests/test_database_comprehensive.py -v --tb=short
echo ""

echo "4. Running comprehensive service and API tests..."
python -m pytest tests/test_service_and_api_comprehensive.py -v --tb=short
echo ""

echo "5. Running all tests with coverage report..."
python -m pytest tests/ -v --tb=short --cov=backend --cov-report=term-missing --cov-report=html
echo ""

echo "=========================================="
echo "Test Suite Completed"
echo "=========================================="