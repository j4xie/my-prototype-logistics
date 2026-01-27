#!/bin/bash
# Python Services 统一部署脚本
# 部署到阿里云服务器

set -e

# 配置
SERVER="root@139.196.165.140"
REMOTE_DIR="/www/wwwroot/python-services"
LOCAL_DIR="python-services"

echo "=========================================="
echo "Python Services 统一部署"
echo "=========================================="

# 1. 检查本地文件
echo "[1/6] 检查本地文件..."
if [ ! -d "$LOCAL_DIR" ]; then
    echo "错误: 找不到 $LOCAL_DIR 目录"
    exit 1
fi

# 2. 创建远程目录
echo "[2/6] 创建远程目录..."
ssh $SERVER "mkdir -p $REMOTE_DIR"

# 3. 打包并上传
echo "[3/6] 打包并上传文件..."
cd $LOCAL_DIR
tar --exclude='__pycache__' --exclude='*.pyc' --exclude='.env' \
    --exclude='*.log' --exclude='*.xlsx' --exclude='*.png' \
    --exclude='venv*' --exclude='.git' \
    -czf ../python-services.tar.gz .
cd ..

scp python-services.tar.gz $SERVER:$REMOTE_DIR/
ssh $SERVER "cd $REMOTE_DIR && tar -xzf python-services.tar.gz && rm python-services.tar.gz"
rm -f python-services.tar.gz

# 4. 安装依赖并启动服务
echo "[4/6] 安装依赖..."
ssh $SERVER << 'ENDSSH'
cd /www/wwwroot/python-services

# 使用 Python 3.8
PYTHON_BIN="python3.8"
if ! command -v $PYTHON_BIN &> /dev/null; then
    echo "Python 3.8 不可用，尝试 python3..."
    PYTHON_BIN="python3"
fi
echo "使用 Python: $PYTHON_BIN"
$PYTHON_BIN --version

# 创建虚拟环境
if [ ! -d "venv38" ]; then
    echo "创建虚拟环境..."
    $PYTHON_BIN -m venv venv38
fi

# 激活虚拟环境并安装依赖
source venv38/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 创建 .env 文件 (如果不存在)
if [ ! -f ".env" ]; then
    echo "# Python Services Configuration" > .env
    echo "LOG_LEVEL=INFO" >> .env
fi
ENDSSH

# 5. 停止旧服务并启动新服务
echo "[5/6] 重启服务..."
ssh $SERVER << 'ENDSSH'
cd /www/wwwroot/python-services

# 停止旧的 Python 服务 (8082 和 8083)
echo "停止旧服务..."
pkill -f "uvicorn.*8082" 2>/dev/null || true
pkill -f "uvicorn.*8083" 2>/dev/null || true
sleep 2

# 启动新的统一服务
echo "启动 Python Services..."
source venv38/bin/activate
nohup python -m uvicorn main:app --host 0.0.0.0 --port 8083 > python-services.log 2>&1 &

sleep 3

# 检查服务状态
if curl -s http://localhost:8083/health > /dev/null; then
    echo "Python Services 启动成功!"
    curl -s http://localhost:8083/health
else
    echo "警告: 服务可能未启动，请检查日志"
    tail -30 python-services.log
fi
ENDSSH

# 6. 验证服务
echo "[6/6] 验证服务..."
echo ""
echo "服务状态:"
ssh $SERVER "curl -s http://localhost:8083/health || echo '服务未响应'"

echo ""
echo "=========================================="
echo "部署完成!"
echo "服务地址: http://139.196.165.140:8083"
echo "健康检查: http://139.196.165.140:8083/health"
echo "API 文档: http://139.196.165.140:8083/docs"
echo ""
echo "路由:"
echo "  - /api/smartbi/*      SmartBI 数据分析"
echo "  - /api/error-analysis/* 错误分析"
echo "  - /api/scheduling/*   调度算法"
echo "  - /api/linucb/*       LinUCB (兼容)"
echo "  - /api/analysis/*     Analysis (兼容)"
echo "=========================================="
