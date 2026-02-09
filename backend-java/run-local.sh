#!/bin/bash

# 白垩纪食品溯源系统 - 本地测试运行脚本
# 在本地启动 Spring Boot 应用进行测试

set -e  # 遇到错误立即退出

echo "========================================"
echo "  Cretas Backend - Local Test Server"
echo "========================================"

# 检查 JAR 文件是否存在
JAR_FILE="target/cretas-backend-system-1.0.0.jar"

if [ ! -f "$JAR_FILE" ]; then
    echo "❌ JAR 文件不存在: $JAR_FILE"
    echo ""
    echo "🔨 开始编译项目..."
    ./build.sh
fi

echo ""
echo "📦 准备启动的 JAR 文件:"
ls -lh "$JAR_FILE"
echo ""

# 检查端口是否被占用
PORT=10010
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  警告: 端口 $PORT 已被占用"
    PID=$(lsof -ti:$PORT)
    echo "   占用进程 PID: $PID"
    read -p "   是否停止该进程? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $PID
        echo "   ✅ 进程已停止"
    else
        echo "   ❌ 无法启动，端口被占用"
        exit 1
    fi
fi

echo ""
echo "🚀 启动本地测试服务器..."
echo "-------------------------------------------"
echo ""
echo "📊 服务信息:"
echo "   地址: http://localhost:$PORT"
echo "   API: http://localhost:$PORT/api/mobile/{factoryId}/timeclock"
echo ""
echo "⚠️  注意: 请确保 MySQL 数据库已启动并配置正确"
echo "   数据库配置: src/main/resources/application.properties"
echo ""
echo "🧪 测试端点:"
echo "   curl http://localhost:$PORT/api/mobile/F001/timeclock/today?userId=1"
echo ""
echo "📝 查看日志: Ctrl+C 停止服务"
echo "-------------------------------------------"
echo ""

# 运行 JAR 文件
java -jar "$JAR_FILE"
