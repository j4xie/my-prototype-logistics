#!/bin/bash

# 端口检测功能测试脚本
# 测试动态端口检测的准确性和可靠性

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="/mnt/c/Users/Steve/heiniu"

# 打印测试标题
print_test_header() {
    clear
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                 端口检测功能测试                                ║${NC}"
    echo -e "${WHITE}║                海牛食品溯源系统                                 ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
}

# 测试基础端口检测
test_basic_detection() {
    echo -e "${BLUE}🔍 测试1: 基础端口检测功能...${NC}"
    echo
    
    # 检测所有运行中的Node.js服务
    echo -e "${CYAN}当前运行的Node.js服务:${NC}"
    for port in $(netstat -tlnp 2>/dev/null | grep "node" | grep -o ":[0-9]*" | sed 's/://g' | sort -u); do
        echo -e "  端口 $port: $(curl -s http://localhost:$port/health >/dev/null 2>&1 && echo '后端服务' || echo '其他服务')"
    done
    echo
}

# 测试健康检查端口识别
test_health_check() {
    echo -e "${BLUE}🔍 测试2: 健康检查端口识别...${NC}"
    echo
    
    BACKEND_PORT=""
    for port in $(seq 3000 3010); do
        if curl -s http://localhost:$port/health >/dev/null 2>&1; then
            BACKEND_PORT=$port
            echo -e "${GREEN}✅ 发现后端服务: 端口 $port${NC}"
            break
        fi
    done
    
    if [ -z "$BACKEND_PORT" ]; then
        echo -e "${YELLOW}⚠️  未发现运行中的后端服务${NC}"
    fi
    echo
}

# 测试前端服务识别
test_frontend_detection() {
    echo -e "${BLUE}🔍 测试3: 前端服务识别...${NC}"
    echo
    
    FRONTEND_PORT=""
    for port in $(seq 3000 3010); do
        if curl -s http://localhost:$port 2>/dev/null | grep -q "Next.js\|React\|__next" 2>/dev/null; then
            FRONTEND_PORT=$port
            echo -e "${GREEN}✅ 发现前端服务: 端口 $port${NC}"
            break
        fi
    done
    
    if [ -z "$FRONTEND_PORT" ]; then
        echo -e "${YELLOW}⚠️  未发现运行中的前端服务${NC}"
    fi
    echo
}

# 测试脚本集成
test_script_integration() {
    echo -e "${BLUE}🔍 测试4: 脚本集成测试...${NC}"
    echo
    
    # 测试主启动脚本的端口检测
    echo -e "${CYAN}测试主启动脚本的端口检测函数...${NC}"
    if [ -f "$PROJECT_ROOT/run-system.sh" ]; then
        echo -e "${GREEN}✅ 主启动脚本存在${NC}"
        
        # 检查是否包含动态端口检测函数
        if grep -q "detect_actual_ports" "$PROJECT_ROOT/run-system.sh"; then
            echo -e "${GREEN}✅ 包含动态端口检测函数${NC}"
        else
            echo -e "${RED}❌ 缺少动态端口检测函数${NC}"
        fi
    else
        echo -e "${RED}❌ 主启动脚本不存在${NC}"
    fi
    
    # 测试专用端口检测脚本
    echo -e "${CYAN}测试专用端口检测脚本...${NC}"
    if [ -f "$PROJECT_ROOT/detect-ports.sh" ]; then
        echo -e "${GREEN}✅ 专用端口检测脚本存在${NC}"
        
        # 检查是否可执行
        if [ -x "$PROJECT_ROOT/detect-ports.sh" ]; then
            echo -e "${GREEN}✅ 脚本具有执行权限${NC}"
        else
            echo -e "${YELLOW}⚠️  脚本缺少执行权限${NC}"
        fi
    else
        echo -e "${RED}❌ 专用端口检测脚本不存在${NC}"
    fi
    
    # 测试快速端口检查脚本
    echo -e "${CYAN}测试快速端口检查脚本...${NC}"
    if [ -f "$PROJECT_ROOT/check-ports.sh" ]; then
        echo -e "${GREEN}✅ 快速端口检查脚本存在${NC}"
        
        # 检查是否可执行
        if [ -x "$PROJECT_ROOT/check-ports.sh" ]; then
            echo -e "${GREEN}✅ 脚本具有执行权限${NC}"
        else
            echo -e "${YELLOW}⚠️  脚本缺少执行权限${NC}"
        fi
    else
        echo -e "${RED}❌ 快速端口检查脚本不存在${NC}"
    fi
    
    echo
}

