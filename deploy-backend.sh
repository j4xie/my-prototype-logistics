#!/bin/bash
# 后端部署脚本 v3.0
# 支持多种并行上传方式，取最快的
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
SERVER="root@139.196.165.140"
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

# Cloudflare R2 配置
R2_BUCKET="cretas"
R2_ACCOUNT_ID="7ff7cc2e7bc3af46147d5c7df18062db"
R2_ACCESS_KEY_ID="2758f2523b0e67a71fae616d2d2fb14b"
R2_SECRET_ACCESS_KEY="f03d3f5ff3c1880c13fc825e4e436dd835a66a8a06028f12088822440b0b0019"
R2_PUBLIC_URL="https://pub-70da4e6da1f3446d9e055f2793d05837.r2.dev"

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
    echo "  JAR 部署 v3.0 - 版本: $VERSION"
    echo "  可用方式: ${METHODS[*]}"
    echo "=========================================="

    # ----- 1. 本地 Maven 打包 -----
    echo ""
    echo "📦 [1/4] 本地 Maven 打包..."
    cd backend/java/cretas-api
    mvn clean package -Dmaven.test.skip=true -q
    cd ../../..

    JAR_PATH="backend/java/cretas-api/target/$JAR_NAME"
    if [ ! -f "$JAR_PATH" ]; then
        echo "❌ JAR 文件不存在: $JAR_PATH"
        exit 1
    fi

    JAR_SIZE=$(du -h "$JAR_PATH" | cut -f1)
    JAR_SIZE_BYTES=$(stat -f%z "$JAR_PATH" 2>/dev/null || stat -c%s "$JAR_PATH" 2>/dev/null)
    echo "   ✓ 打包完成: $JAR_NAME ($JAR_SIZE)"

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

    # === Fallback 方法1: SCP 直接上传 ===
    upload_scp() {
        check_winner && return 0
        echo "   [SCP] 开始上传..."
        if scp -o ConnectTimeout=10 -o ServerAliveInterval=10 "$JAR_PATH" "$SERVER:$REMOTE_TMP/$JAR_NAME" 2>/dev/null; then
            if ! check_winner; then
                echo "SCP" > "$UPLOAD_STATUS_DIR/winner"
                echo "   [SCP] ✓ 完成!"
            fi
        else
            check_winner || echo "   [SCP] ✗ 失败"
        fi
    }

    # === Fallback 方法2: SCP + gzip 压缩传输 ===
    upload_scp_gzip() {
        check_winner && return 0
        echo "   [SCP+gzip] 开始压缩上传..."
        if scp -o ConnectTimeout=10 -o ServerAliveInterval=10 "/tmp/${JAR_NAME}.gz" "$SERVER:$REMOTE_TMP/${JAR_NAME}.gz" 2>/dev/null; then
            check_winner && return 0
            if ssh $SERVER "cd $REMOTE_TMP && gunzip -f ${JAR_NAME}.gz" 2>/dev/null; then
                if ! check_winner; then
                    echo "SCP+gzip" > "$UPLOAD_STATUS_DIR/winner"
                    echo "   [SCP+gzip] ✓ 完成!"
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

        echo "   [OSS加速] 使用全球加速上传..."
        local OSS_PATH="oss://${OSS_BUCKET}/${OSS_DEPLOY_PATH}${JAR_NAME}"

        if $OSSUTIL_CMD cp "$JAR_PATH" "$OSS_PATH" -f -e "$OSS_ACCELERATE_ENDPOINT" 2>/dev/null; then
            check_winner && return 0
            echo "   [OSS加速] ✓ 上传成功，服务器内网下载..."

            local INTERNAL_URL="https://${OSS_BUCKET}.${OSS_INTERNAL_ENDPOINT}/${OSS_DEPLOY_PATH}${JAR_NAME}"

            if ssh -o ConnectTimeout=5 $SERVER "
                cd $REMOTE_TMP && \
                curl -sL --connect-timeout 10 --max-time 60 -o $JAR_NAME '$INTERNAL_URL' && \
                [ -s $JAR_NAME ]
            " 2>/dev/null; then
                if ! check_winner; then
                    echo "OSS加速" > "$UPLOAD_STATUS_DIR/winner"
                    echo "   [OSS加速] ✓ 完成!"
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
                curl -sL --connect-timeout 10 --max-time 120 -o $JAR_NAME '$R2_URL' && \
                [ -s $JAR_NAME ]
            " 2>/dev/null; then
                if ! check_winner; then
                    echo "R2" > "$UPLOAD_STATUS_DIR/winner"
                    echo "   [R2] ✓ 完成!"
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
                echo "   [GitHub直连] 开始下载..."
                if ssh -o ConnectTimeout=5 $SERVER "
                    cd $REMOTE_TMP && \
                    curl -sL --connect-timeout 15 --max-time 300 -o $JAR_NAME '$URL' && \
                    [ -s $JAR_NAME ]
                " 2>/dev/null; then
                    if [ ! -f "$UPLOAD_STATUS_DIR/winner" ]; then
                        echo "GitHub直连" > "$UPLOAD_STATUS_DIR/winner"
                        echo "   [GitHub直连] ✓ 完成!"
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
                    if ssh -o ConnectTimeout=5 $SERVER "
                        cd $REMOTE_TMP && \
                        curl -sL --connect-timeout 10 --max-time 300 -o $JAR_NAME '$URL' && \
                        [ -s $JAR_NAME ]
                    " 2>/dev/null; then
                        if [ ! -f "$UPLOAD_STATUS_DIR/winner" ]; then
                            echo "GitHub/$mirror" > "$UPLOAD_STATUS_DIR/winner"
                            echo "   [GitHub/$mirror] ✓ 完成!"
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

    sleep 1
    wait 2>/dev/null || true

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
    ssh $SERVER "
        cd $REMOTE_JAR_DIR

        if [ -f aims-0.0.1-SNAPSHOT.jar ]; then
            BACKUP_NAME=\"aims-0.0.1-SNAPSHOT.jar.bak.\$(date +%Y%m%d_%H%M%S)\"
            cp aims-0.0.1-SNAPSHOT.jar \"\$BACKUP_NAME\"
            echo \"   备份: \$BACKUP_NAME\"
            ls -t aims-0.0.1-SNAPSHOT.jar.bak.* 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
        fi

        mv $REMOTE_TMP/$JAR_NAME aims-0.0.1-SNAPSHOT.jar
        # 同步到 restart.sh 使用的 JAR 名称
        cp aims-0.0.1-SNAPSHOT.jar cretas-backend-system-1.0.0.jar
        echo '   重启服务...'
        bash restart.sh
    "

    # ----- 4. 验证部署 -----
    echo ""
    echo "🔍 [4/4] 验证部署..."
    sleep 8

    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://139.196.165.140:10010/api/mobile/health 2>/dev/null || echo "000")

    if [ "$HEALTH_CHECK" = "200" ]; then
        echo "   ✓ 服务正常 (HTTP 200)"
    else
        echo "   ⚠ 健康检查: $HEALTH_CHECK (可能需要更多启动时间)"
    fi

    echo ""
    echo "=========================================="
    echo "  ✅ 部署完成!"
    echo "  版本: $VERSION"
    echo "  方式: $WINNER"
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
