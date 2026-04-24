#!/usr/bin/env bash
set -euo pipefail

APP=text-adventure-cli
INSTALL_DIR=$HOME/.$APP
NODE_VERSION_REQUIRED="14.0.0"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_message() {
    local level=$1
    local message=$2
    local color=""
    case $level in
        info) color="${BLUE}" ;;
        success) color="${GREEN}" ;;
        warning) color="${YELLOW}" ;;
        error) color="${RED}" ;;
    esac
    echo -e "${color}${message}${NC}"
}

check_node() {
    if ! command -v node >/dev/null 2>&1; then
        print_message error "❌ Node.js 未安装"
        echo ""
        echo "请安装 Node.js (>= 14.0.0):"
        echo "  - macOS:   brew install node"
        echo "  - Ubuntu:  sudo apt install nodejs npm"
        echo "  - Windows: https://nodejs.org/"
        echo ""
        exit 1
    fi

    local node_version
    node_version=$(node --version | sed 's/v//')
    print_message info "✓ 检测到 Node.js v${node_version}"
}

check_npm() {
    if ! command -v npm >/dev/null 2>&1; then
        print_message error "❌ npm 未安装"
        exit 1
    fi
    print_message info "✓ 检测到 npm"
}

install_adventure() {
    print_message info "📦 正在安装 text-adventure-cli..."
    
    if npm list -g text-adventure-cli >/dev/null 2>&1; then
        print_message warning "⚠️  text-adventure-cli 已安装，正在更新..."
        npm update -g text-adventure-cli
    else
        npm install -g text-adventure-cli
    fi

    if [ $? -eq 0 ]; then
        print_message success "✅ text-adventure-cli 安装成功!"
        echo ""
        echo "使用方法:"
        echo "  adventure        # 启动游戏"
        echo "  tq               # 短命令别名"
        echo "  terminal-quest   # 完整命令别名"
        echo ""
    else
        print_message error "❌ 安装失败"
        exit 1
    fi
}

main() {
    echo ""
    print_message info "🎮 Text Adventure CLI 安装程序"
    echo ""
    
    check_node
    check_npm
    install_adventure
}

main "$@"
