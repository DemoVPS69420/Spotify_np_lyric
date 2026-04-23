#!/usr/bin/env bash
# ================================================
# Spotify Now Playing - OBS Overlay Launcher
# For Linux / macOS
# ================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Move to script directory (so relative paths work when double-clicked)
cd "$(dirname "$0")"

# Detect OS for the "open browser" helper
open_url() {
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$1" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
        open "$1" >/dev/null 2>&1 &
    else
        echo "   (Please open this URL manually: $1)"
    fi
}

pause() {
    read -r -p "   Press Enter to continue..." _
}

echo
echo -e "${BOLD} ================================================${NC}"
echo -e "${BOLD}      SPOTIFY NOW PLAYING - OBS OVERLAY${NC}"
echo -e "${BOLD} ================================================${NC}"
echo

# ================================================
# [1/4] Check Node.js
# ================================================
echo " [1/4] Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo
    echo -e "${RED} ================================================${NC}"
    echo -e "${RED}  [ERROR] Node.js is not installed!${NC}"
    echo -e "${RED} ================================================${NC}"
    echo
    echo "  Node.js is required to run this tool."
    echo
    echo "  Install options:"
    echo "   - Ubuntu/Debian : sudo apt install nodejs npm"
    echo "   - Fedora        : sudo dnf install nodejs npm"
    echo "   - Arch          : sudo pacman -S nodejs npm"
    echo "   - macOS (brew)  : brew install node"
    echo "   - Manual/NVM    : https://nodejs.org/"
    echo
    pause
    open_url "https://nodejs.org/"
    exit 1
fi
NODE_VER="$(node --version 2>/dev/null)"
echo -e "  ${GREEN}OK${NC} - Node.js ${NODE_VER}"
echo

# ================================================
# [2/4] Check PHP
# ================================================
echo " [2/4] Checking PHP..."
if ! command -v php >/dev/null 2>&1; then
    echo -e "  ${YELLOW}WARNING${NC} - PHP is not installed."
    echo "  The Spotify lyrics fetching feature will not work."
    echo
    echo "  How to install PHP:"
    echo "   - Ubuntu/Debian : sudo apt install php-cli"
    echo "   - Fedora        : sudo dnf install php-cli"
    echo "   - Arch          : sudo pacman -S php"
    echo "   - macOS (brew)  : brew install php"
    echo
    read -r -p "   Skip PHP and continue anyway? (y/n): " _SKIP_PHP
    if [[ "${_SKIP_PHP,,}" != "y" ]]; then
        exit 1
    fi
    echo
else
    PHP_VER="$(php -v 2>/dev/null | head -n1 | awk '{print $2}')"
    echo -e "  ${GREEN}OK${NC} - PHP ${PHP_VER}"
    echo
fi

# ================================================
# [3/4] Check Python
# ================================================
echo " [3/4] Checking Python..."
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
fi

if [[ -z "$PYTHON_CMD" ]]; then
    echo -e "  ${YELLOW}WARNING${NC} - Python is not installed - YouTube Music lyrics fallback will be disabled."
    echo "  (Optional - safe to skip)"
else
    PY_VER="$($PYTHON_CMD --version 2>&1)"
    echo -e "  ${GREEN}OK${NC} - ${PY_VER}"
fi
echo

# ================================================
# [4/4] Check and configure .env
# ================================================
echo " [4/4] Checking configuration..."

NEEDS_SETUP=0
if [[ ! -f ".env" ]]; then
    NEEDS_SETUP=1
elif grep -q "your_client_id_here" .env 2>/dev/null \
  || grep -q "your_client_secret_here" .env 2>/dev/null \
  || grep -q "your_sp_dc_cookie_value_here" .env 2>/dev/null; then
    NEEDS_SETUP=1
fi

if [[ $NEEDS_SETUP -eq 1 ]]; then
    echo
    echo -e "${CYAN} ================================================${NC}"
    echo -e "${CYAN}    FIRST-TIME SETUP - Spotify credentials needed${NC}"
    echo -e "${CYAN} ================================================${NC}"
    echo
    echo "  You need two types of credentials. Please read carefully:"
    echo
    echo -e "${BOLD}  --- [A] CLIENT ID and CLIENT SECRET ---${NC}"
    echo "  1. Go to: https://developer.spotify.com/dashboard"
    echo "  2. Log in with your Spotify account"
    echo "  3. Click \"Create App\""
    echo "  4. Give it any name. For \"Redirect URI\" enter exactly:"
    echo
    echo "       http://127.0.0.1:8888/callback"
    echo
    echo "  5. Click Save, then open Settings to see Client ID and Secret"
    echo
    echo -e "${BOLD}  --- [B] SP_DC cookie ---${NC}"
    echo "  1. Open Chrome and go to: https://open.spotify.com"
    echo "  2. Log in to Spotify (if not already logged in)"
    echo "  3. Press F12, open the \"Application\" tab"
    echo "  4. Left panel: expand Cookies -> https://open.spotify.com"
    echo "  5. Find the row named \"sp_dc\", copy the \"Value\" column"
    echo
    pause
    open_url "https://developer.spotify.com/dashboard"
    echo
    echo " ================================================"
    echo
    read -r -p "   Enter SPOTIFY_CLIENT_ID     : " _CID
    read -r -p "   Enter SPOTIFY_CLIENT_SECRET : " _CS
    read -r -p "   Enter SP_DC                 : " _DC

    if [[ -z "$_CID" || -z "$_CS" || -z "$_DC" ]]; then
        echo
        echo -e "  ${RED}[ERROR]${NC} Fields cannot be empty. Please run this file again and fill all fields."
        exit 1
    fi

    cat > .env <<EOF
SPOTIFY_CLIENT_ID=${_CID}
SPOTIFY_CLIENT_SECRET=${_CS}
SP_DC=${_DC}
EOF
    chmod 600 .env 2>/dev/null || true

    echo
    echo -e "  ${GREEN}OK${NC} - .env saved successfully!"
    echo
else
    echo -e "  ${GREEN}OK${NC} - .env is configured"
    echo
fi

# ================================================
# Install Node.js dependencies if missing
# ================================================
if [[ ! -d "node_modules/express" ]]; then
    echo " Installing Node.js dependencies (first run, takes 1-2 minutes)..."
    echo
    if ! npm install; then
        echo
        echo -e " ${RED}[ERROR]${NC} npm install failed!"
        echo " Check your internet connection and try again."
        exit 1
    fi
    echo
    echo -e " ${GREEN}Installation complete!${NC}"
    echo
fi

# ================================================
# Start the server
# ================================================
echo " ================================================"
echo "  STARTING SERVER..."
echo " ================================================"
echo
echo "  OBS Browser Source URL:"
echo "    http://127.0.0.1:8888"
echo
echo "  Once the server starts, your browser will open"
echo "  the Spotify login page. Please authorize the app."
echo
echo "  Add the URL to OBS: Sources > Add > Browser Source"
echo "  URL: http://127.0.0.1:8888"
echo
echo "  Press Ctrl+C to stop the server when done."
echo " ------------------------------------------------"
echo

node server.js

echo
echo " Server stopped."
