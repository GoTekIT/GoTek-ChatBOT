#!/bin/bash
set -e
echo "Deploying Production Stack via Docker Compose..."
docker compose -f docker-compose.prod.yml pull || true
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
