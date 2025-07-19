#!/bin/bash

# 快速端口检查脚本
# 使用方法: ./check-ports.sh

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# 获取当前系统端口信息
get_current_ports() {
    echo -e "${BLUE}🔍 当前系统端口状态...${NC}"
    echo
    
    # 检测后端端口
    BACKEND_PORT=""
    for port in $(seq 3000 3010); do
        if curl -s http://localhost:$port/health >/dev/null 2>&1; then
            BACKEND_PORT=$port
            break
        fi
    done
    
    # 检测前端端口
    FRONTEND_PORT=""
    for port in $(seq 3000 3010); do
        if [ "$port" != "$BACKEND_PORT" ]; then
            if curl -s http://localhost:$port 2>/dev/null | grep -q "Next.js\|React\|__next" 2>/dev/null; then
                FRONTEND_PORT=$port
                break
            fi
        fi
    done
    
    # 显示结果
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                    🌐 当前访问地址                            ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    
    if [ -n "$FRONTEND_PORT" ]; then
        echo -e "${WHITE}║  🎨 前端应用: ${CYAN}http://localhost:$FRONTEND_PORT${WHITE}                    ║${NC}"
    else
        echo -e "${WHITE}║  🎨 前端应用: ${YELLOW}未检测到运行中的前端服务${WHITE}                  ║${NC}"
    fi
    
    if [ -n "$BACKEND_PORT" ]; then
        echo -e "${WHITE}║  🚀 后端API:  ${CYAN}http://localhost:$BACKEND_PORT${WHITE}                     ║${NC}"
        echo -e "${WHITE}║  ❤️  健康检查: ${CYAN}http://localhost:$BACKEND_PORT/health${WHITE}              ║${NC}"
    else
        echo -e "${WHITE}║  🚀 后端API:  ${YELLOW}未检测到运行中的后端服务${WHITE}                  ║${NC}"
    fi
    
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # 显示详细状态
    echo -e "${BLUE}📊 服务状态详情:${NC}"
    echo
    
    if [ -n "$BACKEND_PORT" ]; then
        echo -e "${GREEN}✅ 后端服务: 正常运行 (端口 $BACKEND_PORT)${NC}"
    else
        echo -e "${YELLOW}⚠️  后端服务: 未运行或异常${NC}"
    fi
    
    if [ -n "$FRONTEND_PORT" ]; then
        echo -e "${GREEN}✅ 前端服务: 正常运行 (端口 $FRONTEND_PORT)${NC}"
    else
        echo -e "${YELLOW}⚠️  前端服务: 未运行或异常${NC}"
    fi
    
    echo
    echo -e "${CYAN}💡 提示: 如果地址发生变化，可以随时运行此脚本获取最新信息${NC}"
    echo -e "${CYAN}📊 实时监控: ./detect-ports.sh monitor${NC}"
    echo
}

# 主函数
main() {
    clear
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                   快速端口检查工具                              ║${NC}"
    echo -e "${WHITE}║                海牛食品溯源系统                                 ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    get_current_ports
    
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                        管理命令                                ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🚀 启动系统: ${CYAN}run system${WHITE}                              ║${NC}"
    echo -e "${WHITE}║  🛑 停止系统: ${CYAN}./stop-system.sh${WHITE}                          ║${NC}"
    echo -e "${WHITE}║  📊 实时监控: ${CYAN}./detect-ports.sh monitor${WHITE}                 ║${NC}"
    echo -e "${WHITE}║  📋 查看日志: ${CYAN}./view-logs.sh${WHITE}                            ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
}

# 运行主函数
main "$@"