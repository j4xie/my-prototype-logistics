#!/bin/bash
# Python Services 部署脚本 (SmartBI + 其他模块)
# 部署到阿里云服务器
#
# 用法:
#   ./deploy-smartbi-python.sh              # 部署代码，重启生产 Python (8083)
#   ./deploy-smartbi-python.sh --env test   # 部署代码，重启测试 Python (8084)
#   ./deploy-smartbi-python.sh --env all    # 部署代码，重启两套 Python

set -e

# 加载共享函数库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/scripts/lib/deploy-common.sh" ]; then
    source "$SCRIPT_DIR/scripts/lib/deploy-common.sh"
else
    echo "警告: 未找到 scripts/lib/deploy-common.sh，使用内联函数"
    log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] [$1] ${*:2}"; }
fi

# 配置
SERVER="root@47.100.235.168"
REMOTE_DIR="/www/wwwroot/cretas/code/backend/python"
REMOTE_CRETAS_DIR="/www/wwwroot/cretas"
LOCAL_DIR="backend/python"
SERVER_IP="${SERVER#*@}"

# 参数解析
DEPLOY_ENV="prod"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --env)
            DEPLOY_ENV="$2"
            if [[ ! "$DEPLOY_ENV" =~ ^(prod|test|all)$ ]]; then
                echo "错误: --env 参数必须是 prod, test, 或 all"
                exit 1
            fi
            shift 2
            ;;
        -h|--help)
            echo "用法: ./deploy-smartbi-python.sh [选项]"
            echo ""
            echo "选项:"
            echo "  --env ENV   部署环境: prod (默认), test, all"
            echo "  -h, --help  显示帮助"
            echo ""
            echo "环境说明:"
            echo "  prod   重启生产 Python (端口 8083, 数据库 smartbi_prod_db)"
            echo "  test   重启测试 Python (端口 8084, 数据库 smartbi_db)"
            echo "  all    重启两套 Python 服务"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

echo "=========================================="
echo "Python Services 部署 (SmartBI + Modules)"
echo "部署环境: $DEPLOY_ENV"
echo "=========================================="

# 1. 检查本地文件
log "INFO" "[1/5] 检查本地文件..."
if [ ! -d "$LOCAL_DIR" ]; then
    log "ERROR" "找不到 $LOCAL_DIR 目录"
    exit 1
fi

# 2. 创建远程目录
log "INFO" "[2/5] 创建远程目录..."
ssh $SERVER "mkdir -p $REMOTE_DIR"

# 3. 同步文件到服务器
log "INFO" "[3/5] 同步文件到服务器 (rsync 增量传输)..."
rsync -az --timeout=120 \
    --exclude='__pycache__' --exclude='*.pyc' --exclude='.env' \
    --exclude='smartbi.log' --exclude='*.xlsx' --exclude='*.png' \
    --exclude='venv*' --exclude='python-services.log' \
    --exclude='python-prod.log' --exclude='python-test.log' \
    $LOCAL_DIR/ $SERVER:$REMOTE_DIR/

# 4. 在服务器上安装依赖
log "INFO" "[4/5] 安装依赖..."
ssh $SERVER << ENDSSH
cd $REMOTE_DIR

# 使用 Python 3.8
PYTHON_BIN="python3.8"
if ! command -v \$PYTHON_BIN &> /dev/null; then
    echo "Python 3.8 不可用，尝试 python3..."
    PYTHON_BIN="python3"
fi
echo "使用 Python: \$PYTHON_BIN"
\$PYTHON_BIN --version

# 创建虚拟环境 (使用 Python 3.8)
if [ ! -d "venv38" ]; then
    echo "创建虚拟环境 (Python 3.8)..."
    \$PYTHON_BIN -m venv venv38
fi

# 激活虚拟环境并安装依赖
source venv38/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 创建 .env 文件 (如果不存在)
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || true
    echo "已创建 .env 文件，请配置 LLM API Key"
fi
ENDSSH

