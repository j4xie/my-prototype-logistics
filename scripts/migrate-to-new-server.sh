#!/bin/bash
# ==========================================================
# 服务器迁移脚本: 旧服务器 → 新服务器
#
# 旧服务器: 47.100.235.168 (4C/8GB, 另一阿里云账号)
# 新服务器: 47.100.235.168  (8C/16GB)
#
# 用法:
#   ./scripts/migrate-to-new-server.sh phase1   # 环境准备
#   ./scripts/migrate-to-new-server.sh phase2   # 数据库迁移
#   ./scripts/migrate-to-new-server.sh phase3   # 服务部署
#   ./scripts/migrate-to-new-server.sh phase4   # 配置更新
#   ./scripts/migrate-to-new-server.sh phase5   # 验证切换
#   ./scripts/migrate-to-new-server.sh all      # 全部执行
# ==========================================================

set -e

# 配置
OLD_SERVER="root@47.100.235.168"
NEW_SERVER="root@47.100.235.168"
NEW_IP="47.100.235.168"
OLD_IP="47.100.235.168"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==========================================================
# Phase 1: 新服务器环境准备
# ==========================================================
phase1_environment() {
    log_info "========== Phase 1: 新服务器环境准备 =========="

    log_info "检查新服务器连通性..."
    ssh -o ConnectTimeout=5 $NEW_SERVER "echo 'SSH OK'" || {
        log_error "无法连接新服务器 $NEW_IP"
        log_warn "请先配置 SSH 密钥: ssh-copy-id $NEW_SERVER"
        exit 1
    }

    log_info "检查新服务器环境..."
    ssh $NEW_SERVER << 'EOF'
echo "=== 系统信息 ==="
uname -a
echo ""
echo "=== CPU ==="
nproc
echo ""
echo "=== 内存 ==="
free -h
echo ""
echo "=== 磁盘 ==="
df -h /
echo ""

echo "=== 检查已安装服务 ==="
echo -n "Java: "
java -version 2>&1 | head -1 || echo "未安装"
echo -n "Python: "
python3 --version 2>&1 || echo "未安装"
echo -n "PostgreSQL: "
psql --version 2>&1 || echo "未安装"
echo -n "Redis: "
redis-server --version 2>&1 || echo "未安装"
echo -n "MySQL: "
mysql --version 2>&1 || echo "未安装"
echo -n "Nginx: "
nginx -v 2>&1 || echo "未安装"
echo -n "宝塔: "
bt --version 2>/dev/null || echo "未安装"
EOF

    log_info "Phase 1 完成。请通过宝塔面板安装缺少的服务。"
    log_info "宝塔面板: https://$NEW_IP:8888/658e3b15"
    echo ""
    echo "需要安装的服务:"
    echo "  - Java 17 (JDK)"
    echo "  - PostgreSQL 14+"
    echo "  - Redis"
    echo "  - Python 3.8+"
    echo "  - MySQL 5.7+ (如果迁移 Mall)"
}

