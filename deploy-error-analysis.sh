#!/bin/bash
# 部署 Error Analysis Python 服务到服务器

set -e

SERVER="root@139.196.165.140"
REMOTE_DIR="/www/wwwroot/error-analysis"
SERVICE_NAME="error-analysis"

echo "=== 部署 Error Analysis 服务 ==="

# 1. 创建远程目录
echo "[1/4] 创建远程目录..."
ssh $SERVER "mkdir -p $REMOTE_DIR"

# 2. 同步文件
echo "[2/4] 同步文件到服务器..."
rsync -avz --exclude '__pycache__' --exclude '*.pyc' --exclude '.env' \
    error-analysis-service/ $SERVER:$REMOTE_DIR/

# 3. 安装依赖
echo "[3/4] 安装 Python 依赖..."
ssh $SERVER "cd $REMOTE_DIR && pip3 install -r requirements.txt"

# 4. 重启服务
echo "[4/4] 重启服务..."
ssh $SERVER "cd $REMOTE_DIR && pkill -f 'uvicorn main:app.*8082' || true && nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8082 > error-analysis.log 2>&1 &"

# 等待服务启动
sleep 3

# 5. 健康检查
echo "[检查] 验证服务状态..."
if ssh $SERVER "curl -s http://localhost:8082/health | grep -q healthy"; then
    echo "✅ Error Analysis 服务部署成功！"
    echo "   URL: http://139.196.165.140:8082"
else
    echo "❌ 服务启动失败，请检查日志"
    ssh $SERVER "tail -20 $REMOTE_DIR/error-analysis.log"
    exit 1
fi
