# Phase 2B-β — Bucket A 第二批 (15 文件) 设计 Spec

**Date**: 2026-04-30
**Author**: brainstormed with Steve via superpowers:brainstorming
**Status**: Spec — pending user review then writing-plans
**Branch**: `phase2b/beta-implementation`
**Worktree**: `.worktrees/phase2b-beta`
**Base**: `origin/main` @ `2d8a8a272` (Phase 2B-α + backlog merged via PR #16 + #19)

## Reference

α spec: `docs/superpowers/specs/2026-04-29-phase2b-ai-intent-layer-design.md`
α plan: `docs/superpowers/plans/2026-04-29-phase2b-alpha-implementation-plan.md`
α handoff: `docs/superpowers/handoffs/2026-04-29-phase2b-alpha-handoff.md`

This spec inherits α's架构基础 (Java AIIntentService → HTTP Python `/api/ai/intent/match` → Java IntentExecutor dispatch). β extends the Python side with 6 new sub-modules + updates orchestrator pipeline.

---

## 1. 背景与范围决策

### 1.1 α 已完成 (基础)

- Stage 5-8 matchers (semantic / classifier / fusion / llm)
- Orchestrator 短路逻辑
- F999 + F001 byte-shape gates
- Java 集成 (PythonAiMatcherClient + Resilience4j + IntentResultCache + feature flag)
- 4 个 backlog 修复 (PR #19): embedding stub wired, classifier scope filter, F001 fixture, stale Javadoc

### 1.2 β 范围 — Bucket A 第二批 15 文件 6 子组

Per α spec §3.1 (Bucket A 第二批) — 经源码 verify 后**全 port**, 无 defer:

| 子组 | 文件数 | Java 源 |
|---|---|---|
| C1 语义路由 | 2 | `SemanticRouterService` (141 行, 三级路由 ≥0.92/≥0.75/<0.75), `SemanticMatchingService` (69 行, Layer 0.4 协调器) |
| C2 复杂度路由 | 3 | `SmallLlmComplexityDetector`, `ComplexityClassifier`, `ComplexityRouter` |
| C3 NLP 高级处理 | 3 | `IntentSemanticsParser`, `IntentPreprocessor`, `QueryPreprocessorService` (含 `CoreferenceResolutionService` + `SpellCorrectionService` 合并) |
| C4 校准/打分 | 2 | `ConfidenceCalibrationService`, `IntentScoringService` |
| C5 RAG 历史检索 | 2 | `RAGRetrievalService` (107 行, 历史 query 案例检索), `RetrievalEvaluatorService` (53 行, CRAG corrective RAG) |
| C6 ML 学习 | 3 | `KeywordLearningService`, `ExpressionLearningService`, `ParameterExtractionLearningService` |

**总: 15 文件**

### 1.3 范围决策记录

Brainstorming 期间一度建议缩到 8 文件 (defer C4-C6 共 7 文件), 经 verify Java 源码后**全部撤销 defer**:
- C4 (语义路由): 三级路由器 ≠ α `SemanticMatcher` (后者只是 stage 5 候选返回, 无路由决策). NOT redundant.
- C5 (RAG): 历史 query 案例检索, 跟 `food_kb/` (食品知识库 PDF chunks) 完全不同用例. NOT redundant.
- C6 (ML 学习): 学习 service 代码可现 port, 反馈数据流后通即生效, 无 chicken-and-egg 问题.

最终决策: **全做 15 文件**, 跟 α 同 subagent-driven 模式分 6 dispatch wave.

### 1.4 Out of Scope (留 Phase 3)

- Java legacy 13 services 删除 (β W7 整合阶段做, 但 Java→Python 完全 cutover 留 Phase 3)
- Stage 1-4 (EXACT/PHRASE/REGEX/KEYWORD) 也搬 Python (Phase 3)
- AIIntentServiceImpl 退化为 ~30 行薄客户端 (Phase 3)
- 移除 feature flag (Phase 3, β 期间 flag 仍 default OFF)

---

## 2. Bucket B 不变 (留 Java)

继续 α §3.2 列表 — 18-22 文件 (调度/CRUD/UX) 留 Java, β 不动. 包括:
- `AIIntentService` 接口 + Impl (薄壳化)
- `IntentExecutorService` 4-branch dispatch + Impl
- `IntentExecutionOrchestrator`, `MultiIntentExecutionService`
- `ToolRouterService` 动态 Tool 选择
- `IntentDisambiguationService`, `SmartClarificationService` (UX 状态机)
- 配置 CRUD (`IntentConfigManagementService`, `AIIntentDomainDefaultService`)
- 反馈写库 (`IntentFeedbackService`, 但 ML **学习** 部分移 β)
- 结果格式化 (`ResultFormatterService`, `ResultValidatorService`)
- `PhraseMatchingService` (Java 字符串处理)

---

## 3. 架构变化 (vs α)

### 3.1 新增 Python 目录结构

```
backend/python/ai/  (α 已建)
├── matcher/                   ← α: stage 5-8 4 个 matcher
├── orchestrator.py            ← α 已建, β 大改 (前置 router, 整合新模块)
├── api.py                     ← α 已建, β 不改
├── dto.py                     ← α 已建, β 可能加新字段 (e.g. routerDecision)
├── db.py                      ← α 已建
├── cache.py                   ← α 已建
├── embedding.py               ← α 已建 (B1 wired)
├── config.py                  ← α 已建
├── router/                    ← β NEW
│   ├── __init__.py
│   ├── semantic_router.py     ← C1: 三级路由 (≥0.92 DIRECT_EXECUTE / ≥0.75 NEED_RERANKING / <0.75 NEED_FULL_LLM)
│   └── complexity_router.py   ← C2: 复杂度判定 + 模型选择
├── nlp/                       ← β NEW
│   ├── __init__.py
│   ├── preprocessor.py        ← C3: query 标准化, 时间归一化, 槽位预抽取
│   ├── semantics_parser.py    ← C3: 语义结构解析
│   └── corref_spell.py        ← C3: 代词消解 + 拼写纠正 (Java 2 service 合并)
├── scoring/                   ← β NEW
│   ├── __init__.py
│   ├── calibration.py         ← C4: 跨 matcher confidence 归一化 (Platt scaling)
│   └── intent_scoring.py      ← C4: 综合 (匹配关键词数, 优先级, confidence_boost) 打分
├── rag/                       ← β NEW
│   ├── __init__.py
│   ├── retrieval.py           ← C5: 历史 query 案例检索 (PG + pgvector + intent_history 表)
│   └── evaluator.py           ← C5: CRAG 评估检索质量 (LLM-as-judge / 启发式)
└── learning/                  ← β NEW
    ├── __init__.py
    ├── keyword_learner.py     ← C6: 高置信度匹配自动学新关键词
    ├── expression_learner.py  ← C6: 完整表达学习 (vs 仅关键词)
    └── parameter_learner.py   ← C6: 规则化参数提取 (跳 LLM)
```

### 3.2 新增 Java 改动 (Bucket B 微调)

- `AIIntentServiceImpl.java`: 集成新 router 调用 (Python orchestrator 内部已串好, Java 端只需要传 query 进去, 接 IntentMatchResult 出来 — 几乎不变)
- 删 13 个 Java legacy AI service 文件 (W7 整合阶段, 各对应 β 已 port 的)
- 新加: 无新 Java DTO 字段 (Python orchestrator 已串好所有模块, Java 接最终 IntentMatchResult)

### 3.3 升级数据流 (orchestrator)

α flow:
```
query → stage 5 → 6 → 7 → 8 (短路)
```

β flow:
```
query
  ↓
NLP preprocessor (β C3)         标准化 + 拼写纠正 + 代词消解
  ↓
SemanticRouter (β C1)            三级路由决策
  ├─ DIRECT_EXECUTE (≥0.92):    跳过 5-8, 直接返 candidate
  ├─ NEED_RERANKING (≥0.75):    走 stage 5+6+7 (跳 8)
  └─ NEED_FULL_LLM (<0.75):     走 stage 5+6+7+8
  ↓
[stage 5 SEMANTIC]
  ↓
[stage 6 CLASSIFIER]
  ↓
[stage 7 FUSION]
  ↓
[stage 8 LLM (条件)]
  ├─ ComplexityRouter (β C2):   选便宜 (qwen-turbo) vs 贵 (claude-3.5-sonnet)
  ├─ RAG Retrieval (β C5):      检索历史相似 query 注入 prompt
  └─ RetrievalEvaluator (β C5): 评估检索质量, 决定是否纳入 context
  ↓
Calibration (β C4)               跨 stage confidence 归一化 (Platt scaling)
  ↓
IntentScoring (β C4)             综合分 (confidence + priority + matched_keywords + boost)
  ↓
_build_result → response
  ↓ (异步)
Learning services (β C6)         反馈写 ai_intent_configs (keyword/expression/parameter)
```

**关键变化**:
- 前置 NLP 预处理 (3.x ms 增加)
- 前置 router 三级决策 — DIRECT_EXECUTE 路径**完全跳过 stage 5-8**, 大幅降低延迟 + LLM 成本
- LLM 调用前 ComplexityRouter + RAG 增强
- 各 stage 后置 Calibration 归一化 confidence
- Learning 异步运行, 不影响响应

---

## 4. 6 子组组件详情

### 4.1 C1 语义路由 (router/)

**文件**: `semantic_router.py` + `complexity_router.py` (后者归 C2 但同目录)

**职责** (semantic_router.py):
- 启动时预加载所有 ai_intent_configs.embedding 向量
- 收到 query → 调 `ai/embedding.py:get_embedding(query)` 拿向量
- 计算与所有 intent_config 的余弦相似度
- 三级阈值决策返回:
  - `RouteDecision(method=DIRECT_EXECUTE, intent_code=X, confidence=0.95, candidates=[X])`: 跳 stage 5-8
  - `RouteDecision(method=NEED_RERANKING, candidates=top_5)`: 走 stage 5+6+7
  - `RouteDecision(method=NEED_FULL_LLM, candidates=top_10)`: 走 stage 5+6+7+8

**依赖**: α `ai/embedding.py` (已 wire EmbeddingServiceStub.Encode), α `ai/db.py` (snapshot rows)

### 4.2 C2 复杂度路由 (router/complexity_router.py)

**职责**:
- LLM stage 8 触发时, 判断 query 复杂度
- 调小 LLM (e.g. qwen-turbo, ~1¥/M tokens) 做"是否复杂"判断
- 简单 query → 用便宜 LLM (qwen-turbo / qwen-plus)
- 复杂 query → 用贵 LLM (claude-3.5-sonnet / qwen-max)
- 节省成本 ~60-80% (大部分 query 是简单的)

**依赖**: 现有 `common/llm_router.py` (含 SLOT.MAPPER / SLOT.CHAT)

### 4.3 C3 NLP 高级 (nlp/)

**3 文件**:
- `preprocessor.py`: query 字符串规范化 (繁→简, 全角→半角, 标点统一), 时间归一化 ("昨天" → "2026-04-29"), 工厂代号识别 (F001 提取)
- `semantics_parser.py`: 语义结构 (主体/动作/对象 SVO), L1/L2/L3 域分类
- `corref_spell.py`: 代词消解 ("它"指代上轮 entity), 拼写纠正 (基于 intent_configs.keywords + 编辑距离 ≤ 2)

**依赖**: 独立, 可纯 Python 实现 (不调外部服务)

### 4.4 C4 校准/打分 (scoring/)

**2 文件**:
- `calibration.py`: 各 stage 的 raw confidence 归一化 (Platt scaling: sigmoid(α·raw + β), α/β 系数从历史数据拟合, 启动时加载, 5 min refresh)
- `intent_scoring.py`: 综合分 = w1·calibrated_confidence + w2·matched_keyword_count + w3·priority + w4·confidence_boost. 用于多 candidate 排序

**依赖**: 历史校准数据 (新表 `intent_calibration_coeffs` 或复用 `ai_intent_configs.metadata` JSON 字段)

### 4.5 C5 RAG 历史检索 (rag/)

**2 文件**:
- `retrieval.py`: 检索历史 (query, intent_code, confidence) 三元组. PG 表 `intent_history`, 字段 `(id, query, query_embedding, intent_code, confidence, created_at, factory_id)`. pgvector 索引在 query_embedding. top-k 通过余弦相似度返回 (k=5).
- `evaluator.py`: CRAG 评估检索结果. 启发式: top-1 相似度 > 0.85 → 高质量; 0.7-0.85 → 中等; < 0.7 → 不可信. 高质量直接增强 LLM prompt; 不可信跳过 RAG.

**依赖**: 新 PG 表 `intent_history` (Flyway migration), pgvector adapter (B1 已 register)

**新建表 SQL** (Flyway V20260501_01__intent_history.sql):
```sql
CREATE TABLE intent_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    query_embedding VECTOR(768),
    intent_code VARCHAR(50) NOT NULL,
    confidence REAL,
    factory_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_history_embedding ON intent_history USING ivfflat (query_embedding vector_cosine_ops);
CREATE INDEX idx_history_factory ON intent_history (factory_id);
```

### 4.6 C6 ML 学习 (learning/)

**3 文件**:
- `keyword_learner.py`: 监听 IntentFeedbackService 写库事件 (or daily cron 扫 `intent_feedback` 表). 高置信度正反馈的 query → 提取 unseen keyword → 更新 `ai_intent_configs.keywords` JSON
- `expression_learner.py`: 完整 query 表达学习. 跟 keyword 区别: 保留语境上下文. 输出: 一组 `(intent_code, expression_template)` 写到新 `intent_expressions` 表
- `parameter_learner.py`: 学习参数提取规则. 输入: query + extracted_params 反馈. 输出: 正则/Jinja 模板, 命中后跳 LLM 直接抽参数. 写 `intent_param_rules` 表

**依赖**:
- 新表 `intent_expressions` (id, intent_code, expression, factory_id, learned_at)
- 新表 `intent_param_rules` (id, intent_code, pattern, factory_id, learned_at)
- 新表 `intent_feedback` (Java 写, Python 读) — 检查现有 schema 是否够用

### 4.7 OOD 检测

α §3.2 提到 `SemanticMatchingService.v35.0 OOD detection` (Out-of-Distribution). β C1 实现 `semantic_router.py` 时**包含 OOD 检测分支**: 若 query 跟所有 intent 相似度都 < 0.3 → 返 `RouteDecision(method=OOD_REJECT, ...)`, orchestrator 跳过所有 stage 直接返 ASK_USER.

---

## 5. API Contract 变化

### 5.1 Request (无变化)

`POST /api/ai/intent/match` 仍是 α §5.2 同 contract: `{query, factoryId, userId, role, businessType, history?, options?}` + headers `X-Internal-Secret` + `X-Factory-Id`.

### 5.2 Response (新增可选字段)

α 响应 19 字段不变. β **新增可选字段** (Java DTO 不需要立即解析, 可前向兼容):

```json
{
  "data": {
    ... (α 19 fields) ...
    "routerDecision": "DIRECT_EXECUTE" | "NEED_RERANKING" | "NEED_FULL_LLM" | "OOD_REJECT",
    "complexityLevel": "simple" | "complex" | null,
    "calibratedConfidence": 0.91,
    "ragRetrievalUsed": true | false
  }
}
```

Java `IntentMatchResult.java` 加 4 个 `@JsonInclude(NON_NULL)` 字段以接住, 但 `IntentExecutorService` 不依赖它们 (UX 显示用, 非 dispatch 用).

---

## 6. 错误处理 + 回退

### 6.1 继承 α (不变)

- Resilience4j circuit breaker on Java client (5s window, 3 failures → open 5s, fallback to legacy)
- Feature flag `ai.use-python-matcher` default false
- α legacy code retained until Phase 3
- Connection pool + timeouts unchanged

### 6.2 β 新增: 各子组 graceful degrade

每个子组失败应**降级 not 阻塞**:

| 子组 | 失败模式 | 降级 |
|---|---|---|
| C1 SemanticRouter | embedding 失败 / DB 拉不到 intent embeddings | 跳过 router, 走 stage 5+6+7+8 全跑 (相当于 α 流程) |
| C2 ComplexityRouter | small LLM 超时 / 失败 | 默认走"复杂"路径用贵 LLM (保安全) |
| C3 NLP | preprocessor 异常 | 用原始 query, 不预处理 |
| C4 Calibration | 校准系数缺失 | 用 raw confidence, 不归一化 |
| C5 RAG | 检索失败 / 评估失败 | 跳 RAG 增强, LLM prompt 不带历史 |
| C6 Learning | 写库失败 | 异步任务记 log, 不影响响应 |

---

## 7. 测试策略

### 7.1 继承 α (不变)

- F999 byte-shape gate (空 visible_intents, IntentMatchResult.empty())
- F001 byte-shape gate (populated bestMatch + topCandidates)
- 各 matcher unit test
- pytest in `tests/python/ai/`

### 7.2 β 新增

- `tests/python/ai/test_router_semantic.py`: 三级路由阈值边界 (0.92, 0.75 boundaries)
- `tests/python/ai/test_router_complexity.py`: simple/complex 分类正确, LLM 选择正确
- `tests/python/ai/test_nlp_preprocessor.py`: 时间归一化, 工厂代号提取, 拼写纠正
- `tests/python/ai/test_scoring_calibration.py`: Platt scaling 数值正确
- `tests/python/ai/test_rag_retrieval.py`: pgvector 检索 top-k 正确, factory_id 隔离
- `tests/python/ai/test_rag_evaluator.py`: CRAG 三档评估
- `tests/python/ai/test_learning_keyword.py`: 反馈→关键词提取正确
- `tests/python/ai/test_learning_expression.py`: 表达模板生成
- `tests/python/ai/test_learning_parameter.py`: 参数规则学习

**新 byte-shape fixture**:
- `tests/fixtures/java-intent-golden/F002-direct-execute.json`: SemanticRouter ≥0.92 路径 (新 routerDecision 字段 = "DIRECT_EXECUTE")
- `tests/fixtures/java-intent-golden/F003-rag-enhanced.json`: stage 8 LLM + RAG retrieval 路径

### 7.3 整合测试

- `tests/python/ai/test_orchestrator_beta.py`: 端到端 6 子组串联, 验证降级路径
- Java parity test (α `IntentParityTest`) 新增 ~10 cases 覆盖 β 路由路径

---

## 8. Rollout

### 8.1 Wave 时间线

| Wave | 子组 | 文件 | 估时 | 依赖 |
|---|---|---|---|---|
| **W0 准备** | 读 Java 源码, 验证 schema, 整理 7 service 真实接口 | — | ~4h | — |
| **W1** | C1 语义路由 | semantic_router.py + 改 orchestrator (前置) | ~12h | α SemanticMatcher |
| **W2** | C2 复杂度路由 | complexity_router.py | ~10h | α llm_router |
| **W3** | C3 NLP | preprocessor + parser + corref/spell | ~14h | 独立 |
| **W4** | C4 校准/打分 | calibration + scoring | ~8h | 全 matcher 输出 |
| **W5** | C5 RAG | retrieval + evaluator + Flyway migration | ~12h | embedding (α 已 wire) |
| **W6** | C6 ML 学习 | 3 learner + Flyway migrations + feedback intake 接口 | ~20h | DB write |
| **W7 整合** | orchestrator 串联全 6 子组 + 端到端测试 + Java DTO 加新字段 | — | ~10h | W1-W6 |
| **W8 Cleanup** | 删 Java 13 legacy services + 单测 + 文档 | — | ~8h | W7 verified |

**总: ~98h**, 跟 α 同 subagent-driven 模式 1.5-2 天 ship.

### 8.2 部署 + Flag flip

- α + β 一起 deploy (test env first, flag default OFF)
- 1 周 test env soak with flag ON (这次真做)
- prod flip (flag ON in prod)
- 1 周 prod canary
- 满足 acceptance criteria 后 Phase 3 启动

---

## 9. Concurrent Edit Safety

### 9.1 Worktree 隔离

- β worktree: `.worktrees/phase2b-beta` (already created)
- 分支: `phase2b/beta-implementation`
- Sibling chats: Phase 2A 仍在 `.worktrees/phase2a-finance-profit` / `phase2a-sales-rankings` / `phase2a-sales-trend` 工作 — 严禁碰其 worktree

### 9.2 共享文件冲突 (轻)

| 文件 | 冲突级别 | 缓解 |
|---|---|---|
| `backend/python/main.py` | 低 (Phase 2A 加 sub-spec router; β 不加新 router, 只内部连 ai/router/) | 不冲突 |
| `backend/python/requirements.txt` | 低 (β 可能加 NLP 包如 `jieba`) | 字母序插入 |
| Flyway migrations | 中 (β 加 V20260501_xx 系列, sibling chat 也可能加 V20260501_xx) | 不同 timestamp/序号. β 用 V20260501_10+ 留间距 |

### 9.3 Commit 规则

- 每子组单独 commit (`safe-commit.sh` --only mode)
- 推迟 main.py 改动到 W7 整合
- Flyway migration 各自单独 commit (一 migration 一 commit)

---

## 10. 开放问题 / 风险

| # | 问题 | 应对 |
|---|---|---|
| R1 | Calibration 系数从哪来? 没有历史数据怎么 cold-start? | W4 实现时: 默认 α=1.0, β=0 (无校准). prod 跑 1 周后从历史 PR# 拟合, 写新 migration update |
| R2 | RAG `intent_history` 表 cold-start 也是空的, RAG 第一周无效 | 接受 — RAG 是积累型功能, 慢慢就有数据. evaluator 自然返"不可信"跳过 |
| R3 | Learning 反馈数据来源 — `intent_feedback` 表存在吗 schema 够吗 | W0 验证 — 不够则 W6 加新 migration |
| R4 | Java legacy 13 服务删除的影响 — 有没有外部 caller? | W8 删除前 grep 验证. 可能某些 Tool 还在 import — 一并处理 |
| R5 | `corref_spell.py` 拼写纠正基于编辑距离, 中文效果差 — 需要 BERT-based? | W3 先做编辑距离版 (5h), 跑实测再决定要不要升 BERT |
| R6 | OOD 检测阈值 0.3 是猜的, 真实需要标注 OOD set 调参 | β 用 0.3 默认, post-deploy 收集真实 OOD 案例调参 |
| R7 | Complexity router 调小 LLM 自己也是 LLM 调用, 净节省? | W2 验证: small LLM 单次 ~0.001¥, 复杂 LLM 单次 ~0.05¥. 50× 差距. 即使 100% query 都过 small LLM, 仍净节省. |
| R8 | Phase 2A sibling chats 还在并行做 sub-specs (rankings/trend/finance-profit) — main.py 频繁更新 | W7 改 main.py 前 git fetch + diff 看 sibling 状态, 必要时 rebase β 上去 |
| R9 | Calibration 方案 Platt scaling vs Isotonic regression — 简单 vs 准确 | β 先 Platt (3 行 sigmoid), prod 数据足够后再考虑升 Isotonic |
| R10 | β 加 4 字段到 IntentMatchResult Java DTO — 触发 byte-shape gate 不通过? | F999/F001 fixture 加新字段 (默认 null), JsonInclude.NON_NULL 自动跳 null. 不破坏 |

---

## 11. 命名约定

- Python 子模块: `backend/python/ai/{router,nlp,scoring,rag,learning}/`
- Java 删除批: 13 个 service files (W8 详细列)
- Branch: `phase2b/beta-implementation`
- Worktree: `.worktrees/phase2b-beta`
- Spec: `docs/superpowers/specs/2026-04-30-phase2b-beta-design.md`
- Plan: `docs/superpowers/plans/2026-04-30-phase2b-beta-implementation-plan.md`

---

## 12. 实施门槛

**绝对 no-go (ship 失败重做)**:
- F999 + F001 + F002 + F003 byte-shape gate 任意失败
- α 现有 60+ 测试退化
- Java AIIntentServiceContextTest 退化
- 任何 cross-tenant 数据泄露 (RAG factory_id 隔离要严)
- Flyway migration 失败

**Soft 标准 (可妥协)**:
- 各子组 unit test ≥ 95%
- contract test 1 个 fail 可手修复
- Calibration 校准系数 cold-start 用默认值 (α=1, β=0)

---

## 13. 不在本 spec 决定的事 (留给 writing-plans)

- 各子组具体 Python 实现细节
- Java legacy 13 服务的精确删除清单 (W0 验证 import)
- Flyway migration 序号 (V20260501_10+ 起)
- `intent_feedback` 表 schema 检查 (W0 任务)
- requirements.txt 新依赖 (β 可能加 jieba 中文分词 / sklearn 校准)
- 各 wave 的具体 commit 拆分粒度

---

## 14. 决策记录

| 决策 | 选项 | 锁定 |
|---|---|---|
| Q0 部署策略 | A 先 deploy α / B 同时建 β 一起 deploy / C hybrid | **B** (动量优先) |
| Q1 范围 | I 缩到 8 文件 / II 全 15 文件 | **II** (verify 后撤销 defer) |
| Q2 优先级 | 6 子组顺序 | **C1→C2→C3→C4→C5→C6** (按 ROI) |
| Layout | 平铺 vs 子目录 | **子目录** (router/nlp/scoring/rag/learning) |
| Wave 顺序 | 按依赖 | W1 router 先 (前置 orchestrator), W6 learning 最后 |
| 部署节奏 | 跟 α 同时 / 单独 | **跟 α 同 deploy** (test env soak 1 周后 prod flip) |

---

## 文档结束

**下一步**: 用户 review v1 → invoke `superpowers:writing-plans` 生成实施计划.
