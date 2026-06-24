#!/usr/bin/env bash
#
# FreeCode — direct launcher for macOS / Linux / WSL.
# Use this if you cloned the repo and don't want to npm install -g.
#
# Place this script somewhere on your PATH (e.g. ~/.local/bin/freecode)
# and make it executable:  chmod +x freecode
#
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# If a sibling bin/freecode.js exists, use it (cloned repo layout).
if [ -f "$SCRIPT_DIR/bin/freecode.js" ]; then
  exec node "$SCRIPT_DIR/bin/freecode.js" "$@"
fi

# Otherwise, try the global npm install.
if command -v freecode >/dev/null 2>&1 && [ "$(readlink -f "$(command -v freecode)")" != "$SCRIPT_DIR/$0" ]; then
  exec freecode "$@"
fi

# Fallback: try ~/.freecode-src install dir.
if [ -f "$HOME/.freecode-src/bin/freecode.js" ]; then
  exec node "$HOME/.freecode-src/bin/freecode.js" "$@"
fi

echo "FreeCode not found." >&2
echo "Install it first:" >&2
echo "  curl -fsSL https://raw.githubusercontent.com/cameleonnbss/freecode/main/install.sh | bash" >&2
echo "Or:" >&2
echo "  npm install -g freecode" >&2
exit 1
