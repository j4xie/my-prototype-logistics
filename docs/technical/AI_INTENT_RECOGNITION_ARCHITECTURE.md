# AI意图识别系统 - 完整架构逻辑图

> 本文档提供 AI 意图识别系统的完整架构分析，包括 5 层识别流程、缓存机制、自我学习、两级审批体系和代码位置索引。
>
> **版本**: v2.1 | **更新日期**: 2026-01-06

---

## 目录
1. [完整架构流程图](#完整架构流程图)
2. [5层识别详细说明](#5层识别详细说明)
3. [三层缓存架构](#三层缓存架构)
4. [自我学习触发条件](#自我学习触发条件)
5. [两级审批体系](#两级审批体系)
6. [核心服务关系图](#核心服务关系图)
7. [完整数据流示例](#完整数据流示例)
8. [API接口汇总](#api接口汇总)
9. [定时任务时间表](#定时任务时间表)
10. [关键配置参数](#关键配置参数)
11. [代码冗余分析](#代码冗余分析)

---

## 完整架构流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        用户输入 (userInput)                              │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  ▼
                    ┌─────────────────────────────┐
                    │       输入正规化处理         │
                    │  - 去除首尾空格              │
                    │  - 统一小写                  │
                    │  - 移除特殊字符              │
                    └─────────────┬───────────────┘
                                  ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    Step 0: 语义缓存查询 (Semantic Cache)                 ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃  服务: SemanticCacheServiceImpl                                          ┃
┃  ┌─────────────────────────────────────────────────────────────────┐    ┃
┃  │ 精确缓存 (Hash)          │ 语义缓存 (向量)                      │    ┃
┃  │ MD5 哈希匹配              │ Embedding 相似度 ≥0.85              │    ┃
┃  │ 延迟 <10ms               │ 延迟 10-50ms                         │    ┃
┃  │ 命中 → 直接返回结果      │ 命中 → 返回意图代码，继续执行        │    ┃
┃  └─────────────────────────────────────────────────────────────────┘    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
         精确缓存命中 ◄──┤
                         │未命中
                         ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    Layer 1: 精确表达匹配 (Exact Expression Match)        ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃  服务: ExpressionLearningServiceImpl                                     ┃
┃  方法: matchExactExpression()                                            ┃
┃  原理: SHA256 Hash 查表, O(1) 复杂度                                     ┃
┃  数据源: ai_learned_expressions.expression_hash                         ┃
┃  置信度: 1.0 (100%)                                                      ┃
┃  自学习: 记录训练样本 (TrainingSample.MatchMethod.EXACT)                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
           匹配成功 ◄──┤
                       │无匹配
                       ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    Layer 2: 正则表达式匹配 (Regex Match)                 ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃  方法: matchesByRegex(intent, normalizedInput)                           ┃
┃  数据源: AIIntentConfig.regexPatterns (JSON数组)                        ┃
┃  分数: regexMatchScore (默认 100)                                        ┃
┃  适用: 明确格式输入 (产品代码、订单号、批次号等)                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
           匹配成功 ◄──┤
                       │无匹配
                       ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    Layer 3: 关键词匹配 (Keyword Match)                   ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃  方法: getMatchedKeywords(intent, normalizedInput, factoryId)            ┃
┃  关键词来源 (三层合并):                                                  ┃
┃    ① 基础关键词: AIIntentConfig.keywords (JSON)                         ┃
┃    ② 工厂级关键词: keyword_effectiveness (factoryId, effectiveness≥0.5) ┃
┃    ③ 全局关键词: AIIntentConfig.globalKeywords                          ┃
┃                                                                          ┃
┃  分数计算:                                                               ┃
┃    baseScore = 关键词数 × 10 + 意图优先级                                ┃
┃    opTypeAdjustment = 操作类型匹配(+25) / 不匹配(-20)                   ┃
┃    finalScore = baseScore + opTypeAdjustment                             ┃
┃                                                                          ┃
┃  操作类型检测:                                                           ┃
┃    QUERY_INDICATORS: [查询, 查看, 获取, 列表, 显示, 统计, 报表...]       ┃
┃    UPDATE_INDICATORS: [创建, 新增, 修改, 更新, 删除, 设置, 添加...]       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                         │
                         ▼
          ┌────────────────────────┐
          │  有关键词匹配结果?     │
          └───────┬────────────────┘
                  │
         ┌────────┴────────┐
         │YES              │NO
         ▼                 ▼
┏━━━━━━━━━━━━━━━━━┓   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Layer 4a: 融合  ┃   ┃    Layer 4b: 纯语义匹配 (Pure Semantic Match)    ┃
┃ 评分 (Fusion)   ┃   ┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃
┃─────────────────┃   ┃  服务: IntentEmbeddingCacheServiceImpl           ┃
┃ 语义×0.6        ┃   ┃  模型: GTE-base-zh (768维向量)                   ┃
┃ + 关键词×0.4    ┃   ┃  统一搜索: 意图配置 + 已学习表达 Embedding        ┃
┗━━━━━━━━━━━━━━━━━┛   ┃  阈值:                                           ┃
                      ┃    HIGH: ≥0.85 → 直接返回                       ┃
                      ┃    MEDIUM: 0.72-0.85 → 融合评分                   ┃
                      ┃    LOW: <0.72 → 交给 LLM                          ┃
                      ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │   最佳置信度 < 0.3 ?        │
                    │   或 无任何匹配结果?        │
                    └─────────────┬───────────────┘
                                  │
               ┌──────────────────┴──────────────────┐
               │YES                                  │NO
               ▼                                     ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ┌─────────────────────────┐
┃      Layer 5: LLM Fallback        ┃    │  返回规则匹配结果       │
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃    │  + 强信号判定            │
┃  服务: LlmIntentFallbackClientImpl┃    │  + 确认机制判定          │
┃  模型: DashScope qwen-plus        ┃    └─────────────────────────┘
┃  API: /api/v1/chat/completions    ┃
┃                                   ┃
┃  返回类型:                        ┃
┃    ① 匹配现有意图 → 自动学习      ┃
┃    ② UNKNOWN → CREATE_INTENT建议 ┃
┃    ③ NEED_INFO → 澄清问题        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           自我学习分支                                   │
│─────────────────────────────────────────────────────────────────────────│
│  置信度 ≥ 0.85 (高):                                                     │
│    → tryAutoLearnKeywords() 学习关键词                                   │
│    → tryAutoLearnExpression() 学习表达                                   │
│                                                                          │
│  置信度 0.70-0.85 (中):                                                  │
│    → 仅 tryAutoLearnExpression() 学习表达                                │
│                                                                          │
│  置信度 < 0.70 (低):                                                     │
│    → 仅记录 TrainingSample (用于后续微调)                                │
│                                                                          │
│  LLM返回 UNKNOWN:                                                        │
│    → tryCreateIntentSuggestion() 生成创建新意图建议                      │
│    → 工厂级: factoryAutoApprove=true → 自动创建                          │
│    → 平台级: 等待平台管理员审批                                          │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Handler 执行分发                                  │
│─────────────────────────────────────────────────────────────────────────│
│  服务: IntentExecutorServiceImpl                                        │
│                                                                          │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐              │
│  │    FORM     │   DATA_OP   │  ANALYSIS   │   SYSTEM    │              │
│  │ FormIntent  │ DataOpInt   │ Quality/    │ SystemInt   │              │
│  │ Handler     │ entHandler  │ AlertHandler│ entHandler  │              │
│  └─────────────┴─────────────┴─────────────┴─────────────┘              │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐              │
│  │   SCALE     │   CAMERA    │    HR       │    CRM      │              │
│  │ ScaleIntent │ CameraInt   │ HRIntent    │ CRMIntent   │              │
│  │ Handler     │ entHandler  │ Handler     │ Handler     │              │
│  └─────────────┴─────────────┴─────────────┴─────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        最终结果 IntentMatchResult                        │
│─────────────────────────────────────────────────────────────────────────│
│  bestMatch: AIIntentConfig         候选意图配置                          │
│  confidence: double                置信度 (0.0-1.0)                      │
│  matchMethod: MatchMethod          匹配方法 (EXACT/REGEX/KEYWORD/...)    │
│  matchedKeywords: List<String>     匹配的关键词                          │
│  candidates: List<CandidateIntent> 候选意图列表                          │
│  isStrongSignal: boolean           是否强信号                            │
│  requiresConfirmation: boolean     是否需要用户确认                      │
│  clarificationQuestion: String     澄清问题 (可选)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5层识别详细说明

### Layer 1: 精确表达匹配 (Exact Expression Match)

| 属性 | 值 |
|------|-----|
| **文件位置** | `AIIntentServiceImpl.java` 行 382-422 |
| **服务** | `ExpressionLearningServiceImpl` |
| **方法** | `matchExactExpression(factoryId, normalizedInput)` |
| **数据源** | `ai_learned_expressions` 表 (expression_hash) |
| **匹配方式** | SHA256 Hash 精确匹配 |
| **复杂度** | O(1) |
| **置信度** | 1.0 (100%) |
| **自学习** | 记录样本到 `ai_training_samples` |

### Layer 2: 正则表达式匹配 (Regex Match)

| 属性 | 值 |
|------|-----|
| **文件位置** | `AIIntentServiceImpl.java` 行 438-445 |
| **方法** | `matchesByRegex(intent, normalizedInput)` |
| **数据源** | `AIIntentConfig.regexPatterns` (JSON数组) |
| **分数** | `regexMatchScore` (默认 100) |
| **优先级** | 仅次于精确匹配 |
| **适用场景** | 产品代码、订单号、批次号等格式化输入 |

### Layer 3: 关键词匹配 (Keyword Match)

| 属性 | 值 |
|------|-----|
| **文件位置** | `AIIntentServiceImpl.java` 行 447-463, 1100-1200 |
| **方法** | `getMatchedKeywords(intent, normalizedInput, factoryId)` |
| **关键词来源** | 三层合并 (基础 + 工厂级 + 全局) |
| **分数计算** | `关键词数 × 10 + 优先级 + 操作类型调整` |
| **操作类型检测** | QUERY/UPDATE/AMBIGUOUS/UNKNOWN |

**操作类型权重调整表**:

| 输入类型 | 意图类型 | 调整 |
|----------|----------|------|
| QUERY | QUERY | +25 |
| QUERY | UPDATE | -20 |
| UPDATE | UPDATE | +25 |
| UPDATE | QUERY | -20 |
| AMBIGUOUS/UNKNOWN | 任何 | 0 |

### Layer 4: 语义匹配 (Semantic Match)

| 属性 | 值 |
|------|-----|
| **文件位置** | `AIIntentServiceImpl.java` 行 466-486, 1651-1758 |
| **服务** | `IntentEmbeddingCacheServiceImpl` |
| **Embedding模型** | GTE-base-zh (768维向量) |
| **统一搜索** | 意图配置 + 已学习表达 Embedding |
| **高阈值** | ≥ 0.85 → 直接返回 |
| **中阈值** | 0.72-0.85 → 融合评分 |
| **低阈值** | < 0.72 → 交给 LLM |
| **融合公式** | `语义×0.6 + 关键词×0.4` |

### Layer 5: LLM Fallback

| 属性 | 值 |
|------|-----|
| **文件位置** | `AIIntentServiceImpl.java` 行 547-655 |
| **服务** | `LlmIntentFallbackClientImpl` |
| **模型** | DashScope qwen-plus |
| **触发条件** | 置信度 < 0.3 或 无匹配 |
| **返回类型** | 现有意图 / UNKNOWN / NEED_INFO |
| **Schema验证** | 严格校验LLM返回格式 |

---

## 三层缓存架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            三层缓存架构                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Layer 1: 语义缓存                                  │   │
│  │                  SemanticCacheServiceImpl                             │   │
│  │                                                                       │   │
│  │  ┌─────────────────────┐    ┌─────────────────────┐                  │   │
│  │  │     精确缓存         │    │     语义缓存         │                  │   │
│  │  │   (Hash查表)        │    │   (向量相似度)       │                  │   │
│  │  │                     │    │                     │                  │   │
│  │  │ • MD5 哈希匹配      │    │ • Embedding 相似度   │                  │   │
│  │  │ • 延迟 <10ms        │    │ • 阈值 ≥0.85        │                  │   │
│  │  │ • 完全相同输入      │    │ • 延迟 10-50ms      │                  │   │
│  │  │ • 返回执行结果      │    │ • 返回意图代码      │                  │   │
│  │  └─────────────────────┘    └─────────────────────┘                  │   │
│  │                                                                       │   │
│  │  配置参数:                                                            │   │
│  │  • enabled: true                                                      │   │
│  │  • cacheTtlHours: 24                                                  │   │
│  │  • similarityThreshold: 0.85                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                Layer 2: Intent Embedding 缓存                         │   │
│  │               IntentEmbeddingCacheServiceImpl                         │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                      启动时预计算                             │     │   │
│  │  │  • 所有 AIIntentConfig 的关键词 → Embedding                  │     │   │
│  │  │  • 所有 LearnedExpression → Embedding                        │     │   │
│  │  │  • 存储: ConcurrentHashMap<factoryId, Map<intentCode, emb>>  │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                      运行时使用                               │     │   │
│  │  │  • Layer 4 语义匹配直接使用内存向量                           │     │   │
│  │  │  • O(1) 查找，避免重复计算                                   │     │   │
│  │  │  • 定时刷新: 每天凌晨 4:00                                   │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              Layer 3: 请求级 Embedding 缓存                           │   │
│  │                                                                       │   │
│  │  • 同一请求内的多次向量计算共享                                       │   │
│  │  • ThreadLocal<Map<String, float[]>>                                  │   │
│  │  • 请求结束后自动清理                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 缓存实现详情

| 缓存类型 | 服务 | 存储 | TTL | 刷新机制 |
|----------|------|------|-----|----------|
| 语义缓存(精确) | SemanticCacheServiceImpl | semantic_cache表 | 24h | 自动过期 |
| 语义缓存(向量) | SemanticCacheServiceImpl | semantic_cache表 | 24h | 自动过期 |
| Intent Embedding | IntentEmbeddingCacheServiceImpl | ConcurrentHashMap | 永久 | 每天4:00刷新 |
| Expression Embedding | IntentEmbeddingCacheServiceImpl | ConcurrentHashMap | 永久 | 学习时更新 |
| 请求级缓存 | ThreadLocal | 内存 | 请求结束 | 自动清理 |

---

## 自我学习触发条件

### 触发条件总览表

| 触发点 | 条件 | 学习内容 | 代码位置 |
|--------|------|----------|----------|
| **LLM高置信度** | 置信度 ≥ 0.85 | 关键词 + 表达 | `AIIntentServiceImpl:619-637` |
| **LLM中置信度** | 0.70 ≤ 置信度 < 0.85 | 仅表达 | `AIIntentServiceImpl:619-637` |
| **LLM低置信度** | 置信度 < 0.70 | 仅记录样本 | `AIIntentServiceImpl:619-637` |
| **LLM返回UNKNOWN** | LLM识别为新意图 | CREATE_INTENT建议 | `LlmIntentFallbackClient:260-281` |
| **用户正向反馈** | 确认匹配正确 | 更新关键词效果 | `AIIntentServiceImpl:1512-1539` |
| **用户负向反馈** | 选择正确意图 | 学习关键词到正确意图 | `AIIntentServiceImpl:1572-1633` |
| **精确匹配** | Layer 1 命中 | 记录训练样本 | `AIIntentServiceImpl:409-414` |

### 分层自动学习策略

```
置信度区间            │ 关键词学习 │ 表达学习 │ 记录样本
──────────────────────┼───────────┼─────────┼──────────
≥ 0.85 (高置信度)     │    ✅     │    ✅   │    ✅
0.70 ~ 0.85 (中置信度)│    ❌     │    ✅   │    ✅
< 0.70 (低置信度)     │    ❌     │    ❌   │    ✅
```

### 学习内容详解

#### 1. 关键词学习 (`tryAutoLearnKeywords`)

**文件**: `AIIntentServiceImpl.java` 行 1302-1390

```
提取流程:
  用户输入 → 分词 (标点/空格) → 过滤停用词 (45个)
           → 过滤已存在关键词 → 过滤<2字符 → 过滤纯数字
           → 取最多3个新词 → 保存到 AIIntentConfig.keywords
```

#### 2. 表达学习 (`tryAutoLearnExpression`)

**文件**: `ExpressionLearningServiceImpl.java` 行 50-120

```
保存内容:
  - expression: 完整用户输入
  - expression_hash: SHA256
  - embedding_vector: 768维向量
  - source_type: LLM_FALLBACK / USER_FEEDBACK / MANUAL
  - confidence: LLM置信度
```

#### 3. 训练样本收集 (`recordTrainingSample`)

```
收集字段:
  - user_input: 原始输入
  - matched_intent_code: 匹配意图
  - match_method: EXACT/KEYWORD/SEMANTIC/LLM
  - confidence: 置信度
  - is_correct: 用户反馈 (null=未反馈)
```

#### 4. CREATE_INTENT建议 (`tryCreateIntentSuggestion`)

**文件**: `LlmIntentFallbackClientImpl.java` 行 260-310

```
触发条件: LLM返回 intentCode = "UNKNOWN"
生成内容:
  - suggested_intent_code: LLM建议的意图代码
  - suggested_intent_name: LLM建议的意图名称
  - suggested_keywords: LLM建议的关键词 (JSON)
  - suggested_category: 分类 (ANALYSIS/DATA_OP/FORM/...)
  - llm_confidence: LLM置信度
  - llm_reasoning: LLM推理说明
```

---

## 两级审批体系

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         两级审批体系                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    工厂级意图 (factoryId ≠ null)                      │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │        CREATE_INTENT 建议 (LLM识别新意图)                    │     │   │
│  │  │                                                             │     │   │
│  │  │   LLM 返回 UNKNOWN + 建议                                   │     │   │
│  │  │       │                                                     │     │   │
│  │  │       ▼                                                     │     │   │
│  │  │   生成 IntentOptimizationSuggestion                         │     │   │
│  │  │   (suggestionType = CREATE_INTENT)                          │     │   │
│  │  │       │                                                     │     │   │
│  │  │       ▼                                                     │     │   │
│  │  │   ┌─────────────────────────────────────────┐               │     │   │
│  │  │   │ factoryAutoApprove = true ? (默认开启)  │               │     │   │
│  │  │   └───────────────┬─────────────────────────┘               │     │   │
│  │  │                   │                                         │     │   │
│  │  │          ┌────────┴────────┐                                │     │   │
│  │  │          │YES              │NO                              │     │   │
│  │  │          ▼                 ▼                                │     │   │
│  │  │    自动创建        等待工厂管理员                            │     │   │
│  │  │    AIIntentConfig  手动审批                                  │     │   │
│  │  │    (status=APPLIED)                                         │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    平台级意图 (factoryId = null)                      │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                    意图晋升流程                              │     │   │
│  │  │                                                             │     │   │
│  │  │   工厂级意图                                                │     │   │
│  │  │       │                                                     │     │   │
│  │  │       ▼                                                     │     │   │
│  │  │   工厂管理员申请晋升                                        │     │   │
│  │  │   POST /{factoryId}/intent-analysis/intents/{code}/         │     │   │
│  │  │         request-promotion                                   │     │   │
│  │  │       │                                                     │     │   │
│  │  │       ▼                                                     │     │   │
│  │  │   生成 PROMOTE_TO_PLATFORM 建议                             │     │   │
│  │  │   (IntentOptimizationSuggestion)                           │     │   │
│  │  │       │                                                     │     │   │
│  │  │       ▼                                                     │     │   │
│  │  │   平台管理员查看待审批                                      │     │   │
│  │  │   GET /{factoryId}/intent-analysis/platform/                │     │   │
│  │  │        pending-promotions                                   │     │   │
│  │  │       │                                                     │     │   │
│  │  │       ▼                                                     │     │   │
│  │  │   平台管理员审批                                            │     │   │
│  │  │   POST /{factoryId}/intent-analysis/platform/               │     │   │
│  │  │         promotions/{suggestionId}/approve                   │     │   │
│  │  │       │                                                     │     │   │
│  │  │   ┌───┴───┐                                                 │     │   │
│  │  │   ▼       ▼                                                 │     │   │
│  │  │ 通过    拒绝                                                 │     │   │
│  │  │   │       │                                                 │     │   │
│  │  │   ▼       ▼                                                 │     │   │
│  │  │ 设置    标记 REJECTED                                        │     │   │
│  │  │ factoryId=null  + 记录 approvalNotes                        │     │   │
│  │  │ (变为平台级)                                                 │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    建议状态流转                                       │   │
│  │                                                                       │   │
│  │       PENDING ──────────────────────────────────────▶ EXPIRED        │   │
│  │         │                                       (30天后自动过期)       │   │
│  │         │                                                            │   │
│  │    ┌────┴────┐                                                       │   │
│  │    ▼         ▼                                                       │   │
│  │ APPLIED   REJECTED                                                   │   │
│  │ (已采纳)   (已拒绝)                                                   │   │
│  │    │         │                                                       │   │
│  │    ▼         ▼                                                       │   │
│  │ • 创建新意图  • 记录拒绝原因 (rejectReason)                          │   │
│  │ • 更新规则   • 记录审批备注 (approvalNotes)                          │   │
│  │ • 记录操作人  • 支持重新申请                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 审批相关API

| 端点 | 方法 | 功能 | 角色要求 |
|------|------|------|----------|
| `/{factoryId}/intent-analysis/intents/{code}/request-promotion` | POST | 申请意图晋升 | 工厂管理员 |
| `/{factoryId}/intent-analysis/platform/pending-promotions` | GET | 查看待审批列表 | 平台管理员 |
| `/{factoryId}/intent-analysis/platform/promotions/{id}/approve` | POST | 审批晋升请求 | 平台管理员 |
| `/{factoryId}/intent-analysis/suggestions/{id}/approve-create-intent` | POST | 审批新意图创建 | 工厂/平台管理员 |

### IntentOptimizationSuggestion 实体

**文件**: `IntentOptimizationSuggestion.java`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| factoryId | String | 工厂ID |
| intentCode | String | 关联意图代码 |
| suggestionType | Enum | CREATE_INTENT / PROMOTE_TO_PLATFORM / ADD_KEYWORD / ... |
| suggestionTitle | String | 建议标题 |
| suggestionDetail | TEXT | 建议详情 |
| supportingExamples | JSON | 支持样例 |
| frequency | Integer | 出现频率 |
| impactScore | Decimal | 影响分数 (0-100) |
| status | Enum | PENDING / APPLIED / REJECTED / EXPIRED |
| appliedAt | DateTime | 应用时间 |
| appliedBy | Long | 应用人ID |
| rejectReason | TEXT | 拒绝原因 |
| approvalNotes | TEXT | 审批备注 |
| suggestedIntentCode | String | LLM建议的意图代码 |
| suggestedIntentName | String | LLM建议的意图名称 |
| suggestedKeywords | JSON | LLM建议的关键词 |
| suggestedCategory | String | LLM建议的分类 |
| llmConfidence | Decimal | LLM置信度 |
| llmReasoning | TEXT | LLM推理说明 |
| createdIntentId | String | 创建后的意图ID |
| expiredAt | DateTime | 过期时间 (默认30天) |

---

## 核心服务关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          服务调用关系                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ┌─────────────────────┐                              │
│                        │ AIIntentConfigCtrl  │                              │
│                        │ IntentAnalysisCtrl  │                              │
│                        └──────────┬──────────┘                              │
│                                   │                                          │
│                                   ▼                                          │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                    IntentExecutorServiceImpl                       │     │
│   │                                                                    │     │
│   │  • 编排执行流程                                                    │     │
│   │  • 权限校验 (checkPermission)                                      │     │
│   │  • 审批检查 (checkApproval)                                        │     │
│   │  • Handler 路由                                                    │     │
│   │  • SSE 流式返回                                                    │     │
│   └────────────────────────────┬──────────────────────────────────────┘     │
│                                │                                            │
│            ┌───────────────────┼───────────────────┐                        │
│            ▼                   ▼                   ▼                        │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │ SemanticCache   │  │ AIIntentService │  │ IntentHandler   │            │
│   │ ServiceImpl     │  │ Impl            │  │ (多个实现)       │            │
│   │                 │  │                 │  │                 │            │
│   │ • 精确/语义缓存  │  │ • 5层意图识别   │  │ • Form          │            │
│   │ • TTL管理       │  │ • 权限校验      │  │ • DataOp        │            │
│   │ • 向量相似度    │  │ • 配置管理      │  │ • Analysis      │            │
│   └────────┬────────┘  └────────┬────────┘  │ • Scale/Camera  │            │
│            │                    │           └─────────────────┘            │
│            │                    │                                           │
│            │           ┌────────┴────────┐                                  │
│            │           ▼                 ▼                                  │
│            │   ┌─────────────────┐ ┌─────────────────┐                     │
│            │   │ IntentEmbedding │ │ LlmIntentFallb  │                     │
│            │   │ CacheServiceImpl│ │ ackClientImpl   │                     │
│            │   │                 │ │                 │                     │
│            │   │ • 预计算 Embed  │ │ • DashScope调用  │                     │
│            │   │ • 融合评分      │ │ • Schema验证     │                     │
│            │   │ • 统一搜索      │ │ • 自动学习触发   │                     │
│            │   └────────┬────────┘ │ • 建议生成       │                     │
│            │            │          └────────┬────────┘                     │
│            │            │                   │                               │
│            └────────────┼───────────────────┘                               │
│                         │                                                   │
│                         ▼                                                   │
│            ┌─────────────────────────────────────┐                         │
│            │        EmbeddingClient              │                         │
│            │                                     │                         │
│            │  • DjlEmbeddingClient (推荐)        │                         │
│            │  • 模型: gte-base-zh                │                         │
│            │  • 维度: 768                        │                         │
│            └─────────────────────────────────────┘                         │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        学习相关服务                                  │   │
│   │                                                                      │   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│   │  │ ExpressionLearn │  │ KeywordEffect   │  │ IntentOptimiza  │      │   │
│   │  │ ingServiceImpl  │  │ ivenessService  │  │ tionSuggestion  │      │   │
│   │  │                 │  │                 │  │ Repository      │      │   │
│   │  │ • 表达学习      │  │ • 关键词效果    │  │                 │      │   │
│   │  │ • Hash去重      │  │ • 反馈统计      │  │ • 优化建议管理  │      │   │
│   │  │ • Embedding生成 │  │ • 评分调整      │  │ • 审批流程      │      │   │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 完整数据流示例

```
用户输入: "查询今天的原料库存"
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 0: 语义缓存查询                                                 │
│    - 计算输入 MD5 Hash: abc123...                                   │
│    - 精确缓存: 未命中                                                │
│    - 语义缓存: 计算 Embedding → 相似度 0.78 (未达阈值0.85)           │
│    - 结果: 缓存未命中，继续识别流程                                  │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: Layer 1 精确表达匹配                                         │
│    - 规范化: "查询今天的原料库存"                                    │
│    - Hash 查找 LearnedExpression: 未命中                             │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 2: Layer 2-3 正则 + 关键词匹配                                  │
│    - 正则: 无匹配                                                    │
│    - 检测操作类型: "查询" → QUERY                                    │
│    - 关键词匹配:                                                     │
│      • MATERIAL_BATCH_QUERY: ["原料", "库存", "查询"] → 命中3个      │
│      • PRODUCTION_BATCH_QUERY: ["生产", "批次"] → 命中0个            │
│    - 最高分意图: MATERIAL_BATCH_QUERY, score=55                     │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 3: Layer 4 语义匹配 + 融合评分                                  │
│    - 计算用户输入 Embedding (768维)                                  │
│    - 与所有意图 Embedding 计算余弦相似度                             │
│    - 最高相似度: 0.88 (MATERIAL_BATCH_QUERY)                         │
│    - 融合评分: 0.88 * 0.6 + 0.75 * 0.4 = 0.828                      │
│    - 判定: HIGH 置信度 (≥ 0.72)                                      │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 4: 置信度评估                                                   │
│    - 最终置信度: 0.828                                               │
│    - 第二候选差距: 0.828 - 0.45 = 0.378 > 0.3                        │
│    - 判定: 强信号，直接执行                                          │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 5: 权限 & 审批检查                                              │
│    - 意图: MATERIAL_BATCH_QUERY                                      │
│    - requiredRoles: [] (空 = 所有角色允许)                           │
│    - requiresApproval: false                                         │
│    - 结果: 允许执行                                                  │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 6: Handler 执行                                                 │
│    - 路由: MaterialIntentHandler                                     │
│    - 执行查询: materialBatchRepository.findByFactoryId(...)          │
│    - 返回结果: { items: [...], total: 42 }                           │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 7: 缓存 & 记录                                                  │
│    - 写入语义缓存 (TTL=24h)                                          │
│    - 写入 IntentMatchRecord (统计用)                                 │
│    - 置信度 0.828 < 0.85，不触发关键词学习                           │
│    - 置信度 0.828 ≥ 0.70，触发表达学习                               │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
返回结果:
{
  "success": true,
  "data": {
    "status": "COMPLETED",
    "intentCode": "MATERIAL_BATCH_QUERY",
    "confidence": 0.828,
    "matchMethod": "SEMANTIC",
    "result": { "items": [...], "total": 42 }
  }
}
```

---

## API接口汇总

### 意图执行类

| 端点 | 方法 | 功能 | 文件位置 |
|------|------|------|----------|
| `/api/mobile/{factoryId}/ai-intents/recognize` | POST | 测试意图识别 | `AIIntentConfigController:180` |
| `/api/mobile/{factoryId}/ai-intents/execute` | POST | 执行意图 (同步) | `AIIntentConfigController:220` |
| `/api/mobile/{factoryId}/ai-intents/execute/stream` | POST | 流式执行 (SSE) | `AIIntentConfigController:260` |
| `/api/mobile/{factoryId}/ai-intents/preview` | POST | 预览执行计划 | `AIIntentConfigController:300` |

### 反馈与学习类

| 端点 | 方法 | 功能 | 文件位置 |
|------|------|------|----------|
| `/api/mobile/{factoryId}/ai-intents/feedback/positive` | POST | 正向反馈 | `AIIntentConfigController:350` |
| `/api/mobile/{factoryId}/ai-intents/feedback/negative` | POST | 负向反馈 | `AIIntentConfigController:380` |
| `/api/mobile/{factoryId}/ai-intents/keyword-stats` | GET | 关键词效果统计 | `AIIntentConfigController:420` |

### 配置管理类

| 端点 | 方法 | 功能 | 文件位置 |
|------|------|------|----------|
| `/api/mobile/{factoryId}/ai-intents` | GET | 意图列表 | `AIIntentConfigController:80` |
| `/api/mobile/{factoryId}/ai-intents/{code}` | GET | 意图详情 | `AIIntentConfigController:100` |
| `/api/mobile/{factoryId}/ai-intents/{code}` | PUT | 更新意图 | `AIIntentConfigController:120` |
| `/api/mobile/{factoryId}/ai-intents/{code}/rollback` | POST | 回滚版本 | `AIIntentConfigController:140` |
| `/api/mobile/{factoryId}/ai-intents/{code}/history` | GET | 版本历史 | `AIIntentConfigController:160` |

### 分析与优化类

| 端点 | 方法 | 功能 | 文件位置 |
|------|------|------|----------|
| `/api/mobile/{factoryId}/intent-analysis/statistics` | GET | 每日统计 | `IntentAnalysisController:80` |
| `/api/mobile/{factoryId}/intent-analysis/trends/match-rate` | GET | 匹配率趋势 | `IntentAnalysisController:120` |
| `/api/mobile/{factoryId}/intent-analysis/patterns/failures` | GET | 失败模式分析 | `IntentAnalysisController:160` |
| `/api/mobile/{factoryId}/intent-analysis/suggestions` | GET | 优化建议列表 | `IntentAnalysisController:200` |
| `/api/mobile/{factoryId}/intent-analysis/suggestions/{id}/apply` | POST | 采纳建议 | `IntentAnalysisController:240` |

### 审批类

| 端点 | 方法 | 功能 | 文件位置 |
|------|------|------|----------|
| `/api/mobile/{factoryId}/intent-analysis/intents/{code}/request-promotion` | POST | 申请晋升 | `IntentAnalysisController:640` |
| `/api/mobile/{factoryId}/intent-analysis/platform/pending-promotions` | GET | 待审批列表 | `IntentAnalysisController:700` |
| `/api/mobile/{factoryId}/intent-analysis/platform/promotions/{id}/approve` | POST | 审批晋升 | `IntentAnalysisController:750` |
| `/api/mobile/{factoryId}/intent-analysis/suggestions/{id}/approve-create-intent` | POST | 审批新意图 | `IntentAnalysisController:500` |

---

## 定时任务时间表

| 时间 | 任务 | 服务 | 说明 |
|------|------|------|------|
| 1:00 AM | 日统计聚合 | ErrorAttributionAnalysisScheduler | 聚合前一天的匹配记录 |
| 2:00 AM 周一 | 周报告生成 | ErrorAttributionAnalysisScheduler | 生成周度分析报告 |
| 3:00 AM | 清理旧数据 | ErrorAttributionAnalysisScheduler | 清理30天前的数据 |
| 4:00 AM | 生成优化建议 | ErrorAttributionAnalysisScheduler | 分析失败模式生成建议 |
| 4:00 AM | 刷新Embedding缓存 | IntentEmbeddingCacheServiceImpl | 重新加载所有意图向量 |
| 5:00 AM | 清理低效关键词 | KeywordMaintenanceScheduler | 移除效果分<0.3的关键词 |
| 5:30 AM | 重计算关键词特异性 | KeywordMaintenanceScheduler | 更新关键词区分度 |
| 6:00 AM | 检查关键词晋升资格 | KeywordMaintenanceScheduler | 工厂级→全局关键词晋升 |

---

## 关键配置参数

```yaml
cretas:
  ai:
    intent:
      # === LLM Fallback ===
      llm-fallback:
        enabled: true
        confidence-threshold: 0.3          # 低于此值触发LLM

      # === 自动学习 ===
      auto-learn:
        enabled: true
        confidence-threshold: 0.85         # 高置信度学习关键词
        expression-threshold: 0.70          # 中置信度学习表达
        max-keywords-per-intent: 50

      # === 语义匹配 ===
      semantic:
        enabled: true
        high-threshold: 0.85               # HIGH置信度
        medium-threshold: 0.72             # MEDIUM置信度
        fusion-semantic-weight: 0.6        # 融合时语义权重
        fusion-keyword-weight: 0.4         # 融合时关键词权重

      # === 关键词权重 ===
      weight:
        regex-match-score: 100
        keyword-match-score: 10
        operation-type-match-bonus: 25
        operation-type-mismatch-penalty: 20

      # === 自动创建意图 ===
      auto-create:
        enabled: true
        min-confidence: 0.6
        factory-auto-approve: true          # 工厂级自动审批

    # === 语义缓存 ===
    semantic-cache:
      enabled: true
      ttl-hours: 24
      similarity-threshold: 0.85

    # === Embedding服务 ===
    embedding:
      model: gte-base-zh
      dimension: 768
      cache-refresh-cron: "0 0 4 * * ?"    # 每天4点刷新

    # === 关键词晋升 ===
    keyword:
      promotion:
        min-factories: 3                    # 最少采用工厂数
        min-effectiveness: 0.80             # 最低效果分
```

---

## 代码冗余分析

### 冗余问题汇总

| # | 冗余类型 | 涉及文件 | 严重程度 | 建议 |
|---|----------|----------|----------|------|
| 1 | **关键词学习重复** | AIIntentServiceImpl vs KeywordEffectivenessService | 🔴 高 | 统一到KeywordLearningService |
| 2 | **Embedding计算重复** | ExpressionLearning + EmbeddingCache | 🔴 高 | 统一到EmbeddingService |
| 3 | **意图匹配多层实现** | 4个不同的matchIntent方法 | 🟡 中 | 合并为IntentMatchingService |
| 4 | **缓存管理重复** | Spring Cache + Manual Cache + Semantic Cache | 🟡 中 | 统一缓存框架 |
| 5 | **反馈处理分离** | recordPositiveFeedback调用多服务 | 🟡 中 | 创建FeedbackProcessService |
| 6 | **配置参数混乱** | 全局@Value + FactoryConfig | 🟡 中 | 统一到AIConfigService |

### 建议优化架构

```
当前架构:
  AIIntentServiceImpl
    ├─ KeywordEffectivenessService
    ├─ ExpressionLearningService
    ├─ IntentEmbeddingCacheService
    ├─ SemanticCacheService
    └─ LlmIntentFallbackClient

建议架构:
  AIIntentService (主入口)
    ├─ IntentMatchingService (统一匹配)
    │    ├─ ExactMatcher
    │    ├─ RegexMatcher
    │    ├─ KeywordMatcher
    │    └─ SemanticMatcher
    ├─ LearningService (统一学习)
    │    ├─ KeywordLearning
    │    ├─ ExpressionLearning
    │    └─ SampleCollection
    ├─ EmbeddingService (统一Embedding)
    └─ UnifiedCacheService (统一缓存)
```

---

## 性能指标

| 指标 | 目标值 | 实现方式 |
|------|--------|----------|
| 精确缓存命中延迟 | < 10ms | MD5 Hash 查表 |
| 语义缓存命中延迟 | < 50ms | 向量相似度计算 |
| 意图识别延迟 (无LLM) | < 100ms | 内存 Embedding 缓存 |
| 意图识别延迟 (含LLM) | < 3s | DashScope API |
| 缓存命中率 | > 60% | 精确 + 语义双层缓存 |
| 自动学习覆盖率 | 持续提升 | 高置信度自动学习 |

---

> 文档版本: v2.1 | 最后更新: 2026-01-06
