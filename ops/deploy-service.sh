#!/bin/zsh
set -euo pipefail

LABEL="com.my-remote"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$PROJECT_DIR/com.my-remote.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "==> Building frontend..."
cd "$PROJECT_DIR" && npm run build

echo "==> Stopping $LABEL..."
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null && echo "    Stopped." || echo "    Not running (skipped)."

echo "==> Copying plist to $PLIST_DST..."
cp "$PLIST_SRC" "$PLIST_DST"

echo "==> Loading $LABEL..."
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo "==> Done. Service status:"
launchctl print "gui/$(id -u)/$LABEL" 2>&1 | head -5