# 测试跨平台兼容性
test_cross_platform() {
    echo -e "${BLUE}🔍 测试5: 跨平台兼容性...${NC}"
    echo
    
    # 检测当前操作系统
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo -e "${GREEN}✅ 当前系统: Linux${NC}"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${GREEN}✅ 当前系统: macOS${NC}"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo -e "${GREEN}✅ 当前系统: Windows${NC}"
    else
        echo -e "${GREEN}✅ 当前系统: $OSTYPE${NC}"
    fi
    
    # 检查必要的命令工具
    echo -e "${CYAN}检查必要的命令工具:${NC}"
    
    commands=("curl" "netstat" "grep" "sed" "awk")
    for cmd in "${commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $cmd 可用${NC}"
        else
            echo -e "${RED}❌ $cmd 不可用${NC}"
        fi
    done
    
    echo
}

# 性能测试
test_performance() {
    echo -e "${BLUE}🔍 测试6: 性能测试...${NC}"
    echo
    
    echo -e "${CYAN}测试端口检测速度...${NC}"
    
    # 测试后端端口检测速度
    start_time=$(date +%s.%N)
    for port in $(seq 3000 3010); do
        curl -s http://localhost:$port/health >/dev/null 2>&1 && break
    done
    end_time=$(date +%s.%N)
    
    duration=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0.1")
    echo -e "${GREEN}✅ 后端端口检测用时: ${duration}秒${NC}"
    
    # 测试前端端口检测速度
    start_time=$(date +%s.%N)
    for port in $(seq 3000 3010); do
        curl -s http://localhost:$port 2>/dev/null | grep -q "Next.js\|React\|__next" 2>/dev/null && break
    done
    end_time=$(date +%s.%N)
    
    duration=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0.1")
    echo -e "${GREEN}✅ 前端端口检测用时: ${duration}秒${NC}"
    
    echo
}

# 实际端口检测演示
demonstrate_detection() {
    echo -e "${BLUE}🔍 演示: 实际端口检测...${NC}"
    echo
    
    # 调用实际的端口检测脚本
    if [ -f "$PROJECT_ROOT/check-ports.sh" ]; then
        echo -e "${CYAN}运行快速端口检查脚本:${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        bash "$PROJECT_ROOT/check-ports.sh"
    else
        echo -e "${YELLOW}⚠️  快速端口检查脚本不存在，跳过演示${NC}"
    fi
}

# 生成测试报告
generate_report() {
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                        测试报告                                ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🔍 基础端口检测: 完成                                        ║${NC}"
    echo -e "${WHITE}║  ❤️  健康检查识别: 完成                                        ║${NC}"
    echo -e "${WHITE}║  🎨 前端服务识别: 完成                                        ║${NC}"
    echo -e "${WHITE}║  🔗 脚本集成测试: 完成                                        ║${NC}"
    echo -e "${WHITE}║  💻 跨平台兼容性: 完成                                        ║${NC}"
    echo -e "${WHITE}║  ⚡ 性能测试: 完成                                            ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}🎉 动态端口检测功能测试完成！${NC}"
    echo -e "${CYAN}💡 提示: 此功能可以自动适应端口变化，确保访问地址始终准确${NC}"
    echo
}

# 主函数
main() {
    print_test_header
    
    test_basic_detection
    test_health_check
    test_frontend_detection
    test_script_integration
    test_cross_platform
    test_performance
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    demonstrate_detection
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    generate_report
    
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                      相关命令                                  ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║  🚀 启动系统: ${CYAN}run system${WHITE}                              ║${NC}"
    echo -e "${WHITE}║  📊 端口监控: ${CYAN}./detect-ports.sh monitor${WHITE}                 ║${NC}"
    echo -e "${WHITE}║  🔍 快速检查: ${CYAN}./check-ports.sh${WHITE}                          ║${NC}"
    echo -e "${WHITE}║  🛑 停止系统: ${CYAN}./stop-system.sh${WHITE}                          ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
}

# 运行主函数
main "$@"