#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ludo-online}"
SITE_NAME="ludo-online"
SERVER_NAME="${1:-_}"

TEMPLATE_PATH="$APP_DIR/deploy/nginx/ludo-online.conf"
TARGET_PATH="/etc/nginx/sites-available/$SITE_NAME"

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Missing nginx template: $TEMPLATE_PATH"
  exit 1
fi

sudo cp "$TEMPLATE_PATH" "$TARGET_PATH"
sudo sed -i "s/__SERVER_NAME__/$SERVER_NAME/g" "$TARGET_PATH"
sudo ln -sf "$TARGET_PATH" "/etc/nginx/sites-enabled/$SITE_NAME"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "Nginx configured."
echo "Public URL: http://$SERVER_NAME"
