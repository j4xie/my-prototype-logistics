#!/bin/bash

# 海牛食品溯源系统 - 一键启动脚本
# 使用方法: ./run-system.sh 或 run system

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 项目路径
PROJECT_ROOT="/mnt/c/Users/Steve/heiniu"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend/web-app-next"

# 端口配置
BACKEND_PORT=3001
FRONTEND_PORT=3000
MYSQL_PORT=3306

# 打印带颜色的消息
print_message() {
    echo -e "${2}${1}${NC}"
}

# 打印标题
print_title() {
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                    海牛食品溯源系统                              ║${NC}"
    echo -e "${WHITE}║                   一键启动脚本 v1.0                             ║${NC}"
    echo -e "${WHITE}║               (包含智能工厂ID生成功能)                           ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
}

# 检查MySQL服务
check_mysql() {
    print_message "🗄️  检查MySQL数据库服务..." $BLUE
    
    # 检查MySQL是否在运行
    if ! pgrep -x "mysqld" > /dev/null 2>&1; then
        print_message "⚠️  MySQL服务未运行，尝试启动..." $YELLOW
        
        # 尝试启动MySQL (Windows WSL)
        if command -v net.exe &> /dev/null; then
            print_message "   启动Windows MySQL服务..." $CYAN
            net.exe start mysql 2>/dev/null || true
        fi
        
        # 等待MySQL启动
        sleep 3
        
        # 再次检查
        if ! pgrep -x "mysqld" > /dev/null 2>&1; then
            print_message "❌ 无法启动MySQL服务" $RED
            print_message "   请手动启动MySQL服务后重试" $YELLOW
            print_message "   Windows: 运行 'net start mysql' 或在服务中启动MySQL" $YELLOW
            exit 1
        fi
    fi
    
    # 检查MySQL端口
    if ! netstat -tuln | grep -q ":$MYSQL_PORT "; then
        print_message "⚠️  MySQL端口 $MYSQL_PORT 未监听" $YELLOW
        sleep 2
    fi
    
    print_message "✅ MySQL数据库服务运行正常" $GREEN
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
        print_message "❌ 前端目录不存在: $FRONTEND_DIR" $RED
        exit 1
    fi
    
    print_message "✅ 项目目录检查完成" $GREEN
    echo
}

# 检查端口占用
check_ports() {
    print_message "🔌 检查端口占用情况..." $BLUE
    
    # 检查后端端口
    if netstat -tuln | grep -q ":$BACKEND_PORT "; then
        print_message "⚠️  后端端口 $BACKEND_PORT 已被占用，尝试释放..." $YELLOW
        
        # Windows WSL环境下结束进程
        if command -v taskkill.exe &> /dev/null; then
            # 查找并结束占用端口的进程
            PORT_PID=$(netstat -ano | grep ":$BACKEND_PORT " | awk '{print $5}' | head -1)
            if [ ! -z "$PORT_PID" ]; then
                taskkill.exe /F /PID $PORT_PID 2>/dev/null || true
            fi
        fi
        
        sleep 2
    fi
    
    # 检查前端端口
    if netstat -tuln | grep -q ":$FRONTEND_PORT "; then
        print_message "⚠️  前端端口 $FRONTEND_PORT 已被占用，尝试释放..." $YELLOW
        
        # Windows WSL环境下结束进程
        if command -v taskkill.exe &> /dev/null; then
            PORT_PID=$(netstat -ano | grep ":$FRONTEND_PORT " | awk '{print $5}' | head -1)
            if [ ! -z "$PORT_PID" ]; then
                taskkill.exe /F /PID $PORT_PID 2>/dev/null || true
            fi
        fi
        
        sleep 2
    fi
    
    print_message "✅ 端口检查完成" $GREEN
    echo
}

# 安装依赖
install_dependencies() {
    print_message "📦 检查并安装项目依赖..." $BLUE
    
    # 后端依赖
    print_message "   检查后端依赖..." $CYAN
    cd "$BACKEND_DIR"
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        print_message "   安装后端依赖..." $CYAN
        npm install --silent
    fi
    
    # 前端依赖
    print_message "   检查前端依赖..." $CYAN
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        print_message "   安装前端依赖..." $CYAN
        npm install --silent
    fi
    
    print_message "✅ 依赖安装完成" $GREEN
    echo
}

