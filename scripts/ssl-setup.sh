#!/bin/bash

# WoW Price Checker - SSL/TLS Setup with Let's Encrypt

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "================================================"
echo "WoW Price Checker - SSL/TLS Setup"
echo "================================================"
echo ""

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <your-domain.com> <email@example.com>"
    echo ""
    echo "Example:"
    echo "  $0 wowprices.example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-""}

if [ -z "$EMAIL" ]; then
    read -p "Enter email for Let's Encrypt notifications: " EMAIL
fi

echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Create SSL directory
mkdir -p "$PROJECT_DIR/nginx/ssl"
mkdir -p "$PROJECT_DIR/nginx/certbot/conf"
mkdir -p "$PROJECT_DIR/nginx/certbot/www"

# Check if using Docker
if command -v docker &> /dev/null; then
    echo "🔧 Using Certbot via Docker..."

    # Get certificate
    docker run --rm \
        -v "$PROJECT_DIR/nginx/certbot/conf:/etc/letsencrypt" \
        -v "$PROJECT_DIR/nginx/certbot/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN

    # Copy certificates to nginx ssl directory
    cp "$PROJECT_DIR/nginx/certbot/conf/live/$DOMAIN/fullchain.pem" "$PROJECT_DIR/nginx/ssl/"
    cp "$PROJECT_DIR/nginx/certbot/conf/live/$DOMAIN/privkey.pem" "$PROJECT_DIR/nginx/ssl/"

    echo ""
    echo "✅ SSL certificates obtained successfully"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Edit nginx/conf.d/default.conf"
    echo "   2. Uncomment HTTPS server block"
    echo "   3. Update server_name to: $DOMAIN"
    echo "   4. Restart nginx: docker-compose -f docker-compose.prod.yml restart nginx"
    echo ""
    echo "🔄 Set up auto-renewal:"
    echo "   Add to crontab: 0 0 * * * $SCRIPT_DIR/ssl-renew.sh"

else
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi
