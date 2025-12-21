#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"
IMAGE_NAME="presentation-coach"
CONTAINER_NAME="presentation-coach-app"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Build the Docker image
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" "$PROJECT_ROOT"

# Stop and remove existing container if running
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "Stopping existing container..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# Run the container with .env file
echo "Starting container..."
docker run -d \
    --name "$CONTAINER_NAME" \
    --env-file "$ENV_FILE" \
    -p 8015:8015 \
    "$IMAGE_NAME"

echo "Container '$CONTAINER_NAME' is now running."
echo "Use 'docker logs -f $CONTAINER_NAME' to view logs."
