#!/usr/bin/env bash
# =============================================================================
# train_and_deploy.sh
# 一键完成：训练 BERT 意图分类器 → 上传服务器 → 激活
#
# 使用方式:
#   bash train_and_deploy.sh             # 完整训练后部署
#   bash train_and_deploy.sh --incremental  # 增量微调后部署（已有模型时推荐）
#   bash train_and_deploy.sh --deploy-only  # 仅部署（模型已训练完毕）
#
# 前提:
#   - Python 环境已安装: pip install torch transformers scikit-learn accelerate
#   - 服务器 SSH 免密登录: ssh root@139.196.165.140
#   - 服务器 Python 服务路径: /www/wwwroot/python-services/
# =============================================================================

set -euo pipefail

# ── 配置 ────────────────────────────────────────────────────────────────────
SERVER="root@139.196.165.140"
SERVER_MODEL_DIR="/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier"
SERVER_PYTHON_SERVICE="/www/wwwroot/cretas"   # 重启 cretas 服务使 classifier 生效

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_LOCAL="$SCRIPT_DIR/models/chinese-roberta-wwm-ext-classifier/final"
MODEL_INCREMENTAL="$SCRIPT_DIR/models/incremental/final"
DATA_DIR="$SCRIPT_DIR/data"

MODE="full"   # 默认完整训练
if [[ "${1:-}" == "--incremental" ]]; then MODE="incremental"; fi
if [[ "${1:-}" == "--deploy-only" ]]; then MODE="deploy"; fi

# ── 颜色输出 ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERR]${NC}   $*" >&2; exit 1; }

# ── 检查依赖 ─────────────────────────────────────────────────────────────────
check_deps() {
    info "检查 Python 依赖..."
    python3 -c "import torch, transformers, sklearn" 2>/dev/null \
        || error "缺少依赖！请先运行: pip install torch transformers scikit-learn accelerate"
    info "  torch=$(python3 -c 'import torch; print(torch.__version__)')"
    info "  transformers=$(python3 -c 'import transformers; print(transformers.__version__)')"
    GPU=$(python3 -c 'import torch; print("cuda" if torch.cuda.is_available() else "cpu")')
    info "  设备: $GPU"
}

# ── 步骤1：训练 ──────────────────────────────────────────────────────────────
train_full() {
    info "=== 步骤1: 完整微调 (merged_training_data.jsonl, 19690 samples) ==="
    cd "$SCRIPT_DIR"
    python3 finetune_full.py
    [[ -f "$MODEL_LOCAL/pytorch_model.bin" ]] \
        || error "训练失败：模型文件不存在 $MODEL_LOCAL/pytorch_model.bin"
    info "完整微调完成: $MODEL_LOCAL"
}

train_incremental() {
    info "=== 步骤1: 增量微调 (incremental_training_data.jsonl, 795 samples) ==="
    [[ -f "$MODEL_LOCAL/pytorch_model.bin" ]] \
        || error "增量微调需要已有模型！先运行完整训练: bash train_and_deploy.sh"
    cd "$SCRIPT_DIR"
    python3 incremental_finetune.py \
        --new-data  "$DATA_DIR/incremental_training_data.jsonl" \
        --old-data  "$DATA_DIR/merged_training_data.jsonl" \
        --model-path "$MODEL_LOCAL" \
        --output-path "$SCRIPT_DIR/models/incremental" \
        --epochs 3 \
        --batch-size 16 \
        --lr 5e-6 \
        --replay-ratio 0.5 \
        --freeze-layers 8
    [[ -f "$MODEL_INCREMENTAL/pytorch_model.bin" ]] \
        || error "增量微调失败"
    # 用增量模型覆盖 final
    cp -r "$MODEL_INCREMENTAL/." "$MODEL_LOCAL/"
    info "增量微调完成，模型已合并到: $MODEL_LOCAL"
}

# ── 步骤2：上传模型到服务器 ──────────────────────────────────────────────────
deploy_model() {
    info "=== 步骤2: 上传模型到服务器 ==="
    info "  目标: $SERVER:$SERVER_MODEL_DIR/final/"

    # 创建服务器目录
    ssh "$SERVER" "mkdir -p $SERVER_MODEL_DIR/final"

    # 上传模型文件（排除大型 checkpoint 目录）
    rsync -avz --progress \
        --exclude="*.bin.old" \
        "$MODEL_LOCAL/" \
        "$SERVER:$SERVER_MODEL_DIR/final/"

    info "上传完成"
}

