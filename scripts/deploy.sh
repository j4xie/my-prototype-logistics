#!/bin/bash
# 宝塔部署脚本 - 从 GitHub 拉取代码并打包部署

set -e

# 配置
DEPLOY_DIR="/www/wwwroot/cretas"
CODE_DIR="/www/wwwroot/cretas/code"
REPO_URL="https://github.com/j4xie/my-prototype-logistics.git"
BRANCH="${1:-steven}"  # 从参数获取分支，默认 steven
JAR_NAME="aims-0.0.1-SNAPSHOT.jar"

# 日志
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "========== 开始部署 (分支: $BRANCH) =========="

# 1. 拉取代码
if [ -d "$CODE_DIR/.git" ]; then
    log "更新代码..."
    cd "$CODE_DIR"
    git fetch origin
    git checkout $BRANCH
    git reset --hard origin/$BRANCH
else
    log "首次克隆代码..."
    git clone -b $BRANCH $REPO_URL "$CODE_DIR"
    cd "$CODE_DIR"
fi

# 2. Maven 打包
log "Maven 打包..."
cd "$CODE_DIR/backend-java"
mvn clean package -DskipTests -q

# 3. 停止旧服务
log "停止旧服务..."
PID=$(pgrep -f "$JAR_NAME" || true)
if [ -n "$PID" ]; then
    kill $PID
    sleep 3
fi

# 4. 备份旧 JAR
if [ -f "$DEPLOY_DIR/$JAR_NAME" ]; then
    log "备份旧 JAR..."
    mv "$DEPLOY_DIR/$JAR_NAME" "$DEPLOY_DIR/${JAR_NAME}.bak"
fi

# 5. 复制新 JAR
log "部署新 JAR..."
cp "$CODE_DIR/backend-java/target/$JAR_NAME" "$DEPLOY_DIR/"

# 6. 启动服务
log "启动服务..."
cd "$DEPLOY_DIR"
nohup java -jar $JAR_NAME \
    -DJWT_SECRET=${JWT_SECRET} \
    -DALIBABA_ACCESSKEY_ID=${ALIBABA_ACCESSKEY_ID} \
    -DALIBABA_SECRET_KEY=${ALIBABA_SECRET_KEY} \
    --server.port=10010 \
    > app.log 2>&1 &

# 7. 清理冗余文件
log "清理冗余文件..."
rm -rf "$CODE_DIR/backend-java/target"
rm -f "$DEPLOY_DIR/${JAR_NAME}.bak"

# 8. 等待启动
sleep 5
if pgrep -f "$JAR_NAME" > /dev/null; then
    log "✅ 部署成功！服务已启动"
else
    log "❌ 部署失败！服务未启动"
    exit 1
fi

log "========== 部署完成 =========="
