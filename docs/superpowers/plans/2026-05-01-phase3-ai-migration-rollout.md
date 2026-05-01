# Phase 3 AI Migration Rollout Plan

> 何时把 `ai.use-python-matcher` 翻 `true`, 怎么 stage rollout, kill switch, 长期 cleanup.
>
> **写作日期**: 2026-05-01
> **当前状态**: Phase 2B-α + β 全部 prod 上线 (commits `38b545d0c` α / `fb92f4b01` β / `fdb5f3c48` auth fix). Java flag `ai.use-python-matcher=false` (默认), 完全 dark-shipped.

---

## 1. 现状速览

**Python 端 (8083 prod / 8084 test)**:
- α stage 5-8 SEMANTIC/CLASSIFIER/FUSION/LLM 完整 port
- β SemanticRouter + Calibrator + Scorer + RAG + KeywordLearner + ExpressionLearner 全部 wired
- `tier_selector=disabled` (F6 默认关, env `AI_TIER_SELECTOR_ENABLED=true` 才开)
- `/api/ai/intent/match` 端到端 verify 过 (test + prod 都跑通 routerMs/semanticMs)

**Java 端 (10010 prod / 10011 test)**:
- `AIIntentServiceImpl.usePythonMatcher` 字段读 `${ai.use-python-matcher:false}` (line 88-89)
- 翻 `true` 后流程: cache → Python `/api/ai/intent/match` → Python 返空才退到 legacy pipeline (T20 integration, line 244-281)
- 8 个 Java service `@Deprecated` 但代码留在 (annotation only, Spring DI 不变)

**DB**:
- V20260501_15 在 cretas_db (test) + cretas_prod_db (prod) 都 `success=t`
- pgvector 0.7.0 已装, `query_embedding_vec` + `embedding_vec` 字段 ADD COLUMN 成功 (260 行 / 2717 行 prod, ADD 是元数据级)

---

## 2. 翻 flag 之前的 soak checklist

### 2.1 必须满足的前置条件

- [ ] β prod 已 soak ≥ **48 小时** 无重启 / 异常 log
- [ ] `INTERNAL_API_SECRET` 在 prod Java + Python 两侧字节匹配 (audit 已 verify)
- [ ] Python 8083 健康 + AI orchestrator 启动日志含 `tier_selector=disabled`
- [ ] cretas-python.service 的 `Environment=INTERNAL_API_SECRET=...` 行**移除** (audit tech-debt: 单一来源 .env.prod)
- [ ] `intent_match_records.query_embedding_vec` 列存在但仍 NULL (β 还没写入, 因为 flag false → cron 跑不到)
- [ ] α 旧 prod 数据 ≥ 1000 条 cached snapshot (`ai_intent_configs` 表 row count) — 给 Python snapshot loader 测
- [ ] gRPC embedding 服务 (9090) 健康

### 2.2 度量 dashboard (开 flag 前先建)

| 指标 | 目标 | 来源 |
|---|---|---|
| `/api/ai/intent/match` p50 latency | <200ms | Python prometheus `intent_match_duration_seconds` |
| `/api/ai/intent/match` p99 latency | <2000ms | 同上 |
| `IntentResultCache` hit rate | >40% (热数据后) | Java metric `intent_cache_hits_total` |
| Python orchestrator error rate | <0.5% | Java log `ERROR.*PythonAiMatcherClient` 计数 |
| Java fallback to legacy rate | <5% (Python empty/throw 比例) | Java log `Python returning empty` 计数 |
| stage 8 LLM call rate | <30% (router 大部分应该 DIRECT_EXECUTE 或 NEED_RERANKING) | Python log `Stage 8 LLM result` 计数 |

> ⚠️ **第一周** error rate / fallback rate 高于目标是正常 — Python snapshot 还没暖, semantic embedding 还没缓存. 看趋势是不是降.

---

## 3. 分阶段 rollout

### Phase 3.1: 内部 canary (1 个工厂)

**触发**: soak 完成 + dashboard 上线后

```bash
# 在 .env.prod 加
AI_USE_PYTHON_MATCHER=true
AI_PYTHON_MATCHER_FACTORY_WHITELIST=F999  # 加 whitelist 字段需要 Java 改造一次
```

⚠️ **依赖 Java 改造**: 当前 `usePythonMatcher` 是全局 boolean. 真要 canary 需要先加 whitelist 字段 (单独 PR, ~2-3h).

**简化方案** (推荐): 跳过 canary 直接到 Phase 3.2 全量, 用 kill switch 兜底.

### Phase 3.2: 全量 ramp + kill-switch ready

**触发**: 选定一个**低流量时段** (推荐周末凌晨 03:00)

```bash
# 1. 在 prod Java 上设置环境变量
ssh root@47.100.235.168
cd /www/wwwroot/cretas
echo "AI_USE_PYTHON_MATCHER=true" >> .env.prod
systemctl daemon-reload  # 不需要, EnvironmentFile 自动 reload (重启时)
systemctl restart cretas-backend  # active 实例 (Blue-Green: 先重启 idle, 切流量, 再重启 active)
```

**实际操作 — Blue-Green stage**:

