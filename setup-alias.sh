#!/bin/bash

# 设置 run system 别名脚本

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="/mnt/c/Users/Steve/heiniu"

echo -e "${BLUE}设置 'run system' 别名...${NC}"

# 检查并创建别名
setup_alias() {
    # 检查当前shell
    CURRENT_SHELL=$(basename "$SHELL")
    
    case $CURRENT_SHELL in
        "bash")
            PROFILE_FILE="$HOME/.bashrc"
            ;;
        "zsh")
            PROFILE_FILE="$HOME/.zshrc"
            ;;
        *)
            PROFILE_FILE="$HOME/.profile"
            ;;
    esac
    
    # 别名定义
    ALIAS_LINE="alias 'run system'='cd $PROJECT_ROOT && ./run-system.sh'"
    
    # 检查是否已存在别名
    if grep -q "run system" "$PROFILE_FILE" 2>/dev/null; then
        echo -e "${YELLOW}别名已存在，正在更新...${NC}"
        # 删除旧的别名
        sed -i "/run system/d" "$PROFILE_FILE"
    fi
    
    # 添加新别名
    echo "" >> "$PROFILE_FILE"
    echo "# 海牛食品溯源系统启动别名" >> "$PROFILE_FILE"
    echo "$ALIAS_LINE" >> "$PROFILE_FILE"
    
    echo -e "${GREEN}✅ 别名设置成功！${NC}"
    echo -e "${BLUE}配置文件: $PROFILE_FILE${NC}"
    echo
    echo -e "${YELLOW}使用方法:${NC}"
    echo "1. 重新加载配置: source $PROFILE_FILE"
    echo "2. 或者重启终端"
    echo "3. 然后在任何目录输入: run system"
    echo
    
    # 询问是否立即加载
    read -p "是否立即加载别名? (y/n): " load_now
    if [[ $load_now == "y" || $load_now == "Y" ]]; then
        source "$PROFILE_FILE"
        echo -e "${GREEN}✅ 别名已加载！现在可以使用 'run system' 命令了${NC}"
    fi
}

# 创建停止系统脚本
create_stop_script() {
    cat > "$PROJECT_ROOT/stop-system.sh" << 'EOF'
#!/bin/bash

# 海牛食品溯源系统 - 停止脚本

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="/mnt/c/Users/Steve/heiniu"
PID_FILE="$PROJECT_ROOT/.system_pids"

echo -e "${BLUE}🛑 正在停止海牛食品溯源系统...${NC}"

if [ -f "$PID_FILE" ]; then
    echo -e "${YELLOW}正在停止服务进程...${NC}"
    
    while read line; do
        if [ ! -z "$line" ]; then
            PID=$(echo $line | cut -d'=' -f2)
            if [ ! -z "$PID" ]; then
                kill -TERM $PID 2>/dev/null
                sleep 2
                kill -KILL $PID 2>/dev/null
                echo -e "${GREEN}✅ 已停止进程 (PID: $PID)${NC}"
            fi
        fi
    done < "$PID_FILE"
    
    rm -f "$PID_FILE"
    echo -e "${GREEN}🎉 系统已完全停止！${NC}"
else
    echo -e "${YELLOW}⚠️  未找到运行中的进程文件${NC}"
fi

# 额外清理：强制停止可能的残留进程
echo -e "${YELLOW}清理残留进程...${NC}"

# 停止可能的Node.js进程
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "node.*3001" 2>/dev/null || true
pkill -f "node.*3000" 2>/dev/null || true

echo -e "${GREEN}✅ 清理完成！${NC}"
EOF

    chmod +x "$PROJECT_ROOT/stop-system.sh"
    echo -e "${GREEN}✅ 停止脚本已创建: $PROJECT_ROOT/stop-system.sh${NC}"
}

