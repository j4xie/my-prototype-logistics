#!/bin/bash
# SmartBI Python 服务 Docker 部署脚本
# 使用 Docker 部署到阿里云服务器

set -e

# 配置
SERVER="root@47.100.235.168"
REMOTE_DIR="/www/wwwroot/cretas/code/backend/python"
LOCAL_DIR="smartbi"
IMAGE_NAME="smartbi-python"
CONTAINER_NAME="smartbi-python"
PORT=8083

echo "=========================================="
echo "SmartBI Python 服务 Docker 部署"
echo "=========================================="

# 1. 检查本地文件
echo "[1/6] 检查本地文件..."
if [ ! -d "$LOCAL_DIR" ]; then
    echo "错误: 找不到 $LOCAL_DIR 目录"
    exit 1
fi

# 2. 打包文件
echo "[2/6] 打包文件..."
cd $LOCAL_DIR
tar --exclude='__pycache__' --exclude='*.pyc' --exclude='.env' \
    --exclude='smartbi.log' --exclude='*.xlsx' --exclude='*.png' \
    --exclude='venv*' \
    -czf ../smartbi-docker.tar.gz .
cd ..

# 3. 上传到服务器
echo "[3/6] 上传到服务器..."
ssh $SERVER "mkdir -p $REMOTE_DIR"
scp smartbi-docker.tar.gz $SERVER:$REMOTE_DIR/
rm -f smartbi-docker.tar.gz

# 4. 在服务器上构建和运行 Docker
echo "[4/6] 构建和启动 Docker 容器..."
ssh $SERVER << ENDSSH
cd $REMOTE_DIR

# 解压文件
tar -xzf smartbi-docker.tar.gz && rm smartbi-docker.tar.gz

# 检查 Docker 是否可用
if ! command -v docker &> /dev/null; then
    echo "Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
    systemctl start docker
    systemctl enable docker
fi

# 停止并删除旧容器
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# 构建镜像
echo "构建 Docker 镜像..."
docker build -t $IMAGE_NAME .

# 创建 .env 文件（如果不存在）
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || echo "LLM_API_KEY=" > .env
    echo "已创建 .env 文件"
fi

# 启动容器
echo "启动容器..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p $PORT:$PORT \
    -v \$(pwd)/.env:/app/.env:ro \
    $IMAGE_NAME

sleep 5

# 检查容器状态
docker ps | grep $CONTAINER_NAME
ENDSSH

# 5. 验证服务
echo "[5/6] 验证服务..."
sleep 3
ssh $SERVER "curl -s http://localhost:$PORT/health || echo '服务启动中...'"

# 6. 显示结果
echo ""
echo "=========================================="
echo "Docker 部署完成!"
echo "服务地址: http://47.100.235.168:$PORT"
echo "健康检查: http://47.100.235.168:$PORT/health"
echo "API 文档: http://47.100.235.168:$PORT/docs"
echo ""
echo "管理命令:"
echo "  查看日志: ssh $SERVER 'docker logs $CONTAINER_NAME'"
echo "  重启服务: ssh $SERVER 'docker restart $CONTAINER_NAME'"
echo "  停止服务: ssh $SERVER 'docker stop $CONTAINER_NAME'"
echo "=========================================="