# ==========================================================
# Phase 2: 数据库迁移
# ==========================================================
phase2_database() {
    log_info "========== Phase 2: 数据库迁移 =========="

    # PostgreSQL 迁移
    log_info "[PG] 从旧服务器导出 PostgreSQL 数据库..."

    ssh $OLD_SERVER << 'EOF'
cd /tmp
echo "导出 cretas_db..."
sudo -u postgres pg_dump cretas_db > cretas_db_dump.sql 2>/dev/null || pg_dump -U cretas_user -h localhost cretas_db > cretas_db_dump.sql
echo "导出 smartbi_db..."
sudo -u postgres pg_dump smartbi_db > smartbi_db_dump.sql 2>/dev/null || pg_dump -U smartbi_user -h localhost smartbi_db > smartbi_db_dump.sql
ls -lh /tmp/*_dump.sql
EOF

    log_info "[PG] 传输到新服务器..."
    ssh $OLD_SERVER "scp /tmp/cretas_db_dump.sql /tmp/smartbi_db_dump.sql $NEW_SERVER:/tmp/" || {
        # 如果旧服务器不能直接 scp 到新服务器，通过本地中转
        log_warn "直接传输失败，通过本地中转..."
        scp $OLD_SERVER:/tmp/cretas_db_dump.sql /tmp/
        scp $OLD_SERVER:/tmp/smartbi_db_dump.sql /tmp/
        scp /tmp/cretas_db_dump.sql $NEW_SERVER:/tmp/
        scp /tmp/smartbi_db_dump.sql $NEW_SERVER:/tmp/
    }

    log_info "[PG] 在新服务器上创建数据库并导入..."
    ssh $NEW_SERVER << 'PGEOF'
# 创建用户和数据库
sudo -u postgres psql << 'SQL'
-- cretas
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cretas_user') THEN
    CREATE USER cretas_user WITH PASSWORD 'cretas123';
  END IF;
END $$;
CREATE DATABASE cretas_db OWNER cretas_user;

-- smartbi
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'smartbi_user') THEN
    CREATE USER smartbi_user WITH PASSWORD 'smartbi_secure_password_2025';
  END IF;
END $$;
CREATE DATABASE smartbi_db OWNER smartbi_user;
SQL

# 导入数据
echo "导入 cretas_db..."
psql -U cretas_user -d cretas_db < /tmp/cretas_db_dump.sql 2>&1 | tail -5
echo "导入 smartbi_db..."
psql -U smartbi_user -d smartbi_db < /tmp/smartbi_db_dump.sql 2>&1 | tail -5

echo "验证数据..."
psql -U cretas_user -d cretas_db -c "SELECT count(*) as users_count FROM users;" 2>/dev/null || echo "users 表查询失败"
psql -U smartbi_user -d smartbi_db -c "SELECT count(*) as uploads_count FROM smart_bi_pg_excel_uploads;" 2>/dev/null || echo "uploads 表查询失败"
PGEOF

    # MySQL 迁移 (Mall)
    log_info "[MySQL] 导出 MySQL 数据库..."
    ssh $OLD_SERVER "mysqldump -u root --all-databases > /tmp/mysql_dump.sql 2>/dev/null && ls -lh /tmp/mysql_dump.sql" || {
        log_warn "MySQL 导出失败，可能需要密码。请手动执行:"
        echo "  ssh $OLD_SERVER 'mysqldump -u root -p --all-databases > /tmp/mysql_dump.sql'"
    }

    log_info "Phase 2 完成。请验证数据库迁移结果。"
}

# ==========================================================
# Phase 3: 服务部署
# ==========================================================
phase3_deploy() {
    log_info "========== Phase 3: 服务部署 =========="

    # 3.1 Cretas Java 后端
    log_info "[Java] 部署 Cretas 后端..."
    ssh $NEW_SERVER "mkdir -p /www/wwwroot/cretas/logs /www/wwwroot/cretas/uploads/smartbi"

    log_info "[Java] 从旧服务器复制 JAR + 脚本..."
    ssh $OLD_SERVER "scp /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar $NEW_SERVER:/www/wwwroot/cretas/" || {
        log_warn "直接传输失败，通过本地中转..."
        scp $OLD_SERVER:/www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar /tmp/
        scp /tmp/aims-0.0.1-SNAPSHOT.jar $NEW_SERVER:/www/wwwroot/cretas/
    }

    # 复制启动脚本
    scp $OLD_SERVER:/www/wwwroot/cretas/restart.sh /tmp/restart.sh 2>/dev/null
    scp /tmp/restart.sh $NEW_SERVER:/www/wwwroot/cretas/ 2>/dev/null

    scp $OLD_SERVER:/www/wwwroot/cretas/pull-jar.sh /tmp/pull-jar.sh 2>/dev/null
    scp /tmp/pull-jar.sh $NEW_SERVER:/www/wwwroot/cretas/ 2>/dev/null

    # 复制上传的文件
    log_info "[Java] 同步 SmartBI 上传文件..."
    ssh $OLD_SERVER "tar -czf /tmp/smartbi-uploads.tar.gz -C /www/wwwroot/cretas/uploads/smartbi . 2>/dev/null" || true
    scp $OLD_SERVER:/tmp/smartbi-uploads.tar.gz /tmp/ 2>/dev/null || true
    scp /tmp/smartbi-uploads.tar.gz $NEW_SERVER:/tmp/ 2>/dev/null || true
    ssh $NEW_SERVER "cd /www/wwwroot/cretas/uploads/smartbi && tar -xzf /tmp/smartbi-uploads.tar.gz 2>/dev/null" || true

    log_info "[Java] 启动 Cretas 后端..."
    ssh $NEW_SERVER "cd /www/wwwroot/cretas && bash restart.sh" || {
        log_warn "restart.sh 失败，尝试直接启动..."
        ssh $NEW_SERVER "cd /www/wwwroot/cretas && nohup java -jar -Xmx2g aims-0.0.1-SNAPSHOT.jar --spring.profiles.active=pg-prod > cretas-backend.log 2>&1 &"
    }

    # 3.2 Python AI 服务
    log_info "[Python] 部署 Python AI 服务..."
    ssh $NEW_SERVER "mkdir -p /www/wwwroot/python-services"

    ssh $OLD_SERVER "tar -czf /tmp/python-services.tar.gz -C /www/wwwroot/smartbi-python . --exclude='venv38' --exclude='__pycache__' --exclude='*.pyc' 2>/dev/null"
    scp $OLD_SERVER:/tmp/python-services.tar.gz /tmp/
    scp /tmp/python-services.tar.gz $NEW_SERVER:/tmp/

    ssh $NEW_SERVER << 'PYEOF'
cd /www/wwwroot/python-services
tar -xzf /tmp/python-services.tar.gz

# 创建虚拟环境
PYTHON_BIN="python3.8"
if ! command -v $PYTHON_BIN &> /dev/null; then
    PYTHON_BIN="python3"
fi

if [ ! -d "venv38" ]; then
    $PYTHON_BIN -m venv venv38
fi

source venv38/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 停止旧进程
pkill -f "uvicorn main:app.*8083" 2>/dev/null || true

# 启动服务
nohup venv38/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8083 > python-services.log 2>&1 &
sleep 3
curl -s http://localhost:8083/health || echo "Python 服务启动中..."
PYEOF

    # 3.3 Embedding 服务
    log_info "[Embedding] 部署 Embedding 服务..."
    ssh $NEW_SERVER "mkdir -p /www/wwwroot/embedding-service /www/wwwroot/cretas/models"

    ssh $OLD_SERVER "scp /www/wwwroot/embedding-service/embedding-service-1.0.0.jar $NEW_SERVER:/www/wwwroot/embedding-service/" 2>/dev/null || {
        log_warn "Embedding JAR 传输失败，通过本地中转..."
        scp $OLD_SERVER:/www/wwwroot/embedding-service/embedding-service-1.0.0.jar /tmp/ 2>/dev/null || true
        scp /tmp/embedding-service-1.0.0.jar $NEW_SERVER:/www/wwwroot/embedding-service/ 2>/dev/null || true
    }

    # 复制模型文件
    log_info "[Embedding] 同步模型文件..."
    ssh $OLD_SERVER "tar -czf /tmp/gte-model.tar.gz -C /www/wwwroot/cretas/models . 2>/dev/null" || true
    scp $OLD_SERVER:/tmp/gte-model.tar.gz /tmp/ 2>/dev/null || true
    scp /tmp/gte-model.tar.gz $NEW_SERVER:/tmp/ 2>/dev/null || true
    ssh $NEW_SERVER "cd /www/wwwroot/cretas/models && tar -xzf /tmp/gte-model.tar.gz 2>/dev/null" || true

    ssh $NEW_SERVER << 'EMBEOF'
cd /www/wwwroot/embedding-service
pkill -f "embedding-service.*jar" 2>/dev/null || true
if [ -f "embedding-service-1.0.0.jar" ]; then
    nohup java -jar -Xmx512M embedding-service-1.0.0.jar \
        --grpc.server.port=9090 \
        --embedding.model-path=/www/wwwroot/cretas/models/gte-base-zh \
        > embedding-service.log 2>&1 &
    echo "Embedding 服务已启动"
else
    echo "Embedding JAR 不存在，跳过"
fi
EMBEOF

    # 3.4 Mall 后端
    log_info "[Mall] 部署 Mall 后端..."
    ssh $NEW_SERVER "mkdir -p /www/wwwroot/mall/backend"

    ssh $OLD_SERVER "tar -czf /tmp/mall-backend.tar.gz -C /www/wwwroot/mall . 2>/dev/null" || true
    scp $OLD_SERVER:/tmp/mall-backend.tar.gz /tmp/ 2>/dev/null || true
    scp /tmp/mall-backend.tar.gz $NEW_SERVER:/tmp/ 2>/dev/null || true
    ssh $NEW_SERVER "cd /www/wwwroot/mall && tar -xzf /tmp/mall-backend.tar.gz 2>/dev/null" || true

    log_info "Phase 3 完成。"
}

# ==========================================================
# Phase 4: 配置更新 (Nginx)
# ==========================================================
phase4_config() {
    log_info "========== Phase 4: Nginx 配置更新 =========="

    log_info "旧服务器 Nginx 需要手动配置反向代理。"
    echo ""
    echo "请在旧服务器 (47.100.235.168) 的宝塔面板中更新 Nginx 配置:"
    echo "配置文件模板: scripts/nginx-proxy-to-new-server.conf"
    echo ""
    echo "关键配置:"
    echo "  location /api/mobile → proxy_pass http://$NEW_IP:10010"
    echo "  location /smartbi-api → proxy_pass http://$NEW_IP:8083"
    echo ""
    log_warn "重要: proxy_buffering off; 是 SSE 流式响应的必要条件"
}

# ==========================================================
# Phase 5: 验证切换
# ==========================================================
phase5_verify() {
    log_info "========== Phase 5: 验证与切换 =========="

    log_info "[1] 新服务器健康检查..."
    echo -n "  Java 后端: "
    ssh $NEW_SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:10010/api/mobile/health 2>/dev/null" || echo "FAIL"
    echo ""

    echo -n "  Python AI: "
    ssh $NEW_SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:8083/health 2>/dev/null" || echo "FAIL"
    echo ""

    echo -n "  Embedding: "
    ssh $NEW_SERVER "pgrep -f 'embedding-service.*jar' > /dev/null && echo 'RUNNING' || echo 'NOT RUNNING'"

    log_info "[2] 数据库连通性..."
    ssh $NEW_SERVER << 'EOF'
echo -n "  PostgreSQL cretas_db: "
psql -U cretas_user -h localhost -d cretas_db -c "SELECT 1;" > /dev/null 2>&1 && echo "OK" || echo "FAIL"
echo -n "  PostgreSQL smartbi_db: "
psql -U smartbi_user -h localhost -d smartbi_db -c "SELECT 1;" > /dev/null 2>&1 && echo "OK" || echo "FAIL"
echo -n "  Redis: "
redis-cli ping 2>/dev/null || echo "FAIL"
EOF

    log_info "[3] 通过旧服务器 Nginx 代理测试..."
    echo -n "  Proxy → Java: "
    curl -s -o /dev/null -w "%{http_code}" http://$OLD_IP/api/mobile/health 2>/dev/null || echo "FAIL (Nginx 未配置)"
    echo ""

    log_info "[4] 直连新服务器测试..."
    echo -n "  Direct → Java: "
    curl -s -o /dev/null -w "%{http_code}" http://$NEW_IP:10010/api/mobile/health 2>/dev/null || echo "FAIL"
    echo ""

    echo ""
    log_info "验证完成。如果全部通过，可以停止旧服务器上的后端服务:"
    echo "  ssh $OLD_SERVER 'pkill -f aims-0.0.1-SNAPSHOT.jar'"
    echo "  ssh $OLD_SERVER 'pkill -f uvicorn'"
    echo "  ssh $OLD_SERVER 'systemctl stop embedding-service'"
    echo "  ssh $OLD_SERVER 'systemctl stop mall-backend'"
}

# ==========================================================
# 主流程
# ==========================================================
case "${1:-help}" in
    phase1) phase1_environment ;;
    phase2) phase2_database ;;
    phase3) phase3_deploy ;;
    phase4) phase4_config ;;
    phase5) phase5_verify ;;
    all)
        phase1_environment
        echo ""
        read -p "Phase 1 完成，继续 Phase 2? (y/N) " -n 1 -r
        echo ""
        [[ $REPLY =~ ^[Yy]$ ]] || exit 0

        phase2_database
        echo ""
        read -p "Phase 2 完成，继续 Phase 3? (y/N) " -n 1 -r
        echo ""
        [[ $REPLY =~ ^[Yy]$ ]] || exit 0

        phase3_deploy
        echo ""
        phase4_config
        echo ""
        read -p "Phase 4 完成，继续验证? (y/N) " -n 1 -r
        echo ""
        [[ $REPLY =~ ^[Yy]$ ]] || exit 0

        phase5_verify
        ;;
    *)
        echo "用法: $0 {phase1|phase2|phase3|phase4|phase5|all}"
        echo ""
        echo "  phase1  - 新服务器环境准备 (检查已安装服务)"
        echo "  phase2  - 数据库迁移 (PG + MySQL)"
        echo "  phase3  - 服务部署 (Java + Python + Embedding + Mall)"
        echo "  phase4  - Nginx 配置指引"
        echo "  phase5  - 验证与切换"
        echo "  all     - 按顺序执行全部"
        ;;
esac
