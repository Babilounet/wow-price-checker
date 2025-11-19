.PHONY: help install dev build start stop clean logs test

help:
	@echo "WoW Price Checker - Development Commands"
	@echo ""
	@echo "  make install    - Install all dependencies"
	@echo "  make dev        - Start development environment (Docker)"
	@echo "  make build      - Build all services"
	@echo "  make start      - Start all services"
	@echo "  make stop       - Stop all services"
	@echo "  make clean      - Clean up containers and volumes"
	@echo "  make logs       - View logs"
	@echo "  make test       - Run tests"

install:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Done!"

dev:
	@echo "Starting development environment..."
	docker-compose up -d
	@echo "Services running:"
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

.DEFAULT_GOAL := help
