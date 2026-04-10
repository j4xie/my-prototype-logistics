#!/bin/bash
# web-admin 部署脚本 v1.0 — Vite build + 原子目录交换 + 旧 assets 清理
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
# 用法:
#   ./scripts/deploy/deploy-web-admin.sh           # 默认部署到 139 的 web-admin
#   ./scripts/deploy/deploy-web-admin.sh --dry-run # 构建但不上传
#
# 服务器路径: 139.196.165.140:/www/wwwroot/web-admin/
# Nginx: /www/server/panel/vhost/nginx/web-admin.conf

set -e

# ==================== 配置 ====================
GATEWAY="root@139.196.165.140"
REMOTE_PATH="/www/wwwroot/web-admin"
REMOTE_BACKUP_DIR="/www/wwwroot/web-admin-backups"
LOCAL_BUILD_DIR="web-admin/dist"
TMP_TAR="/tmp/web-admin-dist.tar.gz"
BACKUP_KEEP=3

DRY_RUN=0
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=1
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

if [ "$HTTP_CODE" = "200" ]; then
    log "✅ 部署完成"
    exit 0
else
    log "⚠️  验证失败 (HTTP $HTTP_CODE),请手动检查"
    exit 1
fi
