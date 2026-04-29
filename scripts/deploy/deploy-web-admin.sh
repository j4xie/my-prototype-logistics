#!/bin/bash
# web-admin 部署脚本 v2.0 — Vite build + 原子目录交换 + 旧 assets 清理 + test/prod 分离
#
# 为什么要做原子交换:
#   Vite 用 content-hash 命名 chunk (e.g. DynamicModulePage-DZGo_ThO.js)。每次 deploy
#   会产生新 hash 的 chunk 文件。如果只做 overlay (tar 解压到现有目录),老 chunk 文件
#   会无限累积 — 最后 /assets/ 会塞满几千个过期文件。浏览器 tab 如果长时间不刷新,
#   还会加载旧 chunk 的 URL (已经修过 bug 的旧版本代码) → 404 日志噪音。
#
#   原子交换: 部署到 .staging → mv 旧目录到 .bak.TS → mv .staging 到目标路径。
#   瞬间完成,old chunks 被一次性清理。代价是: 未刷新的老 tab 在导航时会 chunk load
#   fail → 用户被迫刷新。这是正确的行为,stale tab 不应该继续运行。
#
# v2.0 (Apr 18 2026) — Bug #30 fix:
#   之前 REMOTE_PATH 硬编码 /www/wwwroot/web-admin (prod), 运行 script 就直接上 prod,
#   违反 "不动 prod" 硬规则. 现在强制 --env 参数区分:
#     --env test (DEFAULT)  → /www/wwwroot/web-admin-test  (139:8097 vhost)
#     --env prod            → /www/wwwroot/web-admin       (139:8086 / admin domain)
#     --env all             → 先 test, smoke 后 prod (对齐 deploy-backend.sh)
#
# 用法:
#   ./scripts/deploy/deploy-web-admin.sh              # 默认 test
#   ./scripts/deploy/deploy-web-admin.sh --env test   # 显式 test
#   ./scripts/deploy/deploy-web-admin.sh --env prod   # prod (会 confirm 提示)
#   ./scripts/deploy/deploy-web-admin.sh --dry-run    # 构建但不上传
#
# 服务器路径:
#   test: 139.196.165.140:/www/wwwroot/web-admin-test/  (vhost 8097)
#   prod: 139.196.165.140:/www/wwwroot/web-admin/       (vhost 8086 + admin.cretaceousfuture.com 443)

set -e

# ==================== 参数解析 ====================
ENV="test"   # 默认 test (Bug #30 fix, 之前默认 prod 导致误操作)
DRY_RUN=0

while [ $# -gt 0 ]; do
    case "$1" in
        --env)
            ENV="$2"
            shift 2
            ;;
        --env=*)
            ENV="${1#*=}"
            shift
            ;;
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        *)
            echo "❌ 未知参数: $1"
            echo "用法: $0 [--env test|prod|all] [--dry-run]"
            exit 1
            ;;
    esac
done

case "$ENV" in
    test|prod|all) ;;
    *)
        echo "❌ --env 必须是 test / prod / all (你传了: $ENV)"
        exit 1
        ;;
esac

# ==================== 配置 ====================
GATEWAY="root@139.196.165.140"
REMOTE_BACKUP_DIR="/www/wwwroot/web-admin-backups"
LOCAL_BUILD_DIR="web-admin/dist"
TMP_TAR="/tmp/web-admin-dist.tar.gz"
BACKUP_KEEP=3

# 根据 --env 决定目标路径
if [ "$ENV" = "prod" ]; then
    REMOTE_PATH="/www/wwwroot/web-admin"
    echo "⚠️  ⚠️  ⚠️  PROD 部署  ⚠️  ⚠️  ⚠️"
    echo "    目标: $REMOTE_PATH (139:8086 / admin.cretaceousfuture.com)"
    echo "    影响: 所有 prod 用户立刻看到新代码"
    echo ""
    read -p "    真的部 prod? 输 'YES-PROD' 继续, 其他退出: " confirm
    if [ "$confirm" != "YES-PROD" ]; then
        echo "❌ 已取消 (你输: '$confirm')"
        exit 1
    fi
    echo ""
