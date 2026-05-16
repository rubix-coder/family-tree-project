#!/usr/bin/env bash
set -e

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Pick a browser to open (first one found)
open_browser() {
  local url=$1
  if command -v xdg-open &>/dev/null; then
    xdg-open "$url" &
  elif command -v gnome-open &>/dev/null; then
    gnome-open "$url" &
  elif command -v open &>/dev/null; then
    open "$url" &   # macOS
  fi
}

PORT=${PORT:-3000}
echo ""
echo "  FamilyTree Social"
echo "  Starting server on http://localhost:$PORT"
echo "  Press Ctrl+C to stop"
echo ""

# Give the server a moment to start then open the browser
(sleep 1.5 && open_browser "http://localhost:$PORT") &

PORT=$PORT node server.js
