#!/usr/bin/env bash

echo ""
echo "  ╔══════════════════════════════╗"
echo "  ║     FamilyTree Social        ║"
echo "  ╚══════════════════════════════╝"
echo ""

# ── Auto-install Node.js + npm ───────────────────────────────────────
install_node() {
  echo "  Node.js not found — installing automatically..."
  echo ""

  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y nodejs >/dev/null 2>&1

  elif command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
    sudo dnf install -y nodejs >/dev/null 2>&1

  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null 2>&1
    sudo yum install -y nodejs >/dev/null 2>&1

  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm nodejs npm >/dev/null 2>&1

  elif command -v zypper &>/dev/null; then
    sudo zypper install -y nodejs20 npm20 >/dev/null 2>&1

  elif command -v brew &>/dev/null; then
    brew install node >/dev/null 2>&1

  else
    echo "  ERROR: Could not detect a package manager to install Node.js."
    echo "  Please install Node.js manually from: https://nodejs.org"
    echo "  Then run this script again."
    echo ""
    read -rp "  Press Enter to exit..." _
    exit 1
  fi

  # Verify install succeeded
  if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "  ERROR: Installation failed."
    echo "  Please install Node.js manually from: https://nodejs.org"
    echo "  Then run this script again."
    echo ""
    read -rp "  Press Enter to exit..." _
    exit 1
  fi

  echo "  Node.js $(node --version) installed successfully."
  echo ""
}

# Install if node or npm is missing
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
  install_node
fi

# Upgrade if version is below 18
NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "  Node.js $(node --version) is too old (need v18+) — upgrading..."
  echo ""
  install_node
fi

# ── Install app dependencies if needed ───────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "  Installing app dependencies (first run only)..."
  npm install --silent
  echo "  Done."
  echo ""
fi

# ── Open browser ─────────────────────────────────────────────────────
open_browser() {
  local url=$1
  if command -v xdg-open &>/dev/null; then
    xdg-open "$url" &
  elif command -v gnome-open &>/dev/null; then
    gnome-open "$url" &
  elif command -v open &>/dev/null; then
    open "$url" &
  fi
}

PORT=${PORT:-3000}
echo "  Server starting at http://localhost:$PORT"
echo "  Press Ctrl+C to stop."
echo ""

(sleep 2 && open_browser "http://localhost:$PORT") &

PORT=$PORT node server.js
