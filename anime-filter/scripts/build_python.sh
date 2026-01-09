#!/bin/bash
# Build Python backend into a standalone executable for Tauri bundling
#
# This script:
# 1. Creates a virtual environment
# 2. Installs dependencies
# 3. Uses PyInstaller to create a single executable
# 4. Copies the executable to src-tauri/binaries/ with correct naming
#
# Usage: ./scripts/build_python.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
OUTPUT_DIR="$PROJECT_ROOT/src-tauri/binaries"

echo "🐍 Building Python backend..."

cd "$BACKEND_DIR"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt
pip install pyinstaller

# Build with PyInstaller
echo "🔨 Building executable..."
pyinstaller \
    --onefile \
    --name animepick-backend \
    --distpath "$OUTPUT_DIR" \
    --noconfirm \
    --clean \
    --log-level WARN \
    main.py

# Determine the target triple for Tauri
ARCH=$(uname -m)
OS=$(uname -s)

if [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        TARGET="aarch64-apple-darwin"
    else
        TARGET="x86_64-apple-darwin"
    fi
elif [ "$OS" = "Linux" ]; then
    TARGET="x86_64-unknown-linux-gnu"
else
    # Windows (if running in WSL or similar)
    TARGET="x86_64-pc-windows-msvc"
fi

# Rename to include target triple (Tauri convention)
FINAL_NAME="animepick-backend-$TARGET"
mv "$OUTPUT_DIR/animepick-backend" "$OUTPUT_DIR/$FINAL_NAME"

# Make executable
chmod +x "$OUTPUT_DIR/$FINAL_NAME"

echo "✅ Build complete: $OUTPUT_DIR/$FINAL_NAME"
echo ""
echo "Binary info:"
file "$OUTPUT_DIR/$FINAL_NAME"
ls -lh "$OUTPUT_DIR/$FINAL_NAME"

deactivate