elif [ "$ENV" = "all" ]; then
    # all 模式: test → smoke → prod, 单独循环处理见下
    echo "🔄 --env all: 先部 test → smoke → prod (需要最后 confirm)"
    REMOTE_PATH="/www/wwwroot/web-admin-test"  # 先 test
else
    # test (default)
    REMOTE_PATH="/www/wwwroot/web-admin-test"
    echo "🧪 TEST 部署 (默认): $REMOTE_PATH (139:8097)"
fi

log() {
    echo "[$(date '+%H:%M:%S')] $*"
}

# ==================== 1. 本地构建 ====================
log "📦 [1/4] 本地构建 web-admin..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT/web-admin"

npm run build 2>&1 | tail -5

if [ ! -f "dist/index.html" ]; then
    log "❌ 构建失败: dist/index.html 不存在"
    exit 1
fi

ASSET_COUNT=$(find dist/assets -type f 2>/dev/null | wc -l | tr -d ' ')
DIST_SIZE=$(du -sh dist/ | cut -f1)
log "   ✓ 构建完成: $ASSET_COUNT 个 assets, $DIST_SIZE"

# ==================== 2. 打包 ====================
log "📦 [2/4] 打包 tarball..."
tar czf "$TMP_TAR" -C dist .
TAR_SIZE=$(du -sh "$TMP_TAR" | cut -f1)
log "   ✓ Tarball: $TAR_SIZE"

if [ "$DRY_RUN" = "1" ]; then
    log "🧪 dry-run: 跳过上传和部署"
    log "   本地 tarball 保留: $TMP_TAR"
    exit 0
fi

# ==================== 3. 上传 ====================
log "📤 [3/4] 上传到 $GATEWAY..."
scp -q "$TMP_TAR" "$GATEWAY:/tmp/web-admin-dist.tar.gz"
log "   ✓ 上传完成"

# ==================== 4. 原子部署 + 旧版本清理 ====================
log "🚀 [4/4] 原子交换 + 清理旧 backups..."
ssh "$GATEWAY" bash <<REMOTE_DEPLOY
set -e
TS=\$(date +%Y%m%d_%H%M%S)
STAGING="${REMOTE_PATH}.staging"
CURRENT="$REMOTE_PATH"
BACKUP_DIR="$REMOTE_BACKUP_DIR"

mkdir -p "\$BACKUP_DIR"

# 解压到 staging
rm -rf "\$STAGING"
mkdir -p "\$STAGING"
tar xzf /tmp/web-admin-dist.tar.gz -C "\$STAGING"

# 记录旧 assets 数量 (用于对比)
OLD_ASSET_COUNT=0
if [ -d "\$CURRENT/assets" ]; then
    OLD_ASSET_COUNT=\$(find "\$CURRENT/assets" -type f 2>/dev/null | wc -l)
fi
NEW_ASSET_COUNT=\$(find "\$STAGING/assets" -type f 2>/dev/null | wc -l)
echo "   旧 assets: \$OLD_ASSET_COUNT → 新 assets: \$NEW_ASSET_COUNT"

# 原子交换
if [ -e "\$CURRENT" ]; then
    mv "\$CURRENT" "\$BACKUP_DIR/web-admin.bak.\$TS"
fi
mv "\$STAGING" "\$CURRENT"
echo "   ✓ 原子交换完成 (backup: web-admin.bak.\$TS)"

# 清理旧 backups (保留最近 $BACKUP_KEEP 份)
ls -1dt "\$BACKUP_DIR"/web-admin.bak.* 2>/dev/null | tail -n +$(($BACKUP_KEEP + 1)) | while read old; do
    rm -rf "\$old"
    echo "   - removed: \$(basename \$old)"
done

# 清理 tmp
rm -f /tmp/web-admin-dist.tar.gz

echo "   ✓ index.html mtime: \$(stat -c '%y' "\$CURRENT/index.html" 2>/dev/null | cut -d. -f1)"
REMOTE_DEPLOY

rm -f "$TMP_TAR"

# ==================== 5. 验证 ====================
log "🔍 验证..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://139.196.165.140:8086/" || echo "000")
log "   HTTP $HTTP_CODE (http://139.196.165.140:8086/)"

