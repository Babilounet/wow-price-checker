.PHONY: help install dev build start stop clean logs test deploy prod-build prod-up prod-down prod-logs backup restore

help:
	@echo "WoW Price Checker - Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install       - Install all dependencies"
	@echo "  make dev           - Start development environment"
	@echo "  make logs          - View development logs"
	@echo "  make stop          - Stop development services"
	@echo "  make clean         - Clean up containers and volumes"
	@echo ""
	@echo "Production:"
	@echo "  make deploy        - Deploy to production (builds & starts)"
	@echo "  make prod-build    - Build production images"
	@echo "  make prod-up       - Start production services"
	@echo "  make prod-down     - Stop production services"
	@echo "  make prod-logs     - View production logs"
	@echo ""
	@echo "Maintenance:"
	@echo "  make backup        - Create database backup"
	@echo "  make restore FILE=<backup.sql.gz> - Restore from backup"
	@echo "  make test          - Run tests"

install:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Done!"

dev:
	@echo "Starting development environment..."
	docker-compose up -d
	@echo ""
	@echo "✅ Services running:"
	@echo "  - Backend API: http://localhost:3000"
	@echo "  - Frontend:    http://localhost:5173"
	@echo "  - PostgreSQL:  localhost:5432"
	@echo "  - Redis:       localhost:6379"

build:
	docker-compose build

start:
	docker-compose up -d

stop:
	docker-compose down

clean:
	docker-compose down -v
	rm -rf backend/node_modules frontend/node_modules
	rm -rf backend/dist frontend/dist

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

test:
	cd backend && npm test
	cd frontend && npm test

# Production commands
deploy:
	@echo "🚀 Deploying to production..."
	./scripts/deploy.sh

prod-build:
	@echo "📦 Building production images..."
	docker-compose -f docker-compose.prod.yml build --no-cache

prod-up:
	@echo "▶️  Starting production services..."
	docker-compose -f docker-compose.prod.yml up -d

prod-down:
	@echo "⏹️  Stopping production services..."
	docker-compose -f docker-compose.prod.yml down

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

prod-restart:
	@echo "🔄 Restarting production services..."
	docker-compose -f docker-compose.prod.yml restart

prod-ps:
	@echo "📊 Production services status:"
	docker-compose -f docker-compose.prod.yml ps

# Maintenance commands
backup:
	@echo "💾 Creating database backup..."
	./scripts/backup.sh

restore:
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Error: Please specify FILE=<backup.sql.gz>"; \
		echo "Example: make restore FILE=backups/wpc_backup_20250119_120000.sql.gz"; \
		exit 1; \
	fi
	@echo "🔄 Restoring database from $(FILE)..."
	./scripts/restore.sh $(FILE)

ssl-setup:
	@if [ -z "$(DOMAIN)" ] || [ -z "$(EMAIL)" ]; then \
		echo "❌ Error: Please specify DOMAIN and EMAIL"; \
		echo "Example: make ssl-setup DOMAIN=example.com EMAIL=admin@example.com"; \
		exit 1; \
	fi
	@echo "🔐 Setting up SSL for $(DOMAIN)..."
	./scripts/ssl-setup.sh $(DOMAIN) $(EMAIL)

.DEFAULT_GOAL := help
