# Phase 2B — AI 计算密集层下沉 Python (设计 Spec)

**Date**: 2026-04-29
**Author**: brainstormed with Steve via superpowers:brainstorming, audited via superpowers:requesting-code-review
**Status**: Spec amended post-audit (v2) — pending user review then writing-plans
**Branch**: `phase2b/ai-intent-migration`
**Worktree**: `.worktrees/phase2b-ai-intent-layer`
**Sibling work**: Phase 2A `/analysis/sales` byte-shape port runs in parallel at `.worktrees/phase2a-t5-poc` (do not touch)

---

## 修订历史

- **v1 (2026-04-29 初稿)**: 11 文件迁移, 估时 ~102h. **审计抓到 5 个 critical**: API contract 严重缩水, ai_intent_config 是 factory-scoped 写错成全局, golden 数从 51 实际 200-450, AI service 文件 45+ 不是 20+, /api/ai/ JWT 风险.
- **v2 (本稿)**: 改为按"计算密集 vs 调度业务"原则划分 Bucket A (搬 Python ~22-25 文件) + Bucket B (留 Java ~18-22 文件) + Bucket C (待定 ~5 文件). API contract 全字段对齐 IntentMatchResult. JWT 用现有 INTERNAL_API_SECRET + X-Factory-Id 模式. Golden 改用 sampling 策略. 估时 ~190-220h.

---

## 1. 背景与动机

### 1.1 现状

Cretas 后端的 AI 意图识别系统当前 100% 在 Java (Spring Boot, 端口 10010), AI service 层有 **45+ 个文件**, 跨多个子包:

**核心调度 (`service/`)**:
- `AIIntentService` + Impl, `IntentExecutorService` + Impl, `ToolRouterService` + Impl, `IntentExecutionOrchestrator`, `MultiIntentExecutionService`, `ToolDispatchService`, `DynamicToolSelectionService`, `IntentRecognitionPipelineService`, `SseStreamingService`

**意图匹配 (`service/intent/`)**:
- `IntentConfigManagementService`, `IntentScoringService`, `IntentPreprocessor`, `PhraseMatchingService`, `SemanticMatchingService`, `IntentFeedbackLearningService`

**计算密集 / ML / LLM (大部分)**:
- `SemanticIntentMatcher`, `ClassifierIntentMatcher`, `MultiLabelIntentClassifier`, `TwoStageIntentClassifier`, `LlmIntentFallbackClient`
- `IntentEmbeddingCacheService`, `SemanticCacheService`, `RequestScopedEmbeddingCache`, `EmbeddingClient`
- `SemanticRouterService`, `SemanticMatchingService`, `RAGRetrievalService`, `RetrievalEvaluatorService`
- `SmallLlmComplexityDetector`, `ComplexityClassifier`, `ComplexityRouter`
- `ConfidenceCalibrationService`, `IntentScoringService`
- `IntentSemanticsParser`, `QueryPreprocessorService`
- `KeywordLearningService`, `ExpressionLearningService`, `ParameterExtractionLearningService`
- `CoreferenceResolutionService`, `SpellCorrectionService`, `DialectNormalizationService`, `SlotExtractor`, `SlotFillingService`

**业务/状态机/CRUD**:
- `IntentDisambiguationService`, `IntentFeedbackService`, `SmartClarificationService`
- `KeywordEffectivenessService`, `KeywordPromotionService`
- `ResultFormatterService`, `ResultValidatorService`
- `AIIntentDomainDefaultService`

### 1.2 8-stage 意图匹配 pipeline

| Stage | 方法 | 耗时 | MatchMethod enum 值 |
|---|---|---|---|
| 1 EXACT | hash 表完全匹配 | < 1ms | EXACT |
| 2 PHRASE_MATCH | 关键短语对照 | < 1ms | PHRASE_MATCH |
| 3 REGEX | 正则规则 | < 1ms | REGEX |
| 4 KEYWORD | 关键词打分 | 1-2ms | KEYWORD |
| 5 SEMANTIC | pgvector 相似度 | 50-200ms | SEMANTIC |
| 6 CLASSIFIER | ONNX BERT 分类 | 100-300ms | CLASSIFIER |
| 7 FUSION | 5 + 6 加权融合 | ~5+6 | FUSION |
| 8 LLM | 大模型兜底 | 5-15 秒 | LLM |
| (其他) | 相似 / 域默认 / 拒绝 / 无匹配 | — | SIMILAR / DOMAIN_DEFAULT / REJECTED / NONE |

注意 `MatchMethod` enum 实际 **12 值** — Python 端必须支持全部, 不能缩减为 4 个.

### 1.3 Python 侧已有底子

- `backend/python/classifier/` — ONNX BERT intent 分类 (Java stage 6 已通过内部接口调它)
- `backend/python/llm/` — LLM client (DashScope/Anthropic/OpenAI fallback chain)
- `backend/python/chat/` — AI 对话 (drill-down/hierarchy)
- `backend/python/food_kb/` — RAG with pgvector
- `backend/python/smartbi/` 相关 AI 服务

### 1.4 痛点

1. **Java AI 层有循环依赖**: `AIIntentService → LlmFallbackClient → ToolRegistry → Tool → AIIntentService`. 当前用 `@Lazy` 绕开, 不是结构性解决.
2. **Python AI 生态领先**: LangChain / LlamaIndex / Pydantic AI / async LLM SDK / 流式 tool-calling parser / NLP 库 (spaCy, jieba, transformers) 都是 Python 原生.
3. **Python AI 模块碎片化**: `classifier/`, `chat/`, `llm/`, `food_kb/` 各自独立.
4. **迭代速度**: Python 改完即生效, Java 要 Maven 重打 jar.

### 1.5 目标 (用户 driver)

- **(i) 现代化** — 拥抱 Python LLM/NLP/ML 生态
- **(iv) 整合 Python AI 计算层** — 把 Java AI 层中**计算密集**和 **Python 生态本来就强**的部分下沉到 Python; 调度 / 执行 / 业务 CRUD 留 Java

**注意**: v1 spec 把 (iv) 描述为"整合所有 Python AI 碎片", 这是夸大. 实际 Java 还会保留 ~18-22 个调度/CRUD/UX 文件. (iv) 准确 claim 应该是 **"计算层下沉, 不是全 AI 下沉"**.

---

## 1.6 Scope reduction history

