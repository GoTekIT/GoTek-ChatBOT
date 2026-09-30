#!/bin/bash
set -e

echo "=== Deploying GoTek Chatbot Services ==="

echo "[1/2] Building & Starting Production Docker Containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "[2/2] Checking running services..."
docker compose -f docker-compose.prod.yml ps

echo "=== All services deployed successfully! ==="
