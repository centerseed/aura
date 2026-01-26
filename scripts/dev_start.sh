#!/bin/bash
set -e

echo "🚀 Starting Naruvia Local Dev Environment..."

# 1. Start DB if not running
if [ ! "$(docker ps -q -f name=naruvia_db)" ]; then
    echo "📦 Starting Database..."
    docker-compose up -d db
    echo "⏳ Waiting for DB to be ready..."
    sleep 5
fi

# 2. Run Migrations
echo "🔄 Running DB Migrations..."
./backend/scripts/db_upgrade.sh

# 3. Start Streamlit
echo "✨ Starting Frontend..."
export PYTHONPATH=$PYTHONPATH:$(pwd)/backend
backend/venv/bin/streamlit run frontend/main.py
