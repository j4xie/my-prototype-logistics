#!/bin/bash

# 完整系统启动脚本
# 用途: 一次性启动所有必需的服务 (MySQL, Spring Boot, React Native)
# 注意: AI 功能已迁移至 DashScope 直连，无需单独启动 Python 服务 (2026-01-14)
# 使用: bash start-complete-system.sh

set -e

echo "================================"
echo "🚀 Cretas Food Trace 完整系统启动"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"

# 检查 JDK 17 是否可用
check_java() {
    echo -e "${BLUE}检查 Java 环境...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
    fi

    if ! command -v java &> /dev/null; then
        echo -e "${RED}❌ 错误: 未找到 Java。请安装 JDK 17。${NC}"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | grep -oP '(?<=")[0-9]+(?=\.)' | head -1)
    if [ "$JAVA_VERSION" != "17" ] && [ "$JAVA_VERSION" != "21" ]; then
        echo -e "${YELLOW}⚠️ 警告: 检测到 Java 版本 $JAVA_VERSION，推荐使用 JDK 17 或更高。${NC}"
    fi
    echo -e "${GREEN}✅ Java 环境 OK${NC}"
    echo ""
}

# 启动 MySQL
start_mysql() {
    echo -e "${BLUE}启动 MySQL 数据库...${NC}"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! mysql.server status &> /dev/null; then
            echo "  启动 MySQL..."
            mysql.server start
        else
            echo "  MySQL 已在运行"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if ! sudo systemctl status mysql &> /dev/null; then
            echo "  启动 MySQL..."
            sudo systemctl start mysql
        else
            echo "  MySQL 已在运行"
        fi
    fi

    # 等待 MySQL 启动
    sleep 2

    # 验证连接
    if mysql -u root cretas_db -e "SELECT 1" &> /dev/null; then
        echo -e "${GREEN}✅ MySQL 连接成功${NC}"
    else
        echo -e "${RED}❌ MySQL 连接失败。请检查数据库和凭证。${NC}"
        exit 1
    fi
    echo ""
}

# [已废弃] Python AI 服务 - 2026-01-14 迁移至 DashScope 直连
# 无需单独启动 Python 服务，AI 功能由 Spring Boot 通过 DashScope API 直接调用

# 启动 Spring Boot 后端
start_spring_boot() {
    echo -e "${BLUE}启动 Spring Boot 后端服务...${NC}"

    # 检查是否已有进程运行在 10010 端口
    if lsof -i :10010 &> /dev/null; then
        echo "  端口 10010 已被占用，跳过 Spring Boot 启动"
        echo "  如需重启，请运行: lsof -i :10010 | grep LISTEN | awk '{print \$2}' | xargs kill -9"
        echo ""
        return
    fi

    cd "$PROJECT_ROOT/backend-java"

    # 编译 (如果需要)
    if [ ! -d "target" ]; then
        echo "  编译 Spring Boot 项目..."
        mvn clean package -DskipTests -q
    fi

    # 启动服务 (后台运行)
    echo "  启动 Spring Boot 服务..."
    nohup mvn spring-boot:run > backend.log 2>&1 &
    BACKEND_PID=$!
    echo "  后端服务 PID: $BACKEND_PID"

    # 等待服务启动
    sleep 5

    # 验证服务
    if curl -s http://localhost:10010/api/mobile/health &> /dev/null; then
        echo -e "${GREEN}✅ Spring Boot 后端启动成功 (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${YELLOW}⚠️ 警告: 无法验证后端服务，可能尚未完全启动${NC}"
        echo "  请检查日志: tail backend.log"
    fi

    cd "$PROJECT_ROOT"
    echo ""
}

# 启动 React Native 前端
start_react_native() {
    echo -e "${BLUE}启动 React Native 前端 (Expo)...${NC}"

    cd "$PROJECT_ROOT/frontend/CretasFoodTrace"

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo "  安装 npm 依赖..."
        npm install -q
    fi

    # 启动 Expo (后台运行，打开新终端)
    echo "  启动 Expo 开发服务器..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - 打开新终端窗口
        osascript -e 'tell app "Terminal" to do script "cd '"$PROJECT_ROOT/frontend/CretasFoodTrace"' && npm start"'
    else
        # Linux - 使用 gnome-terminal 或 xterm
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal -- bash -c "cd '$PROJECT_ROOT/frontend/CretasFoodTrace' && npm start; read -p 'Press any key to exit...'"
        else
            xterm -e "cd '$PROJECT_ROOT/frontend/CretasFoodTrace' && npm start" &
        fi
    fi

    echo -e "${GREEN}✅ React Native 前端启动${NC}"
    echo "  请在新打开的终端窗口中选择: 'a' (Android) 或 'i' (iOS) 或扫描二维码"
    echo ""

    cd "$PROJECT_ROOT"
}

# 显示启动总结
show_summary() {
    echo ""
    echo "================================"
    echo -e "${GREEN}✅ 系统启动完成！${NC}"
    echo "================================"
    echo ""
    echo -e "${BLUE}服务地址:${NC}"
    echo "  MySQL Database:    localhost:3306"
    echo "  Spring Boot API:   http://localhost:10010"
    echo "  React Native Expo: http://localhost:3010 (in new terminal)"
    echo ""
    echo -e "${BLUE}AI 服务:${NC}"
    echo "  已迁移至 DashScope 直连 (通过 Spring Boot 调用)"
    echo ""
    echo -e "${BLUE}快速验证:${NC}"
    echo "  后端健康检查: curl http://localhost:10010/api/mobile/health"
    echo ""
    echo -e "${BLUE}日志文件:${NC}"
    echo "  后端日志: backend-java/backend.log"
    echo ""
    echo -e "${YELLOW}进程管理:${NC}"
    echo "  查看运行进程: lsof -i :10010"
    echo "  停止后端:    pkill -f spring-boot:run"
    echo ""
    echo "================================"
}

# 清理函数 (CTRL+C 时触发)
cleanup() {
    echo ""
    echo -e "${YELLOW}收到中断信号，准备停止所有服务...${NC}"

    # 尝试优雅关闭服务
    pkill -f spring-boot:run 2>/dev/null || true

    echo -e "${GREEN}✅ 所有服务已停止${NC}"
    exit 0
}

# 设置陷阱
trap cleanup SIGINT SIGTERM

# 主要执行流程
main() {
    check_java
    start_mysql
    # [已废弃] start_python_ai - AI 功能已迁移至 DashScope 直连
    start_spring_boot
    start_react_native
    show_summary

    echo -e "${BLUE}系统在后台运行中...${NC}"
    echo "按 Ctrl+C 停止所有服务"
    echo ""

    # 保持脚本运行
    wait
}

# 执行主函数
main
