#!/usr/bin/env bash
set -e

echo ""
echo "  ╔══════════════════════════════╗"
echo "  ║     FamilyTree Social        ║"
echo "  ╚══════════════════════════════╝"
echo ""

# ── Check Node.js ────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "  ERROR: Node.js is not installed."
  echo ""
  echo "  Install it using one of the methods below, then run this"
  echo "  script again."
  echo ""
  echo "  Ubuntu / Debian:"
  echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "    sudo apt-get install -y nodejs"
  echo ""
  echo "  Fedora / RHEL / CentOS:"
  echo "    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -"
  echo "    sudo dnf install -y nodejs"
  echo ""
  echo "  Arch Linux:"
  echo "    sudo pacman -S nodejs npm"
  echo ""
  echo "  macOS (Homebrew):"
  echo "    brew install node"
  echo ""
  echo "  Any platform (official installer):"
  echo "    https://nodejs.org  →  download the LTS version"
  echo ""
  read -rp "  Press Enter to exit..." _
  exit 1
fi

# ── Check npm ────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo "  ERROR: npm is not installed (it normally comes with Node.js)."
  echo ""
  echo "  Try reinstalling Node.js from https://nodejs.org"
  echo "  Or on Linux, install npm separately:"
  echo ""
  echo "  Ubuntu / Debian:  sudo apt-get install -y npm"
  echo "  Fedora / RHEL:    sudo dnf install -y npm"
  echo "  Arch Linux:       sudo pacman -S npm"
  echo ""
  read -rp "  Press Enter to exit..." _
  exit 1
fi

# ── Check minimum Node version (18+) ─────────────────────────────────
NODE_VER=$(node -e "process.exit(parseInt(process.versions.node.split('.')[0]))" 2>/dev/null; echo $?)
if [ "$NODE_VER" -lt 18 ]; then
  CURRENT=$(node --version)
  echo "  ERROR: Node.js $CURRENT is installed but version 18 or higher is required."
  echo ""
  echo "  Please upgrade: https://nodejs.org"
  echo ""
  read -rp "  Press Enter to exit..." _
  exit 1
fi

# ── Install dependencies if needed ───────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies (first run only)..."
  echo ""
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
