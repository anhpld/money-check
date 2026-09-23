#!/bin/bash

set -e

APP_IMAGE="money-check:latest"
MIGRATOR_IMAGE="money-check-migrator:latest"
CONTAINER_NAME="money-check"
STORAGE_VOLUME="money-check-storage"

echo "==> Pull code mới"
git pull --ff-only

echo "==> Build Docker image"
docker build -t "$APP_IMAGE" .

echo "==> Build migration image"
docker build \
  --target migrator \
  -t "$MIGRATOR_IMAGE" \
  .

echo "==> Tạo volume lưu ảnh nếu chưa tồn tại"
docker volume create "$STORAGE_VOLUME" >/dev/null

echo "==> Chạy database migration"
docker run --rm \
  --env-file .env \
  "$MIGRATOR_IMAGE"

echo "==> Xóa container cũ"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "==> Chạy container mới"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file .env \
  -e AVATAR_STORAGE_DIR=/app/storage/avatars \
  -p 127.0.0.1:3000:3000 \
  -v "$STORAGE_VOLUME:/app/storage" \
  "$APP_IMAGE"

echo "==> Container hiện tại"
docker ps --filter "name=$CONTAINER_NAME"

echo "==> Log gần nhất"
docker logs --tail 50 "$CONTAINER_NAME"
