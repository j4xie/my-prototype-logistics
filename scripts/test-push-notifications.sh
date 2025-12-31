#!/bin/bash

# 推送通知测试脚本
# 用于快速测试推送通知功能

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
API_BASE="${API_BASE:-http://139.196.165.140:10010}"
FACTORY_ID="${FACTORY_ID:-F001}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

# 函数：打印彩色消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 函数：检查依赖
check_dependencies() {
    print_info "检查依赖..."

    if ! command -v curl &> /dev/null; then
        print_error "curl 未安装，请先安装 curl"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_warning "jq 未安装，JSON 输出将不会格式化"
        JQ_AVAILABLE=false
    else
        JQ_AVAILABLE=true
    fi

    print_success "依赖检查完成"
}

# 函数：检查 Token
check_token() {
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "未设置 ACCESS_TOKEN"
        echo ""
        echo "使用方法："
        echo "  export ACCESS_TOKEN='your-access-token'"
        echo "  ./test-push-notifications.sh"
        echo ""
        echo "或者："
        echo "  ACCESS_TOKEN='your-token' ./test-push-notifications.sh"
        exit 1
    fi

    print_success "ACCESS_TOKEN 已设置"
}

# 函数：发送测试推送
send_test_notification() {
    print_info "发送测试推送..."

    response=$(curl -s -w "\n%{http_code}" -X POST \
        "${API_BASE}/api/mobile/${FACTORY_ID}/devices/test-notification" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        print_success "测试推送发送成功"
        if [ "$JQ_AVAILABLE" = true ]; then
            echo "$body" | jq .
        else
            echo "$body"
        fi
    else
        print_error "测试推送发送失败 (HTTP $http_code)"
        echo "$body"
        exit 1
    fi
}

# 函数：获取设备列表
get_device_list() {
    print_info "获取设备列表..."

    response=$(curl -s -w "\n%{http_code}" -X GET \
        "${API_BASE}/api/mobile/${FACTORY_ID}/devices/list" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        print_success "设备列表获取成功"
        if [ "$JQ_AVAILABLE" = true ]; then
            echo "$body" | jq .
        else
            echo "$body"
        fi
    else
        print_error "设备列表获取失败 (HTTP $http_code)"
        echo "$body"
        exit 1
    fi
}

# 函数：注册设备（示例）
register_device() {
    print_info "注册设备..."

    # 示例数据
    data=$(cat <<EOF
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "deviceId": "test-device-001",
  "platform": "android",
  "deviceName": "Test Device",
  "deviceModel": "Android Emulator",
  "osVersion": "13",
  "appVersion": "1.0.0"
}
EOF
)

    response=$(curl -s -w "\n%{http_code}" -X POST \
        "${API_BASE}/api/mobile/${FACTORY_ID}/devices/register" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$data")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        print_success "设备注册成功"
        if [ "$JQ_AVAILABLE" = true ]; then
            echo "$body" | jq .
        else
            echo "$body"
        fi
    else
        print_error "设备注册失败 (HTTP $http_code)"
        echo "$body"
    fi
}

# 函数：健康检查
health_check() {
    print_info "执行健康检查..."

    response=$(curl -s -w "\n%{http_code}" -X GET \
        "${API_BASE}/api/mobile/health")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        print_success "后端服务正常"
        echo "$body"
    else
        print_error "后端服务异常 (HTTP $http_code)"
        echo "$body"
        exit 1
    fi
}

# 主菜单
show_menu() {
    echo ""
    echo "======================================"
    echo "  推送通知测试工具"
    echo "======================================"
    echo ""
    echo "配置："
    echo "  API_BASE: $API_BASE"
    echo "  FACTORY_ID: $FACTORY_ID"
    echo "  ACCESS_TOKEN: ${ACCESS_TOKEN:0:20}..."
    echo ""
    echo "选项："
    echo "  1) 发送测试推送"
    echo "  2) 获取设备列表"
    echo "  3) 注册设备（示例）"
    echo "  4) 健康检查"
    echo "  5) 全部测试"
    echo "  0) 退出"
    echo ""
}

# 执行全部测试
run_all_tests() {
    print_info "开始执行全部测试..."
    echo ""

    health_check
    echo ""

    get_device_list
    echo ""

    send_test_notification
    echo ""

    print_success "全部测试完成！"
}

# 主程序
main() {
    # 检查依赖
    check_dependencies

    # 检查 Token
    check_token

    # 如果有命令行参数，直接执行
    if [ $# -gt 0 ]; then
        case $1 in
            test)
                send_test_notification
                ;;
            list)
                get_device_list
                ;;
            register)
                register_device
                ;;
            health)
                health_check
                ;;
            all)
                run_all_tests
                ;;
            *)
                echo "未知命令: $1"
                echo "可用命令: test, list, register, health, all"
                exit 1
                ;;
        esac
        exit 0
    fi

    # 交互式菜单
    while true; do
        show_menu
        read -p "请选择操作 [0-5]: " choice

        case $choice in
            1)
                send_test_notification
                ;;
            2)
                get_device_list
                ;;
            3)
                register_device
                ;;
            4)
                health_check
                ;;
            5)
                run_all_tests
                ;;
            0)
                print_info "退出程序"
                exit 0
                ;;
            *)
                print_error "无效的选择，请重新输入"
                ;;
        esac

        echo ""
        read -p "按 Enter 键继续..."
    done
}

# 运行主程序
main "$@"