用户原 prompt 写: "Phase 2B: Java AI Tool-Skill 架构 → Python 镜像迁移 ... skill tool 相关的就是很重要的".

经过 brainstorming 对话:
1. 先排除 Tool/Skill 镜像 (Q0+Q1) — 因为 402 Tool 是 JPA-backed Java service 的薄壳, 搬过去要么 HTTP 回调 (双系统永存) 要么重写整个业务逻辑 (~600-1000h). 用户接受**只搬 AI 编排不搬 Tool/Skill**.
2. v1 spec 只搬 8-stage 11 文件 — 审计发现 Java AI 层实际 45+ 文件, "整合 Python AI" claim 站不住.
3. v2 (本稿) 改为按"计算密集 vs 调度业务"划分:
   - **Bucket A** (~22-25 文件) 搬 Python — 计算密集 / ML / LLM / 向量 / NLP 高级
   - **Bucket B** (~18-22 文件) 留 Java — 调度 / 执行 / CRUD / 交互 UX
   - **Bucket C** (~5 文件) writing-plans 阶段读源码再分

最终性质: **Phase 2B 是把 Java AI 层中"算法/学习/推理"那一半搬到 Python, 留下"业务/调度/状态"那一半在 Java**. 不是镜像 Tool/Skill, 也不是全 AI 下沉.

---

## 1.7 范围声明

**In scope (本 Phase 2B):**
- Bucket A 22-25 个 Java AI service 文件下沉 Python
- Java `AIIntentService` 退化为薄客户端 (调 Python REST)
- Java 加 `IntentResultCache` (Caffeine LRU) + Resilience4j circuit breaker
- Feature flag `ai.use-python-matcher` 控制切流
- Contract test (sampling 策略, 不是 51) 保证语义不变
- Phase 拆为 α (核心 8-stage 11 文件) + β (向量/RAG/NLP/校准 11-14 文件)

**Out of scope:**
- 402 个 Tool 实现 — **保留在 Java**
- 16 个内置 Skill — **保留在 Java**
- `IntentExecutorService` 4-branch dispatch — **保留在 Java**
- `ToolRouterService` 动态 Tool 选择 — **保留在 Java**
- Bucket B 全部 18-22 个文件 (调度 / CRUD / UX) — **保留在 Java**
- Java `embedding-service` (gRPC 端口 9090) — **保留** (Python 调它)
- Java 域 Service (MaterialBatchService 等 JPA backed) — **永不动**
- `backend/python/smartbi_compat/` — **兄弟 chat 领地, 严禁碰**
- `backend/python/smartbi/` — **不动**
- `backend/python/auth_middleware.py` — 沿用现有 (但 §5.2 用现有 INTERNAL_API_SECRET 模式)

---

## 2. 决策记录

| 决策 | 选项 | 锁定 | 理由 |
|---|---|---|---|
| **Q0**: 为什么搬 | (i)+(iv) 现代化 + 整合 Python 计算层 | 锁 | 用户 driver |
| **Q1**: 切分粒度 | (a+) 8 stage 全 Python + Java LRU 缓存 | 锁 | 真整合, 缓存抵 5-10ms HTTP |
| **Q2**: 第一阶段范围 | α POC stage 5-8 先 / β 一次搬全 | **α** | 风险减半, 价值 80% 集中在 stage 5-8 |
| **Q3**: 总体范围划分 | 只 11 文件 / 全 45 文件 / 按 Bucket | **按 Bucket A/B/C** | 计算搬, 业务留, 诚实可执行 |
| 细节 1: DB | `ai_intent_config` 双写 / Python 只读 | **Python 只读, factory_id + business_type 过滤, 软删 honor** | web-admin 写走 Java, RLS 兼容 |
| 细节 2: Embedding | 搬 / 留 | **留 Java gRPC :9090** | 已稳, Python 调它 |
| 细节 3: 现有 Python 模块 | 大重构合并 / 加新模块 | **加新 `ai/`** | 不破坏现有, 内部 import |
| 细节 4: 部署 + 回滚 | feature flag / 直切 | **flag `ai.use-python-matcher`** | 即时回 Java |
| 细节 5: 认证 | body factoryId / JWT / 内部 secret | **`X-Internal-Secret` + `X-Factory-Id` 头 (现有模式)** | 复用 auth_middleware.py 现有内部调用机制 |
| 细节 6: Cache 失效 | 5min TTL / pub-sub / 配置版本号 | **配置版本号 + 失效 endpoint** | 见 §6 |
| 细节 7: Circuit breaker | 自撸 AtomicInteger / Resilience4j | **Resilience4j** | 已在 Spring Boot classpath, 工业级 |

---

## 3. Bucket 划分

### 3.1 Bucket A — 搬 Python (~22-25 文件) — Python 真的强

| 子组 | 文件 | Python 优势 |
|---|---|---|
| **8-stage 5-8 核心** (Phase 2B-α) | `SemanticIntentMatcher`, `ClassifierIntentMatcher`, `MultiLabelIntentClassifier`, `TwoStageIntentClassifier`, `LlmIntentFallbackClient` | LLM SDK / ONNX / 向量 |
| **向量/Embedding** (α) | `IntentEmbeddingCacheService`, `SemanticCacheService`, `RequestScopedEmbeddingCache`, `EmbeddingClient` | numpy/向量 |
| **复杂度判定** (β) | `SmallLlmComplexityDetector`, `ComplexityClassifier`, `ComplexityRouter` | 小 LLM |
| **语义路由** (β) | `SemanticRouterService`, `SemanticMatchingService` | 语义 |
| **RAG** (β) | `RAGRetrievalService`, `RetrievalEvaluatorService` | LangChain |
| **NLP 处理** (β) | `IntentSemanticsParser`, `IntentPreprocessor`, `QueryPreprocessorService` | spaCy/jieba |
| **校准/打分** (β) | `ConfidenceCalibrationService`, `IntentScoringService` | sklearn/numpy |
| **学习抽取 ML** (β) | `ParameterExtractionLearningService`, `ExpressionLearningService`, `KeywordLearningService` | sklearn |

α 阶段共 11 文件, β 阶段共 11-14 文件.

### 3.2 Bucket B — 留 Java (~18-22 文件) — 业务/调度/UX

