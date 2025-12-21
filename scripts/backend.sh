#!/bin/bash
# Presentation Coach - Startup Script
# Builds frontend and starts backend server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"
BACKEND_DIR="$PROJECT_ROOT/src/backend"

echo "🎯 Presentation Coach - Starting..."
# Step 2: Copy built files to backend static folder
echo ""
echo "📁 Copying frontend build to backend..."
mkdir -p "$BACKEND_DIR/static"
cp -r "$FRONTEND_DIR/dist/"* "$BACKEND_DIR/static/"

# Step 3: Install backend dependencies if needed
echo ""
echo "🐍 Checking backend dependencies..."
cd "$BACKEND_DIR"

if [ ! -d ".venv" ] && [ -z "$VIRTUAL_ENV" ]; then
    echo "   Installing Python dependencies..."
    pip install -r requirements.txt -q
fi

# Step 4: Start backend server
echo ""
echo "🚀 Starting backend server..."
echo "   Access the app at: http://localhost:${PORT:-8015}"
echo ""

cd "$BACKEND_DIR"
python -m src.app
