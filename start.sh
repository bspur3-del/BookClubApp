#!/bin/bash
set -e

echo "=== BookClubApp startup ==="
echo "PORT=${PORT:-not set}"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO - MISSING)"
echo ""

echo "=== Running migrations ==="
flask db upgrade
echo "=== Migrations done ==="

echo "=== Starting gunicorn on port ${PORT:-8080} ==="
exec gunicorn app:app \
    --bind "0.0.0.0:${PORT:-8080}" \
    --workers 2 \
    --timeout 120 \
    --log-level info \
    --access-logfile - \
    --error-logfile -
