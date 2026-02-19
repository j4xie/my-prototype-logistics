#!/bin/bash
# 后端部署脚本 v4.0
# 修复: 独立临时文件 + MD5校验 + orphan进程清理
#
# 模式1 - JAR 部署 (推荐，默认):
#   ./deploy-backend.sh              # 本地打包 + 并行上传 + 服务器部署
#   ./deploy-backend.sh --jar v1.0   # 指定版本号
#
# 模式2 - Git 部署 (旧方式):
#   ./deploy-backend.sh --git        # git push + 服务器编译

set -e

# ==================== 配置 ====================
REPO="j4xie/my-prototype-logistics"
JAR_NAME="cretas-backend-system-1.0.0.jar"
SERVER="root@47.100.235.168"
REMOTE_JAR_DIR="/www/wwwroot/cretas"
REMOTE_TMP="/tmp"

# GitHub 镜像列表
GITHUB_MIRRORS=(
    "ghproxy.cc"
    "mirror.ghproxy.com"
    "ghfast.top"
    "gh-proxy.com"
    "cf.ghproxy.cc"
)

# 阿里云 OSS 配置
OSS_BUCKET="cretas-media"
OSS_ENDPOINT="oss-cn-shanghai.aliyuncs.com"
OSS_ACCELERATE_ENDPOINT="oss-accelerate.aliyuncs.com"  # 全球加速
OSS_INTERNAL_ENDPOINT="oss-cn-shanghai-internal.aliyuncs.com"
OSS_DEPLOY_PATH="deploy/backend/"

# Cloudflare R2 配置 (从环境变量读取，不要硬编码凭证)
R2_BUCKET="cretas"
# R2_ACCOUNT_ID 是公开标识符 (非凭证)，凭证为 R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-7ff7cc2e7bc3af46147d5c7df18062db}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_PUBLIC_URL="${R2_PUBLIC_URL:-https://pub-70da4e6da1f3446d9e055f2793d05837.r2.dev}"

# ==================== 参数解析 ====================
MODE="jar"
ARG=""

case "$1" in
    --git)
        MODE="git"
        ARG="${2:-steven}"
        ;;
    --jar)
        MODE="jar"
        ARG="$2"
        ;;
    -h|--help)
        echo "用法: ./deploy-backend.sh [选项] [参数]"
        echo ""
        echo "选项:"
        echo "  --jar [version]   JAR 部署模式 (默认)"
        echo "  --git [branch]    Git 部署模式"
        echo "  -h, --help        显示帮助"
        echo ""
        echo "上传策略:"
        echo "  [阶段1] GitHub 并行 (直连 + 5镜像同时竞争)"
        echo "          超时: 60秒"
        echo "  [阶段2] Fallback (GitHub 失败时启用)"
        echo "          - SCP 直接上传"
        echo "          - SCP + gzip 压缩传输"
        echo "          - OSS 全球加速 + 内网下载"
        echo "          - Cloudflare R2 中转"
        echo ""
        echo "示例:"
        echo "  ./deploy-backend.sh              # JAR 部署"
        echo "  ./deploy-backend.sh --jar v1.2   # 指定版本"
        echo "  ./deploy-backend.sh --git        # Git 部署"
        exit 0
        ;;
    *)
        if [ -n "$1" ]; then
            ARG="$1"
        fi
        ;;
esac

# ==================== 环境准备 ====================
# Windows 环境设置 PATH
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    export PATH="$PATH:/c/Program Files/GitHub CLI:/c/Program Files/Amazon/AWSCLIV2:/c/tools:/c/tools/apache-maven-3.9.6/bin"
fi

# 检查工具可用性
HAS_GH=false
HAS_OSS=false
HAS_R2=false

if command -v gh &> /dev/null && gh auth status &> /dev/null 2>&1; then
    HAS_GH=true
fi

if command -v ossutil &> /dev/null || command -v ossutil64 &> /dev/null; then
    HAS_OSS=true
    OSSUTIL_CMD=$(command -v ossutil || command -v ossutil64)
fi

if command -v aws &> /dev/null; then
    HAS_R2=true
fi

# 临时目录
UPLOAD_STATUS_DIR="/tmp/jar-upload-$$"
mkdir -p "$UPLOAD_STATUS_DIR"