| 子组 | 文件 | 为什么留 |
|---|---|---|
| **核心调度** | `AIIntentService` (薄壳化), `IntentExecutorService` + Impl, `IntentExecutionOrchestrator`, `MultiIntentExecutionService`, `ToolRouterService` + Impl, `ToolDispatchService`, `DynamicToolSelectionService`, `IntentRecognitionPipelineService` | 执行 Java Tool/Skill |
| **流式输出** | `SseStreamingService` | Java REST 紧耦合 |
| **配置 CRUD** | `IntentConfigManagementService`, `AIIntentDomainDefaultService` | DB 写 + factory_id RLS |
| **反馈学习写库** | `IntentFeedbackService`, `IntentFeedbackLearningService`, `KeywordEffectivenessService`, `KeywordPromotionService` | 业务 DB 写, RLS 隔离 |
| **交互 UX** | `IntentDisambiguationService`, `SmartClarificationService` | 多轮对话状态机 |
| **结果格式化** | `ResultFormatterService`, `ResultValidatorService` | 格式化为 Java 类型 |
| **短语匹配** (Java 内嵌, 非 ML) | `PhraseMatchingService` | Java 字符串处理够用 |

### 3.3 Bucket C — 边界模糊 (~5 文件) — writing-plans 读源码再分

需要 writing-plans 阶段读源码再决定:
- `SpellCorrectionService` — 规则表? 还是 BERT? 后者搬 Python
- `DialectNormalizationService` — 同上
- `SlotExtractor` / `SlotFillingService` — 规则? ML NER?
- `IntentSemanticsParser` (重复, 已在 A) — 看具体实现

writing-plans 第一步: 读这 5 个文件源码, 二选一 (放 A or 放 B), 锁入 spec amendment.

---

## 4. 架构

### 4.1 Phase 2B-α 期间数据流 (stage 5-8 + 向量 在 Python)

```
用户 query: "查 F001 工厂海南店本月营收同比"
       │
       ▼
┌─────────────────── Java (10010) ────────────────────┐
│ AIIntentService.match(query, ctx)                   │
│  ├─ Stage 1 EXACT     hash 查表  < 1ms  ─ miss      │
│  ├─ Stage 2 PHRASE    短语对照  < 1ms  ─ miss       │
│  │   (PhraseMatchingService — Bucket B 留 Java)     │
│  ├─ Stage 3 REGEX     正则      < 1ms  ─ miss       │
│  ├─ Stage 4 KEYWORD   关键词    1-2ms  ─ miss       │
│  └─ IntentResultCache.get(key)         ── miss      │
│                                                      │
│  Java→Python 出站 headers:                          │
│   X-Internal-Secret: ${INTERNAL_API_SECRET}         │
│   X-Factory-Id: F001                                │
└──────────┬──────────────────────────────────────────┘
           │ HTTP POST localhost:8083
           │ /api/ai/intent/match
           │ (内部调用, 走 INTERNAL_API_SECRET 通道)
           ▼
┌──────────── Python (8083) ──────────────────────────┐
│ JWTAuthMiddleware:                                  │
│  ├─ /api/ai/* in PUBLIC_PREFIXES — 跳过 JWT          │
│  ├─ 但 X-Internal-Secret 校验通过                    │
│  └─ X-Factory-Id 写入 contextvar (RLS 用)           │
│                                                      │
│ POST /api/ai/intent/match handler                   │
│  ├─ Stage 5 SEMANTIC   pgvector 相似度 50-200ms     │
│  │   └─ confidence > 0.85? → 直接 return            │
│  ├─ Stage 6 CLASSIFIER ONNX BERT 100-300ms          │
│  │   └─ wrap 现有 classifier/                        │
│  ├─ Stage 7 FUSION     5+6 加权融合                  │
│  │   └─ fused_confidence > 0.7? → return            │
│  └─ Stage 8 LLM        DashScope/Anthropic 5-15s    │
│      └─ wrap 现有 llm/                               │
└──────────┬──────────────────────────────────────────┘
           │ HTTP 200
           │ Body: 完整 IntentMatchResult JSON (§5.3)
           ▼
┌─────────────────── Java ─────────────────────────────┐
│ IntentResultCache.put(key, result)  TTL 5min         │
│ IntentExecutorService.dispatch(result)               │
│  ├─ Tool 直接执行 (402 Tools 在 Java)                │
│  ├─ Skill 编排执行 (16 Skill 在 Java)                │
│  ├─ ToolRouter 动态选择                              │
│  └─ 无匹配 → IntentDisambiguationService 澄清流程    │
└──────────────────────────────────────────────────────┘
```

**热路径性能**:
- Stage 1-4 命中: **0 延迟** (跟现在一样, Java 内嵌)
- Stage 1-4 miss + cache 命中: **0 延迟**
- Stage 1-4 miss + cache miss: +5-10ms HTTP loopback (需 connection pooling, 见 §6.1)

### 4.2 Phase 2B-β 期间数据流 (新增 RAG/NLP/校准 也下沉)

α 之上新增:
- 复杂度判定 (Java 入口决定走快路径还是 RAG/LLM 重路径) — 由 Python 替代
- RAG 检索 (Python 自然原生)
- NLP 高级 (代词消解 / 拼写纠正 / ...) — Python 调用
- 置信度校准 — Python 接管, Java 拿到的是已校准 confidence

Java 仍主导 dispatch + Tool 执行.

### 4.3 Phase 3 终态 (stage 1-4 也搬 Python)

POC + α + β 全部稳定 1 周 0 fallback 后, Phase 3:
- stage 1-4 也搬 Python (短语匹配 PhraseMatchingService 一并迁, Bucket B 移到 A)
- Java AIIntentService 收敛到 ~30 行薄客户端
- Java AI service/ 文件减少 22-25 个, 留 ~20 个 (主要是 dispatch + UX + CRUD)

---

## 5. API Contract — Java ↔ Python

### 5.1 Endpoint

```
POST http://localhost:8083/api/ai/intent/match
Content-Type: application/json
X-Internal-Secret: ${INTERNAL_API_SECRET}   # 必填
X-Factory-Id: F001                           # 必填
```

### 5.2 认证模型 (锁定决策, 修 audit C5)

**复用现有 `auth_middleware.py:117-145` 的 INTERNAL_API_SECRET 通道**:
- `/api/ai/intent/match` 在 PUBLIC_PREFIXES 中, 跳过 JWT
- Java 必须发 `X-Internal-Secret` 头, Python 校验匹配 `INTERNAL_API_SECRET` 环境变量
- Java 必须发 `X-Factory-Id` 头, Python 写入 `tenant_ctx.set_factory_id()` contextvar (RLS 借此过滤)
- 缺失任一头 → Python 拒绝 (auth fail)

