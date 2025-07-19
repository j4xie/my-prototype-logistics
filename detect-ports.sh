#!/bin/bash

# 动态端口检测脚本
# 自动检测当前运行的前端和后端端口

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# 检测后端端口
detect_backend_port() {
    local backend_port=""
    
    # 方法1: 通过健康检查接口检测
    for port in $(seq 3000 3010); do
        if curl -s http://localhost:$port/health >/dev/null 2>&1; then
            backend_port=$port
            break
        fi
    done
    
    # 方法2: 通过进程检测
    if [ -z "$backend_port" ]; then
        backend_port=$(netstat -tlnp 2>/dev/null | grep "node" | grep -E ":300[0-9]" | head -1 | sed 's/.*:\([0-9]*\) .*/\1/' | head -1)
    fi
    
    # 方法3: 检查package.json中的脚本
    if [ -z "$backend_port" ]; then
        if [ -f "backend/package.json" ]; then
            backend_port=$(grep -o "PORT=[0-9]*" backend/package.json 2>/dev/null | cut -d'=' -f2 | head -1)
        fi
    fi
    
    # 默认值
    if [ -z "$backend_port" ]; then
        backend_port="3001"
    fi
    
    echo $backend_port
}

# 检测前端端口
detect_frontend_port() {
    local frontend_port=""
    
    # 方法1: 通过HTTP响应检测Next.js
    for port in $(seq 3000 3010); do
        if curl -s http://localhost:$port 2>/dev/null | grep -q "Next.js\|React\|__next" 2>/dev/null; then
            frontend_port=$port
            break
        fi
    done
    
    # 方法2: 通过进程检测
    if [ -z "$frontend_port" ]; then
        frontend_port=$(netstat -tlnp 2>/dev/null | grep "node" | grep -E ":300[0-9]" | tail -1 | sed 's/.*:\([0-9]*\) .*/\1/' | head -1)
    fi
    
    # 方法3: 检查.env或配置文件
    if [ -z "$frontend_port" ]; then
        if [ -f "frontend/web-app-next/.env" ]; then
            frontend_port=$(grep -o "PORT=[0-9]*" frontend/web-app-next/.env 2>/dev/null | cut -d'=' -f2 | head -1)
        fi
    fi
    
    # 默认值
    if [ -z "$frontend_port" ]; then
        frontend_port="3000"
    fi
    
    echo $frontend_port
}

# 检测所有运行的Node.js服务
detect_all_node_services() {
    echo -e "${BLUE}🔍 检测所有运行的Node.js服务...${NC}"
    
    local services=""
    
    # 获取所有Node.js进程的端口
    for port in $(netstat -tlnp 2>/dev/null | grep "node" | grep -o ":[0-9]*" | sed 's/://g' | sort -u); do
        local service_type="未知"
        local status="❓"
        
        # 检测服务类型
        if curl -s http://localhost:$port/health >/dev/null 2>&1; then
            service_type="后端API"
            status="✅"
        elif curl -s http://localhost:$port >/dev/null 2>&1; then
            # 检查是否是React/Next.js应用
            if curl -s http://localhost:$port 2>/dev/null | grep -q "Next.js\|React\|__next" 2>/dev/null; then
                service_type="前端应用"
                status="✅"
            else
                service_type="Web服务"
                status="✅"
            fi
        else
            service_type="未响应"
            status="❌"
        fi
        
        services="$services\n   $status 端口 $port: $service_type"
    done
    
    if [ -n "$services" ]; then
        echo -e "${CYAN}发现的服务:${NC}"
        echo -e "$services"
    else
        echo -e "${YELLOW}未发现运行中的Node.js服务${NC}"
    fi
    
    echo
}

# 生成访问信息
generate_access_info() {
    local backend_port=$(detect_backend_port)
    local frontend_port=$(detect_frontend_port)
    
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                     🌐 动态访问地址                            ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🎨 前端应用: ${CYAN}http://localhost:$frontend_port${WHITE}                    ║${NC}"
    echo -e "${WHITE}║  🚀 后端API:  ${CYAN}http://localhost:$backend_port${WHITE}                     ║${NC}"
    echo -e "${WHITE}║  ❤️  健康检查: ${CYAN}http://localhost:$backend_port/health${WHITE}              ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # 验证端口可访问性
    echo -e "${BLUE}🔍 验证服务可访问性...${NC}"
    
    # 检查后端
    if curl -s http://localhost:$backend_port/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ 后端服务正常 (端口 $backend_port)${NC}"
    else
        echo -e "${YELLOW}⚠️  后端服务异常 (端口 $backend_port)${NC}"
    fi
    
    # 检查前端
    if curl -s http://localhost:$frontend_port >/dev/null 2>&1; then
        echo -e "${GREEN}✅ 前端服务正常 (端口 $frontend_port)${NC}"
    else
        echo -e "${YELLOW}⚠️  前端服务异常 (端口 $frontend_port)${NC}"
    fi
    
    echo
}

# 实时监控端口变化
monitor_ports() {
    echo -e "${BLUE}📊 实时监控端口变化 (按 Ctrl+C 退出)...${NC}"
    echo
    
    local last_backend=""
    local last_frontend=""
    
    while true; do
        local current_backend=$(detect_backend_port)
        local current_frontend=$(detect_frontend_port)
        
        if [ "$current_backend" != "$last_backend" ] || [ "$current_frontend" != "$last_frontend" ]; then
            clear
            echo -e "${YELLOW}🔄 端口变化检测到！${NC}"
            echo "时间: $(date)"
            echo
            generate_access_info
            
            last_backend=$current_backend
            last_frontend=$current_frontend
        fi
        
        sleep 5
    done
}

# 主函数
main() {
    clear
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                   动态端口检测工具                              ║${NC}"
    echo -e "${WHITE}║                海牛食品溯源系统                                 ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    case "${1:-detect}" in
        "detect")
            detect_all_node_services
            generate_access_info
            ;;
        "monitor")
            monitor_ports
            ;;
        "backend")
            echo "后端端口: $(detect_backend_port)"
            ;;
        "frontend")
            echo "前端端口: $(detect_frontend_port)"
            ;;
        "help")
            echo "使用方法:"
            echo "  ./detect-ports.sh          # 检测当前端口"
            echo "  ./detect-ports.sh monitor  # 实时监控端口变化"
            echo "  ./detect-ports.sh backend  # 只显示后端端口"
            echo "  ./detect-ports.sh frontend # 只显示前端端口"
            ;;
        *)
            echo "未知选项: $1"
            echo "运行 './detect-ports.sh help' 查看帮助"
            ;;
    esac
}

# 运行主函数
main "$@"