# ── 步骤3：服务器端激活分类器 ────────────────────────────────────────────────
activate_classifier() {
    info "=== 步骤3: 服务器端激活分类器 ==="

    ssh "$SERVER" bash << 'REMOTE'
set -e

PYTHON_SVC="/www/wwwroot/python-services"
MODEL_DIR="$PYTHON_SVC/models/chinese-roberta-wwm-ext-classifier/final"

# 验证模型文件
echo "[服务器] 验证模型文件..."
ls -lh "$MODEL_DIR/pytorch_model.bin" || { echo "模型文件不存在！"; exit 1; }
ls -lh "$MODEL_DIR/config.json"
ls -lh "$MODEL_DIR/label_mapping.json"

# 确认 Python 依赖
echo "[服务器] 检查依赖..."
python3 -c "import torch, transformers, sklearn" \
    || { echo "安装依赖..."; pip3 install torch transformers scikit-learn accelerate --quiet; }

# 测试模型可加载
echo "[服务器] 测试模型加载..."
python3 - << 'PY'
import json, torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

model_dir = "/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/final"
tokenizer = AutoTokenizer.from_pretrained(model_dir)
model = AutoModelForSequenceClassification.from_pretrained(model_dir)
model.eval()

with open(f"{model_dir}/label_mapping.json") as f:
    lm = json.load(f)
id_to_label = {int(v): k for k, v in lm["label_to_id"].items()}

# 快速推理测试
inputs = tokenizer("查看订单列表", return_tensors="pt", max_length=64, truncation=True)
with torch.no_grad():
    logits = model(**inputs).logits
pred_id = logits.argmax(-1).item()
print(f"[OK] 测试推理: '查看订单列表' → {id_to_label[pred_id]} (conf={torch.softmax(logits,-1).max().item():.3f})")
PY

echo "[服务器] 模型验证通过"
REMOTE

    info "服务器模型验证通过"
}

# ── 步骤4：更新 Java 后端配置并重启 ─────────────────────────────────────────
restart_java_backend() {
    info "=== 步骤4: 提示更新 Java 配置 ==="
    cat << 'MSG'

  ┌─────────────────────────────────────────────────────────────────┐
  │  需要在 Java 后端 application.yml 中开启分类器：               │
  │                                                                 │
  │  cretas:                                                        │
  │    ai:                                                          │
  │      intent:                                                    │
  │        python-classifier:                                      │
  │          enabled: true                                          │
  │          url: http://localhost:8083/api/classifier/classify     │
  │          high-confidence-threshold: 0.85                        │
  │          timeout-ms: 500                                        │
  │                                                                 │
  │  然后重启 Java 服务:                                            │
  │    cd /www/wwwroot/cretas && bash restart.sh                   │
  └─────────────────────────────────────────────────────────────────┘

MSG
}

# ── 步骤5：端到端验证 ────────────────────────────────────────────────────────
run_e2e_check() {
    info "=== 步骤5: 端到端验证 ==="
    ssh "$SERVER" bash << 'REMOTE'
# 等待 Python 服务就绪
echo "检查 Python 分类器服务..."
for i in {1..10}; do
    STATUS=$(curl -s http://localhost:8083/api/classifier/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "unreachable")
    if [[ "$STATUS" == "healthy" ]]; then
        echo "[OK] Python 分类器服务正常: status=$STATUS"
        break
    fi
    echo "  等待服务启动... ($i/10)"
    sleep 3
done

# 快速意图测试
echo "测试几个意图..."
TESTS=(
    '{"text":"查看订单列表","top_k":1}'
    '{"text":"帮我打卡","top_k":1}'
    '{"text":"删除用户","top_k":1}'
    '{"text":"今天入库了多少鸡肉","top_k":1}'
    '{"text":"帮我找找订单","top_k":1}'
)
for body in "${TESTS[@]}"; do
    RESULT=$(curl -s -X POST http://localhost:8083/api/classifier/classify \
        -H "Content-Type: application/json" \
        -d "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    top=d['predictions'][0]
    print(f\"{top['intent']} ({top['confidence']:.3f})\")
else:
    print('ERROR: '+str(d.get('error','')))
" 2>/dev/null || echo "请求失败")
    TEXT=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['text'])")
    echo "  '$TEXT' → $RESULT"
done
REMOTE
}

# ── 主流程 ───────────────────────────────────────────────────────────────────
main() {
    echo ""
    info "=========================================="
    info " BERT 意图分类器 训练 & 部署脚本"
    info " 模式: $MODE"
    info "=========================================="
    echo ""

    check_deps

    case "$MODE" in
        full)
            train_full
            deploy_model
            activate_classifier
            restart_java_backend
            run_e2e_check
            ;;
        incremental)
            train_incremental
            deploy_model
            activate_classifier
            restart_java_backend
            run_e2e_check
            ;;
        deploy)
            deploy_model
            activate_classifier
            restart_java_backend
            run_e2e_check
            ;;
    esac

    echo ""
    info "=========================================="
    info " 全部完成！"
    info " 本地模型: $MODEL_LOCAL"
    info " 服务器:   $SERVER:$SERVER_MODEL_DIR/final/"
    info "=========================================="
    echo ""
}

main "$@"
