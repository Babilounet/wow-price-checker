#!/bin/bash

# WoW Price Checker - SSL Certificate Renewal

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Renewing SSL certificates..."

docker run --rm \
    -v "$PROJECT_DIR/nginx/certbot/conf:/etc/letsencrypt" \
    -v "$PROJECT_DIR/nginx/certbot/www:/var/www/certbot" \
    certbot/certbot renew \
    --quiet

# Reload nginx if certificates were renewed
if [ $? -eq 0 ]; then
    docker-compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec nginx nginx -s reload
    echo "✅ SSL certificates renewed and nginx reloaded"
fi
