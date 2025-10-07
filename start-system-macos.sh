#!/bin/bash

# 白垩纪食品溯源系统 - macOS一键启动脚本
# 使用方法: ./start-system-macos.sh

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 项目路径 (macOS)
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend/CretasFoodTrace"

# 端口配置
BACKEND_PORT=3001
RN_DEV_PORT=3010
RN_WEB_PORT=3011

# 打印带颜色的消息
print_message() {
    echo -e "${2}${1}${NC}"
}

# 打印标题
print_title() {
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                    白垩纪食品溯源系统                              ║${NC}"
    echo -e "${WHITE}║                 macOS一键启动脚本 v1.0                          ║${NC}"
    echo -e "${WHITE}║              (React Native + Backend)                        ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
}

# 检查系统依赖
check_dependencies() {
    print_message "🔍 检查系统依赖..." $BLUE
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        print_message "❌ Node.js 未安装，请先安装 Node.js" $RED
        exit 1
    fi
    
    NODE_VERSION=$(node -v)
    print_message "   Node.js版本: $NODE_VERSION" $CYAN
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        print_message "❌ npm 未安装，请先安装 npm" $RED
        exit 1
    fi
    
    NPM_VERSION=$(npm -v)
    print_message "   npm版本: $NPM_VERSION" $CYAN
    
    # 检查Expo CLI
    print_message "   检查Expo CLI..." $CYAN
    if ! command -v expo &> /dev/null; then
        print_message "   正在全局安装Expo CLI..." $CYAN
        npm install -g @expo/cli
    fi
    
    print_message "✅ 系统依赖检查完成" $GREEN
    echo
}

# 检查项目目录
check_directories() {
    print_message "📁 检查项目目录..." $BLUE
    
    if [ ! -d "$BACKEND_DIR" ]; then
        print_message "❌ 后端目录不存在: $BACKEND_DIR" $RED
        exit 1
    fi
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_message "❌ React Native前端目录不存在: $FRONTEND_DIR" $RED
        exit 1
    fi
    
    print_message "✅ 项目目录检查完成" $GREEN
    echo
}

# 安装依赖
install_dependencies() {
    print_message "📦 检查并安装项目依赖..." $BLUE
    
    # 后端依赖
    print_message "   检查后端依赖..." $CYAN
    cd "$BACKEND_DIR"
    if [ ! -d "node_modules" ]; then
        print_message "   安装后端依赖..." $CYAN
        npm install
    fi
    
    # React Native依赖
    print_message "   检查React Native依赖..." $CYAN
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ]; then
        print_message "   安装React Native依赖..." $CYAN
        npm install
    fi
    
    # 安装Web依赖
    print_message "   确保Web依赖已安装..." $CYAN
    npx expo install react-dom react-native-web @expo/metro-runtime > /dev/null 2>&1 || true
    
    print_message "✅ 依赖安装完成" $GREEN
    echo
}

# 清理端口
cleanup_ports() {
    print_message "🧹 清理端口占用..." $BLUE
    
    # 清理可能占用的端口
    for port in $BACKEND_PORT $RN_DEV_PORT $RN_WEB_PORT; do
        PID=$(lsof -ti:$port 2>/dev/null || echo "")
        if [ ! -z "$PID" ]; then
            print_message "   终止端口 $port 上的进程 (PID: $PID)..." $CYAN
            kill -9 $PID 2>/dev/null || true
            sleep 1
        fi
    done
    
    print_message "✅ 端口清理完成" $GREEN
    echo
}

# 启动后端服务
start_backend() {
    print_message "🚀 启动后端服务..." $BLUE
    
    cd "$BACKEND_DIR"
    
    # 后台启动后端
    print_message "   启动后端服务 (端口: $BACKEND_PORT)..." $CYAN
    npm run dev > /dev/null 2>&1 &
    BACKEND_PID=$!
    
    # 等待后端启动
    print_message "   等待后端服务启动..." $CYAN
    sleep 5
    
    # 检查后端是否启动成功
    MAX_RETRIES=10
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
            print_message "✅ 后端服务启动成功 (PID: $BACKEND_PID)" $GREEN
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_message "   等待后端服务启动... ($RETRY_COUNT/$MAX_RETRIES)" $CYAN
        sleep 3
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        print_message "❌ 后端服务启动失败" $RED
        exit 1
    fi
    
    echo
}

# 启动React Native开发服务器
start_rn_dev() {
    print_message "📱 启动React Native开发服务器..." $BLUE
    
    cd "$FRONTEND_DIR"
    
    print_message "   启动Expo开发服务器 (端口: $RN_DEV_PORT)..." $CYAN
    npm start > /dev/null 2>&1 &
    RN_DEV_PID=$!
    
    sleep 3
    print_message "✅ React Native开发服务器启动 (PID: $RN_DEV_PID)" $GREEN
    echo
}

# 启动React Native Web服务器
start_rn_web() {
    print_message "🌐 启动React Native Web服务器..." $BLUE
    
    cd "$FRONTEND_DIR"
    
    print_message "   启动Web版本 (端口: $RN_WEB_PORT)..." $CYAN
    npx expo start --web --port $RN_WEB_PORT > /dev/null 2>&1 &
    RN_WEB_PID=$!
    
    sleep 5
    print_message "✅ React Native Web服务器启动 (PID: $RN_WEB_PID)" $GREEN
    echo
}

# 显示访问信息
show_access_info() {
    print_message "🌐 白垩纪食品溯源系统启动完成！" $GREEN
    
    echo
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                        系统访问地址                             ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🚀 后端API:        ${CYAN}http://localhost:$BACKEND_PORT${WHITE}                  ║${NC}"
    echo -e "${WHITE}║  ❤️  健康检查:       ${CYAN}http://localhost:$BACKEND_PORT/health${WHITE}           ║${NC}"
    echo -e "${WHITE}║  📱 RN开发面板:      ${CYAN}http://localhost:$RN_DEV_PORT${WHITE}                  ║${NC}"
    echo -e "${WHITE}║  🌐 RN Web应用:      ${CYAN}http://localhost:$RN_WEB_PORT${WHITE}                  ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                        使用方法                                ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🌐 Web开发:        访问 http://localhost:$RN_WEB_PORT               ║${NC}"
    echo -e "${WHITE}║  📱 移动端测试:      使用Expo Go扫描二维码                          ║${NC}"
    echo -e "${WHITE}║  🔧 API测试:        访问 http://localhost:$BACKEND_PORT              ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    print_message "🎉 系统已成功启动！" $GREEN
    print_message "💡 所有服务在后台运行，按 Ctrl+C 退出监控" $YELLOW
    echo
}

# 监控服务状态
monitor_services() {
    trap 'echo -e "\n${YELLOW}🔄 监控已退出，服务仍在后台运行${NC}"; exit 0' INT
    
    while true; do
        sleep 30
        
        # 检查后端状态
        if ! curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
            print_message "⚠️  后端服务异常，请检查" $YELLOW
        fi
    done
}

# 主函数
main() {
    clear
    print_title
    
    # 检查系统环境
    check_dependencies
    check_directories
    cleanup_ports
    
    # 准备项目
    install_dependencies
    
    # 启动服务
    start_backend
    start_rn_dev
    start_rn_web
    
    # 显示访问信息
    show_access_info
    
    # 监控系统状态
    monitor_services
}

# 运行主函数
main "$@"