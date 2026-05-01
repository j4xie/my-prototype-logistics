# Phase 2B-β — Bucket A 第二批 (post-audit) 设计 Spec

**Date**: 2026-04-30
**Author**: brainstormed with Steve via superpowers:brainstorming, audited via superpowers:code-reviewer
**Status**: Spec v2 (post-audit) — pending user review then writing-plans
**Branch**: `phase2b/beta-implementation`
**Worktree**: `.worktrees/phase2b-beta`
**Base**: `origin/main` @ `2d8a8a272`

## Reference

α spec: `docs/superpowers/specs/2026-04-29-phase2b-ai-intent-layer-design.md`
α plan: `docs/superpowers/plans/2026-04-29-phase2b-alpha-implementation-plan.md`
α handoff: `docs/superpowers/handoffs/2026-04-29-phase2b-alpha-handoff.md`

This spec inherits α's架构基础 (Java AIIntentService → HTTP Python `/api/ai/intent/match` → Java IntentExecutor dispatch). β extends Python with **9 new files** + 1 α modification, NOT 15 as v1 proposed.

---

## 修订历史

- **v1 (2026-04-30 初稿)**: 15 文件, 6 子组 (C1-C6), 估 98h. **审计抓 6 critical + 6 important**.
- **v2 (post-audit, 本稿)**: 范围缩小到 **9 新文件 + 1 α 改动** (5 子组, ~70h). 关键变化:
  - **C2 重新定位**: Java ComplexityRouter 实际是 ProcessingMode 路由 (orchestrator 用, Bucket B), 不是 LLM tier 选择. β 提的 "LLM tier selector" 是**新 feature 不是 port**, 文件减到 1 个
  - **C3 NLP 整组 DROP**: IntentSemanticsParser + IntentPreprocessor 被 Bucket B 的 IntentExecutionOrchestrator 用, 留 Java 不动 (R-CR6 from audit)
  - **C5 RAG 简化**: Java 实际读现有 `intent_match_records` + `learned_expressions` 表 (已有数据), 不需新表 migration. **无 cold-start** (R-CR3 from audit)
  - **C6 ML 学习**: 修正表名 — 实际是 `training_samples` / `intent_match_records` / `learned_expressions` / `parameter_extraction_rules`, 不是 spec v1 写的 `intent_feedback` (R-IM4)
  - **DTO 字段不加**: 删 4 个 optional 字段 — 不污染 API contract, 避免 α 测试 break (R-CR5)
  - **Calibration cold-start**: 不用 Platt sigmoid 默认 α=1/β=0 (sigmoid 0.85=0.701 不是 identity). 改: 校准系数缺失时跳过, 直通 raw confidence (R-IM2)
  - **Embedding cache**: ai/embedding.py 加 request-scoped contextvars 缓存, SemanticRouter 跟 stage 5 SEMANTIC 共享同一次 gRPC 调用 (R-CR2)
  - **OOD detection**: 不阻塞 stage 5-8, 仅 flag (R-IM3)
  - **W7/W8 vs Phase 3**: W8 只 `@Deprecated` Java legacy services + 不再注入. Phase 3 真删 (R-CR4)

---

## 1. 范围 (post-audit)

### 1.1 已完成 (α + backlog)

