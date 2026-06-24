#!/usr/bin/env bash
#
# FreeCode — one-shot installer for macOS / Linux / WSL.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/cameleonnbss/freecode/main/install.sh | bash
#
# Or, after cloning:
#   ./install.sh
#
# What it does:
#   1. Checks Node.js >= 18 is installed (installs it via nvm if missing & user agrees)
#   2. Clones FreeCode into ~/.freecode-src (or uses the current dir if run from the repo)
#   3. npm install + npm run build
#   4. Symlinks `freecode` into ~/.local/bin (or /usr/local/bin if sudo)
#   5. Prints next steps
#
set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

say()  { printf "${GREEN}✓${NC} %s\n" "$1"; }
info() { printf "${CYAN}❯${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
err()  { printf "${RED}✗${NC} %s\n" "$1" >&2; }

REPO_URL="https://github.com/cameleonnbss/freecode.git"
INSTALL_DIR="${FREECODE_INSTALL_DIR:-$HOME/.freecode-src}"
BIN_NAME="freecode"

# ── 1. Node check ──────────────────────────────────────────────────────────
info "Checking Node.js…"
if ! command -v node >/dev/null 2>&1; then
  warn "Node.js not found."
  if command -v nvm >/dev/null 2>&1 || [ -s "$HOME/.nvm/nvm.sh" ]; then
    info "Installing Node 20 via nvm…"
    . "$HOME/.nvm/nvm.sh"
    nvm install 20
    nvm use 20
  else
    err "Node.js is required (>= 18). Install it from https://nodejs.org and re-run this script."
    err "Or install nvm first:  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
    exit 1
  fi
fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js >= 18 required (you have $(node -v)). Upgrade: https://nodejs.org"
  exit 1
fi
say "Node $(node -v) OK"

# ── 2. Clone or use current dir ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ] && grep -q '"freecode"' "$SCRIPT_DIR/package.json" 2>/dev/null; then
  # Run from inside the repo — use current dir.
  INSTALL_DIR="$SCRIPT_DIR"
  info "Running from repo: $INSTALL_DIR"
else
  info "Cloning FreeCode into $INSTALL_DIR…"
  if [ -d "$INSTALL_DIR" ]; then
    say "Already cloned, pulling latest…"
    git -C "$INSTALL_DIR" pull --rebase --autostash || warn "git pull failed, continuing with existing copy"
  else
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  fi
fi
cd "$INSTALL_DIR"

# ── 3. Install + build ──────────────────────────────────────────────────────
info "Installing dependencies (npm install)…"
npm install --no-fund --no-audit
say "Dependencies installed"

info "Building (npm run build)…"
npm run build
say "Build complete"

# ── 4. Symlink binary ───────────────────────────────────────────────────────
TARGET="$INSTALL_DIR/bin/freecode.js"
chmod +x "$TARGET"

# Pick a bin dir on PATH.
BIN_DIR=""
for candidate in "$HOME/.local/bin" "/usr/local/bin" "$HOME/bin"; do
  if [ -d "$candidate" ] && echo "$PATH" | tr ':' '\n' | grep -qx "$candidate"; then
    BIN_DIR="$candidate"
    break
  fi
done
if [ -z "$BIN_DIR" ]; then
  # Create ~/.local/bin and add to PATH.
  BIN_DIR="$HOME/.local/bin"
  mkdir -p "$BIN_DIR"
  warn "Created $BIN_DIR — make sure it is on your PATH."
  if [ -f "$HOME/.bashrc" ]; then
    grep -q 'HOME/.local/bin' "$HOME/.bashrc" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    say "Added to ~/.bashrc — restart your shell or run: source ~/.bashrc"
  fi
  if [ -f "$HOME/.zshrc" ]; then
    grep -q 'HOME/.local/bin' "$HOME/.zshrc" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
    say "Added to ~/.zshrc — restart your shell or run: source ~/.zshrc"
  fi
fi

ln -sf "$TARGET" "$BIN_DIR/$BIN_NAME"
say "Linked $BIN_NAME → $BIN_DIR/$BIN_NAME"

# ── 5. Done ─────────────────────────────────────────────────────────────────
printf "\n"
printf "${CYAN} ▄▄▄▄▄▄▄▄                                                                    ▄▄           ${NC}\n"
printf "${CYAN} ██▀▀▀▀▀▀                                                                    ██           ${NC}\n"
printf "${CYAN} ██         ██▄████   ▄████▄    ▄████▄              ▄█████▄   ▄████▄    ▄███▄██   ▄████▄  ${NC}\n"
printf "${CYAN} ███████    ██▀      ██▄▄▄▄██  ██▄▄▄▄██            ██▀    ▀  ██▀  ▀██  ██▀  ▀██  ██▄▄▄▄██ ${NC}\n"
printf "${CYAN} ██         ██       ██▀▀▀▀▀▀  ██▀▀▀▀▀▀            ██        ██    ██  ██    ██  ██▀▀▀▀▀▀ ${NC}\n"
printf "${CYAN} ██         ██       ▀██▄▄▄▄█  ▀██▄▄▄▄█            ▀██▄▄▄▄█  ▀██▄▄██▀  ▀██▄▄███  ▀██▄▄▄▄█ ${NC}\n"
printf "${CYAN} ▀▀         ▀▀         ▀▀▀▀▀     ▀▀▀▀▀               ▀▀▀▀▀     ▀▀▀▀      ▀▀▀ ▀▀    ▀▀▀▀▀  ${NC}\n"
printf "\n"
say "FreeCode installed!"
printf "  ${GRAY}Run:${NC}        freecode\n"
printf "  ${GRAY}Configure:${NC}  freecode config\n"
printf "  ${GRAY}Docs:${NC}       https://github.com/cameleonnbss/freecode\n"
printf "\n"
if [ ! -w "$BIN_DIR" ] || ! echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
  warn "Open a new terminal (or run: source ~/.bashrc) so 'freecode' is on your PATH."
fi
