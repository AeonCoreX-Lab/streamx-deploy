#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  StreamX Deploy — Installer
#  curl -sSL https://aeoncorex-lab.github.io/streamx-deploy/install.sh | bash
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE_URL="https://aeoncorex-lab.github.io/streamx-deploy"
TOOL_NAME="streamx-deploy"
INSTALL_DIR="/usr/local/bin"

# ── Colours ────────────────────────────────────────────────────────────────────
G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' R='\033[0;31m' NC='\033[0m' BOLD='\033[1m'
ok()   { echo -e "${G}✓${NC}  $*"; }
err()  { echo -e "${R}✗${NC}  $*" >&2; }
info() { echo -e "${C}›${NC}  $*"; }

echo -e "\n${BOLD}${C}StreamX Deploy Installer${NC}\n"

# ── Check curl/wget ────────────────────────────────────────────────────────────
if command -v curl &>/dev/null; then
  FETCH="curl -sSfL"
elif command -v wget &>/dev/null; then
  FETCH="wget -qO-"
else
  err "Neither curl nor wget found. Install one and try again."
  exit 1
fi

# ── Detect OS / install path ───────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM="linux"  ;;
  Darwin*) PLATFORM="macos"  ;;
  MINGW*|CYGWIN*|MSYS*) PLATFORM="windows" ;;
  *)       PLATFORM="linux"  ;;
esac

# Find writable install directory
if [[ -w "$INSTALL_DIR" ]]; then
  DEST="$INSTALL_DIR/$TOOL_NAME"
elif [[ -d "$HOME/.local/bin" ]]; then
  DEST="$HOME/.local/bin/$TOOL_NAME"
  INSTALL_DIR="$HOME/.local/bin"
else
  mkdir -p "$HOME/.local/bin"
  DEST="$HOME/.local/bin/$TOOL_NAME"
  INSTALL_DIR="$HOME/.local/bin"
fi

# ── Download ───────────────────────────────────────────────────────────────────
info "Downloading streamx-deploy…"
TMP="$(mktemp)"
$FETCH "${BASE_URL}/streamx-deploy" -o "$TMP" || {
  err "Download failed. Check your internet connection."
  rm -f "$TMP"
  exit 1
}

# ── Install ────────────────────────────────────────────────────────────────────
chmod +x "$TMP"

# Try direct install, fallback to sudo
if cp "$TMP" "$DEST" 2>/dev/null; then
  ok "Installed to $DEST"
elif command -v sudo &>/dev/null; then
  info "Requesting sudo to install to $INSTALL_DIR…"
  sudo cp "$TMP" "$DEST"
  ok "Installed to $DEST"
else
  # Last resort: install to home bin
  mkdir -p "$HOME/bin"
  cp "$TMP" "$HOME/bin/$TOOL_NAME"
  DEST="$HOME/bin/$TOOL_NAME"
  INSTALL_DIR="$HOME/bin"
  ok "Installed to $DEST"
fi

rm -f "$TMP"

# ── PATH check ─────────────────────────────────────────────────────────────────
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo ""
  echo -e "${Y}Add to your PATH:${NC}"
  SHELL_RC=""
  case "$SHELL" in
    */zsh)  SHELL_RC="$HOME/.zshrc"   ;;
    */bash) SHELL_RC="$HOME/.bashrc"  ;;
    */fish) SHELL_RC="$HOME/.config/fish/config.fish" ;;
  esac

  if [[ -n "$SHELL_RC" ]]; then
    echo "  echo 'export PATH=\"\$PATH:${INSTALL_DIR}\"' >> $SHELL_RC"
    echo "  source $SHELL_RC"
    # Auto-add if interactive
    if [[ -t 1 ]]; then
      read -r -p "  Add to $SHELL_RC automatically? [Y/n]: " REPLY
      REPLY="${REPLY:-Y}"
      if [[ "$REPLY" =~ ^[Yy]$ ]]; then
        echo "export PATH=\"\$PATH:${INSTALL_DIR}\"" >> "$SHELL_RC"
        ok "Added to $SHELL_RC"
        export PATH="$PATH:$INSTALL_DIR"
      fi
    fi
  else
    echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
  fi
fi

# ── Verify ─────────────────────────────────────────────────────────────────────
echo ""
if "$DEST" version &>/dev/null; then
  VERSION=$("$DEST" version)
  ok "streamx-deploy ${VERSION} installed!"
else
  ok "streamx-deploy installed!"
fi

# ── Next steps ─────────────────────────────────────────────────────────────────
cat << DONE

${BOLD}Get started:${NC}

  ${C}streamx-deploy new${NC}        Create a new addon project
  ${C}streamx-deploy platforms${NC}  Show supported hosting platforms
  ${C}streamx-deploy help${NC}       Show all commands

${G}Deploy your addon in minutes — free on Cloudflare, Vercel, Render, and more.${NC}

DONE
