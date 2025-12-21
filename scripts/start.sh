#!/bin/bash
# Presentation Coach - Startup Script
# Builds frontend and starts backend server

set -e

# ============================================================================
# Colors & Formatting
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
CHECK="${GREEN}✓${RESET}"
CROSS="${RED}✗${RESET}"
ARROW="${CYAN}➜${RESET}"
SPARKLE="${YELLOW}✨${RESET}"

# ============================================================================
# Paths
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"
BACKEND_DIR="$PROJECT_ROOT/src/backend"

# ============================================================================
# Animation Functions
# ============================================================================
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while ps -p $pid > /dev/null 2>&1; do
        for (( i=0; i<${#spinstr}; i++ )); do
            printf "\r   ${CYAN}${spinstr:$i:1}${RESET} $2"
            sleep $delay
        done
    done
    printf "\r"
}

progress_bar() {
    local current=$1
    local total=$2
    local width=40
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r   ${GRAY}[${RESET}"
    printf "${GREEN}%${filled}s${RESET}" | tr ' ' '█'
    printf "${GRAY}%${empty}s${RESET}" | tr ' ' '░'
    printf "${GRAY}]${RESET} ${WHITE}%3d%%${RESET}" $percentage
}

type_text() {
    local text="$1"
    local delay=${2:-0.02}
    for (( i=0; i<${#text}; i++ )); do
        printf "%s" "${text:$i:1}"
        sleep $delay
    done
    echo ""
}

# ============================================================================
# Logo & Banner
# ============================================================================
show_logo() {
    clear
    echo ""
    echo -e "${PURPLE}"
    cat << 'EOF'
    ██████╗ ██████╗ ███████╗███████╗███████╗███╗   ██╗████████╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
    ██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝████╗  ██║╚══██╔══╝██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
    ██████╔╝██████╔╝█████╗  ███████╗█████╗  ██╔██╗ ██║   ██║   ███████║   ██║   ██║██║   ██║██╔██╗ ██║
    ██╔═══╝ ██╔══██╗██╔══╝  ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
    ██║     ██║  ██║███████╗███████║███████╗██║ ╚████║   ██║   ██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
    ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
EOF
    echo -e "${RESET}"
    echo -e "${CYAN}"
    cat << 'EOF'
                             ██████╗ ██████╗  █████╗  ██████╗██╗  ██╗
                            ██╔════╝██╔═══██╗██╔══██╗██╔════╝██║  ██║
                            ██║     ██║   ██║███████║██║     ███████║
                            ██║     ██║   ██║██╔══██║██║     ██╔══██║
                            ╚██████╗╚██████╔╝██║  ██║╚██████╗██║  ██║
                             ╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
EOF
    echo -e "${RESET}"
    echo ""
    echo -e "                    ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "                         ${SPARKLE} ${WHITE}AI-Powered Presentation Training${RESET} ${SPARKLE}"
    echo -e "                    ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    sleep 0.5
}

# ============================================================================
# Dependency Checks
# ============================================================================
check_dependency() {
    local name="$1"
    local command="$2"
    local version_flag="${3:---version}"
    local required="${4:-true}"
    
    printf "   ${ARROW} Checking ${WHITE}%-12s${RESET}" "$name..."
    
    if command -v $command &> /dev/null; then
        local version=$($command $version_flag 2>&1 | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)
        printf " ${CHECK} ${GREEN}Found${RESET} ${DIM}(v${version})${RESET}\n"
        return 0
    else
        if [ "$required" = "true" ]; then
            printf " ${CROSS} ${RED}Not found${RESET}\n"
            return 1
        else
            printf " ${YELLOW}⚠${RESET} ${YELLOW}Not found (optional)${RESET}\n"
            return 0
        fi
    fi
}

run_checks() {
    echo -e "\n${BOLD}${WHITE}🔍 System Requirements Check${RESET}"
    echo -e "${DIM}   ─────────────────────────────────────────${RESET}\n"
    
    local failed=0
    
    # Python
    if ! check_dependency "Python" "python3" "--version"; then
        if ! check_dependency "Python" "python" "--version"; then
            failed=1
        fi
    fi
    
    # pip
    if ! check_dependency "pip" "pip3" "--version"; then
        if ! check_dependency "pip" "pip" "--version"; then
            failed=1
        fi
    fi
    
    # Node.js
    check_dependency "Node.js" "node" "--version" || failed=1
    
    # npm
    check_dependency "npm" "npm" "--version" || failed=1
    
    # FFmpeg
    check_dependency "FFmpeg" "ffmpeg" "-version" || failed=1
    
    # Git (optional)
    check_dependency "Git" "git" "--version" "false"
    
    echo ""
    
    if [ $failed -eq 1 ]; then
        echo -e "   ${CROSS} ${RED}Some required dependencies are missing!${RESET}"
        echo -e "   ${DIM}Please install the missing dependencies and try again.${RESET}\n"
        exit 1
    else
        echo -e "   ${CHECK} ${GREEN}All required dependencies found!${RESET}\n"
    fi
    
    sleep 0.3
}

# ============================================================================
# Build Steps
# ============================================================================
step_frontend_deps() {
    echo -e "${BOLD}${WHITE}📦 Frontend Dependencies${RESET}"
    echo -e "${DIM}   ─────────────────────────────────────────${RESET}\n"
    
    cd "$FRONTEND_DIR"
    
    if [ ! -d "node_modules" ]; then
        echo -e "   ${ARROW} Installing npm packages..."
        npm install --silent &
        spinner $! "Installing npm packages..."
        echo -e "   ${CHECK} ${GREEN}npm packages installed${RESET}\n"
    else
        echo -e "   ${CHECK} ${GREEN}npm packages already installed${RESET}\n"
    fi
    
    sleep 0.2
}

step_frontend_build() {
    echo -e "${BOLD}${WHITE}🔨 Building Frontend${RESET}"
    echo -e "${DIM}   ─────────────────────────────────────────${RESET}\n"
    
    cd "$FRONTEND_DIR"
    
    echo -e "   ${ARROW} Compiling TypeScript & bundling assets..."
    
    # Run build in background and show spinner
    npm run build --silent 2>&1 &
    local pid=$!
    spinner $pid "Building frontend..."
    wait $pid
    
    echo -e "   ${CHECK} ${GREEN}Frontend build complete${RESET}\n"
    sleep 0.2
}

step_copy_assets() {
    echo -e "${BOLD}${WHITE}📁 Deploying Assets${RESET}"
    echo -e "${DIM}   ─────────────────────────────────────────${RESET}\n"
    
    mkdir -p "$BACKEND_DIR/static"
    
    echo -e "   ${ARROW} Copying build files to backend..."
    cp -r "$FRONTEND_DIR/dist/"* "$BACKEND_DIR/static/" &
    spinner $! "Copying files..."
    
    local file_count=$(find "$BACKEND_DIR/static" -type f | wc -l)
    echo -e "   ${CHECK} ${GREEN}Deployed ${WHITE}$file_count${GREEN} files to static folder${RESET}\n"
    sleep 0.2
}

step_backend_deps() {
    echo -e "${BOLD}${WHITE}🐍 Backend Dependencies${RESET}"
    echo -e "${DIM}   ─────────────────────────────────────────${RESET}\n"
    
    cd "$BACKEND_DIR"
    
    if [ ! -d ".venv" ] && [ -z "$VIRTUAL_ENV" ]; then
        echo -e "   ${ARROW} Installing Python packages..."
        pip install -r requirements.txt -q &
        spinner $! "Installing Python packages..."
        echo -e "   ${CHECK} ${GREEN}Python packages installed${RESET}\n"
    else
        echo -e "   ${CHECK} ${GREEN}Python environment ready${RESET}\n"
    fi
    
    sleep 0.2
}

step_start_server() {
    local port="${PORT:-8015}"
    
    echo -e "${BOLD}${WHITE}🚀 Starting Server${RESET}"
    echo -e "${DIM}   ─────────────────────────────────────────${RESET}\n"
    
    echo -e "   ${ARROW} Initializing Flask application...\n"
    sleep 0.5
    
    echo -e "${DIM}   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    echo -e "   ${SPARKLE} ${BOLD}${GREEN}Presentation Coach is ready!${RESET} ${SPARKLE}"
    echo ""
    echo -e "   ${WHITE}Local:${RESET}   ${CYAN}http://localhost:${port}${RESET}"
    echo -e "   ${WHITE}Network:${RESET} ${CYAN}http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo "0.0.0.0"):${port}${RESET}"
    echo ""
    echo -e "   ${DIM}Press ${WHITE}Ctrl+C${DIM} to stop the server${RESET}"
    echo -e "${DIM}   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    
    cd "$BACKEND_DIR"
    python -m src.app
}

# ============================================================================
# Main
# ============================================================================
main() {
    show_logo
    run_checks
    step_frontend_deps
    step_frontend_build
    step_copy_assets
    step_backend_deps
    step_start_server
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n\n   ${YELLOW}👋 Shutting down gracefully...${RESET}\n"; exit 0' SIGINT SIGTERM

main