**Java 侧实现** (`PythonAiMatcherClient`):
```java
@Value("${cretas.python.internal-secret}")
private String internalSecret;

public IntentMatchResult match(String query, String factoryId, String userId, ...) {
    HttpHeaders headers = new HttpHeaders();
    headers.set("X-Internal-Secret", internalSecret);
    headers.set("X-Factory-Id", factoryId);
    // ...
}
```

**Body 中的 factoryId 仅作回送验证** (Python 校验 body.factoryId == header X-Factory-Id, 不一致 reject).

### 5.3 Request body

```json
{
  "query": "查 F001 工厂海南店本月营收同比",
  "factoryId": "F001",
  "userId": "22",
  "username": "admin",
  "role": "factory_super_admin",
  "businessType": "FACTORY",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "options": {
    "enableLlmFallback": true,
    "timeoutMs": 30000,
    "minConfidence": 0.7,
    "intentConfigVersion": 12345
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| query | yes | 用户自然语言 |
| factoryId | yes | 多租户隔离, 必须等于 header X-Factory-Id |
| userId | yes | 反馈学习用 |
| username | yes | 日志/审计 |
| role | yes | 权限 (filter required_roles) |
| businessType | yes | "COMMON" / "FACTORY" / "RESTAURANT" — 用于 ai_intent_configs 业态过滤 |
| history | no | 上下文对话 (≤10 轮), stage 8 LLM 用 |
| options.enableLlmFallback | no, default true | 允许 stage 8 |
| options.timeoutMs | no, default 30000 | 总超时 |
| options.minConfidence | no, default 0.7 | 低于此阈值返 LOW_CONFIDENCE |
| options.intentConfigVersion | no | Java 当前 cache 的 ai_intent_configs 版本号. 若 Python 已加载更新版本, 提示 Java invalidate (见 §6.4) |

### 5.4 Response body — 完整对齐 IntentMatchResult.java (修 audit C1)

```json
{
  "success": true,
  "data": {
    "bestMatch": {
      "id": "uuid-xxx",
      "intentCode": "FINANCE_REVENUE_YOY_QUERY",
      "intentName": "营收同比查询",
      "intentCategory": "ANALYSIS",
      "sensitivityLevel": "MEDIUM",
      "factoryId": null,
      "businessType": "COMMON",
      "toolName": "finance_revenue_yoy_analysis",
      "handlerClass": null,
      "requiredRoles": "[\"factory_super_admin\",\"manager\"]",
      "quotaCost": 1,
      "cacheTtlMinutes": 30,
      "requiresApproval": false,
      "approvalChainId": null,
      "keywords": "[\"营收\",\"同比\"]",
      "negativeKeywords": null,
      "regexPattern": null,
      "description": "...",
      "exampleQueries": "[...]",
      "negativeExamples": null,
      "maxTokens": 2000,
      "responseTemplate": null,
      "isActive": true,
      "priority": 80,
      "metadata": null,
      "chartType": "line_chart",
      "requiredEntities": "[\"time\",\"region\",\"metric\"]",
      "confidenceBoost": "0.10",
      "configVersion": 12345,
      "semanticDomain": "FINANCE",
      "semanticAction": "QUERY",
      "semanticObject": "REVENUE",
      "semanticPath": "FINANCE.QUERY.REVENUE"
    },
    "topCandidates": [
      {
        "intentCode": "FINANCE_REVENUE_YOY_QUERY",
        "intentName": "营收同比查询",
        "intentCategory": "ANALYSIS",
        "confidence": 0.91,
        "matchScore": 95,
        "matchedKeywords": ["营收", "同比"],
        "matchMethod": "FUSION",
        "description": "..."
      },
      {
        "intentCode": "FINANCE_REVENUE_QUERY",
        "intentName": "营收查询",
        "intentCategory": "ANALYSIS",
        "confidence": 0.74,
        "matchScore": 70,
        "matchedKeywords": ["营收"],
        "matchMethod": "FUSION",
        "description": "..."
      }
    ],
    "confidence": 0.91,
    "matchMethod": "FUSION",
    "matchedKeywords": ["营收", "同比"],
    "isStrongSignal": true,
    "requiresConfirmation": false,
    "clarificationQuestion": null,
    "userInput": "查 F001 工厂海南店本月营收同比",
    "actionType": "QUERY",
    "questionType": "OPERATION",
    "targetEntity": null,
    "sessionId": null,
    "conversationMessage": null,
    "isMultiIntent": false,
    "additionalIntents": [],
    "executionStrategy": null,
    "timingMs": {
      "preprocessMs": 5,
      "matchMs": 240,
      "totalMs": 245
    },
    "preprocessedQuery": {
      "originalQuery": "...",
      "normalizedQuery": "...",
      "extractedSlots": { "factoryId": "F001", "store": "海南店", "period": "本月" },
      "timeNormalization": { "start": "2026-04-01", "end": "2026-04-30" },
      "coreference": null
    }
  },
  "message": "OK"
}
```

字段全部对齐 Java `IntentMatchResult.java`. Python 端用 Pydantic model 严格定义, JSON 结构跟 Jackson 序列化一致 (同 Phase 2A byte-shape 模式).

**Python Pydantic 模型** (`ai/dto.py`) 必须 1:1 映射:
- `IntentMatchResultDto` → IntentMatchResult
- `AIIntentConfigDto` → AIIntentConfig (30+ 字段)
- `CandidateIntentDto` → CandidateIntent
- `IntentMatchDto` → IntentMatch (multi-intent)
- `PreprocessedQueryDto` → PreprocessedQuery
- `MatchMethod` enum 12 值
- `ActionType` enum
- `QuestionType` enum
- `ExecutionStrategy` enum (multi-intent)

参考兄弟 chat Phase 2A `smartbi_compat/` 的 Java DTO 镜像模式.

### 5.5 错误响应

```json
{ "success": false, "data": null, "message": "...", "code": "..." }
```

| code | 含义 | Java 行为 |
|---|---|---|
| LOW_CONFIDENCE | 所有 stage confidence 低于 minConfidence | Java 启动 IntentDisambiguationService 澄清流程 |
| LLM_TIMEOUT | stage 8 超时 | Java 走 circuit breaker → fallback legacy |
| EMBEDDING_UNAVAILABLE | gRPC :9090 不通 | Python 自动降级 (跳 stage 5) |
| DB_UNAVAILABLE | ai_intent_configs 拉不到 | Python 用 snapshot, 200 但 debug warning |
| AUTH_INTERNAL_SECRET_MISMATCH | Java 没发或发错 X-Internal-Secret | Java 检查配置 |
| AUTH_FACTORY_ID_MISMATCH | header X-Factory-Id 与 body.factoryId 不一致 | Java 修复调用 |
| 5xx | 服务挂 | Java circuit breaker → fallback legacy |

---

## 6. 错误处理 + 回退 + Cache 失效

### 6.1 失败模式与应对

| 失败 | 检测 | 应对 |
|---|---|---|
| Python 服务挂 (8083 不通) | Resilience4j connect timeout 3s | Circuit breaker open 5s, Java fallback legacy |
| Python 总响应超时 (>30s) | Resilience4j read timeout | 同上 |
| Python 返 5xx | HTTP status check | 同上 |
| LLM (stage 8) 超时 | Python 内部 LLM client 已有 timeout 30s | Python 返 LOW_CONFIDENCE, Java 走澄清 |
| DB `ai_intent_configs` 拉取失败 | asyncpg connection error | Python 用启动时 snapshot, 日志 warning, 不阻塞请求 |
| Embedding 服务 gRPC :9090 挂 | grpc.RpcError | Stage 5 跳过, 落到 Stage 6 (CLASSIFIER) |
| Java cache miss + Python 失败 | Java 收到 fallback 信号 | 走 Java legacy stage 5-8 (POC 期间保留) |
| `classifier/` ONNX 模型加载失败 | 启动期 import error | Python 服务无法启动, 部署回滚 |
| **Python OOM (16GB box)** | 监控 RSS | 部署前 stress test 内存峰值, 加 swap warning |
| **gRPC :9090 冷启 (Restart=on-failure RestartSec=15)** | embedding-service 重启窗口 | Python 重试 3 次 each 1s 间隔, 仍失败降级 stage 6 |
| **ai_intent_configs 行数无限增长** | 启动期 row count check | 加 archived_at 字段 + purge cron (Phase 3 backlog) |
| **Phase 2A 共用 asyncpg pool 耗尽** | pool wait timeout | Phase 2A vs 2B 分独立 pool (在 main.py register 时各自 init) |

### 6.2 Circuit breaker — 用 Resilience4j (修 audit I2)

```java
// pom.xml 已含 resilience4j-spring-boot3 (验证), 否则加:
// <dependency>
//   <groupId>io.github.resilience4j</groupId>
//   <artifactId>resilience4j-spring-boot3</artifactId>
// </dependency>

