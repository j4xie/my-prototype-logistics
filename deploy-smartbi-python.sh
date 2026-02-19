#!/bin/bash
# Python Services 部署脚本 (SmartBI + 其他模块)
# 部署到阿里云服务器

set -e

# 配置
SERVER="root@47.100.235.168"
REMOTE_DIR="/www/wwwroot/cretas/code/backend/python"
LOCAL_DIR="backend/python"

echo "=========================================="
echo "Python Services 部署 (SmartBI + Modules)"
echo "=========================================="

# 1. 检查本地文件
echo "[1/5] 检查本地文件..."
if [ ! -d "$LOCAL_DIR" ]; then
    echo "错误: 找不到 $LOCAL_DIR 目录"
    exit 1
fi

# 2. 创建远程目录
echo "[2/5] 创建远程目录..."
ssh $SERVER "mkdir -p $REMOTE_DIR"

# 3. 同步文件到服务器
echo "[3/5] 同步文件到服务器..."
# 打包本地文件 (排除不需要的文件)
cd $LOCAL_DIR
tar --exclude='__pycache__' --exclude='*.pyc' --exclude='.env' \
    --exclude='smartbi.log' --exclude='*.xlsx' --exclude='*.png' \
    -czf ../smartbi-python.tar.gz .
cd ..

# 上传并解压
scp smartbi-python.tar.gz $SERVER:$REMOTE_DIR/
ssh $SERVER "cd $REMOTE_DIR && tar -xzf smartbi-python.tar.gz && rm smartbi-python.tar.gz"
rm -f smartbi-python.tar.gz

# 4. 在服务器上安装依赖和启动服务
echo "[4/5] 安装依赖并启动服务..."
ssh $SERVER << 'ENDSSH'
cd /www/wwwroot/smartbi-python

# 使用 Python 3.8
PYTHON_BIN="python3.8"
if ! command -v $PYTHON_BIN &> /dev/null; then
    echo "Python 3.8 不可用，尝试 python3..."
    PYTHON_BIN="python3"
fi
echo "使用 Python: $PYTHON_BIN"
$PYTHON_BIN --version

# 创建虚拟环境 (使用 Python 3.8)
if [ ! -d "venv38" ]; then
    echo "创建虚拟环境 (Python 3.8)..."
    $PYTHON_BIN -m venv venv38
fi

# 激活虚拟环境并安装依赖
source venv38/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 创建 .env 文件 (如果不存在)
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "已创建 .env 文件，请配置 LLM API Key"
fi

# 停止旧进程
pkill -f "uvicorn main:app.*8083" 2>/dev/null || true

# 启动服务
echo "启动 Python Services..."
nohup venv38/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8083 > python-services.log 2>&1 &

sleep 3

# 检查服务状态
if curl -s http://localhost:8083/health > /dev/null; then
    echo "Python Services 启动成功!"
    curl -s http://localhost:8083/health
else
    echo "警告: 服务可能未启动，请检查日志"
    tail -20 python-services.log
fi
ENDSSH

# 5. 验证服务
echo "[5/5] 验证服务..."
echo ""
echo "服务状态:"
ssh $SERVER "curl -s http://localhost:8083/health || echo '服务未响应'"

echo ""
echo "=========================================="
echo "部署完成!"
echo "服务地址: http://47.100.235.168:8083"
echo "健康检查: http://47.100.235.168:8083/health"
echo "API 文档: http://47.100.235.168:8083/docs"
echo "=========================================="
