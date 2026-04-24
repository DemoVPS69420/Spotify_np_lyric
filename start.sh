#!/usr/bin/env bash
# ================================================
# Spotify Now Playing - OBS Overlay Launcher
# For Linux / macOS
# Auto-installs missing dependencies when possible.
# ================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Run from the script's own directory (so ./node_modules, ./.env resolve correctly)
cd "$(dirname "$0")" || exit 1

# ------------------------------------------------
# Helpers
# ------------------------------------------------
pause() { read -r -p "   Press Enter to continue..." _; }

is_yes() { [[ "$1" =~ ^[Yy]([Ee][Ss])?$ ]]; }

open_url() {
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$1" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
        open "$1" >/dev/null 2>&1 &
    else
        echo "   (Please open this URL manually: $1)"
    fi
}

# ------------------------------------------------
# Package-manager detection
# ------------------------------------------------
PKG_MGR=""
PKG_INSTALL=""
NEED_SUDO="no"

if command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="apt"
    PKG_INSTALL="sudo apt-get install -y"
    NEED_SUDO="yes"
elif command -v dnf >/dev/null 2>&1; then
    PKG_MGR="dnf"
    PKG_INSTALL="sudo dnf install -y"
    NEED_SUDO="yes"
elif command -v pacman >/dev/null 2>&1; then
    PKG_MGR="pacman"
    PKG_INSTALL="sudo pacman -S --noconfirm --needed"
    NEED_SUDO="yes"
elif command -v zypper >/dev/null 2>&1; then
    PKG_MGR="zypper"
    PKG_INSTALL="sudo zypper install -y"
    NEED_SUDO="yes"
elif command -v brew >/dev/null 2>&1; then
    PKG_MGR="brew"
    PKG_INSTALL="brew install"
    NEED_SUDO="no"
fi

# Refresh apt index once
apt_refreshed=0
ensure_apt_ready() {
    if [[ "$PKG_MGR" == "apt" && $apt_refreshed -eq 0 ]]; then
        echo "   Updating package index (sudo apt-get update)..."
        sudo apt-get update -qq
        apt_refreshed=1
    fi
}

# pkg_install "<display name>" <apt_pkgs> <dnf_pkgs> <pacman_pkgs> <zypper_pkgs> <brew_pkgs>
# Pass "-" to skip a particular package manager.
pkg_install() {
    local name="$1" apt="$2" dnf="$3" pac="$4" zyp="$5" brw="$6"
    local pkg=""
    case "$PKG_MGR" in
        apt)    pkg="$apt" ;;
        dnf)    pkg="$dnf" ;;
        pacman) pkg="$pac" ;;
        zypper) pkg="$zyp" ;;
        brew)   pkg="$brw" ;;
        *)
            echo -e "   ${YELLOW}No supported package manager detected — install '$name' manually.${NC}"
            return 1
            ;;
    esac
    if [[ -z "$pkg" || "$pkg" == "-" ]]; then
        echo -e "   ${YELLOW}No known package name for $PKG_MGR — install '$name' manually.${NC}"
        return 1
    fi

    ensure_apt_ready
    echo -e "   ${CYAN}>>> $PKG_INSTALL $pkg${NC}"
    if [[ "$NEED_SUDO" == "yes" ]]; then
        echo "   (You may be prompted for your sudo password.)"
    fi

    # shellcheck disable=SC2086
    if $PKG_INSTALL $pkg; then
        echo -e "   ${GREEN}Installed $name successfully.${NC}"
        return 0
    fi
    echo -e "   ${RED}Failed to install $name.${NC}"
    return 1
}

# ------------------------------------------------
# Banner
# ------------------------------------------------
echo
echo -e "${BOLD} ================================================${NC}"
echo -e "${BOLD}      SPOTIFY NOW PLAYING - OBS OVERLAY${NC}"
echo -e "${BOLD} ================================================${NC}"
if [[ -n "$PKG_MGR" ]]; then
    echo -e "   Detected package manager: ${CYAN}${PKG_MGR}${NC}"
else
    echo -e "   ${YELLOW}No supported package manager detected.${NC}"
    echo    "   You'll need to install missing tools manually."
fi
echo

# ================================================
# [1/4] Node.js (+ npm)
# ================================================
echo " [1/4] Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo -e "   ${YELLOW}Node.js is not installed.${NC}"
    read -r -p "   Auto-install Node.js now? (y/n): " ans
    if is_yes "$ans"; then
        # Distro packages (may be old on Debian/Ubuntu — works for most users).
        pkg_install "Node.js + npm" \
            "nodejs npm" \
            "nodejs npm" \
            "nodejs npm" \
            "nodejs npm" \
            "node" \
            || {
                echo
                echo "   Tip: for newer Node.js on Debian/Ubuntu, run:"
                echo "     curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -"
                echo "     sudo apt-get install -y nodejs"
                exit 1
            }
    else
        echo "   Please install Node.js manually: https://nodejs.org/"
        open_url "https://nodejs.org/"
        exit 1
    fi
fi
NODE_VER="$(node --version 2>/dev/null)"
echo -e "   ${GREEN}OK${NC} - Node.js ${NODE_VER}"

