#!/bin/bash
# === 生产环境启动脚本 (systemd 版) ===
# 服务: cretas-embedding(9090) + cretas-backend(10010) + cretas-python(8083)
echo "[$(date)] === Starting Production Environment ==="

# Auto-swap .jar.new if present
cd /www/wwwroot/cretas
if [ -f aims-0.0.1-SNAPSHOT.jar.new ]; then
    echo "Swapping new JAR..."
    mv aims-0.0.1-SNAPSHOT.jar.new aims-0.0.1-SNAPSHOT.jar
fi

# 重启所有服务 (按依赖顺序)
echo "Restarting Embedding service (9090)..."
systemctl restart cretas-embedding
sleep 5

# 等待 Embedding 就绪
for i in $(seq 1 10); do
    if ss -tlnp | grep -q ':9090'; then
        echo "Embedding service verified on port 9090 (${i}s)"
        break
    fi
    sleep 1
done

echo "Restarting Python service (8083)..."
systemctl restart cretas-python

echo "Restarting Java backend (10010)..."
systemctl restart cretas-backend

# 验证 Redis
redis-cli ping > /dev/null 2>&1 && echo "Redis verified: PONG" || echo "WARNING: Redis not responding"

echo ""
echo "=== Post-startup verification ==="
sleep 3
for port in 9090 8083; do
    if ss -tlnp | grep -q ":${port}"; then
        echo "  port $port: OK"
    else
        echo "  port $port: NOT LISTENING (check logs!)"
    fi
done
echo "  port 10010: waiting for Spring Boot startup (~20s)..."

echo "[$(date)] === Production Environment Started ==="
echo ""
echo "Health check: curl http://localhost:10010/api/mobile/health"
echo "Status:       systemctl status cretas-backend cretas-python cretas-embedding"
