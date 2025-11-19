#!/bin/bash

# WoW Price Checker - Production Deployment Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "================================================"
echo "WoW Price Checker - Production Deployment"
echo "================================================"
echo ""

# Check if .env exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please create .env from .env.example and configure it"
    exit 1
fi

# Load environment
source "$PROJECT_DIR/.env"

# Check required variables
if [ -z "$BLIZZARD_CLIENT_ID" ] || [ -z "$BLIZZARD_CLIENT_SECRET" ]; then
    echo "❌ Error: Blizzard API credentials not configured!"
    echo "   Please set BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET in .env"
    exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Error: POSTGRES_PASSWORD not set in .env"
    exit 1
fi

echo "✅ Environment configuration validated"
echo ""

# Build images
echo "📦 Building Docker images..."
docker-compose -f "$PROJECT_DIR/docker-compose.prod.yml" build --no-cache

echo ""
echo "✅ Images built successfully"
echo ""

# Pull required images
echo "📥 Pulling required images..."
docker-compose -f "$PROJECT_DIR/docker-compose.prod.yml" pull nginx postgres redis

echo ""
echo "✅ Images pulled successfully"
echo ""

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f "$PROJECT_DIR/docker-compose.prod.yml" down

echo ""
echo "✅ Containers stopped"
echo ""

# Start services
echo "🚀 Starting services..."
docker-compose -f "$PROJECT_DIR/docker-compose.prod.yml" up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if docker-compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps | grep -q "healthy"; then
        break
    fi
    echo "   Waiting... ($RETRIES retries left)"
    sleep 2
    RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
    echo ""
    echo "⚠️  Warning: Services may not be fully healthy yet"
    echo "   Check with: docker-compose -f docker-compose.prod.yml ps"
else
    echo ""
    echo "✅ Services are healthy"
fi

echo ""
echo "================================================"
echo "🎉 Deployment completed!"
echo "================================================"
echo ""
echo "Services running:"
echo "  🌐 Application: http://localhost"
echo "  📊 API:         http://localhost/api/v1/health"
echo ""
echo "Useful commands:"
echo "  📋 View logs:   docker-compose -f docker-compose.prod.yml logs -f"
echo "  📊 Status:      docker-compose -f docker-compose.prod.yml ps"
echo "  🛑 Stop:        docker-compose -f docker-compose.prod.yml down"
echo "  💾 Backup:      ./scripts/backup.sh"
echo ""
