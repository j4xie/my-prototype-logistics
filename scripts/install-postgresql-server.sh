#!/bin/bash
# ============================================
# PostgreSQL 14+ 服务器安装脚本
# 目标服务器: 139.196.165.140 (CentOS/Alibaba Cloud Linux)
# ============================================

set -e

echo "============================================"
echo "  PostgreSQL 14 安装脚本"
echo "============================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# 1. 安装 PostgreSQL 14
# ============================================
install_postgresql() {
    log_info "安装 PostgreSQL 14..."

    # 添加 PostgreSQL 官方仓库
    if [ ! -f /etc/yum.repos.d/pgdg-redhat-all.repo ]; then
        yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm
    fi

    # 禁用内置 PostgreSQL 模块 (如果存在)
    yum module disable -y postgresql 2>/dev/null || true

    # 安装 PostgreSQL 14
    yum install -y postgresql14-server postgresql14-contrib

    # 初始化数据库
    if [ ! -d /var/lib/pgsql/14/data/base ]; then
        /usr/pgsql-14/bin/postgresql-14-setup initdb
    fi

    # 启动服务
    systemctl enable postgresql-14
    systemctl start postgresql-14

    log_info "PostgreSQL 14 安装完成"
}

# ============================================
# 2. 安装 pgloader
# ============================================
install_pgloader() {
    log_info "安装 pgloader..."

    # 安装 EPEL 仓库
    yum install -y epel-release

    # 安装 pgloader 依赖
    yum install -y sbcl freetds freetds-devel

    # 尝试从 EPEL 安装
    if yum install -y pgloader 2>/dev/null; then
        log_info "pgloader 从 EPEL 安装成功"
    else
        log_warn "EPEL 无 pgloader，使用 Docker 方式"
        # 使用 Docker 运行 pgloader
        if ! command -v docker &> /dev/null; then
            yum install -y docker
            systemctl enable docker
            systemctl start docker
        fi
        docker pull dimitri/pgloader:latest
        log_info "pgloader Docker 镜像已拉取"
    fi
}

# ============================================
# 3. 配置 PostgreSQL
# ============================================
configure_postgresql() {
    log_info "配置 PostgreSQL..."

    PG_CONF="/var/lib/pgsql/14/data/postgresql.conf"
    PG_HBA="/var/lib/pgsql/14/data/pg_hba.conf"

    # 备份原配置
    cp $PG_CONF ${PG_CONF}.bak
    cp $PG_HBA ${PG_HBA}.bak

    # 修改 postgresql.conf
    cat >> $PG_CONF << 'EOF'

# ============================================
# Cretas 迁移优化配置
# ============================================
listen_addresses = '*'
port = 5432

# 内存配置 (假设 8GB RAM)
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 64MB

# 并发配置
max_connections = 200
max_parallel_workers_per_gather = 4

# WAL 配置
wal_buffers = 64MB
checkpoint_completion_target = 0.9

# 日志配置
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d.log'
log_statement = 'ddl'

# pg_cron 支持
shared_preload_libraries = 'pg_cron'
cron.database_name = 'cretas_db'
EOF

    # 修改 pg_hba.conf (允许远程连接)
    cat >> $PG_HBA << 'EOF'

# Cretas 应用连接
host    cretas_db       cretas_user     127.0.0.1/32            md5
host    cretas_db       cretas_user     10.0.0.0/8              md5
host    smartbi_db      smartbi_user    127.0.0.1/32            md5
host    smartbi_db      smartbi_user    10.0.0.0/8              md5
EOF

    log_info "PostgreSQL 配置完成"
}

# ============================================
# 4. 创建数据库和用户
# ============================================
create_database() {
    log_info "创建数据库和用户..."

    # 读取密码
    read -sp "请输入 cretas_user 密码: " CRETAS_PWD
    echo
    read -sp "请输入 smartbi_user 密码: " SMARTBI_PWD
    echo

    sudo -u postgres psql << EOF
-- 创建用户
CREATE USER cretas_user WITH PASSWORD '${CRETAS_PWD}';
CREATE USER smartbi_user WITH PASSWORD '${SMARTBI_PWD}';

-- 创建数据库
CREATE DATABASE cretas_db OWNER cretas_user;
CREATE DATABASE smartbi_db OWNER smartbi_user;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE cretas_db TO cretas_user;
GRANT ALL PRIVILEGES ON DATABASE smartbi_db TO smartbi_user;

-- 安装扩展
\c cretas_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

\c smartbi_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF

    log_info "数据库和用户创建完成"
}

# ============================================
# 5. 重启服务
# ============================================
restart_services() {
    log_info "重启 PostgreSQL 服务..."
    systemctl restart postgresql-14

    # 验证
    if systemctl is-active --quiet postgresql-14; then
        log_info "PostgreSQL 服务运行正常"
    else
        log_error "PostgreSQL 服务启动失败"
        exit 1
    fi
}

# ============================================
# 6. 验证安装
# ============================================
verify_installation() {
    log_info "验证安装..."

    echo ""
    echo "PostgreSQL 版本:"
    sudo -u postgres psql -c "SELECT version();"

    echo ""
    echo "已安装扩展:"
    sudo -u postgres psql -d cretas_db -c "SELECT extname FROM pg_extension;"

    echo ""
    echo "数据库列表:"
    sudo -u postgres psql -c "\l"

    log_info "============================================"
    log_info "安装完成!"
    log_info "============================================"
    log_info "PostgreSQL 端口: 5432"
    log_info "数据库: cretas_db, smartbi_db"
    log_info "用户: cretas_user, smartbi_user"
}

# ============================================
# 主流程
# ============================================
main() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi

    install_postgresql
    install_pgloader
    configure_postgresql
    create_database
    restart_services
    verify_installation
}

main "$@"
