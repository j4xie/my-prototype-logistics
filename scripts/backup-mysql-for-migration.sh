#!/bin/bash
# ============================================
# MySQL 迁移前备份脚本
# 目标服务器: 139.196.165.140
# ============================================

set -e

# 配置
BACKUP_DIR="/backup/mysql-migration"
DB_NAME="cretas_db"
DB_USER="root"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cretas_db_before_pg_migration_${DATE}.sql"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# 1. 准备工作
# ============================================
prepare() {
    log_info "准备备份目录..."
    mkdir -p $BACKUP_DIR

    # 检查磁盘空间
    AVAILABLE=$(df -BG $BACKUP_DIR | tail -1 | awk '{print $4}' | tr -d 'G')
    if [ "$AVAILABLE" -lt 5 ]; then
        log_error "磁盘空间不足 (剩余: ${AVAILABLE}GB, 需要: 5GB)"
        exit 1
    fi
    log_info "磁盘空间充足: ${AVAILABLE}GB"
}

# ============================================
# 2. 执行备份
# ============================================
backup_database() {
    log_info "开始备份 MySQL 数据库..."
    log_info "数据库: $DB_NAME"
    log_info "输出文件: $BACKUP_FILE"

    # 获取表数量
    TABLE_COUNT=$(mysql -u $DB_USER -p -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'")
    log_info "表数量: $TABLE_COUNT"

    # 执行完整备份
    mysqldump -u $DB_USER -p \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --set-gtid-purged=OFF \
        --add-drop-table \
        --complete-insert \
        $DB_NAME > $BACKUP_FILE

    if [ $? -eq 0 ]; then
        log_info "备份完成!"
    else
        log_error "备份失败!"
        exit 1
    fi
}

# ============================================
# 3. 压缩备份
# ============================================
compress_backup() {
    log_info "压缩备份文件..."
    gzip -9 $BACKUP_FILE
    BACKUP_FILE="${BACKUP_FILE}.gz"

    # 生成校验和
    md5sum $BACKUP_FILE > ${BACKUP_FILE}.md5
    log_info "MD5 校验和已生成"
}

# ============================================
# 4. 验证备份
# ============================================
verify_backup() {
    log_info "验证备份文件..."

    # 检查文件大小
    FILE_SIZE=$(ls -lh $BACKUP_FILE | awk '{print $5}')
    log_info "备份文件大小: $FILE_SIZE"

    # 验证 gzip 文件完整性
    if gzip -t $BACKUP_FILE; then
        log_info "备份文件完整性验证通过"
    else
        log_error "备份文件损坏!"
        exit 1
    fi

    # 统计表数量 (从备份文件)
    BACKUP_TABLE_COUNT=$(zgrep -c "^CREATE TABLE" $BACKUP_FILE)
    log_info "备份中的表数量: $BACKUP_TABLE_COUNT"
}

# ============================================
# 5. 汇总
# ============================================
summary() {
    echo ""
    echo "============================================"
    echo "  备份完成汇总"
    echo "============================================"
    echo "备份文件: $BACKUP_FILE"
    echo "MD5 校验: ${BACKUP_FILE}.md5"
    echo "文件大小: $(ls -lh $BACKUP_FILE | awk '{print $5}')"
    echo "备份时间: $(date)"
    echo "============================================"
    echo ""
    log_info "下一步: 运行 pgloader 迁移"
    log_info "命令: pgloader scripts/migrate.load"
}

# ============================================
# 主流程
# ============================================
main() {
    log_info "============================================"
    log_info "  MySQL 迁移前备份"
    log_info "============================================"

    prepare
    backup_database
    compress_backup
    verify_backup
    summary
}

main "$@"