# 数据库迁移
run_database_migration() {
    print_message "🗄️  运行数据库迁移..." $BLUE
    
    cd "$BACKEND_DIR"
    
    # 检查Prisma配置
    if [ ! -f "prisma/schema.prisma" ]; then
        print_message "❌ Prisma配置文件不存在" $RED
        exit 1
    fi
    
    # 生成Prisma客户端
    print_message "   生成Prisma客户端..." $CYAN
    npx prisma generate 2>/dev/null || true
    
    # 运行数据库迁移
    print_message "   同步数据库结构..." $CYAN
    npx prisma migrate deploy 2>/dev/null || npx prisma db push 2>/dev/null || true
    
    print_message "✅ 数据库迁移完成" $GREEN
    echo
}

# 启动后端服务
start_backend() {
    print_message "🚀 启动后端服务..." $BLUE
    
    cd "$BACKEND_DIR"
    
    # 创建日志目录
    mkdir -p logs
    
    # 启动后端 (后台运行)
    print_message "   启动后端服务 (端口: $BACKEND_PORT)..." $CYAN
    nohup npm run dev > logs/backend.log 2>&1 &
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
            echo "BACKEND_PID=$BACKEND_PID" > $PROJECT_ROOT/.system_pids
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_message "   等待后端服务启动... ($RETRY_COUNT/$MAX_RETRIES)" $CYAN
        sleep 3
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        print_message "❌ 后端服务启动失败" $RED
        print_message "   请检查日志: $BACKEND_DIR/logs/backend.log" $YELLOW
        exit 1
    fi
    
    echo
}

# 启动前端服务
start_frontend() {
    print_message "🎨 启动前端服务..." $BLUE
    
    cd "$FRONTEND_DIR"
    
    # 创建日志目录
    mkdir -p logs
    
    # 启动前端 (后台运行)
    print_message "   启动前端服务 (端口: $FRONTEND_PORT)..." $CYAN
    nohup npm run dev > logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    # 等待前端启动
    print_message "   等待前端服务启动..." $CYAN
    sleep 8
    
    # 检查前端是否启动成功
    MAX_RETRIES=15
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            print_message "✅ 前端服务启动成功 (PID: $FRONTEND_PID)" $GREEN
            echo "FRONTEND_PID=$FRONTEND_PID" >> $PROJECT_ROOT/.system_pids
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_message "   等待前端服务启动... ($RETRY_COUNT/$MAX_RETRIES)" $CYAN
        sleep 4
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        print_message "⚠️  前端服务启动可能失败，请检查日志" $YELLOW
        print_message "   日志位置: $FRONTEND_DIR/logs/frontend.log" $YELLOW
    fi
    
    echo
}

# 动态检测实际运行端口 (增强版)
detect_actual_ports() {
    print_message "🔍 检测实际运行端口..." $BLUE
    
    # 检测后端端口 (通过健康检查)
    ACTUAL_BACKEND_PORT=""
    for port in $(seq 3000 3010); do
        if curl -s http://localhost:$port/health >/dev/null 2>&1; then
            ACTUAL_BACKEND_PORT=$port
            break
        fi
    done
    
    # 如果健康检查失败，尝试通过进程检测
    if [ -z "$ACTUAL_BACKEND_PORT" ]; then
        ACTUAL_BACKEND_PORT=$(netstat -tlnp 2>/dev/null | grep "node" | grep -E ":300[0-9]" | head -1 | sed 's/.*:\([0-9]*\) .*/\1/' | head -1)
    fi
    
    # 如果未找到，使用默认端口
    if [ -z "$ACTUAL_BACKEND_PORT" ]; then
        ACTUAL_BACKEND_PORT=$BACKEND_PORT
    fi
    
    # 检测前端端口 (通过React/Next.js特征)
    ACTUAL_FRONTEND_PORT=""
    for port in $(seq 3000 3010); do
        if [ "$port" != "$ACTUAL_BACKEND_PORT" ]; then
            if curl -s http://localhost:$port 2>/dev/null | grep -q "Next.js\|React\|__next" 2>/dev/null; then
                ACTUAL_FRONTEND_PORT=$port
                break
            fi
        fi
    done
    
    # 如果未找到，尝试通过进程检测
    if [ -z "$ACTUAL_FRONTEND_PORT" ]; then
        ACTUAL_FRONTEND_PORT=$(netstat -tlnp 2>/dev/null | grep "node" | grep -E ":300[0-9]" | grep -v ":$ACTUAL_BACKEND_PORT" | head -1 | sed 's/.*:\([0-9]*\) .*/\1/' | head -1)
    fi
    
    # 如果未找到，使用默认端口
    if [ -z "$ACTUAL_FRONTEND_PORT" ]; then
        ACTUAL_FRONTEND_PORT=$FRONTEND_PORT
    fi
    
    print_message "   后端端口: $ACTUAL_BACKEND_PORT" $CYAN
    print_message "   前端端口: $ACTUAL_FRONTEND_PORT" $CYAN
    
    # 验证端口可访问性
    print_message "   验证服务状态..." $CYAN
    if curl -s http://localhost:$ACTUAL_BACKEND_PORT/health >/dev/null 2>&1; then
        print_message "   ✅ 后端服务正常" $GREEN
    else
        print_message "   ⚠️  后端服务异常" $YELLOW
    fi
    
    if curl -s http://localhost:$ACTUAL_FRONTEND_PORT >/dev/null 2>&1; then
        print_message "   ✅ 前端服务正常" $GREEN
    else
        print_message "   ⚠️  前端服务异常" $YELLOW
    fi
    
    echo
}