// application.yml 配置:
resilience4j:
  circuitbreaker:
    instances:
      pythonAiMatcher:
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        failureRateThreshold: 60
        waitDurationInOpenState: 5s
        permittedNumberOfCallsInHalfOpenState: 3

// 使用:
@Component
public class PythonAiMatcherClient {

    @CircuitBreaker(name = "pythonAiMatcher", fallbackMethod = "matchFallback")
    public IntentMatchResult match(IntentMatchRequest request) {
        return restTemplate.postForObject(...);
    }

    public IntentMatchResult matchFallback(IntentMatchRequest request, Throwable t) {
        log.warn("Python AI matcher unavailable, fallback to legacy: {}", t.getMessage());
        return legacyAIIntentService.match(request);
    }
}
```

不再自撸 AtomicInteger. Resilience4j 是标准实现, 有 metric 暴露 + Prometheus.

### 6.3 HTTP 客户端 — 必须 connection pooling (修 audit I1)

```java
@Bean
public RestTemplate pythonAiRestTemplate() {
    PoolingHttpClientConnectionManager pool = new PoolingHttpClientConnectionManager();
    pool.setMaxTotal(50);
    pool.setDefaultMaxPerRoute(20);

    CloseableHttpClient httpClient = HttpClients.custom()
        .setConnectionManager(pool)
        .setKeepAliveStrategy((response, context) -> 30_000)
        .setDefaultRequestConfig(RequestConfig.custom()
            .setConnectTimeout(Timeout.ofSeconds(3))
            .setResponseTimeout(Timeout.ofSeconds(30))
            .build())
        .build();

    return new RestTemplate(new HttpComponentsClientHttpRequestFactory(httpClient));
}
```

POC 期间在 test env 实测 P50/P95 loopback latency, 确认 ≤ 5-10ms 假设. 否则调整设计.

### 6.4 Cache 失效 — 配置版本号机制 (修 audit I4 R1+R5)

**问题**: Java admin 改 `ai_intent_configs` (新增 / 改 keywords / 禁用 intent), Python 5min 内还用旧 snapshot, Java cache 5min 内还用旧 intentCode → dispatch 找不到该 intent → 失败.

**方案**: `AIIntentConfig` 已有 `config_version` 字段 (line 277, "每次修改自动递增").

实现:
- **Java 侧**: `IntentConfigManagementService.updateIntent()` 时 `configVersion += 1`, 同时 invalidate Java `IntentResultCache` (Caffeine cache.invalidateAll())
- **Java 侧出站**: 每次调 Python 时 request body 带 `options.intentConfigVersion = max(currentVersion across all configs)`
- **Python 侧**: 维护 `latestConfigVersion`. 收到请求若 `request.options.intentConfigVersion < latestConfigVersion`, 返回 200 但 header 带 `X-Config-Stale: true`
- **Java 侧入站**: 看到 `X-Config-Stale: true`, **不缓存**这次的 result + log warning + 触发 ai_intent_configs reload
- **Python 侧 reload 触发**: 暴露 `POST /api/ai/intent/cache/invalidate` (Internal-only), Java admin update 时主动 POST, Python 立即 reload

3 层防御:
1. 默认 5min Python 自动 refresh
2. config_version mismatch → 单次不缓存
3. 主动 invalidate endpoint → Java 改完立即推送

不需要 Redis pub/sub. 单进程 Python 简单.

### 6.5 Stage 1-4 命中率 — 数据采集 (修 audit I5)

v1 spec 假设 70-80% 命中 stage 1-4 是 unsourced. **Phase 2B-α W1 第一周必做**: 在 Java 现有 `AIIntentServiceImpl` 加 metric:
- 每次 match() 完成时 emit `intent.match.stage.{EXACT/PHRASE/REGEX/KEYWORD/SEMANTIC/...}` counter
- 跑 1 周 prod 流量
- W2 报告真实 hit rate distribution

如果 stage 1-4 真命中 < 50%, Q1 (a+) 缓存策略需要调整 (要么 Java 不再缓存所有 query, 要么 Python 内自己先做 stage 1-4).

### 6.6 回退原则

**POC 期间 (W1-W3)**: 任何 Python 失败 → fallback legacy Java code (旧代码物理保留, 不删).
**Phase 2 末 (W7)**: legacy 删除前必须满足:
- Test env 真实流量 1 周 0 fallback 触发
- Prod canary 24h 0 fallback 触发
- 满足后才能 PR 删除 Java legacy 代码

---

## 7. 测试策略

### 7.1 Contract test — sampling 策略 (修 audit C3)

**Golden corpus 实际规模**:

V9 测试套件方法计数 (`grep -c "@CsvSource\|@ParameterizedTest"`):
- IntentResponseE2EV9Test.java: 27 (parameterized methods)
- TwoStageIntentClassifierV9ComprehensiveTest.java: 18
- TwoStageIntentClassifierV9ComplexScenariosTest.java: 16
- TwoStageIntentClassifierV9SimulatedTest.java: 12
- TwoStageIntentClassifierV9Test.java: 2
- AIIntentServiceContextTest.java: 0 (用 @Test, 不是 parameterized)

每 parameterized 方法对应 ~5-15 行 CSV. 估总 case **200-450** (audit 估 445+, 不冲突).

**Sampling 策略**:
1. **Tier 1 — Smoke goldens (50 cases)**: 每个 intent_category × 每个 sensitivity_level 抽 1-2 case, 覆盖广度. CI 必跑, 阻塞 PR.
2. **Tier 2 — Representative goldens (200 cases)**: stratified sampling, 覆盖 80% intent_codes. Test env 部署后必跑.
3. **Tier 3 — Full corpus (400+ cases)**: 完整跑, 每周 nightly. 非阻塞.

**Tier 1 (50) sampling 算法** (writing-plans 详细):
- 按 `intent_category` 分组 (ANALYSIS / DATA_OP / FORM / SCHEDULE / SYSTEM 等), 每组抽 5-8 个
- 按 `sensitivityLevel` 分组 (LOW/MEDIUM/HIGH/CRITICAL), 各组覆盖
- 按 stage hit (在 Java 现有 IntentResponseE2EV9Test 里看 expected MatchMethod), 8 stage 各 5+ case
- 多意图 isMultiIntent=true 至少 5 个

**通过门槛 Tier 1**: 50/50 必须全过, intentCode 完全一致, confidence ±0.05 允差, matchMethod 一致.
**通过门槛 Tier 2**: ≥ 95% 通过 (即 ≤ 10 个 case fail), fail 的需要分析原因.
**通过门槛 Tier 3**: ≥ 90% 通过, fail 的进入 backlog.

### 7.2 单元测试

每个 Python matcher 隔离测试:
- `test_semantic.py`: mock pgvector
- `test_classifier.py`: mock ONNX
- `test_fusion.py`: 给 stage 5+6 score, 验证融合算法
- `test_llm.py`: mock LLM client
- `test_orchestrator.py`: mock 所有 matcher, 短路逻辑
- `test_dto.py`: Pydantic model serialize/deserialize 跟 Java JSON 对齐

**边界**: 空 query, 超长 query (>4096 chars), 多语言, 注入字符 (`<script>`, SQL, JSON), 重复空白, 多意图.

### 7.3 集成测试

`tests/ai/test_integration.py`:
- 真实 Python 服务 (FastAPI test client)
- 真实 PG 连接 (test DB)
- mock LLM client (避免真实 API 费用)
- 端到端 50 个 query, 验证 stage 命中 + response shape 1:1 跟 Java IntentMatchResult JSON

### 7.4 Smoke test

部署到 test env 后:
- e2e-web-admin skill 跑 AI 对话场景
- 覆盖: 库存查询 / 销售分析 / 工单创建 / 报表生成 / 复杂多轮对话 / disambiguation 多意图

### 7.5 性能测试

```bash
# 1000 query 压测
ab -n 1000 -c 10 -T 'application/json' \
   -H 'X-Internal-Secret: ...' \
   -H 'X-Factory-Id: F001' \
   -p sample-query.json \
   http://localhost:8083/api/ai/intent/match
