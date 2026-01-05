# AI意图识别系统 - 完整架构分析文档 V2

> 本文档详细分析 AI 意图识别系统的完整架构，包含代码位置、数据流、缓存策略、自学习机制和实际业务示例。

---

## 目录

1. [系统架构总览](#系统架构总览)
2. [5层识别流程详解](#5层识别流程详解)
3. [实际业务示例](#实际业务示例)
4. [三层缓存架构](#三层缓存架构)
5. [自学习机制](#自学习机制)
6. [两级审批系统](#两级审批系统)
7. [关键服务与代码位置](#关键服务与代码位置)
8. [配置参数清单](#配置参数清单)
9. [API 端点汇总](#api-端点汇总)
10. [定时任务](#定时任务)

---

## 系统架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户输入 (userInput)                               │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
           ┌───────────────────────────────────────────┐
           │          AIIntentServiceImpl              │
           │     (核心入口: recognizeIntent)           │
           │     文件: AIIntentServiceImpl.java        │
           │     行号: 357-658                         │
           └───────────────────────┬───────────────────┘
                                   ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                         5层识别流水线                                        ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃                                                                             ┃
┃   Layer 1: 精确表达 (Hash)     ──▶ O(1) 查表                               ┃
┃        │                            置信度: 1.0                             ┃
┃        ▼ 无匹配                                                             ┃
┃   Layer 2: 正则表达式          ──▶ Pattern.matches()                       ┃
┃        │                            分数: 100                               ┃
┃        ▼ 无匹配                                                             ┃
┃   Layer 3: 关键词匹配          ──▶ 三层关键词合并                          ┃
┃        │                            分数 = 关键词数×10 + 优先级             ┃
┃        ▼                                                                    ┃
┃   Layer 4: 语义匹配            ──▶ GTE-base-zh (768维)                     ┃
┃        │                            融合: 语义×0.6 + 关键词×0.4             ┃
┃        ▼ 置信度 < 0.3                                                       ┃
┃   Layer 5: LLM Fallback        ──▶ DashScope qwen-plus                     ┃
┃                                     返回: 意图 / UNKNOWN / NEED_INFO       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                   │
                                   ▼
           ┌───────────────────────────────────────────┐
           │           自学习分支                       │
           │                                           │
           │  置信度 ≥ 0.85:  学习关键词 + 表达        │
           │  置信度 0.70-0.85: 仅学习表达             │
           │  置信度 < 0.70:  仅记录样本               │
           │  UNKNOWN:       生成 CREATE_INTENT 建议   │
           └───────────────────────────────────────────┘
                                   │
                                   ▼
           ┌───────────────────────────────────────────┐
           │           IntentMatchResult               │
           │                                           │
           │  bestMatch: AIIntentConfig                │
           │  confidence: double                       │
           │  matchMethod: EXACT/REGEX/KEYWORD/...     │
           │  matchedKeywords: List<String>            │
           │  isStrongSignal: boolean                  │
           │  requiresConfirmation: boolean            │
           └───────────────────────────────────────────┘
```

---

## 5层识别流程详解

### Layer 1: 精确表达匹配 (Exact Expression Match)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: 精确表达匹配                                                      │
├────────────────────────────────────────────────────────────────────────────┤
│  服务: ExpressionLearningService                                            │
│  方法: matchExactExpression(factoryId, userInput)                          │
│  文件: ExpressionLearningServiceImpl.java:125-168                          │
│                                                                            │
│  原理:                                                                      │
│    1. 输入正规化: trim() + toLowerCase()                                   │
│    2. SHA256 Hash 计算                                                     │
│    3. 查表: ai_learned_expressions.expression_hash                         │
│                                                                            │
│  复杂度: O(1)                                                               │
│  置信度: 1.0 (100%)                                                        │
│  自学习: 记录到 ai_training_samples (MatchMethod.EXACT)                    │
└────────────────────────────────────────────────────────────────────────────┘
```

| 属性 | 值 |
|------|-----|
| **代码位置** | `AIIntentServiceImpl.java:382-422` |
| **服务** | `ExpressionLearningService` |
| **数据表** | `ai_learned_expressions` |
| **索引字段** | `expression_hash` (SHA256) |
| **置信度** | 固定 1.0 |

### Layer 2: 正则表达式匹配 (Regex Match)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 2: 正则表达式匹配                                                    │
├────────────────────────────────────────────────────────────────────────────┤
│  方法: matchesByRegex(intent, normalizedInput)                             │
│  文件: AIIntentServiceImpl.java:438-445                                    │
│                                                                            │
│  原理:                                                                      │
│    1. 获取 AIIntentConfig.regexPattern                                     │
│    2. Pattern.compile(pattern).matcher(input).matches()                    │
│                                                                            │
│  分数: regexMatchScore (默认 100)                                          │
│  适用: 产品代码、订单号、批次号等格式化输入                                │
└────────────────────────────────────────────────────────────────────────────┘
```

| 属性 | 值 |
|------|-----|
| **代码位置** | `AIIntentServiceImpl.java:438-445` |
| **数据源** | `AIIntentConfig.regexPattern` |
| **匹配分数** | `regexMatchScore = 100` |
| **适用场景** | 格式化输入 (产品代码、订单号) |

### Layer 3: 关键词匹配 (Keyword Match)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 3: 关键词匹配                                                        │
├────────────────────────────────────────────────────────────────────────────┤
│  方法: getMatchedKeywords(intent, normalizedInput, factoryId)              │
│  文件: AIIntentServiceImpl.java:447-463, 430-432                           │
│                                                                            │
│  关键词三层合并:                                                            │
│    ① 基础关键词: AIIntentConfig.keywords (JSON Array)                      │
│    ② 工厂级关键词: keyword_effectiveness WHERE factoryId='F001'            │
│    ③ 全局关键词: keyword_effectiveness WHERE factoryId='GLOBAL'            │
│                                                                            │
│  分数计算:                                                                  │
│    baseScore = 关键词数 × 10 + 意图优先级                                  │
│    opTypeAdjustment = 操作类型匹配(+25) / 不匹配(-20)                      │
│    finalScore = baseScore + opTypeAdjustment                               │
└────────────────────────────────────────────────────────────────────────────┘
```

**操作类型权重调整**:

| 输入类型 | 意图类型 | 调整值 |
|----------|----------|--------|
| QUERY | QUERY | +25 |
| QUERY | UPDATE | -20 |
| UPDATE | UPDATE | +25 |
| UPDATE | QUERY | -20 |
| AMBIGUOUS | 任何 | 0 |

### Layer 4: 语义匹配 (Semantic Match)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 4: 语义匹配 (Unified Semantic Match)                                 │
├────────────────────────────────────────────────────────────────────────────┤
│  服务: IntentEmbeddingCacheService                                         │
│  方法: matchIntentsWithExpressions(factoryId, userInput)                   │
│  文件: IntentEmbeddingCacheServiceImpl.java:450-520                        │
│                                                                            │
│  Embedding模型: GTE-base-zh (768维向量)                                    │
│  客户端: DjlEmbeddingClient.java                                           │
│                                                                            │
│  统一搜索范围:                                                              │
│    1. 意图配置 embedding (AIIntentConfig.description)                      │
│    2. 已学习表达 embedding (ai_learned_expressions.embedding_vector)       │
│                                                                            │
│  阈值:                                                                      │
│    HIGH:   ≥ 0.85  →  直接返回                                             │
│    MEDIUM: 0.72-0.85  →  融合评分 (语义×0.6 + 关键词×0.4)                  │
│    LOW:    < 0.72  →  交给 LLM Fallback                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

| 属性 | 值 |
|------|-----|
| **代码位置** | `AIIntentServiceImpl.java:466-486, 1651-1758` |
| **Embedding服务** | `IntentEmbeddingCacheServiceImpl.java:450-520` |
| **模型** | GTE-base-zh (768维) |
| **高阈值** | ≥ 0.85 |
| **中阈值** | 0.72-0.85 |
| **融合权重** | 语义 60% + 关键词 40% |

### Layer 5: LLM Fallback

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Layer 5: LLM Fallback                                                      │
├────────────────────────────────────────────────────────────────────────────┤
│  服务: LlmIntentFallbackClient                                              │
│  实现: LlmIntentFallbackClientImpl.java                                    │
│  文件: AIIntentServiceImpl.java:547-655                                    │
│                                                                            │
│  触发条件: (置信度 < 0.3) OR (无任何匹配结果)                               │
│  模型: DashScope qwen-plus                                                  │
│  API: /api/v1/chat/completions                                             │
│                                                                            │
│  返回类型:                                                                  │
│    ① 匹配现有意图  →  返回 IntentMatchResult (MatchMethod.LLM)             │
│    ② UNKNOWN       →  tryCreateIntentSuggestion() → 生成建议               │
│    ③ NEED_INFO     →  返回澄清问题                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

| 属性 | 值 |
|------|-----|
| **代码位置** | `AIIntentServiceImpl.java:547-655` |
| **服务** | `LlmIntentFallbackClientImpl.java` |
| **模型** | DashScope qwen-plus |
| **触发阈值** | 置信度 < 0.3 |
| **返回类型** | 现有意图 / UNKNOWN / NEED_INFO |

---

## 实际业务示例

> 本章通过6个真实业务场景，演示用户输入如何通过5层识别流水线获得不同结果。

### 示例总览

| # | 用户输入 | 命中层级 | 识别结果 | 置信度 |
|---|----------|----------|----------|--------|
| 1 | "查询原料库存" | Layer 1 (精确表达) | MATERIAL_BATCH_QUERY | 1.0 |
| 2 | "批次号 BATCH-2026-001" | Layer 2 (正则) | TRACE_BATCH | 1.0 |
| 3 | "今天生产计划" | Layer 3 (关键词) | PRODUCTION_PLAN_QUERY | 0.85 |
| 4 | "帮我看看仓库里还有多少鱼" | Layer 4 (语义) | MATERIAL_BATCH_QUERY | 0.78 |
| 5 | "把上周的质检报告发给张经理" | Layer 5 (LLM) | UNKNOWN → 建议创建 | - |
| 6 | "处理那个事情" | Layer 5 (LLM) | NEED_INFO → 澄清 | - |

---

### 示例 1: 精确表达命中 (Layer 1)

```
用户输入: "查询原料库存"
```

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: 精确表达匹配                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: 正规化                                                     │
│    输入: "查询原料库存"                                              │
│    正规化: "查询原料库存" (trim + toLowerCase)                       │
│                                                                     │
│  Step 2: 计算Hash                                                   │
│    SHA256("查询原料库存") = "a3f2b8c1d4e5..."                       │
│                                                                     │
│  Step 3: 查表                                                       │
│    SELECT * FROM ai_learned_expressions                             │
│    WHERE expression_hash = 'a3f2b8c1d4e5...'                        │
│    AND factory_id = 'F001'                                          │
│                                                                     │
│  Step 4: 命中！                                                     │
│    找到记录: intent_code = 'MATERIAL_BATCH_QUERY'                   │
│    置信度 = 1.0                                                     │
│                                                                     │
│  ✅ 结果: 直接返回，跳过后续层                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**返回结果**:
```json
{
  "intentCode": "MATERIAL_BATCH_QUERY",
  "intentName": "原材料批次查询",
  "confidence": 1.0,
  "matchMethod": "EXACT",
  "matchedKeywords": [],
  "requiresConfirmation": false
}
```

**自学习**: 记录到训练样本，增强此表达的权重。

---

### 示例 2: 正则匹配命中 (Layer 2)

```
用户输入: "批次号 BATCH-2026-001"
```

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: 精确表达匹配 → 未命中                                      │
│  Layer 2: 正则表达式匹配                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  遍历所有意图的正则模式:                                             │
│                                                                     │
│  意图: TRACE_BATCH                                                  │
│  正则: "(?i).*批次号?\s*([A-Z]+-\d{4}-\d{3}).*"                     │
│                                                                     │
│  匹配: Pattern.compile(regex).matcher("批次号 BATCH-2026-001")      │
│  结果: ✅ 匹配成功！                                                 │
│  提取: 批次号 = "BATCH-2026-001"                                    │
│                                                                     │
│  分数: regexMatchScore = 100                                        │
│                                                                     │
│  ✅ 结果: 直接返回，跳过后续层                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**返回结果**:
```json
{
  "intentCode": "TRACE_BATCH",
  "intentName": "批次溯源查询",
  "confidence": 1.0,
  "matchMethod": "REGEX",
  "extractedParams": {
    "batchNumber": "BATCH-2026-001"
  },
  "requiresConfirmation": false
}
```

**适用场景**: 产品代码、订单号、批次号等格式化输入。

---

### 示例 3: 关键词匹配命中 (Layer 3)

```
用户输入: "今天生产计划"
```

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: 精确表达 → 未命中                                          │
│  Layer 2: 正则匹配 → 未命中                                          │
│  Layer 3: 关键词匹配                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: 加载关键词 (三层合并)                                       │
│    ① 基础关键词: ["生产计划", "计划", "排产"]                        │
│    ② 工厂关键词: ["产能", "日产量"] (factory_id='F001')              │
│    ③ 全局关键词: ["生产安排"] (factory_id='GLOBAL')                  │
│    合并: ["生产计划", "计划", "排产", "产能", "日产量", "生产安排"]   │
│                                                                     │
│  Step 2: 匹配统计                                                   │
│    输入: "今天生产计划"                                              │
│    命中: ["生产计划", "计划"]                                        │
│    命中数: 2                                                        │
│                                                                     │
│  Step 3: 计算分数                                                   │
│    baseScore = 2 × 10 + priority(50) = 70                          │
│    操作类型: 输入是QUERY, 意图是QUERY → +25                         │
│    finalScore = 70 + 25 = 95                                        │
│                                                                     │
│  Step 4: 置信度转换                                                 │
│    confidence = min(95/100, 0.95) = 0.85                           │
│                                                                     │
│  ✅ 结果: 高于阈值(0.3)，返回此意图                                  │
└─────────────────────────────────────────────────────────────────────┘
```

**返回结果**:
```json
{
  "intentCode": "PRODUCTION_PLAN_QUERY",
  "intentName": "生产计划查询",
  "confidence": 0.85,
  "matchMethod": "KEYWORD",
  "matchedKeywords": ["生产计划", "计划"],
  "requiresConfirmation": false
}
```

**自学习**: 置信度 ≥ 0.85，自动学习"今天生产计划"为新表达。

---

### 示例 4: 语义匹配命中 (Layer 4)

```
用户输入: "帮我看看仓库里还有多少鱼"
```

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1-3: 未命中 (没有精确表达、正则、直接关键词)                   │
│  Layer 4: 语义匹配                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: 计算输入Embedding                                          │
│    input_embedding = DjlEmbeddingClient.encode(                     │
│      "帮我看看仓库里还有多少鱼"                                      │
│    )  // 768维向量                                                  │
│                                                                     │
│  Step 2: 与意图Embedding比较                                        │
│    意图: MATERIAL_BATCH_QUERY                                       │
│    描述: "查询原材料批次库存信息"                                    │
│    intent_embedding = [缓存中获取]                                   │
│                                                                     │
│    similarity = cosineSimilarity(                                   │
│      input_embedding,                                               │
│      intent_embedding                                               │
│    ) = 0.76                                                         │
│                                                                     │
│  Step 3: 阈值判断                                                   │
│    0.72 ≤ 0.76 < 0.85 → MEDIUM 区间                                │
│    执行融合评分                                                      │
│                                                                     │
│  Step 4: 融合评分                                                   │
│    语义分数 = 0.76                                                  │
│    关键词分数 = 0.5 (命中"库存"相关)                                │
│    融合 = 0.76 × 0.6 + 0.5 × 0.4 = 0.656                           │
│    最终置信度 = max(0.656, 0.76) = 0.78                            │
│                                                                     │
│  ✅ 结果: 返回语义匹配结果                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**返回结果**:
```json
{
  "intentCode": "MATERIAL_BATCH_QUERY",
  "intentName": "原材料批次查询",
  "confidence": 0.78,
  "matchMethod": "SEMANTIC",
  "matchedKeywords": [],
  "requiresConfirmation": false
}
```

**自学习**: 0.70 ≤ 置信度 < 0.85，学习表达但不学习关键词。

---

### 示例 5: LLM Fallback - 新意图建议 (Layer 5)

```
用户输入: "把上周的质检报告发给张经理"
```

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1-4: 未命中或置信度 < 0.3                                     │
│  Layer 5: LLM Fallback                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: 构建Prompt                                                 │
│    系统: "你是意图分类助手..."                                       │
│    用户: "帮我分析: 把上周的质检报告发给张经理"                       │
│    候选意图: [QUALITY_REPORT_QUERY, QUALITY_INSPECTION_QUERY, ...]  │
│                                                                     │
│  Step 2: 调用DashScope                                              │
│    model: qwen-plus                                                 │
│    temperature: 0.1                                                 │
│                                                                     │
│  Step 3: LLM返回                                                    │
│    {                                                                │
│      "intentCode": "UNKNOWN",                                       │
│      "reason": "用户意图涉及报告发送/分享，现有意图均为查询类",       │
│      "suggestedCategory": "REPORT",                                 │
│      "suggestedName": "质检报告分享"                                 │
│    }                                                                │
│                                                                     │
│  Step 4: 生成CREATE_INTENT建议                                      │
│    IntentOptimizationSuggestion.createNewIntentSuggestion(          │
│      factoryId = "F001",                                            │
│      userInput = "把上周的质检报告发给张经理",                        │
│      suggestedCode = "QUALITY_REPORT_SHARE",                        │
│      suggestedName = "质检报告分享",                                 │
│      suggestedKeywords = ["发送", "分享", "报告", "发给"],           │
│      confidence = 0.85                                              │
│    )                                                                │
│                                                                     │
│  ⚠️ 结果: 返回UNKNOWN，等待工厂管理员审批新意图                      │
└─────────────────────────────────────────────────────────────────────┘
```

**返回结果**:
```json
{
  "intentCode": "UNKNOWN",
  "confidence": 0.0,
  "matchMethod": "LLM",
  "requiresConfirmation": false,
  "message": "未能识别您的意图，已生成新意图建议供管理员审批",
  "suggestionId": "sugg-abc123"
}
```

**后续流程**: 工厂管理员在"意图管理"界面看到待审批建议，可选择创建新意图。

---

### 示例 6: LLM Fallback - 需要澄清 (Layer 5)

```
用户输入: "处理那个事情"
```

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1-4: 未命中 (输入过于模糊)                                    │
│  Layer 5: LLM Fallback                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: 构建Prompt并调用LLM                                        │
│                                                                     │
│  Step 2: LLM返回NEED_INFO                                           │
│    {                                                                │
│      "intentCode": "NEED_INFO",                                     │
│      "clarifyingQuestion": "请问您想处理什么事情？例如：\n           │
│        1. 处理质检异常\n                                             │
│        2. 处理设备告警\n                                             │
│        3. 处理生产任务\n                                             │
│        请具体说明一下"                                               │
│    }                                                                │
│                                                                     │
│  ⚠️ 结果: 返回澄清问题，请用户补充信息                               │
└─────────────────────────────────────────────────────────────────────┘
```

**返回结果**:
```json
{
  "intentCode": "NEED_INFO",
  "confidence": 0.0,
  "matchMethod": "LLM",
  "requiresConfirmation": true,
  "clarifyingQuestion": "请问您想处理什么事情？例如：\n1. 处理质检异常\n2. 处理设备告警\n3. 处理生产任务\n请具体说明一下"
}
```

**用户体验**: 前端显示澄清问题，引导用户提供更具体的输入。

---

### 识别路径对比图

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           不同输入的识别路径                                   │
└──────────────────────────────────────────────────────────────────────────────┘

输入1: "查询原料库存"           输入4: "帮我看看仓库里还有多少鱼"
       │                              │
       ▼                              ▼
  ┌─────────┐                   ┌─────────┐
  │ Layer 1 │ ✅ 命中           │ Layer 1 │ ✗
  └────┬────┘                   └────┬────┘
       │                              │
       ▼                              ▼
  ┌─────────────┐              ┌─────────┐
  │ 直接返回     │              │ Layer 2 │ ✗
  │ 置信度=1.0   │              └────┬────┘
  └─────────────┘                    │
                                     ▼
输入2: "批次号 BATCH-2026-001"  ┌─────────┐
       │                        │ Layer 3 │ ✗
       ▼                        └────┬────┘
  ┌─────────┐                        │
  │ Layer 1 │ ✗                      ▼
  └────┬────┘                   ┌─────────┐
       │                        │ Layer 4 │ ✅ 语义命中
       ▼                        └────┬────┘
  ┌─────────┐                        │
  │ Layer 2 │ ✅ 正则命中            ▼
  └────┬────┘                   ┌─────────────┐
       │                        │ 返回 0.78   │
       ▼                        │ 学习表达    │
  ┌─────────────┐              └─────────────┘
  │ 直接返回     │
  │ 提取参数    │         输入5: "把上周的质检报告发给张经理"
  └─────────────┘               │
                                ▼
输入3: "今天生产计划"      ┌─────────────────┐
       │                   │ Layer 1-4 未命中 │
       ▼                   └────────┬────────┘
  ┌─────────┐                       │
  │ Layer 1 │ ✗                     ▼
  └────┬────┘               ┌─────────────────┐
       │                    │ Layer 5: LLM    │
       ▼                    │ 返回 UNKNOWN    │
  ┌─────────┐               │ 生成新意图建议   │
  │ Layer 2 │ ✗             └─────────────────┘
  └────┬────┘
       │                  输入6: "处理那个事情"
       ▼                        │
  ┌─────────┐                   ▼
  │ Layer 3 │ ✅ 关键词命中  ┌─────────────────┐
  └────┬────┘               │ Layer 1-4 未命中 │
       │                    └────────┬────────┘
       ▼                             │
  ┌─────────────┐                    ▼
  │ 返回 0.85   │            ┌─────────────────┐
  │ 学习表达    │            │ Layer 5: LLM    │
  │ 学习关键词  │            │ 返回 NEED_INFO  │
  └─────────────┘            │ 请求澄清        │
                             └─────────────────┘
```

---

## 三层缓存架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           三层缓存架构                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Layer 1: 语义缓存 (Semantic Cache)                                         ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃  服务: SemanticCacheService                                                 ┃
┃  文件: SemanticCacheServiceImpl.java                                        ┃
┃  存储: semantic_cache 表                                                    ┃
┃                                                                             ┃
┃  功能: 缓存相似查询的结果                                                   ┃
┃  原理: 新查询 embedding 与缓存 embedding 比较                               ┃
┃  阈值: 相似度 ≥ 0.92 时命中缓存                                            ┃
┃  TTL:  24小时                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                   │
                                   ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Layer 2: 意图 Embedding 缓存 (Intent Embedding Cache)                      ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃  服务: IntentEmbeddingCacheService                                          ┃
┃  文件: IntentEmbeddingCacheServiceImpl.java                                 ┃
┃  存储: ConcurrentHashMap (内存)                                             ┃
┃                                                                             ┃
┃  结构:                                                                      ┃
┃    intentCache: Map<factoryId, Map<intentCode, CachedIntentEmbedding>>     ┃
┃    expressionCache: Map<factoryId, Map<expressionId, CachedExpression>>    ┃
┃                                                                             ┃
┃  刷新: 每天 4:00 AM 自动刷新                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                   │
                                   ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Layer 3: Spring @Cacheable 缓存                                            ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃  位置: AIIntentServiceImpl.java                                             ┃
┃  注解: @Cacheable("intentConfigs")                                          ┃
┃                                                                             ┃
┃  缓存项:                                                                    ┃
┃    - 意图配置列表 (按工厂ID)                                                ┃
┃    - 关键词效果记录                                                         ┃
┃                                                                             ┃
┃  失效: @CacheEvict 手动清除                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 缓存服务代码位置

| 缓存层 | 服务 | 文件 | 关键行号 |
|--------|------|------|----------|
| 语义缓存 | `SemanticCacheService` | `SemanticCacheServiceImpl.java` | 149-199 |
| Embedding缓存 | `IntentEmbeddingCacheService` | `IntentEmbeddingCacheServiceImpl.java` | 201-338 |
| Spring缓存 | `@Cacheable` | `AIIntentServiceImpl.java` | 分散 |

---

## 自学习机制

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           自学习触发流程                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                    LLM Fallback 返回结果
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  置信度≥0.85 │ │ 置信度0.70-  │ │  置信度<0.70 │
    │    (HIGH)    │ │ 0.85 (MED)   │ │    (LOW)     │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │学习关键词    │ │仅学习表达    │ │仅记录样本    │
    │+ 学习表达    │ │(不学关键词)  │ │(不学习)      │
    └──────────────┘ └──────────────┘ └──────────────┘

                    LLM 返回 UNKNOWN
                           │
                           ▼
                ┌─────────────────────┐
                │ tryCreateIntentSugg │
                │ estion() 生成建议   │
                └──────────┬──────────┘
                           │
               ┌───────────┴───────────┐
               │                       │
               ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐
    │ 工厂级意图      │     │ 建议晋升为      │
    │ (自动审批可用)  │     │ 平台级意图      │
    └─────────────────┘     └─────────────────┘
```

### 学习触发条件详表

| 触发点 | 条件 | 学习内容 | 代码位置 |
|--------|------|----------|----------|
| LLM高置信度 | 置信度 ≥ 0.85 | 关键词 + 表达 | `AIIntentServiceImpl:619-637` |
| LLM中置信度 | 0.70 ≤ 置信度 < 0.85 | 仅表达 | `AIIntentServiceImpl:619-637` |
| LLM低置信度 | 置信度 < 0.70 | 仅记录样本 | `AIIntentServiceImpl:619-637` |
| LLM返回UNKNOWN | 识别为新意图 | CREATE_INTENT建议 | `LlmIntentFallbackClient:260-281` |
| 用户正向反馈 | 确认匹配正确 | 更新关键词效果 | `AIIntentServiceImpl:1512-1539` |
| 用户负向反馈 | 选择正确意图 | 学习到正确意图 | `AIIntentServiceImpl:1572-1633` |
| 精确匹配命中 | Layer 1 命中 | 记录训练样本 | `AIIntentServiceImpl:409-414` |

### 关键词学习流程

```
用户输入 → 分词 (标点/空格) → 过滤停用词 (45个)
        → 过滤已存在关键词 → 过滤<2字符 → 过滤纯数字
        → 取最多3个新词 → 保存到 AIIntentConfig.keywords
```

**代码位置**: `AIIntentServiceImpl.java:1302-1390`

### 表达学习内容

| 字段 | 说明 |
|------|------|
| `expression` | 完整用户输入 |
| `expression_hash` | SHA256 |
| `embedding_vector` | 768维向量 |
| `source_type` | LLM_FALLBACK / USER_FEEDBACK / MANUAL |
| `confidence` | LLM置信度 |

**代码位置**: `ExpressionLearningServiceImpl.java:75-120`

---

## 两级审批系统

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        两级审批系统                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Level 1: 工厂级审批                                                        ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃                                                                             ┃
┃  触发条件:                                                                  ┃
┃    - LLM 返回 UNKNOWN                                                       ┃
┃    - 生成 CREATE_INTENT 类型的 IntentOptimizationSuggestion                ┃
┃                                                                             ┃
┃  自动审批:                                                                  ┃
┃    - factoryAutoApprove = true (AIIntentConfig 配置)                       ┃
┃    - 系统自动应用建议，创建工厂级意图                                       ┃
┃                                                                             ┃
┃  手动审批:                                                                  ┃
┃    - factoryAutoApprove = false                                            ┃
┃    - 工厂管理员在"意图管理"界面手动审批                                     ┃
┃                                                                             ┃
┃  审批人角色: factory_admin, factory_super_admin                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                   │
                    (申请晋升为平台级)
                                   ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Level 2: 平台级审批                                                        ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃                                                                             ┃
┃  触发条件:                                                                  ┃
┃    - 工厂管理员申请晋升 (request-promotion API)                             ┃
┃    - 生成 PROMOTE_TO_PLATFORM 类型的 IntentOptimizationSuggestion          ┃
┃                                                                             ┃
┃  审批流程:                                                                  ┃
┃    - 平台管理员在"晋升审批"界面查看待审批列表                               ┃
┃    - 可批准或拒绝，并填写 approvalNotes                                     ┃
┃                                                                             ┃
┃  审批人角色: super_admin (平台管理员)                                       ┃
┃                                                                             ┃
┃  批准后:                                                                    ┃
┃    - 意图 factoryId 设为 null (变为平台级)                                  ┃
┃    - 所有工厂可见                                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 审批相关代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| 申请晋升 | `IntentAnalysisController.java` | 240-280 |
| 待审批列表 | `IntentAnalysisController.java` | 290-320 |
| 审批处理 | `IntentAnalysisController.java` | 330-400 |
| 建议实体 | `IntentOptimizationSuggestion.java` | 全文件 |

### IntentOptimizationSuggestion 关键字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `suggestionType` | Enum | CREATE_INTENT / PROMOTE_TO_PLATFORM |
| `status` | Enum | PENDING / APPLIED / REJECTED / EXPIRED |
| `suggestedIntentCode` | String | LLM建议的意图代码 |
| `suggestedKeywords` | JSON | LLM建议的关键词 |
| `llmConfidence` | Decimal | LLM置信度 |
| `approvalNotes` | Text | 审批备注 |

---

## 关键服务与代码位置

### 核心服务文件索引

| 服务 | 文件 | 主要职责 |
|------|------|----------|
| **意图识别主入口** | `AIIntentServiceImpl.java` | 5层识别流水线 |
| **表达学习** | `ExpressionLearningServiceImpl.java` | 学习完整表达 |
| **Embedding缓存** | `IntentEmbeddingCacheServiceImpl.java` | 向量缓存与匹配 |
| **语义缓存** | `SemanticCacheServiceImpl.java` | 相似查询缓存 |
| **LLM客户端** | `LlmIntentFallbackClientImpl.java` | DashScope调用 |
| **关键词效果** | `KeywordEffectivenessServiceImpl.java` | 关键词效果追踪 |
| **DJL Embedding** | `DjlEmbeddingClient.java` | GTE-base-zh模型 |

### AIIntentServiceImpl.java 关键方法索引

| 方法 | 行号 | 功能 |
|------|------|------|
| `recognizeIntent()` | 357-658 | 5层识别主入口 |
| `matchExactExpression()` | 382-422 | Layer 1 |
| `matchesByRegex()` | 438-445 | Layer 2 |
| `getMatchedKeywords()` | 447-463 | Layer 3 |
| `trySemanticMatch()` | 466-486, 1651-1758 | Layer 4 |
| `handleLlmFallback()` | 547-655 | Layer 5 |
| `tryAutoLearnKeywords()` | 1302-1328 | 关键词学习 |
| `tryAutoLearnExpression()` | 1330-1390 | 表达学习 |
| `extractNewKeywords()` | 1344-1390 | 关键词提取 |
| `recordPositiveFeedback()` | 1512-1539 | 正向反馈 |
| `recordNegativeFeedback()` | 1572-1633 | 负向反馈 |

### IntentHandler 处理器索引

| Handler | 文件 | 处理意图类别 |
|---------|------|-------------|
| `MaterialIntentHandler` | `handler/MaterialIntentHandler.java` | 原材料相关 |
| `QualityIntentHandler` | `handler/QualityIntentHandler.java` | 质量检测相关 |
| `ReportIntentHandler` | `handler/ReportIntentHandler.java` | 报表分析相关 |
| `ScaleIntentHandler` | `handler/ScaleIntentHandler.java` | 电子秤相关 |
| `ShipmentIntentHandler` | `handler/ShipmentIntentHandler.java` | 出货相关 |
| `HRIntentHandler` | `handler/HRIntentHandler.java` | 人事考勤相关 |
| `AlertIntentHandler` | `handler/AlertIntentHandler.java` | 告警相关 |
| `ConfigIntentHandler` | `handler/ConfigIntentHandler.java` | 配置相关 |
| `DataOperationIntentHandler` | `handler/DataOperationIntentHandler.java` | 数据操作 |
| `CameraIntentHandler` | `handler/CameraIntentHandler.java` | 摄像头相关 |

---

## 配置参数清单

```properties
# ========== LLM Fallback ==========
cretas.ai.intent.llm-fallback.enabled=true
cretas.ai.intent.llm-fallback.confidence-threshold=0.3

# ========== 自动学习 ==========
cretas.ai.intent.auto-learn.enabled=true
cretas.ai.intent.auto-learn.confidence-threshold=0.85     # HIGH
cretas.ai.intent.auto-learn.expression-threshold=0.70     # MEDIUM
cretas.ai.intent.auto-learn.max-keywords-per-intent=50

# ========== 语义匹配 ==========
cretas.ai.intent.semantic.enabled=true
cretas.ai.intent.semantic.high-threshold=0.85
cretas.ai.intent.semantic.medium-threshold=0.72
cretas.ai.intent.semantic.fusion-semantic-weight=0.6
cretas.ai.intent.semantic.fusion-keyword-weight=0.4

# ========== 关键词权重 ==========
cretas.ai.intent.weight.regex-match-score=100
cretas.ai.intent.weight.keyword-match-score=10
cretas.ai.intent.weight.operation-type-match-bonus=25
cretas.ai.intent.weight.operation-type-mismatch-penalty=20

# ========== 关键词晋升 ==========
cretas.ai.keyword.promotion.min-factories=3
cretas.ai.keyword.promotion.min-effectiveness=0.80

# ========== 语义缓存 ==========
cretas.ai.semantic-cache.similarity-threshold=0.92
cretas.ai.semantic-cache.ttl-hours=24
```

### 硬编码常量位置

| 常量 | 文件 | 行号 |
|------|------|------|
| `STOP_WORDS` (45个) | `AIIntentServiceImpl.java` | 182 |
| `QUERY_INDICATORS` | `AIIntentServiceImpl.java` | 195 |
| `UPDATE_INDICATORS` | `AIIntentServiceImpl.java` | 204 |

---

## API 端点汇总

### 意图识别 API

| 方法 | 端点 | 功能 | Controller |
|------|------|------|------------|
| POST | `/api/mobile/{factoryId}/ai-intents/execute` | 执行意图识别 | `AIIntentConfigController` |
| POST | `/api/mobile/{factoryId}/ai-intents/recognize` | 识别意图 | `AIIntentConfigController` |
| GET | `/api/mobile/{factoryId}/ai-intents` | 获取意图列表 | `AIIntentConfigController` |
| GET | `/api/mobile/{factoryId}/ai-intents/{intentCode}` | 获取单个意图 | `AIIntentConfigController` |
| PUT | `/api/mobile/{factoryId}/ai-intents/{intentCode}` | 更新意图 | `AIIntentConfigController` |

### 意图分析 API

| 方法 | 端点 | 功能 | Controller |
|------|------|------|------------|
| GET | `/api/mobile/{factoryId}/intent-analysis/suggestions` | 优化建议列表 | `IntentAnalysisController` |
| POST | `/api/mobile/{factoryId}/intent-analysis/suggestions/{id}/apply` | 应用建议 | `IntentAnalysisController` |
| POST | `/api/mobile/{factoryId}/intent-analysis/intents/{code}/request-promotion` | 申请晋升 | `IntentAnalysisController` |
| GET | `/api/mobile/{factoryId}/intent-analysis/platform/pending-promotions` | 待审批列表 | `IntentAnalysisController` |
| POST | `/api/mobile/{factoryId}/intent-analysis/platform/promotions/{id}/approve` | 审批晋升 | `IntentAnalysisController` |

### 反馈 API

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/api/mobile/{factoryId}/ai-intents/feedback/positive` | 正向反馈 |
| POST | `/api/mobile/{factoryId}/ai-intents/feedback/negative` | 负向反馈 |

---

## 定时任务

| 时间 | 任务 | 服务 | 方法 |
|------|------|------|------|
| 1:00 AM | 日统计聚合 | ErrorAttributionAnalysisScheduler | `aggregateDailyStats()` |
| 2:00 AM 周一 | 周报告生成 | ErrorAttributionAnalysisScheduler | `generateWeeklyReport()` |
| 3:00 AM | 清理旧数据 | ErrorAttributionAnalysisScheduler | `cleanupOldData()` |
| 4:00 AM | 生成优化建议 | ErrorAttributionAnalysisScheduler | `generateSuggestions()` |
| 4:00 AM | 刷新Embedding缓存 | IntentEmbeddingCacheServiceImpl | `refreshCache()` |
| 5:00 AM | 清理低效关键词 | KeywordMaintenanceScheduler | `cleanupIneffective()` |
| 5:30 AM | 重计算关键词特异性 | KeywordMaintenanceScheduler | `recalculateSpecificity()` |
| 6:00 AM | 检查关键词晋升资格 | KeywordMaintenanceScheduler | `checkPromotionEligibility()` |

---

## 数据表索引

### 核心表

| 表名 | 用途 |
|------|------|
| `ai_intent_config` | 意图配置 |
| `ai_intent_config_history` | 意图配置历史版本 |
| `ai_learned_expressions` | 已学习表达 |
| `ai_training_samples` | 训练样本 |
| `keyword_effectiveness` | 关键词效果 |
| `intent_match_records` | 匹配记录 |
| `intent_optimization_suggestions` | 优化建议 |
| `semantic_cache` | 语义缓存 |
| `semantic_cache_config` | 语义缓存配置 |

### 关键索引

| 表 | 索引 | 字段 |
|-----|------|------|
| `ai_intent_config` | `idx_factory_code` | `factory_id, intent_code` |
| `ai_learned_expressions` | `idx_expression_hash` | `expression_hash` |
| `keyword_effectiveness` | `idx_factory_intent_keyword` | `factory_id, intent_code, keyword` |
| `intent_optimization_suggestions` | `idx_factory_status` | `factory_id, status` |

---

## 并行工作建议

### Subagent 并行建议
- 可并行: ✅
- 建议:
  1. Agent 1: VectorUtils 工具类 + 清理废弃代码
  2. Agent 2: KeywordLearningService 统一
  3. Agent 3: IntentMatchingConfig 配置统一

### 多 Chat 并行建议
- 可并行: ❌
- 原因: AIIntentServiceImpl.java 被多个改动涉及，避免冲突
- 建议: 单窗口顺序完成

---

## 文档版本

| 版本 | 日期 | 说明 |
|------|------|------|
| V2.0 | 2026-01-06 | 完整架构分析文档 |