# 显示访问信息
show_access_info() {
    print_message "🌐 海牛食品溯源系统启动完成！" $GREEN
    
    # 动态检测实际端口
    detect_actual_ports
    
    echo
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                        系统访问地址                             ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🎨 前端应用: ${CYAN}http://localhost:$ACTUAL_FRONTEND_PORT${WHITE}                    ║${NC}"
    echo -e "${WHITE}║  🚀 后端API:  ${CYAN}http://localhost:$ACTUAL_BACKEND_PORT${WHITE}                     ║${NC}"
    echo -e "${WHITE}║  ❤️  健康检查: ${CYAN}http://localhost:$ACTUAL_BACKEND_PORT/health${WHITE}              ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                        系统功能                                ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🏭 工厂管理: 智能工厂ID生成系统                                 ║${NC}"
    echo -e "${WHITE}║  🌾 养殖管理: 畜禽养殖追溯                                      ║${NC}"
    echo -e "${WHITE}║  🏪 加工管理: 食品加工流程                                      ║${NC}"
    echo -e "${WHITE}║  🚚 物流管理: 运输追溯                                          ║${NC}"
    echo -e "${WHITE}║  🔍 溯源查询: 产品追溯                                          ║${NC}"
    echo -e "${WHITE}║  👥 用户管理: 多租户权限                                        ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                        默认登录账户                             ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  👤 平台管理员: ${YELLOW}platform_admin${WHITE}                          ║${NC}"
    echo -e "${WHITE}║  🔐 默认密码: ${YELLOW}Admin@123456${WHITE}                              ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                        管理命令                                ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🛑 停止服务: ${CYAN}./stop-system.sh${WHITE}                          ║${NC}"
    echo -e "${WHITE}║  📊 查看日志: ${CYAN}./view-logs.sh${WHITE}                            ║${NC}"
    echo -e "${WHITE}║  🔄 重启服务: ${CYAN}./restart-system.sh${WHITE}                       ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    print_message "🎯 智能工厂ID生成功能已集成到平台管理中！" $CYAN
    print_message "   访问路径: 平台管理 → 工厂管理 → 新建工厂" $CYAN
    echo
    print_message "🎉 系统已成功启动！请在浏览器中访问前端应用" $GREEN
    print_message "💡 建议：保持此窗口打开以监控系统状态" $YELLOW
    echo
}

# 主函数
main() {
    clear
    print_title
    
    # 检查系统环境
    check_mysql
    check_dependencies
    check_directories
    check_ports
    
    # 准备项目
    install_dependencies
    run_database_migration
    
    # 启动服务
    start_backend
    start_frontend
    
    # 显示访问信息
    show_access_info
    
    # 监控系统状态
    print_message "⏸️  按 Ctrl+C 停止监控 (服务继续在后台运行)" $YELLOW
    print_message "🛑 要完全停止系统，请运行: ./stop-system.sh" $YELLOW
    print_message "📊 实时端口监控: ./detect-ports.sh monitor" $CYAN
    
    trap 'echo -e "\n${YELLOW}🔄 系统仍在后台运行${NC}"; exit 0' INT
    
    # 智能监控循环
    while true; do
        sleep 30
        
        # 重新检测端口以应对变化
        detect_actual_ports > /dev/null 2>&1
        
        # 检查后端状态
        if ! curl -s http://localhost:$ACTUAL_BACKEND_PORT/health > /dev/null 2>&1; then
            print_message "⚠️  后端服务异常 (端口: $ACTUAL_BACKEND_PORT)，请检查" $YELLOW
        fi
        
        # 检查前端状态
        if ! curl -s http://localhost:$ACTUAL_FRONTEND_PORT > /dev/null 2>&1; then
            print_message "⚠️  前端服务异常 (端口: $ACTUAL_FRONTEND_PORT)，请检查" $YELLOW
        fi
    done
}

# 运行主函数
main "$@"