```

**目标 (POC 完成时)**:
- P50 < 200ms
- P95 < 1500ms (含部分 stage 8 LLM 兜底)
- P99 < 30s (LLM 超时上限)
- **Java cache hit rate**: 实测后给目标 (v1 假设 80% 不靠谱, 等 §6.5 1 周数据)
- Python 服务 RSS < 1.5GB (含 ONNX + 向量缓存 + LLM client overhead)
- 0 fallback 触发 (5 分钟压测窗口)

### 7.6 Acceptance criteria — Phase 2B-α 升 prod 门槛

- [ ] Tier 1 contract test 50/50 通过
- [ ] Tier 2 contract test ≥ 95%
- [ ] 所有单测通过
- [ ] Test env 1 周 0 fallback 触发
- [ ] P95 latency 不退化 (vs Java legacy baseline, 用 §6.5 数据对比)
- [ ] Cache hit rate ≥ §6.5 实测数据 80% (即不退化)
- [ ] No regressions in `e2e-web-admin` smoke
- [ ] 内存使用 < 1.5GB
- [ ] Tier 3 nightly 至少 1 次 ≥ 90%

---

## 8. Rollout 时间线 (修 audit M6, 新拆 α/β)

| 周 | 阶段 | 工作 | 状态门 |
|---|---|---|---|
| **W1 α** | Stage hit-rate 数据采集 + ai/ skeleton + 4 个 matcher (semantic/classifier/fusion/llm) | Java 加 metric + Python 11 文件搬 | Stage hit rate report 出 + 单测通过 |
| **W2 α** | DTO 1:1 对齐 + Tier 1 50 goldens 抽样 + Java client (Resilience4j + connection pool) + cache + flag | 完整 stage 5-8 + Java 改造 | Tier 1 contract 50/50 通过 |
| **W3 α** | Test env flag flip true + smoke + Tier 2 + 监控 | 信心 | 1 周 0 fallback + Tier 2 ≥ 95% |
| **W4 α** | Prod flip + monitoring | 升 prod | Prod 1 周稳定 |
| **W5 β** | Bucket A 第二批: 复杂度 + 语义路由 + RAG (~6-8 文件) | β-1 | 单测 + integration |
| **W6 β** | Bucket A 第三批: NLP + 校准 + ML 学习 (~5-6 文件) | β-2 | 单测 + integration |
| **W7 β** | β 完整测试 + Tier 1 重跑 + canary | β prod 升 | Tier 1 50/50 不退化 |
| **W8 Phase 3** | Java legacy 删 (~22-25 文件) + Bucket B 接口微调 + 文档 | 清理 | Java AI service 文件减少 ≥ 22 |

**总日历**: 7-8 周 (vs v1 的 4-5 周, 因为 β 增加).
**总工作量**: ~190-220h ±30% (历史 Cretas 估时偏差大, audit M2 提醒).

---

## 9. 工作量分解 (修 audit M2 — 加 30% 不确定性)

| 子阶段 | 工作 | 估时 (h) |
|---|---|---|
| W1 α: stage hit-rate metric Java 改造 | 数据采集 | 8 |
| W1 α: ai/ skeleton + DTO 1:1 (~30 字段映射) | 基础 | 16 |
| W1 α: 2 matcher (semantic/classifier) + 单测 | 计算搬 | 14 |
| W2 α: 2 matcher (fusion/llm) + orchestrator + 单测 | 完整 5-8 | 16 |
| W2 α: Tier 1 sampling 算法 + 50 goldens 抽样 | 测试 | 12 |
| W2 α: Java PythonAiMatcherClient + Resilience4j + cache + flag + auth headers | Java 改造 | 16 |
| W2 α: Java IntentParityTest (Tier 1) | Java 单测 | 6 |
| W3 α: Test env 部署 + smoke + 监控 | 部署 | 8 |
| W3 α: 1 周观察 + 调优 | 信心 | 12 |
| W4 α: Prod flip + canary | 升 prod | 8 |
| W5 β-1: 复杂度路由 (3 文件) + 语义路由 (2) + RAG (2) | β-1 实现 | 28 |
| W6 β-2: NLP (3) + 校准 (2) + ML 学习 (3) | β-2 实现 | 28 |
| W7 β prod | β 测试 + canary | 12 |
| W8 Phase 3: Java legacy 删 22-25 文件 + 接口调整 + 文档 | 清理 | 16 |
| **TOTAL** | | **~200h** |

不确定性 ±30% (~140-260h). 风险来源:
- Bucket C 5 文件实际属 A 还是 B 待定 (±5 文件 = ±30h)
- 6.4 cache invalidation 实现复杂度
- Phase 2A 共用资源调度 (asyncpg pool / main.py 协调)
- contract test 各 Tier sampling 时发现 Java 现有测试不全, 需要补 case

---

## 10. 并发编辑安全 (修 audit I3, 加 3 个文件)

### 10.1 兄弟 chat (Phase 2A) 领地 (不变)

- worktree: `.worktrees/phase2a-t5-poc`
- 分支: `phase2a/t5-poc`
- 在做: `/analysis/sales` byte-shape port (foundation 22 tasks 进行中, 19 commits NOT pushed)

### 10.2 我 (Phase 2B) 领地

- worktree: `.worktrees/phase2b-ai-intent-layer`
- 分支: `phase2b/ai-intent-migration`
- 触碰文件:
  - `backend/python/ai/` (新建, 全部我的)
  - `backend/python/tests/ai/` (新建)
  - `backend/python/main.py` (+1 行 router include)
  - `backend/python/requirements.txt` (+ 几个依赖)
  - `backend/python/conftest.py` (+ AI mock fixture)
  - Java AI service 层 (Bucket A 22-25 个改/删 + Bucket B 微调接口)
  - 新 Java client + cache + circuit breaker config 文件
  - **`backend/python/llm/`** (wrap, 不改源码 — 但若发现需要 patch, 需协调)
  - **`backend/python/classifier/`** (wrap, 不改源码 — 同上)
  - **Java `IntentExecutorServiceImpl.java`** (调用入口微调, dispatch 收 Python response)

### 10.3 真冲突面 (扩 7-8 文件)

| 文件 | 冲突级别 | 缓解 |
|---|---|---|
| `backend/python/main.py` | 中 | 推迟到 Phase 2B 最后改, `safe-commit.sh` 锁定 |
| `backend/python/requirements.txt` | 低 | 字母序插入位置 |
| `backend/python/conftest.py` | 低 | 不同 fixture 函数 |
| `backend/python/llm/` (wrap, 但若 patch 协调) | 低 | 优先不动. 若必须改, 跟兄弟 chat 沟通 |
| `backend/python/classifier/` (wrap, 但若 patch 协调) | 低 | 同上 |
| Java `IntentExecutorServiceImpl.java` | 低-中 | 兄弟 chat AFAIK 不动. 但要 fetch + diff 确认 |
| Flyway migration version | 低 | 我用 `V20260501_xx`, 跟兄弟 `V20260430_xx` 错开 |
| `scripts/deploy/deploy-smartbi-python.sh` | 极低 | 已确认 rsync 整个 backend/python (audit 验证), 双方共用不冲突 |

### 10.4 安全协议 (不变)

1. Worktree 物理隔离
2. 每天开工先 fetch
3. 里程碑 commit (rule 1)
4. 共享文件用 `safe-commit.sh "msg" file1 file2` (rule 5b)
5. 改 main.py 推迟到最后
6. Pre-merge 主分支前协调

### 10.5 部署同步点

`backend/python/` 是同一进程 (端口 8083). `deploy-smartbi-python.sh` 会 rsync 整个 `backend/python/` (audit 验证 ✓). 部署前必须:
- 我的 `phase2b/ai-intent-migration` 已 push 且包含兄弟 chat 最新 commits (rebase)
- 或反过来兄弟 chat rebase 我的
- 不能只部一侧

---

## 11. 开放问题 / 风险

| # | 问题 | 状态 |
|---|---|---|
| ~~R1~~ | ~~ai_intent_configs 5 分钟刷新窗口~~ | **已解决 (§6.4 配置版本号 + invalidate endpoint)** |
| R2 | Stage 7 FUSION 短路: 命中 stage 5 是否跑 stage 6 | **锁**: confidence > 0.85 直接 return, 不跑 6/7/8 |
| R3 | LLM provider fallback chain | 复用现有 `llm/` 模块 (memory call_chain 优化已做) |
| R4 | Embedding gRPC :9090 挂时 stage 5 跳过 | 已设计降级 (§6.1) |
| ~~R5~~ | ~~Java IntentResultCache 5min 旧 intentCode~~ | **已解决 (§6.4 同 R1)** |
| R6 | IntentDisambiguationService 用 confidence | API contract 包含 (§5.4 `confidence` + `topCandidates`), 不用改 Java |
| R7 | IntentFeedbackService 反馈写库 | Java 写, Python 5min 读 + invalidate endpoint (§6.4) |
| R8 | history 上下文给 stage 8 LLM | API request `history` 字段 (§5.3) |
| ~~R9~~ | ~~ai_intent_configs 是否 RLS~~ | **已解决: 是 factory-scoped**, Python 必须 filter `factory_id IS NULL OR = req.factoryId` AND `business_type IN ('COMMON', req.businessType)` AND `is_active = true` AND `deleted_at IS NULL`, ORDER BY priority DESC. 实现见 §4.1 Bucket A `ai/db.py`. |
| R10 | Python 服务内存 +200-500MB | 服务器 16GB 够, 监控 RSS, OOM 触发 swap warning |
| R11 | Bucket C 5 文件分类 | writing-plans 阶段读源码定 |
| R12 | Bucket A 中 9 个 service 文件实际删除影响 | 需要 dependency 扫描: 谁还在 import 它们? |
| R13 | Tier 1 50-golden sampling 算法的 stratified 维度 | writing-plans 阶段 design + 实测验证覆盖 |
| R14 | Phase 2A vs 2B asyncpg pool 竞争 | 各自独立 pool, main.py register 时 init |
| R15 | `MatchMethod` enum 12 值 Python 全支持 | Pydantic enum 严格映射, 单测覆盖每个值 |

---

## 12. 命名约定

- Python 模块: `backend/python/ai/`
- Python 包名: `ai`
- Python API 路径: `/api/ai/intent/match`
- Java client 类: `PythonAiMatcherClient`
- Java cache 类: `IntentResultCache`
- Java circuit breaker: `pythonAiMatcher` (Resilience4j instance name)
- Feature flag: `ai.use-python-matcher` (Spring `@Value` 读)
- Internal secret: `INTERNAL_API_SECRET` (env var, Java + Python 共享)
- Branch: `phase2b/ai-intent-migration`
- Worktree: `.worktrees/phase2b-ai-intent-layer`
- Spec 文件: `docs/superpowers/specs/2026-04-29-phase2b-ai-intent-layer-design.md`
- Plan 文件 (writing-plans): `docs/superpowers/plans/2026-04-29-phase2b-implementation-plan.md`

---

## 13. 实施门槛

**绝对 no-go (ship 失败重做):**
- Tier 1 contract test 任意 case 失败
- Test env fallback 触发率 > 0
- Prod 部署后任何 AI 意图无法识别 (R47/R48 P0 那种)
- 兄弟 chat (Phase 2A) 因我的改动断 build
- 任何 cross-tenant 数据泄露 (factory A 看到 factory B 的 intent)
- `MatchMethod` enum 缺值 (Java 返 SIMILAR/DOMAIN_DEFAULT/REJECTED Python 不支持就崩)

**Soft 标准 (可妥协):**
- Confidence ±0.05 允差
- LLM stage 8 偶发超时 (Python 已 fallback)
- ai_intent_configs 失效 < 1min (从 admin 改到 prod 生效)
- Tier 2 ≥ 95%, Tier 3 ≥ 90%

---

## 14. 后续 Phase 3 cleanup (本 spec 不展开)

POC + α + β 上线 prod 1 周 0 异常后, 启动 Phase 3:

1. Stage 1-4 也搬 Python (含 PhraseMatchingService 从 Bucket B 移 A)
2. Java AIIntentServiceImpl 退化为 ~30 行薄客户端
3. 删除 Java legacy 22-25 个文件 + 关联单测
4. Bucket B 接口微调 (拿到 Python response 怎么 dispatch, 已实现, 收尾)
5. 移除 feature flag (Python 路径成默认)
6. 文档 `.claude/rules/ai-intent-tool-skill-architecture.md` 更新 (Python 部分)

预计 ~30-40h.

---

## 15. 不在本 spec 决定的事 (留给 writing-plans)

- 具体 Python 文件实现细节 (代码层面)
- 具体 Java diff 怎么写
- Spring config 怎么定义 feature flag default
- **Tier 1 50-golden sampling 算法的 stratified 维度 + 具体抽样 (R13)**
- **Bucket C 5 文件读源码后属 A 还是 B (R11)**
- **Bucket A 中各文件 Java legacy 是否仍有 import (R12)**
- Python `ai/cache.py` 用 Redis 还是内存 LRU
- 具体的部署步骤
- 监控指标接入 (Prometheus metric name, dashboard)
- `INTERNAL_API_SECRET` 旋转策略 (短期沿用现有, 长期看)

---

## 文档结束

**下一步**: 用户 review v2 → invoke `superpowers:writing-plans` 生成实施计划.

**v2 关键改动汇总** (vs v1):
- §1.1 Java AI 文件清单 45+ 完整 enumerate
- §1.5 + §1.6 + §1.7 driver/scope 诚实 reframe
- §2 决策表加 Q3 Bucket / 细节 5-7 (auth / cache / circuit breaker)
- §3 Bucket A/B/C 完整划分
- §5.2-5.5 API contract 全字段对齐 IntentMatchResult, JWT 用 INTERNAL_API_SECRET 模式
- §6.2 Resilience4j 替自撸 circuit breaker
- §6.3 connection pooling 强制
- §6.4 cache 失效配置版本号机制 (3 层防御)
- §6.5 stage hit rate W1 数据采集
- §7.1 sampling 策略, 3 tier 50/200/400+ goldens
- §8 7-8 周时间线, α + β 拆分
- §9 200h ±30%
- §10 冲突文件扩 7-8 个
- §11 开放问题 R1/R5/R9 解决, 加 R11-R15
