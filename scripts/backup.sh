#!/bin/bash

# WoW Price Checker - Database Backup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
    source "$PROJECT_DIR/.env"
fi

POSTGRES_DB=${POSTGRES_DB:-wow_price_checker}
POSTGRES_USER=${POSTGRES_USER:-postgres}
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/wpc_backup_$TIMESTAMP.sql.gz"

echo "================================================"
echo "WoW Price Checker - Database Backup"
echo "================================================"
echo ""
echo "Backup file: $BACKUP_FILE"
echo ""

# Run backup inside postgres container
docker exec wpc-postgres sh -c "pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip" > "$PROJECT_DIR/backups/wpc_backup_$TIMESTAMP.sql.gz"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully"
    echo ""

    # Show backup size
    BACKUP_SIZE=$(du -h "$PROJECT_DIR/backups/wpc_backup_$TIMESTAMP.sql.gz" | cut -f1)
    echo "📦 Backup size: $BACKUP_SIZE"
    echo ""

    # List recent backups
    echo "Recent backups:"
    ls -lht "$PROJECT_DIR/backups" | head -6
    echo ""

    # Clean old backups (keep last 7 days)
    echo "🧹 Cleaning old backups (keeping last 7 days)..."
    find "$PROJECT_DIR/backups" -name "wpc_backup_*.sql.gz" -mtime +7 -delete
    echo "✅ Cleanup completed"
else
    echo "❌ Backup failed!"
    exit 1
fi
