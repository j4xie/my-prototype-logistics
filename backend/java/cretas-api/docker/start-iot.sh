#!/bin/bash
# Cretas IoT 服务启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 启动 Cretas IoT 基础设施..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 请先安装 Docker Compose"
    exit 1
fi

# 启动 EMQX
echo "📡 启动 EMQX MQTT Broker..."
docker-compose -f docker-compose-iot.yml up -d emqx

# 等待服务就绪
echo "⏳ 等待 EMQX 就绪..."
for i in {1..30}; do
    if docker exec cretas-emqx emqx ctl status 2>/dev/null | grep -q "is started"; then
        echo "✅ EMQX 已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ EMQX 启动超时"
        exit 1
    fi
    sleep 2
done

# 显示访问信息
echo ""
echo "============================================"
echo "✅ Cretas IoT 基础设施已启动"
echo "============================================"
echo ""
echo "📊 EMQX Dashboard: http://localhost:18083"
echo "   用户名: admin"
echo "   密码: public"
echo ""
echo "🔌 MQTT 连接信息:"
echo "   TCP:       mqtt://localhost:1883"
echo "   WebSocket: ws://localhost:8083/mqtt"
echo ""
echo "📝 测试命令:"
echo "   mosquitto_pub -h localhost -p 1883 -t 'test' -m 'hello'"
echo "   mosquitto_sub -h localhost -p 1883 -t 'test'"
echo ""
