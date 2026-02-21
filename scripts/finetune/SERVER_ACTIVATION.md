# 服务器激活 BERT 分类器 — 操作手册

## 前置：训练模型（本地执行）

```bash
cd scripts/finetune

# 首次训练（约 10-30 分钟，取决于 GPU）
bash train_and_deploy.sh

# 或者只做增量微调（已有模型时，约 5 分钟）
bash train_and_deploy.sh --incremental
```

---

## 第一步：服务器安装 Python 依赖

```bash
ssh root@139.196.165.140

# CPU 模式（无 GPU）
pip3 install torch --index-url https://download.pytorch.org/whl/cpu
pip3 install transformers scikit-learn accelerate

# 或者 GPU 模式（CUDA 12.1）
pip3 install torch --index-url https://download.pytorch.org/whl/cu121
pip3 install transformers scikit-learn accelerate
```

---

## 第二步：验证 Python 分类器服务

```bash
# 检查健康状态
curl http://localhost:8083/api/classifier/health

# 期望返回：
# {"status":"healthy","model_loaded":true,"num_intents":157,...}

# 测试分类
curl -X POST http://localhost:8083/api/classifier/classify \
  -H "Content-Type: application/json" \
  -d '{"text":"查看订单列表","top_k":3}'
```

---

## 第三步：修改 Java 后端配置

在服务器的 `/www/wwwroot/cretas/` 目录下找到 `application.yml`，
添加或修改以下配置段：

```yaml
# ── BERT 意图分类器配置 ─────────────────────────────────────────────
python-classifier:
  enabled: true                                         # 从 false 改为 true
  url: http://localhost:8083/api/classifier/classify
  high-confidence-threshold: 0.85                       # 置信度 ≥0.85 直接采纳
  timeout-ms: 500                                       # 超时 500ms

cretas:
  ai:
    fusion:
      enabled: true                                     # BERT + 语义向量融合
      min-confidence: 0.60
      timeout-ms: 500
    semantic-similarity:
      enabled: true                                     # 语义向量层
    semantic-router:
      enabled: true                                     # 语义路由层
    intent:
      llm-fallback:
        enabled: true                                   # LLM 兜底保留
```

---

## 第四步：重启 Java 服务

```bash
cd /www/wwwroot/cretas
bash restart.sh

# 查看日志确认分类器注入成功
tail -f cretas-backend.log | grep -i "Classifier"
# 期望看到: [Classifier] ClassifierIntentMatcher 注入: 成功
```

---

## 第五步：端到端验证

```bash
# 测试通过 Java API 的完整意图识别链路
curl -X POST http://localhost:10010/api/public/ai-demo/recognize \
  -H "Content-Type: application/json" \
  -d '{"userInput":"帮我找找订单","sessionId":"test"}'

# 对比关键指标（日志中）：
# matchedBy: CLASSIFIER  ← 说明 BERT 层命中了
# confidence: 0.92       ← 置信度
# intent: ORDER_LIST     ← 意图
```

---

## 效果预期

| 层 | 之前 | 之后 |
|----|------|------|
| 短语层（HashMap） | 覆盖约 70% 常见表达 | 不变 |
| **BERT 分类层（新激活）** | 关闭 | 覆盖短语层漏网的口语/变体表达 |
| 语义向量层 | noop | 激活后补充覆盖 |
| LLM 兜底 | 承接所有漏网 | 仅处理极罕见/知识类请求 |

**整体准确率预期：从当前约 70% 提升至 90%+**

---

## 增量微调流程（后续持续改进）

当发现新的识别失败案例时：

```bash
# 1. 将失败样本追加到增量数据
echo '{"text":"新的口语表达","label":"CORRECT_INTENT"}' \
  >> scripts/finetune/data/incremental_training_data.jsonl

# 2. 增量微调（约 5 分钟）
bash scripts/finetune/train_and_deploy.sh --incremental

# 3. 自动上传并重启
```