# 创建日志查看脚本
create_log_viewer() {
    cat > "$PROJECT_ROOT/view-logs.sh" << 'EOF'
#!/bin/bash

# 海牛食品溯源系统 - 日志查看器

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="/mnt/c/Users/Steve/heiniu"
BACKEND_LOG="$PROJECT_ROOT/backend/logs/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/frontend/web-app-next/logs/frontend.log"

clear
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 海牛食品溯源系统 - 日志查看器                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${YELLOW}选择要查看的日志:${NC}"
echo "1. 📋 后端日志 (最近50行)"
echo "2. 📋 前端日志 (最近50行)"
echo "3. 📊 实时监控后端日志"
echo "4. 📊 实时监控前端日志"
echo "5. 🔍 搜索日志内容"
echo "6. 🧹 清空日志"
echo "7. 🚪 退出"
echo

read -p "请选择 (1-7): " choice

case $choice in
    1)
        echo -e "${GREEN}📋 后端日志 (最近50行):${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -50 "$BACKEND_LOG" 2>/dev/null || echo -e "${RED}日志文件不存在: $BACKEND_LOG${NC}"
        ;;
    2)
        echo -e "${GREEN}📋 前端日志 (最近50行):${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -50 "$FRONTEND_LOG" 2>/dev/null || echo -e "${RED}日志文件不存在: $FRONTEND_LOG${NC}"
        ;;
    3)
        echo -e "${GREEN}📊 实时监控后端日志 (按 Ctrl+C 退出):${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -f "$BACKEND_LOG" 2>/dev/null || echo -e "${RED}日志文件不存在: $BACKEND_LOG${NC}"
        ;;
    4)
        echo -e "${GREEN}📊 实时监控前端日志 (按 Ctrl+C 退出):${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -f "$FRONTEND_LOG" 2>/dev/null || echo -e "${RED}日志文件不存在: $FRONTEND_LOG${NC}"
        ;;
    5)
        read -p "输入要搜索的关键词: " keyword
        echo -e "${GREEN}🔍 搜索结果:${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${BLUE}后端日志中的匹配:${NC}"
        grep -i "$keyword" "$BACKEND_LOG" 2>/dev/null || echo "未找到匹配项"
        echo
        echo -e "${BLUE}前端日志中的匹配:${NC}"
        grep -i "$keyword" "$FRONTEND_LOG" 2>/dev/null || echo "未找到匹配项"
        ;;
    6)
        read -p "确定要清空所有日志吗? (y/n): " confirm
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            > "$BACKEND_LOG" 2>/dev/null
            > "$FRONTEND_LOG" 2>/dev/null
            echo -e "${GREEN}✅ 日志已清空${NC}"
        else
            echo -e "${YELLOW}操作已取消${NC}"
        fi
        ;;
    7)
        echo -e "${GREEN}👋 退出日志查看器${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ 无效选择${NC}"
        ;;
esac

echo
read -p "按任意键继续..."
EOF

    chmod +x "$PROJECT_ROOT/view-logs.sh"
    echo -e "${GREEN}✅ 日志查看器已创建: $PROJECT_ROOT/view-logs.sh${NC}"
}

# 显示使用说明
show_usage() {
    echo
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                        使用说明                                ║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║  🚀 启动系统: ${YELLOW}run system${BLUE}                              ║${NC}"
    echo -e "${BLUE}║  🛑 停止系统: ${YELLOW}./stop-system.sh${BLUE}                        ║${NC}"
    echo -e "${BLUE}║  📊 查看日志: ${YELLOW}./view-logs.sh${BLUE}                          ║${NC}"
    echo -e "${BLUE}║  🔧 设置别名: ${YELLOW}./setup-alias.sh${BLUE}                        ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}🎉 海牛食品溯源系统管理工具已设置完成！${NC}"
    echo -e "${YELLOW}💡 提示：智能工厂ID生成功能已集成到系统中${NC}"
    echo
}

# 主函数
main() {
    clear
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                 海牛食品溯源系统 - 别名设置                      ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    setup_alias
    create_stop_script
    create_log_viewer
    show_usage
}

# 运行主函数
main "$@"