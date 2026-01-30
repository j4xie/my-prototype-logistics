#!/bin/bash

# 白垩纪食品溯源系统 - 后端部署脚本
# 将编译好的 JAR 文件部署到服务器

set -e  # 遇到错误立即退出

echo "========================================"
echo "  Cretas Backend - Deploy Script"
echo "========================================"

# 配置参数（根据实际情况修改）
SERVER_HOST="139.196.165.140"
SERVER_USER="root"
SERVER_PATH="/www/wwwroot/cretas"
JAR_FILE="target/cretas-backend-system-1.0.0.jar"
SERVER_PORT="10010"

# 检查 JAR 文件是否存在
if [ ! -f "$JAR_FILE" ]; then
    echo "❌ JAR 文件不存在: $JAR_FILE"
    echo "   请先运行: ./build.sh"
    exit 1
fi

echo "📦 准备部署的 JAR 文件:"
ls -lh "$JAR_FILE"
echo ""

# 确认部署
read -p "🚀 确认部署到服务器 $SERVER_HOST? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 部署已取消"
    exit 1
fi

echo ""
echo "📤 上传 JAR 文件到服务器..."
echo "-------------------------------------------"

# 上传 JAR 文件到服务器
scp "$JAR_FILE" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"

echo ""
echo "✅ 文件上传成功"
echo ""
echo "🔄 重启服务器应用..."
echo "-------------------------------------------"

# 在服务器上执行重启脚本
ssh "$SERVER_USER@$SERVER_HOST" << EOF
    cd $SERVER_PATH

    # 停止现有进程
    echo "⏹️  停止现有进程..."
    ps aux | grep cretas-backend-system | grep -v grep | awk '{print \$2}' | xargs -r kill -9 || true
    sleep 2

    # 启动新进程
    echo "▶️  启动新进程..."
    nohup java -jar cretas-backend-system-1.0.0.jar --server.port=$SERVER_PORT > cretas-backend.log 2>&1 &
    NEW_PID=\$!
    echo "✅ 应用已启动，PID: \$NEW_PID"

    # 等待服务启动
    echo "⏳ 等待服务启动..."
    sleep 5

    # 检查进程是否运行
    if ps -p \$NEW_PID > /dev/null; then
        echo "✅ 服务运行正常，PID: \$NEW_PID"
    else
        echo "❌ 服务启动失败，请检查日志"
        tail -n 50 cretas-backend.log
        exit 1
    fi
EOF

echo ""
echo "✅ 部署完成！"
echo "-------------------------------------------"
echo ""
echo "📊 服务信息:"
echo "   地址: http://$SERVER_HOST:$SERVER_PORT"
echo "   API: http://$SERVER_HOST:$SERVER_PORT/api/mobile/{factoryId}/timeclock"
echo ""
echo "🔍 查看日志:"
echo "   ssh $SERVER_USER@$SERVER_HOST 'tail -f $SERVER_PATH/cretas-backend.log'"
echo ""
echo "🧪 测试端点:"
echo "   curl http://$SERVER_HOST:$SERVER_PORT/api/mobile/F001/timeclock/today?userId=1"
echo ""
echo "========================================"
echo "  Deployment Completed Successfully!"
echo "========================================"