```bash
# 当前 active = green (prod 10010 → green 10020), idle = blue (10010 stopped)
# 1) 给 idle (blue) 加 flag, 启动
echo "AI_USE_PYTHON_MATCHER=true" | tee -a /etc/systemd/system/cretas-backend.service.d/override.conf
systemctl daemon-reload
systemctl start cretas-backend  # blue 启动, 10010 监听
# 2) 等 blue health UP (~80s)
curl 127.0.0.1:10010/api/mobile/health
# 3) 用 deploy script 的 BG 工具切 nginx upstream (10020 → 10010)
bash /www/wwwroot/cretas/scripts/blue-green-switch.sh blue
# 4) 停 green
systemctl stop cretas-backend-green
```

**第一小时密切监控**:

```bash
# 每 30s 看一次 error/fallback 比例
watch -n 30 'tail -1000 /www/wwwroot/cretas/cretas-prod.log | grep -c "Python.*empty\|Python.*throw" '
```

### Phase 3.3: Kill switch (回滚)

**触发**: 任一指标越红:
- p99 > 3000ms 持续 5 分钟
- error rate > 2% 持续 5 分钟
- Java fallback rate > 30% 持续 5 分钟

**操作** (~30s recovery):

```bash
ssh root@47.100.235.168
sed -i 's/AI_USE_PYTHON_MATCHER=true/AI_USE_PYTHON_MATCHER=false/' /www/wwwroot/cretas/.env.prod
systemctl restart cretas-backend  # 5-10s reload + 80s 应用启动
# 之后 Java 走 100% legacy in-process pipeline, 跟 ramp 前完全一致
```

---

## 4. Phase 3.x 后续 cleanup (long-term)

### 4.1 Java service 真删除 (Phase 3.A)

**前置**: ramp 后 30 天无 fallback, 确定 Python 完全胜任.

**8 个 service 删除清单**:
- `ConfidenceCalibrationService` + Impl → Python `ai/scoring/calibration.py`
- `ExpressionLearningService` + Impl → Python `ai/learning/expression_learner.py`
- `KeywordLearningService` + Impl → Python `ai/learning/keyword_learner.py`
- `ParameterExtractionLearningService` + Impl → **不删** (Python 无对应, 用户决定 Java 继续)
- `RAGRetrievalService` + Impl → Python `ai/rag/retrieval.py`
- `RetrievalEvaluatorService` + Impl → Python `ai/rag/evaluator.py`
- `SemanticRouterService` + Impl → Python `ai/router/semantic_router.py`
- `IntentScoringService` + Impl → Python `ai/scoring/intent_scoring.py`

**步骤**: 单独 PR per service, 删 `@Service` 实现 → 删 interface → 改所有 caller → 跑全部 IntentParityTest.

**预计**: 7 个 PR, 每个 1-2h 工作 + review, 总共 ~10-15h.

### 4.2 Stage 1-4 Python 化 (Phase 3.B)

**当前**: Java `IntentRecognitionPipelineService` 跑 Stage 1 EXACT (哈希表) + Stage 2 PHRASE_MATCH + Stage 3 REGEX + Stage 4 KEYWORD.
**目标**: 全 4 个 stage 也 port to Python, Python orchestrator 接管 stage 1-4 + 已有的 5-8.
**影响**: AIIntentServiceImpl 退化为 thin client, 只调 Python `/api/ai/intent/match`, 不再持有 IntentRecognitionPipelineService 引用.

**预计**: ~30-50h. spec + plan + impl + Java 改造.

### 4.3 移除 feature flag (Phase 3.C)

**前置**: 4.2 完成 + 60 天 soak.

```java
// 删除以下行
@Value("${ai.use-python-matcher:false}")
private boolean usePythonMatcher;

// recognizeIntentWithConfidence() 直接调 Python, 不要分支
```

删 `application.properties:298` 那行.

**预计**: 1-2h, 单独 PR.

---

## 5. 依赖项 + risks

| 风险 | 缓解 |
|---|---|
| Python `/api/ai/intent/match` 平均 latency > Java in-process | 看 dashboard 数据后决定: 加 `tier_selector=true` 让简单 query 走 cheap LLM |
| pgvector ivfflat 索引随数据增长 recall 下降 | 每月 ANALYZE + `VACUUM ANALYZE intent_match_records ai_learned_expressions` |
| KeywordLearner / ExpressionLearner cron 跑垃圾数据 | I-NEW-3 fix 限定 per-tenant; ExpressionLearner 用 `confidence >= 0.95` 高门槛, 风险低 |
| Java 端 fallback to legacy 比例长期高 (>10%) | 说明 Python snapshot 缺数据 / 路由判断不准 → 调试 SemanticRouter 阈值 |
| Phase 3 服务删除时漏改 caller | grep `@Autowired.*<ServiceName>` + IntentParityTest 全过 |

---

## 6. Action items (本 chat 不做, 给后续 chat)

- [ ] 加 prometheus dashboard 给 6 个度量
- [ ] Java 端加 metric: `IntentResultCache.hitRate`, `PythonAiMatcherClient.fallbackRate`
- [ ] 决定是否要 canary whitelist (新增 `ai.python-matcher-factories=F999`, 默认空)
- [ ] cretas-python.service 删除 `Environment=INTERNAL_API_SECRET=...` 行 (audit tech-debt)
- [ ] 写 Phase 3.A 删除计划 (8 个 service, 7 个 PR)
- [ ] 写 Phase 3.B Stage 1-4 Python port spec
- [ ] 决定 ParameterExtractionLearningService 命运 (留 Java 还是后续 port)

---

**Owner**: TBD (本 chat 不指派)
**预计 ramp 触发时间**: ≥ 2026-05-03 (β 上线后 ≥ 48h soak)