if [ "$HTTP_CODE" != "200" ]; then
    log "⚠️  验证失败 (HTTP $HTTP_CODE),请手动检查"
    exit 1
fi

# R43 fix: --env all 之前 silently 只部 test, 现在测试通过后 prompt 部 prod
if [ "$ENV" = "all" ]; then
    log "✅ Test 部署完成"
    echo ""
    echo "⚠️  ⚠️  ⚠️  PROD 部署 (第二阶段)  ⚠️  ⚠️  ⚠️"
    echo "    目标: /www/wwwroot/web-admin (139:8086 / admin.cretaceousfuture.com)"
    echo "    影响: 所有 prod 用户立刻看到新代码"
    echo ""
    read -p "    输 'YES-PROD' 继续部 prod, 其他跳过 prod: " confirm
    if [ "$confirm" != "YES-PROD" ]; then
        echo "✅ Test 已部署, 跳过 prod (你输: '$confirm')"
        exit 0
    fi

    # 重新打包 + 上传 (test 那次已 rm'd /tmp/web-admin-dist.tar.gz)
    log "📦 [prod 1/3] 重新打包..."
    cd "$PROJECT_ROOT/web-admin/dist"
    tar czf "$TMP_TAR" .
    cd "$PROJECT_ROOT"
    log "   ✓ Tarball: $(du -h "$TMP_TAR" | awk '{print $1}')"

    log "📤 [prod 2/3] 上传 prod..."
    scp -q "$TMP_TAR" "$GATEWAY:/tmp/web-admin-dist.tar.gz"
    log "   ✓ 上传完成"

    log "🚀 [prod 3/3] 原子交换 prod..."
    REMOTE_PATH="/www/wwwroot/web-admin"  # prod target
    ssh "$GATEWAY" bash <<REMOTE_DEPLOY_PROD
set -e
TS=\$(date +%Y%m%d_%H%M%S)
STAGING="${REMOTE_PATH}.staging"
CURRENT="$REMOTE_PATH"
BACKUP_DIR="$REMOTE_BACKUP_DIR"

mkdir -p "\$BACKUP_DIR"
rm -rf "\$STAGING"
mkdir -p "\$STAGING"
tar xzf /tmp/web-admin-dist.tar.gz -C "\$STAGING"

OLD_ASSET_COUNT=0
if [ -d "\$CURRENT/assets" ]; then
    OLD_ASSET_COUNT=\$(find "\$CURRENT/assets" -type f 2>/dev/null | wc -l)
fi
NEW_ASSET_COUNT=\$(find "\$STAGING/assets" -type f 2>/dev/null | wc -l)
echo "   旧 assets: \$OLD_ASSET_COUNT → 新 assets: \$NEW_ASSET_COUNT"

if [ -e "\$CURRENT" ]; then
    mv "\$CURRENT" "\$BACKUP_DIR/web-admin.bak.\$TS"
fi
mv "\$STAGING" "\$CURRENT"
echo "   ✓ Prod 原子交换完成 (backup: web-admin.bak.\$TS)"

ls -1dt "\$BACKUP_DIR"/web-admin.bak.* 2>/dev/null | tail -n +$(($BACKUP_KEEP + 1)) | while read old; do
    rm -rf "\$old"
    echo "   - removed: \$(basename \$old)"
done

rm -f /tmp/web-admin-dist.tar.gz
echo "   ✓ Prod index.html mtime: \$(stat -c '%y' "\$CURRENT/index.html" 2>/dev/null | cut -d. -f1)"
REMOTE_DEPLOY_PROD
    rm -f "$TMP_TAR"

    log "🔍 验证 prod..."
    PROD_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://139.196.165.140:8086/" || echo "000")
    log "   HTTP $PROD_CODE (http://139.196.165.140:8086/)"
    if [ "$PROD_CODE" = "200" ]; then
        log "✅ Prod 部署完成"
    else
        log "⚠️  Prod 验证失败 (HTTP $PROD_CODE)"
        exit 1
    fi
fi

log "✅ 部署完成"
