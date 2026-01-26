#!/bin/bash
cd "$(dirname "$0")/.."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi
alembic upgrade head