# Require Node.js >= 18 (optional chaining, ESM dynamic imports used in canvas service).
NODE_MAJOR="$(node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')"
if [[ -n "$NODE_MAJOR" && "$NODE_MAJOR" -lt 18 ]]; then
    echo
    echo -e "   ${RED}[ERROR] Node.js ${NODE_VER} is too old.${NC}"
    echo    "   This project requires Node.js 18 or newer."
    echo    "   Your version will crash with: 'SyntaxError: Unexpected token .'"
    echo
    echo    "   How to upgrade:"
    if [[ "$PKG_MGR" == "apt" ]]; then
        echo "     # Remove old Node first:"
        echo "     sudo apt-get remove -y nodejs npm"
        echo "     # Install Node 20 LTS from NodeSource:"
        echo "     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "     sudo apt-get install -y nodejs"
        echo
        read -r -p "   Auto-upgrade Node.js to 20 LTS now via NodeSource? (y/n): " ans
        if is_yes "$ans"; then
            sudo apt-get remove -y nodejs npm || true
            if curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -; then
                sudo apt-get install -y nodejs
                NODE_VER="$(node --version 2>/dev/null)"
                echo -e "   ${GREEN}Upgraded to Node.js ${NODE_VER}${NC}"
            else
                echo -e "   ${RED}NodeSource setup failed.${NC}"
                exit 1
            fi
        else
            exit 1
        fi
    elif [[ "$PKG_MGR" == "dnf" ]]; then
        echo "     sudo dnf module reset nodejs"
        echo "     sudo dnf module install nodejs:20/common"
        exit 1
    elif [[ "$PKG_MGR" == "pacman" ]]; then
        echo "     sudo pacman -Syu nodejs npm   (rolling release — should already be modern)"
        exit 1
    elif [[ "$PKG_MGR" == "brew" ]]; then
        echo "     brew upgrade node   (or:  brew install node@20)"
        exit 1
    else
        echo "     Install the latest LTS from https://nodejs.org/"
        exit 1
    fi
fi

# npm may ship separately on some distros.
if ! command -v npm >/dev/null 2>&1; then
    echo -e "   ${YELLOW}npm is not installed — installing...${NC}"
    pkg_install "npm" "npm" "npm" "npm" "npm" "node" || exit 1
fi
echo

# ================================================
# [2/4] PHP
# ================================================
echo " [2/4] Checking PHP..."
if ! command -v php >/dev/null 2>&1; then
    echo -e "   ${YELLOW}PHP is not installed.${NC} (needed for Spotify lyrics fetching)"
    read -r -p "   Auto-install PHP now? (y/n, 'n' = skip feature): " ans
    if is_yes "$ans"; then
        # Install php-cli AND php-curl (required for Spotify lyrics API — uses curl_init)
        pkg_install "PHP CLI + curl extension" \
            "php-cli php-curl" \
            "php-cli php-curl" \
            "php php-curl" \
            "php-cli php-curl" \
            "php" \
            || {
                read -r -p "   Continue without PHP? (y/n): " cont
                is_yes "$cont" || exit 1
            }
    fi
fi
if command -v php >/dev/null 2>&1; then
    PHP_VER="$(php -v 2>/dev/null | head -n1 | awk '{print $2}')"
    echo -e "   ${GREEN}OK${NC} - PHP ${PHP_VER}"

    # Verify PHP curl extension is loaded (required by Spotify lyrics API).
    if ! php -m 2>/dev/null | grep -qi '^curl$'; then
        echo -e "   ${YELLOW}PHP curl extension missing${NC} — Spotify lyrics will fail with 'undefined function curl_init()'."
        read -r -p "   Install php-curl now? (y/n): " ans
        if is_yes "$ans"; then
            pkg_install "PHP curl extension" \
                "php-curl" \
                "php-curl" \
                "php-curl" \
                "php-curl" \
                "-" \
                || echo -e "   ${YELLOW}Install failed — install php-curl manually.${NC}"
        fi
    fi
else
    echo -e "   ${YELLOW}PHP skipped — Spotify lyrics feature disabled.${NC}"
fi
echo

# ================================================
# [3/4] Python 3
# ================================================
echo " [3/4] Checking Python..."
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
fi

if [[ -z "$PYTHON_CMD" ]]; then
    echo -e "   ${YELLOW}Python is not installed.${NC} (optional - YouTube Music lyrics fallback)"
    read -r -p "   Auto-install Python 3 now? (y/n, 'n' = skip feature): " ans
    if is_yes "$ans"; then
        pkg_install "Python 3" \
            "python3" \
            "python3" \
            "python" \
            "python3" \
            "python" \
            || true
        if command -v python3 >/dev/null 2>&1; then
            PYTHON_CMD="python3"
        elif command -v python >/dev/null 2>&1; then
            PYTHON_CMD="python"
        fi
    fi
fi
if [[ -n "$PYTHON_CMD" ]]; then
    PY_VER="$($PYTHON_CMD --version 2>&1)"
    echo -e "   ${GREEN}OK${NC} - ${PY_VER}"
else
    echo -e "   ${YELLOW}Python skipped — YouTube Music fallback disabled.${NC}"
fi
echo

# ================================================
# [4/4] .env configuration
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
