#!/bin/zsh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# Start the tunnel in background
/opt/homebrew/bin/cloudflared tunnel \
  --config "$DIR/cloudflared-config.yml" \
  run my-remote &
TUNNEL_PID=$!

# Start the server in background
/opt/homebrew/bin/npx tsx "$DIR/server.ts" &
SERVER_PID=$!

# If either process exits, kill the other and exit
trap 'kill $TUNNEL_PID $SERVER_PID 2>/dev/null; wait' EXIT

# Wait for either to exit
while kill -0 $TUNNEL_PID 2>/dev/null && kill -0 $SERVER_PID 2>/dev/null; do
  sleep 1
done

exit 1
