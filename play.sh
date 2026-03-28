#!/usr/bin/env bash
#
# Konoha — Path of the Shinobi
# Launches the dev server and opens the game in your default browser.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Determine the port (default Vite port)
PORT="${KONOHA_PORT:-5173}"

# Open browser after a short delay to let Vite start
(sleep 2 && open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || echo "Open http://localhost:$PORT in your browser") &

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   KONOHA — Path of the Shinobi       ║"
echo "  ║   Starting on http://localhost:$PORT  ║"
echo "  ║   Press Ctrl+C to stop               ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

npx vite --port "$PORT"
