#!/bin/bash

# WoW Price Checker - Database Restore Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lht "$PROJECT_DIR/backups"/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
    source "$PROJECT_DIR/.env"
fi

POSTGRES_DB=${POSTGRES_DB:-wow_price_checker}
POSTGRES_USER=${POSTGRES_USER:-postgres}

echo "================================================"
echo "WoW Price Checker - Database Restore"
echo "================================================"
echo ""
echo "⚠️  WARNING: This will replace the current database!"
echo "   Backup file: $BACKUP_FILE"
echo "   Database: $POSTGRES_DB"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo ""
echo "🔄 Restoring database..."

# Drop and recreate database
docker exec wpc-postgres sh -c "psql -U $POSTGRES_USER -c 'DROP DATABASE IF EXISTS $POSTGRES_DB;'"
docker exec wpc-postgres sh -c "psql -U $POSTGRES_USER -c 'CREATE DATABASE $POSTGRES_DB;'"

# Restore backup
gunzip -c "$BACKUP_FILE" | docker exec -i wpc-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database restored successfully"
else
    echo ""
    echo "❌ Restore failed!"
    exit 1
fi
