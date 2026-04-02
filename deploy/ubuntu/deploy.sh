#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-}"
APP_DIR="${APP_DIR:-/opt/ludo-online}"

if [[ ! -d "$APP_DIR/.git" ]]; then
  if [[ -z "$REPO_URL" ]]; then
    echo "Usage: $0 <git_repo_url>"
    echo "Example: $0 https://github.com/yourname/ludo-online.git"
    exit 1
  fi

  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER:$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

cd "$APP_DIR"

if [[ -f package.json ]]; then
  npm install --omit=dev
fi

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" || true

echo "Deploy complete."
echo "App process: pm2 status"
