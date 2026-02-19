#!/bin/bash
# 部署脚本共享函数库 v1.0
# 用法: source scripts/lib/deploy-common.sh
#
# 提供: log(), wait_for_health(), archive_backup(), check_disk_space()

# ==================== 日志 ====================

# 日志级别: DEBUG=0, INFO=1, WARN=2, ERROR=3
_LOG_LEVEL="${LOG_LEVEL:-INFO}"
_LOG_FILE="${LOG_FILE:-}"

_log_level_num() {
    case "$1" in
        DEBUG) echo 0 ;;
        INFO)  echo 1 ;;
        WARN)  echo 2 ;;
        ERROR) echo 3 ;;
        *)     echo 1 ;;
    esac
}

# log <LEVEL> <message...>
# 结构化日志: [timestamp] [LEVEL] message
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')

    local current_level_num
    current_level_num=$(_log_level_num "$_LOG_LEVEL")
    local msg_level_num
    msg_level_num=$(_log_level_num "$level")

    # 跳过低于当前级别的消息
    [ "$msg_level_num" -lt "$current_level_num" ] && return 0

    local log_entry="[$timestamp] [$level] $message"

    # 输出到 stdout
    echo "$log_entry"

    # 如果设置了日志文件，同时写入
    if [ -n "$_LOG_FILE" ]; then
        echo "$log_entry" >> "$_LOG_FILE"
    fi
}

# ==================== 健康检查 ====================

# wait_for_health <url> [retries] [interval_seconds]
# 返回: 0=成功, 1=超时
wait_for_health() {
    local url="$1"
    local retries="${2:-30}"
    local interval="${3:-2}"
    local total_wait=$((retries * interval))

    log "INFO" "健康检查: $url (最多等待 ${total_wait}s)"

    for i in $(seq 1 "$retries"); do
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

        if [ "$status" = "200" ]; then
            log "INFO" "服务正常 (HTTP 200, 等待 $((i * interval))s)"
            return 0
        fi

        if [ $((i % 5)) -eq 0 ]; then
            log "INFO" "等待服务启动... ($((i * interval))/${total_wait}s, HTTP $status)"
        fi

        sleep "$interval"
    done

    log "ERROR" "健康检查超时 (${total_wait}s), 最后状态: HTTP $status"
    return 1
}

# ==================== 备份管理 ====================

# archive_backup <file_path> [keep_count]
# 创建带时间戳的备份，保留最近 N 份
archive_backup() {
    local file="$1"
    local keep="${2:-3}"

    if [ ! -f "$file" ]; then
        log "WARN" "备份目标不存在: $file"
        return 0
    fi

    local backup_name="${file}.bak.$(date +%Y%m%d_%H%M%S)"
    cp "$file" "$backup_name"
    log "INFO" "备份: $backup_name"

    # 清理旧备份，保留最近 $keep 份
    local old_backups
    old_backups=$(ls -t "${file}.bak."* 2>/dev/null | tail -n +$((keep + 1)))
    if [ -n "$old_backups" ]; then
        echo "$old_backups" | xargs rm -f 2>/dev/null || true
        local cleaned
        cleaned=$(echo "$old_backups" | wc -l)
        log "DEBUG" "清理 $cleaned 份旧备份"
    fi
}

# ==================== 磁盘检查 ====================

# check_disk_space <path> <required_mb>
# 检查指定路径的可用磁盘空间
# 返回: 0=足够, 1=不足
check_disk_space() {
    local path="$1"
    local required_mb="$2"

    local available_kb
    available_kb=$(df "$path" 2>/dev/null | awk 'NR==2 {print $4}')

    if [ -z "$available_kb" ]; then
        log "WARN" "无法检查磁盘空间: $path"
        return 0  # 检查失败不阻塞部署
    fi

    local available_mb=$((available_kb / 1024))

    if [ "$available_mb" -lt "$required_mb" ]; then
        log "ERROR" "磁盘空间不足: ${available_mb}MB 可用, 需要 ${required_mb}MB ($path)"
        return 1
    fi

    log "DEBUG" "磁盘空间充足: ${available_mb}MB 可用 ($path)"
    return 0
}

# ==================== 文件大小 ====================

# get_file_size_bytes <file_path>
# 跨平台获取文件大小 (MSYS/Linux/macOS)
get_file_size_bytes() {
    local file="$1"
    wc -c < "$file" 2>/dev/null | tr -d ' '
}

# get_file_size_human <file_path>
# 人类可读的文件大小
get_file_size_human() {
    local file="$1"
    du -h "$file" 2>/dev/null | cut -f1
}

# ==================== 进程管理 ====================

# graceful_kill <pid...>
# 先 SIGTERM，等待 10s，再 SIGKILL
graceful_kill() {
    local pids=("$@")

    for pid in "${pids[@]}"; do
        kill -TERM "$pid" 2>/dev/null || true
    done

    # 等待优雅退出
    local elapsed=0
    while [ $elapsed -lt 10 ]; do
        local alive=0
        for pid in "${pids[@]}"; do
            kill -0 "$pid" 2>/dev/null && alive=1
        done
        [ "$alive" -eq 0 ] && return 0
        sleep 1
        elapsed=$((elapsed + 1))
    done

    # 强制终止
    for pid in "${pids[@]}"; do
        kill -9 "$pid" 2>/dev/null || true
    done
    log "WARN" "强制终止 ${#pids[@]} 个进程"
}

# ==================== 回滚 ====================

# rollback_jar <jar_path>
# 恢复最新备份
rollback_jar() {
    local jar_path="$1"
    local latest_backup
    latest_backup=$(ls -t "${jar_path}.bak."* 2>/dev/null | head -1)

    if [ -z "$latest_backup" ]; then
        log "ERROR" "无可用备份: ${jar_path}.bak.*"
        return 1
    fi

    log "INFO" "回滚到: $latest_backup"
    cp "$latest_backup" "$jar_path"
    log "INFO" "回滚完成"
    return 0
}