# 重启对应环境的 Python 服务 (通过 restart 脚本，保证环境变量一致)
log "INFO" "[4.5/5] 重启 Python 服务 (环境: $DEPLOY_ENV)..."

restart_prod_python() {
    ssh $SERVER "cd $REMOTE_CRETAS_DIR && bash restart-prod.sh" 2>&1 | grep -i python || true
}

restart_test_python() {
    ssh $SERVER "cd $REMOTE_CRETAS_DIR && bash restart-test.sh" 2>&1 | grep -i python || true
}

case "$DEPLOY_ENV" in
    prod)
        # 只重启生产 Python (restart-prod.sh 会同时重启 Java，但这没关系)
        # 更精准: 只杀 Python，通过 restart-prod.sh 里的逻辑
        ssh $SERVER "
            PID_PY=\$(lsof -ti :8083 2>/dev/null)
            if [ -n \"\$PID_PY\" ]; then kill \$PID_PY 2>/dev/null; sleep 2; fi
            cd $REMOTE_CRETAS_DIR/code/backend/python
            POSTGRES_DB=smartbi_prod_db \
            POSTGRES_PASSWORD=smartbi_secure_password_2025 \
            POSTGRES_ENABLED=true \
            POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=smartbi_user \
            FOOD_KB_POSTGRES_DB=cretas_prod_db \
            FOOD_KB_POSTGRES_PASSWORD=cretas123 \
            FOOD_KB_POSTGRES_USER=cretas_user \
            FOOD_KB_POSTGRES_HOST=localhost FOOD_KB_POSTGRES_PORT=5432 \
            LLM_API_KEY=sk-da3b827e6a00404a8bc869296f8690bc \
            LLM_MODEL=qwen3.5-plus LLM_FAST_MODEL=qwen3.5-flash \
            LLM_REASONING_MODEL=qwen3.5-flash LLM_VL_MODEL=qwen3.5-plus \
            nohup $REMOTE_CRETAS_DIR/code/backend/python/venv38/bin/python \
                -m uvicorn main:app --host 0.0.0.0 --port 8083 \
                > $REMOTE_CRETAS_DIR/python-prod.log 2>&1 &
            echo 'Production Python restarted'
        "
        ;;
    test)
        ssh $SERVER "
            PID_PY=\$(lsof -ti :8084 2>/dev/null)
            if [ -n \"\$PID_PY\" ]; then kill \$PID_PY 2>/dev/null; sleep 2; fi
            cd $REMOTE_CRETAS_DIR/code/backend/python
            POSTGRES_DB=smartbi_db \
            POSTGRES_PASSWORD=smartbi_secure_password_2025 \
            POSTGRES_ENABLED=true \
            POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=smartbi_user \
            FOOD_KB_POSTGRES_DB=cretas_db \
            FOOD_KB_POSTGRES_PASSWORD=cretas123 \
            FOOD_KB_POSTGRES_USER=cretas_user \
            FOOD_KB_POSTGRES_HOST=localhost FOOD_KB_POSTGRES_PORT=5432 \
            LLM_API_KEY=sk-da3b827e6a00404a8bc869296f8690bc \
            LLM_MODEL=qwen3.5-plus LLM_FAST_MODEL=qwen3.5-flash \
            LLM_REASONING_MODEL=qwen3.5-flash LLM_VL_MODEL=qwen3.5-plus \
            nohup $REMOTE_CRETAS_DIR/code/backend/python/venv38/bin/python \
                -m uvicorn main:app --host 0.0.0.0 --port 8084 \
                > $REMOTE_CRETAS_DIR/python-test.log 2>&1 &
            echo 'Test Python restarted'
        "
        ;;
    all)
        ssh $SERVER "
            # Production Python
            PID_PY=\$(lsof -ti :8083 2>/dev/null)
            if [ -n \"\$PID_PY\" ]; then kill \$PID_PY 2>/dev/null; sleep 2; fi
            cd $REMOTE_CRETAS_DIR/code/backend/python
            POSTGRES_DB=smartbi_prod_db \
            POSTGRES_PASSWORD=smartbi_secure_password_2025 \
            POSTGRES_ENABLED=true \
            POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=smartbi_user \
            FOOD_KB_POSTGRES_DB=cretas_prod_db \
            FOOD_KB_POSTGRES_PASSWORD=cretas123 \
            FOOD_KB_POSTGRES_USER=cretas_user \
            FOOD_KB_POSTGRES_HOST=localhost FOOD_KB_POSTGRES_PORT=5432 \
            LLM_API_KEY=sk-da3b827e6a00404a8bc869296f8690bc \
            LLM_MODEL=qwen3.5-plus LLM_FAST_MODEL=qwen3.5-flash \
            LLM_REASONING_MODEL=qwen3.5-flash LLM_VL_MODEL=qwen3.5-plus \
            nohup $REMOTE_CRETAS_DIR/code/backend/python/venv38/bin/python \
                -m uvicorn main:app --host 0.0.0.0 --port 8083 \
                > $REMOTE_CRETAS_DIR/python-prod.log 2>&1 &
            echo 'Production Python restarted'

            # Test Python
            PID_PY=\$(lsof -ti :8084 2>/dev/null)
            if [ -n \"\$PID_PY\" ]; then kill \$PID_PY 2>/dev/null; sleep 2; fi
            POSTGRES_DB=smartbi_db \
            POSTGRES_PASSWORD=smartbi_secure_password_2025 \
            POSTGRES_ENABLED=true \
            POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=smartbi_user \
            FOOD_KB_POSTGRES_DB=cretas_db \
            FOOD_KB_POSTGRES_PASSWORD=cretas123 \
            FOOD_KB_POSTGRES_USER=cretas_user \
            FOOD_KB_POSTGRES_HOST=localhost FOOD_KB_POSTGRES_PORT=5432 \
            LLM_API_KEY=sk-da3b827e6a00404a8bc869296f8690bc \
            LLM_MODEL=qwen3.5-plus LLM_FAST_MODEL=qwen3.5-flash \
            LLM_REASONING_MODEL=qwen3.5-flash LLM_VL_MODEL=qwen3.5-plus \
            nohup $REMOTE_CRETAS_DIR/code/backend/python/venv38/bin/python \
                -m uvicorn main:app --host 0.0.0.0 --port 8084 \
                > $REMOTE_CRETAS_DIR/python-test.log 2>&1 &
            echo 'Test Python restarted'
        "
        ;;
esac

# 5. 验证服务
log "INFO" "[5/5] 验证服务..."
sleep 3

if [[ "$DEPLOY_ENV" == "prod" || "$DEPLOY_ENV" == "all" ]]; then
    if wait_for_health "http://${SERVER_IP}:8083/health" 15 2; then
        log "INFO" "[生产] Python 服务 (8083) 部署成功"
    else
        log "WARN" "[生产] 健康检查超时，请检查: ssh $SERVER 'tail -50 $REMOTE_CRETAS_DIR/python-prod.log'"
    fi
fi

if [[ "$DEPLOY_ENV" == "test" || "$DEPLOY_ENV" == "all" ]]; then
    if wait_for_health "http://${SERVER_IP}:8084/health" 15 2; then
        log "INFO" "[测试] Python 服务 (8084) 部署成功"
    else
        log "WARN" "[测试] 健康检查超时，请检查: ssh $SERVER 'tail -50 $REMOTE_CRETAS_DIR/python-test.log'"
    fi
fi

echo ""
echo "=========================================="
echo "部署完成! (环境: $DEPLOY_ENV)"
if [[ "$DEPLOY_ENV" == "prod" || "$DEPLOY_ENV" == "all" ]]; then
    echo "生产: http://${SERVER_IP}:8083/health"
fi
if [[ "$DEPLOY_ENV" == "test" || "$DEPLOY_ENV" == "all" ]]; then
    echo "测试: http://${SERVER_IP}:8084/health"
fi
echo "=========================================="