α 主体 (PR #16) + 4 backlog 修复 (PR #19) — 见 α handoff.

### 1.2 β v2 范围: 9 新文件 + 1 α 改动

| 子组 | 文件数 | 说明 | Java 来源 |
|---|---|---|---|
| **C1 SemanticRouter** | 1 | `ai/router/semantic_router.py` 三级阈值 (≥0.92 DIRECT_EXECUTE, ≥0.75 NEED_RERANKING, <0.75 NEED_FULL_LLM) + OOD <0.3 (flag only). 用 ai/db.py snapshot (factory_id 已 filter) | `SemanticRouterService` (1 of 2 — drop coordinator) |
| **C2 LLM tier selector** | 1 | `ai/router/llm_tier_selector.py` — **NEW feature, NOT Java port**. Stage 8 LLM 触发前选 cheap (qwen-turbo) vs expensive (claude-3.5). | (new design, no Java equiv) |
| ~~C3 NLP~~ | 0 | **DROP** — IntentSemanticsParser + IntentPreprocessor 被 Bucket B 的 IntentExecutionOrchestrator + IntentRecognitionPipelineServiceImpl 调用. β 不动. | (stays Java) |
| **C4 校准/打分** | 2 | `ai/scoring/calibration.py` (Platt scaling, 系数缺失时直通) + `ai/scoring/intent_scoring.py` (综合分) | `ConfidenceCalibrationService` + `IntentScoringService` |
| **C5 RAG 历史检索** | 2 | `ai/rag/retrieval.py` (读现有 `intent_match_records` + `learned_expressions`) + `ai/rag/evaluator.py` (CRAG 启发式: top-1 ≥0.85 高质 / 0.7-0.85 中等 / <0.7 跳) | `RAGRetrievalService` + `RetrievalEvaluatorService` |
| **C6 ML 学习** | 3 | `ai/learning/keyword_learner.py` + `ai/learning/expression_learner.py` + `ai/learning/parameter_learner.py`. 读 `training_samples` / `intent_match_records` / `learned_expressions` / `parameter_extraction_rules` (现有表) | `KeywordLearningService` + `ExpressionLearningService` + `ParameterExtractionLearningService` |
| **额外 (α 改动)** | 1 改 | `ai/embedding.py` 加 request-scoped cache (contextvars 实现), 让 SemanticRouter + stage 5 SEMANTIC 共享一次 gRPC 调用 | — |

**总: 9 新文件 + 1 α 改动**

### 1.3 Bucket B 不变 (留 Java) — clarify post-audit

α §3.2 列表 + **以下确认留 Java** (不在 β 范围):
- `IntentSemanticsParser` (Bucket B, IntentExecutionOrchestrator 调用)
- `IntentPreprocessor` (Bucket B, IntentRecognitionPipelineServiceImpl 调用)
- `QueryPreprocessorService` (Bucket B)
- `CoreferenceResolutionService` (Bucket B)
- `SpellCorrectionService` (Bucket B)
- `SemanticMatchingService` (Bucket B coordinator, IntentRecognitionPipelineServiceImpl 调用)
- `ComplexityRouter` + `ComplexityClassifier` + `SmallLlmComplexityDetector` (Bucket B, IntentExecutionOrchestrator 用 ProcessingMode 路由 ≠ LLM tier 选择. β 的 C2 是另一新 feature, 不删 Java 这套)

### 1.4 Out of Scope (Phase 3)

- Java legacy AI services 真删除 (β W8 只 `@Deprecated` + 停止注入)
- Stage 1-4 (EXACT/PHRASE/REGEX/KEYWORD) 也搬 Python
- AIIntentServiceImpl 退化为薄客户端
- 移除 feature flag

---

## 2. Bucket B 留 Java 的服务 (复用 α §3.2 + post-audit 修订)

α §3.2 + β v2 修订:
- **核心调度** (不变): AIIntentService, IntentExecutorService, ToolRouterService, SkillRegistry, SkillExecutor, 402 Tools, 16 Skills
- **意图编排**: IntentExecutionOrchestrator, MultiIntentExecutionService, ToolDispatchService, DynamicToolSelectionService, IntentRecognitionPipelineServiceImpl, SseStreamingService
- **NLP** (β v2 修订: 全 Bucket B): IntentSemanticsParser, IntentPreprocessor, QueryPreprocessorService, CoreferenceResolutionService, SpellCorrectionService
- **复杂度路由 Java 端** (β v2 修订: 全 Bucket B): ComplexityRouter, ComplexityClassifier, SmallLlmComplexityDetector
- **配置 CRUD**: IntentConfigManagementService, AIIntentDomainDefaultService
- **反馈写库** (β 只读不写): IntentFeedbackService
- **交互 UX**: IntentDisambiguationService, SmartClarificationService
- **结果格式化**: ResultFormatterService, ResultValidatorService
- **短语匹配**: PhraseMatchingService

---

## 3. 架构变化 (vs α)

### 3.1 新增 Python 子目录

```
backend/python/ai/
├── (existing α modules: matcher/, orchestrator.py, api.py, dto.py, db.py, cache.py, embedding.py, config.py)
├── embedding.py              ← α 改动: 加 request-scoped contextvars cache
├── router/                   ← β NEW
│   ├── __init__.py
│   ├── semantic_router.py    ← C1 三级路由 + OOD flag
│   └── llm_tier_selector.py  ← C2 新 feature: cheap vs expensive LLM
├── scoring/                  ← β NEW
│   ├── __init__.py
│   ├── calibration.py        ← C4 Platt scaling (系数缺失直通)
│   └── intent_scoring.py     ← C4 综合分
├── rag/                      ← β NEW
│   ├── __init__.py
│   ├── retrieval.py          ← C5 读现有表
│   └── evaluator.py          ← C5 CRAG 启发式
└── learning/                 ← β NEW
    ├── __init__.py
    ├── keyword_learner.py    ← C6 关键词学习
    ├── expression_learner.py ← C6 表达学习
    └── parameter_learner.py  ← C6 参数规则学习
```

### 3.2 升级数据流 (orchestrator)

α flow: `query → stage 5 → 6 → 7 → 8`
β v2 flow:

```
query
  ↓ (NLP 留 Java, β 不动 — Bucket B 已处理)
SemanticRouter (β C1)            预加载 ai_intent_configs.embedding cache
  │  • 查 ai/embedding.py:get_embedding_cached(query) → 计算 1 次
  │  • 存入 contextvars (orchestrator 后续 stage 复用同一向量)
  │  • 三级 + OOD:
  │     ├─ DIRECT_EXECUTE (≥0.92): 跳过 5-8, 直接返候选 (经 _build_result 过 visible_intents 过滤)
  │     ├─ NEED_RERANKING (≥0.75): 走 5+6+7 (跳 8)
  │     ├─ NEED_FULL_LLM (<0.75 且 ≥0.3): 走 5+6+7+8
  │     └─ OOD_DETECTED (<0.3): 仍走 5+6+7+8 但 result 加 ood:true flag (Java 端可选 UX)
  ↓
[stage 5 SEMANTIC]                复用 router 已计算 embedding (CR-2 fix)
  ↓
[stage 6 CLASSIFIER]
  ↓
[stage 7 FUSION]
  ↓
[stage 8 LLM (条件)]
  ├─ LLM tier selector (β C2):  小 LLM 判 simple/complex (~0.001¥) → 选 cheap/expensive
  ├─ RAG Retrieval (β C5):       读现有 intent_match_records + learned_expressions
  └─ RAG Evaluator (β C5):       启发式评估, 高质量注入 LLM prompt
  ↓
Calibration (β C4)               系数缺失时直通; 否则 sigmoid 归一化
  ↓
IntentScoring (β C4)             综合分排序 candidates
  ↓
_build_result (α 已有, I2 visibility filter 在这, β 不绕过)
  ↓
response
  ↓ (异步, 非阻塞)
Learning services (β C6)         读 training_samples 学新规则, 写 learned_expressions / parameter_extraction_rules
```

### 3.3 关键 fix points (post-audit)

- **CR-2 embedding 重复调用**: ai/embedding.py 加 `get_embedding_cached(query)` 用 `contextvars.ContextVar` per-request 存储. SemanticRouter 计算 1 次, stage 5 SEMANTIC 复用. 节省 50-100ms 每次 stage-5 触发.
- **CR-7 DIRECT_EXECUTE I2 bypass**: SemanticRouter 用 `ai/db.py:get_current_snapshot()` (已经过 factory_id + business_type filter), 候选只能来自 visible 集. DIRECT_EXECUTE 结果仍经 `_build_result` 走 I2 过滤.
- **IM-1 preprocessedQuery volatile**: Java NLP (Bucket B) 不动, Python 端不写 preprocessedQuery 字段. F999/F001 fixture preprocessedQuery: null 不变.
- **IM-2 calibration sigmoid**: 系数缺失时直通 raw confidence, 不 sigmoid. α 测试 confidence 值不变.
- **IM-3 OOD 不阻塞**: <0.3 仅加 flag, stages 5-8 仍跑.
- **IM-6 embedding 同源**: C5 RAG 用 `ai/embedding.py` (gte-zh model 现有 stub), 不用 food_kb 的 DashScope embedder.

---

## 4. 5 子组组件详情 (post-audit)

### 4.1 C1 SemanticRouter (`router/semantic_router.py`)

**1 文件 ~150 行**

**职责**:
- 启动时从 ai/db.py snapshot 预加载所有 ai_intent_configs.embedding (per factory)
- 收到 query → 调 `ai/embedding.py:get_embedding_cached(query)` (1 次, 入 contextvars)
- 计算 query_emb 与所有 visible intent embeddings 余弦相似度
- 三级 + OOD 决策返:
  ```python
  @dataclass
  class RouteDecision:
      method: Literal["DIRECT_EXECUTE", "NEED_RERANKING", "NEED_FULL_LLM"]
      ood_detected: bool  # True if max similarity < 0.3
      candidates: list[CandidateIntentDto]  # top-K with similarity scores
      query_embedding: list[float]  # for stage 5 reuse
  ```
- 返 candidates 的 intent_codes 必属 visible_intents (factory_id 隔离)

**依赖**: α `ai/embedding.py`, `ai/db.py`, `ai/dto.py:CandidateIntentDto`.

**测试**:
- 阈值边界 (0.92 / 0.75 / 0.3)
- factory_id 隔离 (F001 不见 F002 intent)
- OOD flag 不阻塞 (return method=NEED_FULL_LLM + ood_detected=True)
- Embedding cache 共享 (router 调用后, stage 5 不再 call gRPC)

### 4.2 C2 LLM tier selector (`router/llm_tier_selector.py`) — NEW feature

**1 文件 ~80 行**, **NOT Java port** (Java ComplexityRouter 留 Bucket B 用其他用途).

**职责**:
- Stage 8 LLM 触发前调用
- 用小 LLM (qwen-turbo via common/llm_router SLOT.MAPPER, ~0.001¥/call) 判 query 复杂度
- 简单 query → 用便宜 LLM (qwen-turbo / qwen-plus, ~0.005¥/M tokens)
- 复杂 query → 用贵 LLM (claude-3.5-sonnet / qwen-max)
- 失败 fallback 到贵 LLM (保安全)

**ROI 验证 (post-audit)**:
- 假设 stage 8 触发 30% 流量, 其中 80% 是简单 query → 24% 总流量受益
- 节省: 24% × (0.05¥ - 0.005¥) = 0.0108¥/query
- 成本: 100% × 0.001¥ = 0.001¥/query (small LLM 自身)
- 净: -0.0098¥/query (节省). 持平点: 简单 query 占比 > 2.2% 即净省

**依赖**: `common/llm_router` 现有 SLOT 接口.

### 4.3 C4 校准/打分 (`scoring/calibration.py` + `scoring/intent_scoring.py`)

**2 文件**

**`calibration.py` (~60 行)**:
- 系数表 `intent_calibration_coeffs` (新 Flyway migration V20260501_10__calibration.sql, 但**初始为空**)
- 启动时加载, 5 min refresh
- **系数缺失时**: `calibrated = raw` (直通, 非 sigmoid). 这样 α 测试不 break (R-IM2 fix).
- 系数存在时: `calibrated = sigmoid(α·raw + β)` per (matcher, factory_id) 维度

**`intent_scoring.py` (~80 行)**:
- 综合分 = w1·calibrated_confidence + w2·matched_keyword_count + w3·priority_normalized + w4·confidence_boost
- 权重默认 (0.5, 0.2, 0.2, 0.1), env override
- 用于多 candidate 排序

**测试**:
- 系数缺失 → calibrated == raw
- 系数存在 → sigmoid 数值正确
- 综合分排序符合预期

### 4.4 C5 RAG 历史检索 (`rag/retrieval.py` + `rag/evaluator.py`) — post-audit 简化

**2 文件**, **不新建表** (用现有数据).

**`retrieval.py` (~120 行)**:
- 读取**现有表**:
  - `intent_match_records` (Java 已写, 字段: id, query, query_embedding (vector), intent_code, confidence, factory_id, created_at)
  - `learned_expressions` (Java 已写, 字段: id, intent_code, expression, factory_id, learned_at)
- pgvector 余弦相似度查 top-K (默认 K=5)
- factory_id 隔离 (where factory_id = $X OR factory_id IS NULL)
- 用 `ai/embedding.py:get_embedding_cached(query)` (CR-2 fix, 不重复 gRPC; 若 router 已计算则共享)

**`evaluator.py` (~60 行)** — CRAG 启发式:
- top-1 相似度 >= 0.85 → 高质量 (注入 LLM prompt 完整 context)
- 0.7-0.85 → 中等 (注入 query 不注入 intent_code)
- <0.7 → 不可信 (跳过 RAG, LLM 不带 history)
- 0 results (cold-start) → 不可信, 同上

**No cold-start** (post-audit fix): Java pipeline 已经 prod 写过 `intent_match_records`. β 上线即有数据.

**Migration**: 无需新建表. 仅可能加 pgvector index 优化 (V20260501_10__rag_index.sql).

### 4.5 C6 ML 学习 (`learning/{keyword,expression,parameter}_learner.py`)

**3 文件, 全异步, 不阻塞响应**

**真实表名 (post-audit fix)**:
- 读: `training_samples` (Java IntentFeedbackService 写)
- 读: `intent_match_records` (Java 每次匹配写)
- 写: `learned_expressions` (现有, β 加新 row), `parameter_extraction_rules` (现有, β 加新 row), `ai_intent_configs.keywords` (现有, β 更新 JSON 数组)

**`keyword_learner.py` (~100 行)**:
- 监听 IntentFeedbackService 写 `training_samples` (postgres LISTEN/NOTIFY 或 5min cron)
- 高置信度正反馈 query → 提取 unseen keyword (通过简单 token diff)
- 更新 `ai_intent_configs.keywords` JSON

**`expression_learner.py` (~120 行)**:
- 完整 query 表达模板学习
- 输入: query + intent_code 标注
- 输出: expression 模板写到 `learned_expressions` 表
- 触发: 高置信度匹配 (>= 0.95) 或 用户显式确认 (training_samples)

**`parameter_learner.py` (~120 行)**:
- 学习参数提取规则
- 输入: query + extracted_params 反馈
- 输出: 正则/Jinja 模板写到 `parameter_extraction_rules` 表

**依赖**: 现有 4 表 schema. **W0 必做**: grep + 验证 schema 存在性.

### 4.6 α 改动: `ai/embedding.py` 加 request-scoped cache

**~30 行 patch**

```python
# backend/python/ai/embedding.py
import contextvars

_request_embedding_cache: contextvars.ContextVar[dict] = contextvars.ContextVar(
    "_request_embedding_cache", default={}
)

async def get_embedding_cached(text: str) -> Optional[List[float]]:
    """Request-scoped cached embedding. Set via FastAPI middleware that
    initializes a fresh dict per request."""
    cache = _request_embedding_cache.get()
    if text in cache:
        return cache[text]
    vec = await get_embedding(text)
    if vec is not None:
        cache[text] = vec
    return vec
```

FastAPI middleware (在 ai/api.py) 每 request init `_request_embedding_cache.set({})`.

**测试**: 同 query 在 1 个 request 内 call 2 次 → gRPC 只调 1 次.

---

## 5. API Contract 变化 (post-audit) — 不变

**没有新 DTO 字段** (R-CR5 fix).

α §5 的 contract 完全保留. β 内部决策 (routerDecision / llmTier / ragUsed) 仅记 Python 日志 + Micrometer metric, 不进 response.

如果未来要观测, 加新 metric API endpoint, 不污染 IntentMatchResult.

---

## 6. 错误处理 + 回退 (继承 α + 各子组 graceful degrade)

| 子组 | 失败 | 降级 |
|---|---|---|
| C1 SemanticRouter | embedding 失败 / DB miss | 跳 router, orchestrator 直接 stage 5+6+7+8 全跑 |
| C2 LLM tier selector | small LLM 超时 | 默认走"复杂"路径, 用贵 LLM (保安全) |
| C4 Calibration | 系数缺失 | 直通 raw confidence (R-IM2 fix) |
| C4 Scoring | 权重缺失 | 用默认权重 (0.5, 0.2, 0.2, 0.1) |
| C5 RAG retrieval | 检索失败 / 0 results | 跳 RAG 增强, LLM prompt 不带 history |
| C5 RAG evaluator | 评估失败 | 默认"不可信"跳过 |
| C6 Learning | 写库失败 | 异步任务记 log, 不影响响应 |

继承 α: Resilience4j circuit breaker, feature flag default OFF, legacy retained.

---

## 7. 测试策略

### 7.1 继承 α (不变)

- F999 + F001 byte-shape gate
- 各 matcher unit test
- pytest in `tests/python/ai/`
- 总 60+ 测试

### 7.2 β v2 新增

| 文件 | 测试范围 |
|---|---|
| `test_router_semantic.py` | 三级阈值边界, factory_id 隔离, OOD flag 不阻塞, embedding cache 共享 |
| `test_router_llm_tier.py` | simple/complex 分类, LLM 选择, 失败 fallback |
| `test_scoring_calibration.py` | 系数缺失直通, sigmoid 数值, factory 维度 |
| `test_scoring_intent.py` | 综合分排序, 权重 env override |
| `test_rag_retrieval.py` | pgvector 检索 top-K, factory_id 隔离, 0-results 处理, embedding 共享 |
| `test_rag_evaluator.py` | 三档评估边界, 0-results 默认不可信 |
| `test_learning_keyword.py` | 反馈→关键词提取正确, JSON 更新 |
| `test_learning_expression.py` | 表达模板生成, 写库 |
| `test_learning_parameter.py` | 参数规则学习, 写 parameter_extraction_rules |
| `test_embedding_cached.py` | request-scoped cache 共享 |

**新 fixture**: 无 (DTO 不变, F999/F001 仍 cover envelope shape).

### 7.3 整合测试

- `test_orchestrator_beta.py`: 端到端各 router 路径 (DIRECT_EXECUTE / NEED_RERANKING / NEED_FULL_LLM / OOD)
- α `IntentParityTest` Java 端: 验证 Java legacy path vs β path 同 intentCode (新加 ~10 cases 覆盖路由路径)

---

## 8. Rollout

### 8.1 Wave 时间线 (post-audit)

| Wave | 工作 | 估时 |
|---|---|---|
| **W0 准备** | grep 验证 4 表 schema (training_samples / intent_match_records / learned_expressions / parameter_extraction_rules); 列 13 Java legacy services 真实 import; 整理子组依赖 | ~3h |
| **W1** | C1 SemanticRouter + ai/embedding.py request-scoped cache + orchestrator 前置 router | ~12h |
| **W2** | C2 LLM tier selector | ~5h |
| **W3** | C4 校准/打分 (2 文件) | ~8h |
| **W4** | C5 RAG (2 文件, 读现有表, 含 pgvector index migration) | ~10h |
| **W5** | C6 ML 学习 (3 文件) | ~18h |
| **W6 整合** | orchestrator 串联全 5 子组 + 端到端测试 + post-test 调优 | ~10h |
| **W7 Cleanup** | Java legacy services `@Deprecated` + 停止 Spring 注入 (不真删) | ~6h |

**总: ~72h**, 7 wave (vs v1 的 98h / 8 wave). 跟 α 同 subagent-driven 模式 1.5 天 ship.

### 8.2 部署 + Flag flip

- α + β 一起 deploy (test env first, flag default OFF)
- 1 周 test env soak with flag ON
- prod flip
- 1 周 prod canary
- Phase 3 启动 (真删 Java services + Stage 1-4 也搬 Python)

---

## 9. Concurrent Edit Safety

### 9.1 Worktree 隔离

- β worktree: `.worktrees/phase2b-beta` (已建)
- 分支: `phase2b/beta-implementation`
- Sibling: phase2a-finance-profit / phase2a-sales-rankings / phase2a-sales-trend (Phase 2A sub-specs 仍并行)

### 9.2 共享文件冲突

| 文件 | 冲突级别 | 缓解 |
|---|---|---|
| `backend/python/main.py` | 中 | **集中到 W6 整合一次性改** (per R-IM5 fix). 不散在 W1-W5. ai 模块 wiring 通过新 `ai/__init__.py:configure_app(app)` 调用, main.py 只 +1-2 行 |
| `requirements.txt` | 低 | β 可能加 sklearn (calibration). 字母序插入 |
| Flyway migrations | 低 | β 仅可能加 1 个 (V20260501_10__rag_index 或 V20260501_10__calibration_coeffs). 跟 sibling 错开. β 用 `V20260501_15+` 留间距 |

### 9.3 Commit 规则

- 每子组单独 commit (`safe-commit.sh` --only mode)
- main.py 集中 W6 一次 atomic 改动 (post-audit fix)
- 每 migration 一个 commit

---

## 10. 开放问题 / 风险

| # | 问题 | 应对 |
|---|---|---|
| R1 | C2 ROI 计算依赖 stage 8 触发率假设 30% — 真实数据可能不同 | W6 部署后实测, 调整 simple/complex 分类阈值 |
| R2 | C4 综合分权重 (0.5/0.2/0.2/0.1) 是猜的 | env override + W6 后调优 |
| R3 | C5 RAG 检索质量启发式阈值 (0.85/0.7) 也是猜 | post-deploy 收集真实 case 调参 |
| R4 | C6 学习服务异步触发用 PG LISTEN/NOTIFY 还是 5min cron | W5 决: cron 简单稳定, NOTIFY 实时但要 PG 配置 |
| R5 | Bucket B 的 IntentSemanticsParser / IntentPreprocessor 仍在 Java, β 的 Python 端不预处理 — 输入质量受 Java 控制 | 接受. Phase 3 再考虑 |
| R6 | OOD 阈值 0.3 是猜的 | post-deploy 收集 OOD case 调参. 仅 flag 不阻塞 |
| R7 | Embedding cache 用 contextvars per-request — async 上下文边界 | FastAPI middleware 起一个 request 即 set 新 dict, 自动隔离. asyncio.Task 子任务继承 context, 行为正确 |
| R8 | Phase 2A sibling main.py 频繁更新 | W6 集中改一次, fetch + rebase 后做 |
| R9 | Calibration 系数表为空时直通 — 怎么从空到有? | post-prod 1 周后写人工 SQL 拟合 + insert 系数. 或运营脚本 batch 计算 |
| R10 | Java legacy services @Deprecated 但仍存在 — Phase 3 真删时机 | 1 周 prod canary + 0 fallback 触发后 |

---

## 11. 命名约定

- Python: `backend/python/ai/{router,scoring,rag,learning}/`
- 不需要 nlp/ 子目录 (C3 dropped)
- Branch: `phase2b/beta-implementation`
- Worktree: `.worktrees/phase2b-beta`
- Spec: `docs/superpowers/specs/2026-04-30-phase2b-beta-design.md`
- Plan: `docs/superpowers/plans/2026-04-30-phase2b-beta-implementation-plan.md`

---

## 12. 实施门槛

**绝对 no-go (ship 失败重做)**:
- F999 + F001 byte-shape gate 失败
- α 现有 60+ 测试退化 (含 calibration 直通验证)
- Java AIIntentServiceContextTest 退化
- 任何 cross-tenant 数据泄露 (RAG factory_id 隔离要严)
- Embedding cache 跨 request 串数据 (隔离 bug)

**Soft 标准**:
- 各子组 unit test 全过
- 综合分权重默认值 (后续可 env 调)
- Calibration 系数表初始为空可接受

---

## 13. 不在本 spec 决定的事 (留给 writing-plans)

- 各子组具体 Python 实现细节
- W0 grep 验证后的 13 Java legacy 服务真实清单
- Flyway migration 序号 (β 用 V20260501_15+)
- requirements.txt 新依赖 (可能 sklearn / scipy)
- 各 wave 具体 commit 拆分粒度
- Resilience pattern 对各 sub-stage failure (graceful degrade 实现细节)

---

## 14. 决策记录 (post-audit)

| 决策 | 选项 | v1 | v2 (post-audit) |
|---|---|---|---|
| 部署策略 | A 先部 α / B 同建 β / C hybrid | B | **B 不变** |
| 范围 | 8 / 15 / 12 文件 | 15 (v1) | **9 (v2 post-audit)** |
| C3 NLP | port / 留 Java | port | **留 Java** (Bucket B 用) |
| C2 ComplexityRouter | port / 新 feature | port | **新 feature, 1 文件** |
| C5 RAG migration | 新表 / 用现有 | 新表 | **用现有** (intent_match_records + learned_expressions) |
| Calibration cold-start | sigmoid 默认 / 直通 | sigmoid (错!) | **直通** (R-IM2 fix) |
| OOD detection | 阻塞 reject / flag | 阻塞 | **flag 不阻塞** (R-IM3 fix) |
| DTO 4 新字段 | 加 / 不加 | 加 (矛盾!) | **不加** (R-CR5 fix) |
| Embedding 重复调用 | 独立 / cache | 独立 (浪费) | **request-scoped cache** (R-CR2 fix) |
| W7/W8 删除 Java | 真删 / @Deprecated | 矛盾 | **W7 Deprecated, Phase 3 真删** (R-CR4 fix) |
| Wave 数 | 8 | 8 | **7** (drop W3 NLP) |
| 估时 | 98h | 98h | **72h** |

---

## 文档结束

**下一步**: 用户 review v2 → invoke `superpowers:writing-plans` 生成实施计划.

**v2 关键改动 (vs v1)** — 全部修复 audit 6 critical + 6 important:
- 范围: 15 → 9 files (drop NLP 整组 + 简化 RAG)
- 估时: 98h → 72h
- C2 重新定位 (port → new feature)
- C5 RAG 用现有表, 无 cold-start
- Calibration 直通 (不 sigmoid 默认)
- OOD flag 不阻塞
- DTO 不加新字段
- Embedding cache fix
- W7 Deprecated 不真删 (Phase 3 真删)
