#!/bin/bash
# Development startup script
#
# Starts both the Python backend and Tauri frontend in development mode.
# The Python backend runs directly (not as a sidecar) for easier debugging.
#
# Usage: ./scripts/dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting AnimePick in development mode..."

# Check if Python venv exists
if [ ! -d "$PROJECT_ROOT/backend/venv" ]; then
    echo "📦 Setting up Python environment..."
    cd "$PROJECT_ROOT/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
fi

# Start Python backend in background
echo "🐍 Starting Python backend..."
cd "$PROJECT_ROOT/backend"
source venv/bin/activate
python main.py --dev &
PYTHON_PID=$!
echo "Python backend PID: $PYTHON_PID"

# Give Python time to start
sleep 2

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $PYTHON_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Tauri in development mode
echo "⚡ Starting Tauri frontend..."
cd "$PROJECT_ROOT"
npm run tauri dev

# Cleanup on exit
cleanup