cleanup() {
    rm -rf "$UPLOAD_STATUS_DIR"
    rm -f "/tmp/${JAR_NAME}.gz" 2>/dev/null
    jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

# ==================== Git 部署模式 ====================
deploy_git() {
    local BRANCH="${1:-steven}"
    echo "=========================================="
    echo "  Git 部署模式 - 分支: $BRANCH"
    echo "=========================================="
    echo ""
    echo "📤 推送代码到 GitHub..."
    git push origin "$BRANCH"
    echo ""
    echo "🔧 触发服务器部署..."
    ssh $SERVER "cd /www/wwwroot/cretas && ./deploy.sh $BRANCH"
    echo ""
    echo "✅ Git 部署完成!"
}

# ==================== JAR 部署模式 ====================
deploy_jar() {
    local VERSION="${1:-v$(date +%Y%m%d_%H%M%S)}"

    # 统计可用方式
    local METHODS=("SCP" "SCP+gzip")
    [ "$HAS_GH" = "true" ] && METHODS+=("GitHub+镜像" "GitHub直连")
    [ "$HAS_OSS" = "true" ] && METHODS+=("OSS加速")
    [ "$HAS_R2" = "true" ] && METHODS+=("R2")

    echo "=========================================="
    echo "  JAR 部署 v4.0 - 版本: $VERSION"
    echo "  可用方式: ${METHODS[*]}"
    echo "=========================================="

    # ----- 1. 本地 Maven 打包 -----
    echo ""
    echo "📦 [1/4] 本地 Maven 打包..."
    export JAVA_HOME="${JAVA_HOME:-C:/Program Files/Java/jdk-17}"
    cd backend/java/cretas-api
    ./mvnw.cmd clean package -Dmaven.test.skip=true -q
    cd ../../..

    JAR_PATH="backend/java/cretas-api/target/$JAR_NAME"
    if [ ! -f "$JAR_PATH" ]; then
        echo "❌ JAR 文件不存在: $JAR_PATH"
        exit 1
    fi

    JAR_SIZE=$(du -h "$JAR_PATH" | cut -f1)
    JAR_SIZE_BYTES=$(stat -f%z "$JAR_PATH" 2>/dev/null || stat -c%s "$JAR_PATH" 2>/dev/null)
    echo "   ✓ 打包完成: $JAR_NAME ($JAR_SIZE, ${JAR_SIZE_BYTES} bytes)"

    # 计算本地 MD5 checksum
    LOCAL_MD5=$(md5sum "$JAR_PATH" | cut -d' ' -f1)
    echo "   ✓ MD5: $LOCAL_MD5"

    # 预先创建 gzip 压缩版本
    echo "   压缩中..."
    gzip -c "$JAR_PATH" > "/tmp/${JAR_NAME}.gz"
    GZ_SIZE=$(du -h "/tmp/${JAR_NAME}.gz" | cut -f1)
    echo "   ✓ 压缩完成: ${JAR_NAME}.gz ($GZ_SIZE)"

    # ----- 2. 并行上传 -----
    echo ""
    echo "📤 [2/4] 启动并行上传..."

    # 检查是否已有胜者
    check_winner() {
        [ -f "$UPLOAD_STATUS_DIR/winner" ]
    }

    # 远程 MD5 验证 + rename 为标准名
    # 参数: $1=远程临时文件名 (不含目录), $2=方法名
    verify_and_claim() {
        local TMP_FILE="$1"
        local METHOD_NAME="$2"
        if ssh -o ConnectTimeout=5 $SERVER "
            REMOTE_MD5=\$(md5sum $REMOTE_TMP/$TMP_FILE | cut -d' ' -f1)
            if [ \"\$REMOTE_MD5\" = \"$LOCAL_MD5\" ]; then
                mv -f $REMOTE_TMP/$TMP_FILE $REMOTE_TMP/$JAR_NAME
                exit 0
            else
                echo \"MD5 mismatch: \$REMOTE_MD5 vs $LOCAL_MD5\"
                rm -f $REMOTE_TMP/$TMP_FILE
                exit 1
            fi
        " 2>/dev/null; then
            if ! check_winner; then
                echo "$METHOD_NAME" > "$UPLOAD_STATUS_DIR/winner"
                echo "   [$METHOD_NAME] ✓ 完成! (MD5 verified)"
            fi
        else
            check_winner || echo "   [$METHOD_NAME] ✗ MD5 验证失败"
        fi
    }

    # === Fallback 方法1: SCP 直接上传 ===
    upload_scp() {
        check_winner && return 0
        local TMP_FILE="${JAR_NAME}.scp"
        echo "   [SCP] 开始上传..."
        if scp -o ConnectTimeout=10 -o ServerAliveInterval=10 "$JAR_PATH" "$SERVER:$REMOTE_TMP/$TMP_FILE" 2>/dev/null; then
            if ! check_winner; then
                verify_and_claim "$TMP_FILE" "SCP"
            fi
        else
            check_winner || echo "   [SCP] ✗ 失败"
        fi
    }

    # === Fallback 方法2: SCP + gzip 压缩传输 ===
    upload_scp_gzip() {
        check_winner && return 0
        local TMP_FILE="${JAR_NAME}.scp_gzip"
        local TMP_GZ="${JAR_NAME}.scp_gzip.gz"
        echo "   [SCP+gzip] 开始压缩上传..."
        if scp -o ConnectTimeout=10 -o ServerAliveInterval=10 "/tmp/${JAR_NAME}.gz" "$SERVER:$REMOTE_TMP/$TMP_GZ" 2>/dev/null; then
            check_winner && return 0
            if ssh $SERVER "cd $REMOTE_TMP && gunzip -c $TMP_GZ > $TMP_FILE && rm -f $TMP_GZ" 2>/dev/null; then
                if ! check_winner; then
                    verify_and_claim "$TMP_FILE" "SCP+gzip"
                fi
            else
                check_winner || echo "   [SCP+gzip] ✗ 解压失败"
            fi
        else
            check_winner || echo "   [SCP+gzip] ✗ 上传失败"
        fi
    }

    # === Fallback 方法3: OSS 全球加速 ===
    upload_oss_accelerate() {
        [ "$HAS_OSS" != "true" ] && return 1
        check_winner && return 0

        local TMP_FILE="${JAR_NAME}.oss"
        echo "   [OSS加速] 使用全球加速上传..."
        local OSS_PATH="oss://${OSS_BUCKET}/${OSS_DEPLOY_PATH}${JAR_NAME}"

        if $OSSUTIL_CMD cp "$JAR_PATH" "$OSS_PATH" -f -e "$OSS_ACCELERATE_ENDPOINT" 2>/dev/null; then
            check_winner && return 0
            echo "   [OSS加速] ✓ 上传成功，服务器内网下载..."

            local INTERNAL_URL="https://${OSS_BUCKET}.${OSS_INTERNAL_ENDPOINT}/${OSS_DEPLOY_PATH}${JAR_NAME}"

            if ssh -o ConnectTimeout=5 $SERVER "
                cd $REMOTE_TMP && \
                curl -sL --connect-timeout 10 --max-time 300 -o $TMP_FILE '$INTERNAL_URL'
            " 2>/dev/null; then
                if ! check_winner; then
                    verify_and_claim "$TMP_FILE" "OSS加速"
                fi
            else
                check_winner || echo "   [OSS加速] ✗ 服务器下载失败"
            fi
        else
            check_winner || echo "   [OSS加速] ✗ 上传失败"
        fi
    }

    # === Fallback 方法4: Cloudflare R2 ===
    upload_r2() {
        [ "$HAS_R2" != "true" ] && return 1
        check_winner && return 0

        local TMP_FILE="${JAR_NAME}.r2"
        echo "   [R2] 上传到 Cloudflare R2..."

        export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
        export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

        local R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        local R2_PATH="s3://${R2_BUCKET}/deploy/${JAR_NAME}"

        if aws s3 cp "$JAR_PATH" "$R2_PATH" --endpoint-url "$R2_ENDPOINT" 2>/dev/null; then
            check_winner && return 0
            echo "   [R2] ✓ 上传成功，服务器下载..."

            local R2_URL="${R2_PUBLIC_URL}/deploy/${JAR_NAME}"

            if ssh -o ConnectTimeout=5 $SERVER "
                cd $REMOTE_TMP && \
                curl -sL --connect-timeout 10 --max-time 300 -o $TMP_FILE '$R2_URL'
            " 2>/dev/null; then
                if ! check_winner; then
                    verify_and_claim "$TMP_FILE" "R2"
                fi
            else
                check_winner || echo "   [R2] ✗ 服务器下载失败"
            fi
        else
            check_winner || echo "   [R2] ✗ 上传失败"
        fi
    }

    # 记录开始时间
    UPLOAD_START_TIME=$(date +%s)

    # 存储所有后台进程的 PID
    UPLOAD_PIDS=()

    # ===== 阶段1: GitHub 并行竞争 (直连 + 5镜像) =====
    if [ "$HAS_GH" = "true" ]; then
        echo "   [阶段1] GitHub 并行上传 (直连 + ${#GITHUB_MIRRORS[@]}镜像)..."

        # 先创建 Release
        echo "   创建 GitHub Release..."
        gh release delete "$VERSION" --repo "$REPO" -y 2>/dev/null || true
        if gh release create "$VERSION" "$JAR_PATH" \
            --repo "$REPO" \
            --title "Release $VERSION" \
            --notes "Auto release $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null; then
            echo "   ✓ Release 创建成功"

            # GitHub 直连下载
            (
                sleep 1  # 等待 Release 生效
                [ -f "$UPLOAD_STATUS_DIR/winner" ] && exit 0
                local URL="https://github.com/$REPO/releases/download/$VERSION/$JAR_NAME"
                local TMP_FILE="${JAR_NAME}.github_direct"
                echo "   [GitHub直连] 开始下载..."
                if ssh -o ConnectTimeout=5 $SERVER "
                    cd $REMOTE_TMP && \
                    curl -sL --connect-timeout 15 --max-time 300 -o $TMP_FILE '$URL'
                " 2>/dev/null; then
                    if [ ! -f "$UPLOAD_STATUS_DIR/winner" ]; then
                        verify_and_claim "$TMP_FILE" "GitHub直连"
                    fi
                fi
            ) &
            UPLOAD_PIDS+=($!)

            # 所有镜像并行
            for mirror in "${GITHUB_MIRRORS[@]}"; do
                (
                    sleep 1
                    [ -f "$UPLOAD_STATUS_DIR/winner" ] && exit 0
                    local URL="https://${mirror}/https://github.com/$REPO/releases/download/$VERSION/$JAR_NAME"
                    local SAFE_MIRROR=$(echo "$mirror" | tr '.' '_')
                    local TMP_FILE="${JAR_NAME}.gh_${SAFE_MIRROR}"
                    if ssh -o ConnectTimeout=5 $SERVER "
                        cd $REMOTE_TMP && \
                        curl -sL --connect-timeout 10 --max-time 300 -o $TMP_FILE '$URL'
                    " 2>/dev/null; then
                        if [ ! -f "$UPLOAD_STATUS_DIR/winner" ]; then
                            verify_and_claim "$TMP_FILE" "GitHub/$mirror"
                        fi
                    fi
                ) &
                UPLOAD_PIDS+=($!)
            done
        else
            echo "   ✗ Release 创建失败，跳过 GitHub 方式"
        fi
    fi

    # 等待 GitHub 方式完成 (最多60秒)
    echo ""
    echo "   等待 GitHub 下载完成 (超时: 60秒)..."
    WINNER=""
    GITHUB_TIMEOUT=60
    ELAPSED=0

    while [ -z "$WINNER" ] && [ $ELAPSED -lt $GITHUB_TIMEOUT ]; do
        if [ -f "$UPLOAD_STATUS_DIR/winner" ]; then
            WINNER=$(cat "$UPLOAD_STATUS_DIR/winner")
            break
        fi
        sleep 2
        ELAPSED=$((ELAPSED + 2))

        if [ $((ELAPSED % 20)) -eq 0 ]; then
            echo "   ... 已等待 ${ELAPSED}s"
        fi
    done

    # ===== 阶段2: Fallback (GitHub 超时或失败) =====
    if [ -z "$WINNER" ]; then
        echo ""
        echo "   [阶段2] GitHub 超时，启动 Fallback 方式..."

        # 终止 GitHub 相关进程
        for pid in "${UPLOAD_PIDS[@]}"; do
            kill -9 "$pid" 2>/dev/null || true
            pkill -9 -P "$pid" 2>/dev/null || true
        done
        UPLOAD_PIDS=()

        # 杀掉服务器上残留的 GitHub 下载 curl 进程
        ssh -o ConnectTimeout=5 $SERVER "pkill -f 'curl.*$JAR_NAME' 2>/dev/null; true" 2>/dev/null || true

        # 启动 Fallback 方式
        upload_scp &
        UPLOAD_PIDS+=($!)

        upload_scp_gzip &
        UPLOAD_PIDS+=($!)

        [ "$HAS_OSS" = "true" ] && { upload_oss_accelerate & UPLOAD_PIDS+=($!); }
        [ "$HAS_R2" = "true" ] && { upload_r2 & UPLOAD_PIDS+=($!); }

        # 等待 Fallback 完成 (最多5分钟)
        echo "   等待 Fallback 完成 (超时: 5分钟)..."
        FALLBACK_TIMEOUT=300
        ELAPSED=0

        while [ -z "$WINNER" ] && [ $ELAPSED -lt $FALLBACK_TIMEOUT ]; do
            if [ -f "$UPLOAD_STATUS_DIR/winner" ]; then
                WINNER=$(cat "$UPLOAD_STATUS_DIR/winner")
                break
            fi
            sleep 2
            ELAPSED=$((ELAPSED + 2))

            if [ $((ELAPSED % 30)) -eq 0 ]; then
                echo "   ... Fallback 已等待 ${ELAPSED}s"
            fi
        done
    fi

    # 计算上传耗时
    UPLOAD_END_TIME=$(date +%s)
    UPLOAD_DURATION=$((UPLOAD_END_TIME - UPLOAD_START_TIME))

    # 强制终止所有后台进程及其子进程
    echo "   终止其他上传任务..."

    # 方法1: 终止记录的 PID 及其所有子进程
    for pid in "${UPLOAD_PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            # 获取该进程的所有子进程并终止
            pkill -9 -P "$pid" 2>/dev/null || true
            kill -9 "$pid" 2>/dev/null || true
        fi
    done

    # 方法2: 终止可能残留的 ossutil/aws 进程
    pkill -9 -f "ossutil.*$JAR_NAME" 2>/dev/null || true
    pkill -9 -f "aws.*$JAR_NAME" 2>/dev/null || true
    pkill -9 -f "aws s3 cp.*cretas" 2>/dev/null || true

    # 方法3: 终止当前脚本的所有后台任务
    jobs -p 2>/dev/null | xargs -r kill -9 2>/dev/null || true

    # 方法4: 杀掉服务器上残留的 curl/wget (防止 orphan 覆盖 winner 文件)
    ssh -o ConnectTimeout=5 $SERVER "pkill -f 'curl.*$JAR_NAME' 2>/dev/null; true" 2>/dev/null || true

    sleep 1
    wait 2>/dev/null || true

    # 清理服务器上的临时文件 (保留 winner 的 $JAR_NAME)
    ssh -o ConnectTimeout=5 $SERVER "rm -f $REMOTE_TMP/${JAR_NAME}.scp $REMOTE_TMP/${JAR_NAME}.scp_gzip $REMOTE_TMP/${JAR_NAME}.scp_gzip.gz $REMOTE_TMP/${JAR_NAME}.oss $REMOTE_TMP/${JAR_NAME}.r2 $REMOTE_TMP/${JAR_NAME}.github_direct $REMOTE_TMP/${JAR_NAME}.gh_* 2>/dev/null; true" 2>/dev/null || true

    if [ -z "$WINNER" ]; then
        echo ""
        echo "❌ 所有上传方式都失败或超时"
        exit 1
    fi

    # 计算速度 (兼容不同系统)
    if command -v bc &> /dev/null && [ -n "$JAR_SIZE_BYTES" ] && [ "$UPLOAD_DURATION" -gt 0 ]; then
        SPEED_MBPS=$(echo "scale=2; $JAR_SIZE_BYTES / 1024 / 1024 / $UPLOAD_DURATION" | bc 2>/dev/null)
    else
        # Fallback: 使用 awk 计算
        SPEED_MBPS=$(awk "BEGIN {printf \"%.2f\", $JAR_SIZE_BYTES / 1024 / 1024 / $UPLOAD_DURATION}" 2>/dev/null || echo "N/A")
    fi

    echo ""
    echo "   🏆 胜出: $WINNER"
    echo "   ⏱️  耗时: ${UPLOAD_DURATION}s"
    echo "   📊 速度: ${SPEED_MBPS} MB/s (${JAR_SIZE} 文件)"

    # ----- 3. 服务器部署 -----
    echo ""
    echo "🚀 [3/4] 服务器部署..."
    # MD5 验证 + 部署 JAR (不含重启)
    DEPLOY_OK=false
    if ssh $SERVER "
        cd $REMOTE_JAR_DIR

        # 备份当前 JAR
        if [ -f aims-0.0.1-SNAPSHOT.jar ]; then
            BACKUP_NAME=\"aims-0.0.1-SNAPSHOT.jar.bak.\$(date +%Y%m%d_%H%M%S)\"
            cp aims-0.0.1-SNAPSHOT.jar \"\$BACKUP_NAME\"
            echo \"   备份: \$BACKUP_NAME\"
            ls -t aims-0.0.1-SNAPSHOT.jar.bak.* 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
        fi

        # 最终 MD5 验证 (部署前)
        REMOTE_MD5=\$(md5sum $REMOTE_TMP/$JAR_NAME | cut -d' ' -f1)
        echo \"   MD5 验证: \$REMOTE_MD5 (预期: $LOCAL_MD5)\"
        if [ \"\$REMOTE_MD5\" != \"$LOCAL_MD5\" ]; then
            echo '   ❌ JAR 文件 MD5 不匹配，中止部署!'
            exit 1
        fi

        # 部署 JAR
        mv $REMOTE_TMP/$JAR_NAME aims-0.0.1-SNAPSHOT.jar

        # 验证部署后文件完整性
        DEPLOYED_MD5=\$(md5sum aims-0.0.1-SNAPSHOT.jar | cut -d' ' -f1)
        if [ \"\$DEPLOYED_MD5\" != \"$LOCAL_MD5\" ]; then
            echo '   ❌ 部署后 checksum 不匹配! 恢复备份...'
            if [ -n \"\$BACKUP_NAME\" ] && [ -f \"\$BACKUP_NAME\" ]; then
                cp \"\$BACKUP_NAME\" aims-0.0.1-SNAPSHOT.jar
                echo '   ✓ 已恢复备份'
            fi
            exit 1
        fi
        echo '   ✓ MD5 验证通过'
    "; then
        DEPLOY_OK=true
    fi

    if [ "$DEPLOY_OK" != "true" ]; then
        echo "   ❌ 部署失败 (MD5 不匹配或文件损坏)"
        exit 1
    fi

    # 清理 .jar.new (防止 restart.sh 的 auto-swap 覆盖刚部署的 JAR)
    ssh -o ConnectTimeout=5 $SERVER "rm -f $REMOTE_JAR_DIR/aims-0.0.1-SNAPSHOT.jar.new 2>/dev/null" 2>/dev/null || true

    # 重启服务 (单独 SSH，restart.sh 的 nohup 不会被 SSH 断开影响)
    echo "   重启服务..."
    ssh $SERVER "cd $REMOTE_JAR_DIR && bash restart.sh" || true

    # 清理残留临时文件
    ssh -o ConnectTimeout=5 $SERVER "rm -f $REMOTE_TMP/${JAR_NAME}.* $REMOTE_TMP/aims-new.jar $REMOTE_TMP/deploy.jar.gz 2>/dev/null" 2>/dev/null || true

    # ----- 4. 验证部署 -----
    echo ""
    echo "🔍 [4/4] 验证部署 (最多等待60秒)..."
    HEALTH_OK=false
    for i in {1..30}; do
        HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:10010/api/mobile/health 2>/dev/null || echo "000")
        if [ "$HEALTH_CHECK" = "200" ]; then
            echo "   ✓ 服务正常 (HTTP 200, 等待 $((i*2))s)"
            HEALTH_OK=true
            break
        fi
        if [ $((i % 5)) -eq 0 ]; then
            echo "   ... 等待服务启动 ($((i*2))/60s, HTTP $HEALTH_CHECK)"
        fi
        sleep 2
    done

    if [ "$HEALTH_OK" != "true" ]; then
        echo "   ⚠ 健康检查超时 (60s)，最后状态: HTTP $HEALTH_CHECK"
        echo "   请手动检查: ssh $SERVER 'tail -50 $REMOTE_JAR_DIR/cretas-backend.log'"
    fi

    echo ""
    echo "=========================================="
    echo "  ✅ 部署完成!"
    echo "  版本: $VERSION"
    echo "  方式: $WINNER"
    echo "  MD5: $LOCAL_MD5"
    echo "  上传耗时: ${UPLOAD_DURATION}s (${SPEED_MBPS} MB/s)"
    [ "$HAS_GH" = "true" ] && echo "  Release: https://github.com/$REPO/releases/tag/$VERSION"
    echo "=========================================="
}

# ==================== 执行 ====================
if [ "$MODE" = "jar" ]; then
    deploy_jar "$ARG"
else
    deploy_git "$ARG"
fi
