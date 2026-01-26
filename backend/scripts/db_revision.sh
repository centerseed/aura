#!/bin/bash
cd "$(dirname "$0")/.."
# Check if venv exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi
alembic revision --autogenerate -m "$1"
