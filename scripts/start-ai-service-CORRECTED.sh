#!/bin/bash

# 宝塔上启动 AI 服务的脚本 - 已修正路径
# 正确路径: /www/wwwroot/project/backend-ai-chat
# 使用方法: bash /www/wwwroot/project/start-ai-service.sh

AI_DIR="/www/wwwroot/project/backend-ai-chat"
LOG_FILE="/www/wwwroot/project/logs/ai-service.log"

echo "=========================================="
echo "启动白垩纪 AI 服务"
echo "=========================================="
echo ""

# 检查目录是否存在
if [ ! -d "$AI_DIR" ]; then
    echo "❌ 错误: AI 服务目录不存在: $AI_DIR"
    echo "请确保已经将 backend-ai-chat 目录放在宝塔服务器"
    echo "期望位置: $AI_DIR"
    exit 1
fi

echo "✅ AI 服务目录: $AI_DIR"
echo ""

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

# 检查是否已经运行
echo "【1】检查是否已有实例运行..."
if pgrep -f "python.*main\.py" > /dev/null; then
    echo "⚠️ AI 服务已在运行，进程如下："
    ps aux | grep -E 'python.*main' | grep -v grep
    echo ""
    echo "如要重启，请先运行: pkill -f 'python.*main.py'"
    exit 0
fi
echo "✅ 没有运行中的实例"
echo ""

# 检查虚拟环境
echo "【2】检查虚拟环境..."
if [ ! -f "$AI_DIR/venv/bin/python" ]; then
    echo "❌ 虚拟环境不存在，正在创建..."
    cd "$AI_DIR"
    python3 -m venv venv
    if [ $? -eq 0 ]; then
        echo "✅ 虚拟环境创建完成"
    else
        echo "❌ 虚拟环境创建失败"
        exit 1
    fi
fi
echo "✅ 虚拟环境存在"
echo ""

# 安装依赖
echo "【3】安装/更新依赖..."
cd "$AI_DIR"
"$AI_DIR/venv/bin/pip" install -q -r requirements.txt 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 依赖安装完成"
else
    echo "❌ 依赖安装失败"
    tail -20 "$LOG_FILE" 2>/dev/null || echo "查看日志了解详情: $LOG_FILE"
    exit 1
fi
echo ""

# 启动服务
echo "【4】启动 AI 服务..."
echo "服务日志: $LOG_FILE"
echo ""

cd "$AI_DIR"
nohup "$AI_DIR/venv/bin/python" scripts/main.py > "$LOG_FILE" 2>&1 &

# 获取进程 ID
PID=$!
echo "✅ AI 服务已启动，进程ID: $PID"
sleep 2

# 验证服务是否成功启动
if ps -p $PID > /dev/null; then
    echo "✅ 服务进程正在运行"
else
    echo "❌ 服务启动失败，请检查日志:"
    tail -20 "$LOG_FILE"
    exit 1
fi
echo ""

# 测试连接
echo "【5】测试 API 连接..."
sleep 2
if curl -s -m 5 http://localhost:8085/ > /dev/null 2>&1; then
    echo "✅ API 可以访问: http://localhost:8085/"
    echo "📚 API 文档: http://139.196.165.140:8085/docs"
else
    echo "⚠️ 无法立即连接 API，请稍候几秒后重试"
    echo "检查日志: tail -f $LOG_FILE"
fi
echo ""

echo "=========================================="
echo "✅ AI 服务启动完成"
echo "=========================================="
echo ""
echo "常用命令:"
echo "1. 查看日志: tail -f $LOG_FILE"
echo "2. 停止服务: pkill -f 'python.*main.py'"
echo "3. 重启服务: bash $0"
echo "4. 检查状态: bash /www/wwwroot/project/check-ai-service.sh"
