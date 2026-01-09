# AI 意图识别系统 - 完整问题分析流程

> 本文档详细说明用户提出任何问题后，系统如何逐层分析并处理的完整逻辑。
>
> 最后更新：2026-01-08

---

## 目录

1. [整体架构图](#整体架构图)
2. [Layer 0: QuestionType 预筛](#layer-0-questiontype-预筛)
3. [Layer 1-4: 意图匹配层](#layer-1-4-意图匹配层)
4. [Layer 5: LLM 兜底](#layer-5-llm-兜底)
5. [Handler 执行阶段](#handler-执行阶段)
6. [完整流程示例](#完整流程示例)
7. [关键配置文件](#关键配置文件)

---

## 整体架构图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           用户输入 (userInput)                               │
│                         例: "有什么好的管理建议"                              │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
                                  ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃     Layer 0: QuestionType 预筛                                              ┃
┃     ─────────────────────────────                                           ┃
┃     判断输入类型:                                                            ┃
┃       • CONVERSATIONAL (闲聊) → 直接 LLM 回复                               ┃
┃       • GENERAL_QUESTION (泛问题) → 直接 LLM 回复                           ┃
┃       • OPERATIONAL_COMMAND (操作指令) → 进入意图匹配                        ┃
┃       • UNDETERMINED (不确定) → 进入意图匹配                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
        [CONVERSATIONAL /              [OPERATIONAL_COMMAND /
         GENERAL_QUESTION]                UNDETERMINED]
                  │                               │
                  ▼                               ▼
        ┌─────────────────┐          ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
        │   直接返回:      │          ┃   5层意图匹配流水线                    ┃
        │   intentRecog-  │          ┃   ──────────────────                   ┃
        │   nized: false  │          ┃   Layer 1: 关键词精确匹配              ┃
        │   status:       │          ┃         ↓ 无匹配                       ┃
        │   COMPLETED     │          ┃   Layer 2: 正则表达式匹配              ┃
        │                 │          ┃         ↓ 无匹配                       ┃
        │   (由 LLM 给出   │          ┃   Layer 3: 语义缓存匹配               ┃
        │    智能回复)     │          ┃         ↓ 无匹配                       ┃
        └─────────────────┘          ┃   Layer 4: 融合评分匹配               ┃
                                     ┃         ↓ 置信度 < 阈值                ┃
                                     ┃   Layer 5: LLM Fallback               ┃
                                     ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                                  │
                                                  ▼
                                     ┌────────────────────────┐
                                     │  匹配成功?              │
                                     │  intentRecognized:     │
                                     │  true / false          │
                                     └────────────────────────┘
                                                  │
                                    ┌─────────────┴─────────────┐
                                    │                           │
                              [true: 有意图]              [false: 无意图]
                                    │                           │
                                    ▼                           ▼
                         ┌──────────────────┐        ┌──────────────────┐
                         │  执行 Handler    │        │  返回 UNKNOWN    │
                         │  调用相关 API    │        │  或 LLM 回复     │
                         └──────────────────┘        └──────────────────┘
```

---

## Layer 0: QuestionType 预筛

这是**最关键的第一道关卡**，决定用户输入是否进入业务意图匹配流程。

### 四种 QuestionType

| 类型 | 说明 | 后续处理 |
|------|------|----------|
| `CONVERSATIONAL` | 闲聊/打招呼 | 直接 LLM 回复，不匹配意图 |
| `GENERAL_QUESTION` | 泛问题/建议类 | 直接 LLM 回复，不匹配意图 |
| `OPERATIONAL_COMMAND` | 明确操作指令 | 进入5层意图匹配 |
| `UNDETERMINED` | 无法确定 | 进入5层意图匹配 |

### 检测逻辑

```java
// 文件: IntentKnowledgeBase.java

public QuestionType detectQuestionType(String input) {
    // 1. 检查闲聊指示词
    if (matchesAny(input, conversationalIndicators)) {
        return CONVERSATIONAL;  // "你好"、"谢谢" 等
    }

    // 2. 检查泛问题指示词 (关键!)
    if (matchesAny(input, generalQuestionIndicators)) {
        return GENERAL_QUESTION;  // "有什么建议"、"管理建议" 等
    }

    // 3. 检查操作指示词
    if (matchesAny(input, operationalIndicators)) {
        return OPERATIONAL_COMMAND;  // "查询"、"创建"、"删除" 等
    }

    return UNDETERMINED;
}
```

### generalQuestionIndicators 示例

```java
private static final Set<String> generalQuestionIndicators = Set.of(
    // 建议类
    "有什么建议", "管理建议", "好的建议", "什么建议", "啥建议",
    "有何建议", "一些建议", "给我建议",

    // 开放性问题
    "为什么", "怎么回事", "什么原因", "如何理解",
    "是什么", "有哪些", "什么区别", "什么好处",

    // 泛化询问
    "怎么样", "怎么办", "什么情况", "什么意思",
    "能不能", "可以吗", "行不行"
);
```

### 预筛的意义

| 输入 | 检测结果 | 说明 |
|------|----------|------|
| "有什么好的管理建议" | `GENERAL_QUESTION` | 包含"管理建议"，不进入意图匹配 |
| "查询原料库存" | `OPERATIONAL_COMMAND` | 包含"查询"，进入意图匹配 |
| "你好" | `CONVERSATIONAL` | 闲聊，直接 LLM |
| "带鱼还剩多少" | `UNDETERMINED` | 进入意图匹配尝试 |

---

## Layer 1-4: 意图匹配层

只有 `OPERATIONAL_COMMAND` 或 `UNDETERMINED` 类型才会进入。

### Layer 1: 关键词精确匹配

```java
// 检查 userInput 是否包含意图配置的 keywords
for (AIIntentConfig config : allConfigs) {
    List<String> keywords = parseKeywords(config.getKeywords());
    for (String keyword : keywords) {
        if (input.contains(keyword)) {
            matchedIntents.add(config);
            break;
        }
    }
}
```

- **匹配方式**: 字符串包含检查
- **置信度**: 1.0 (完全匹配)
- **速度**: O(n×m)，n=意图数，m=关键词数

### Layer 2: 正则表达式匹配

```java
// 检查 userInput 是否匹配意图的 regex 模式
for (AIIntentConfig config : allConfigs) {
    if (config.getRegexPattern() != null) {
        if (Pattern.matches(config.getRegexPattern(), input)) {
            return IntentMatchResult.of(config, "REGEX", 1.0);
        }
    }
}
```

- **用途**: 复杂模式匹配（如"批次号 XXX"）
- **置信度**: 1.0

### Layer 3: 语义缓存匹配

```java
// 检查语义缓存 (SemanticCache)
// 之前 LLM 识别过的相同语义表达可直接复用
Optional<CachedResult> cached = semanticCache.get(input);
if (cached.isPresent() && cached.get().confidence >= 0.85) {
    return IntentMatchResult.of(cached.get().intentCode, "CACHE", cached.get().confidence);
}
```

- **来源**: 之前 LLM 识别的结果缓存
- **阈值**: 置信度 ≥ 0.85
- **性能**: 避免重复调用 LLM

### Layer 4: 融合评分 (Fusion Scoring)

```java
// 综合多维度计算最终得分
FusionScore score = FusionScore.builder()
    .keywordScore(keywordMatcher.score(input, config))   // 关键词匹配度
    .semanticScore(embedding.similarity(input, config))  // 语义相似度
    .contextScore(contextAnalyzer.score(session, config)) // 上下文相关度
    .build();

double finalScore = score.keyword * 0.4 + score.semantic * 0.6;
```

- **组合**: 关键词 40% + 语义 60%
- **阈值**: `finalScore >= 0.65` 才认为匹配成功
- **输出**: 选择得分最高的意图

---

## Layer 5: LLM 兜底

当 Layer 1-4 都无法匹配时，调用 LLM 进行意图理解。

### 调用流程

```java
// LlmIntentFallbackClientImpl.java
public LlmFallbackResult fallbackRecognize(String userInput, List<AIIntentConfig> candidates) {

    String prompt = buildPrompt(userInput, candidates);

    // 调用 DashScope API (qwen-plus)
    String response = dashScopeClient.chat(prompt);

    // 解析 LLM 响应
    return parseResponse(response);
}
```

### LLM 返回类型

| 返回 | 说明 | 前端处理 |
|------|------|----------|
| `intentCode` | 识别到具体意图 | 执行对应 Handler |
| `UNKNOWN` | 无法识别 | 显示帮助或重试提示 |
| `NEED_INFO` | 需要更多信息 | 追问用户补充 |

### 自学习触发

```java
// LLM 识别成功后，自动学习
if (result.confidence >= 0.85) {
    expressionLearningService.learnExpression(
        userInput,
        result.intentCode,
        result.confidence
    );
}
```

---

## Handler 执行阶段

意图匹配成功后，进入 Handler 执行。

### 执行流程

```
意图匹配结果 (intentCode: MATERIAL_BATCH_QUERY)
        │
        ▼
┌───────────────────────────────────────┐
│  IntentExecutorServiceImpl            │
│  ──────────────────────────           │
│  1. 根据 intentCode 找 Handler        │
│  2. 检查权限                          │
│  3. 解析参数                          │
│  4. 执行业务逻辑                      │
│  5. 格式化返回结果                    │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Handler 示例:                         │
│  MaterialBatchQueryHandler            │
│  ──────────────────────────           │
│  - 调用 MaterialBatchService          │
│  - 查询数据库                         │
│  - 返回结构化数据                     │
└───────────────────────────────────────┘
```

### 状态码说明

| status | 说明 |
|--------|------|
| `COMPLETED` | 执行完成 |
| `NEED_INFO` | 需要补充参数 |
| `PENDING_CONFIRM` | 等待用户确认 |
| `FAILED` | 执行失败 |

---

## 完整流程示例

### 示例 1: "查询原料库存"（操作类）

```
输入: "查询原料库存"
        │
        ▼
Layer 0: detectQuestionType()
        │ 包含 "查询" → OPERATIONAL_COMMAND
        ▼
Layer 1: 关键词匹配
        │ 匹配到 ["原料", "库存"] → MATERIAL_BATCH_QUERY
        ▼
结果: {
    intentRecognized: true,
    matchedIntentCode: "MATERIAL_BATCH_QUERY",
    matchMethod: "KEYWORD",
    confidence: 1.0,
    status: "COMPLETED"
}
        │
        ▼
Handler: MaterialBatchQueryHandler.execute()
        │
        ▼
返回: 原料库存列表数据
```

### 示例 2: "有什么好的管理建议"（泛问题）

```
输入: "有什么好的管理建议"
        │
        ▼
Layer 0: detectQuestionType()
        │ 包含 "管理建议" → GENERAL_QUESTION
        ▼
直接走 LLM (不进入意图匹配)
        │
        ▼
结果: {
    intentRecognized: false,
    matchedIntentCode: null,
    status: "COMPLETED",
    message: "[LLM 生成的管理建议回复]"
}
```

### 示例 3: "带鱼还剩多少"（模糊表达）

```
输入: "带鱼还剩多少"
        │
        ▼
Layer 0: detectQuestionType()
        │ 不含明确指示词 → UNDETERMINED
        ▼
Layer 1: 关键词匹配
        │ 无精确匹配
        ▼
Layer 2: 正则匹配
        │ 无匹配
        ▼
Layer 3: 语义缓存
        │ 无缓存
        ▼
Layer 4: 融合评分
        │ "带鱼"+"剩" 与 MATERIAL_BATCH_QUERY 语义相似
        │ finalScore = 0.72 (≥ 0.65)
        ▼
结果: {
    intentRecognized: true,
    matchedIntentCode: "MATERIAL_BATCH_QUERY",
    matchMethod: "FUSION",
    confidence: 0.72,
    status: "COMPLETED"
}
```

---

## 关键配置文件

| 文件 | 位置 | 作用 |
|------|------|------|
| `IntentKnowledgeBase.java` | `backend-java/src/main/java/com/cretas/aims/config/` | QuestionType 检测、指示词配置 |
| `AIIntentServiceImpl.java` | `backend-java/src/main/java/com/cretas/aims/service/impl/` | 5层匹配主逻辑 |
| `LlmIntentFallbackClientImpl.java` | `backend-java/src/main/java/com/cretas/aims/service/impl/` | LLM 兜底调用 |
| `IntentExecutorServiceImpl.java` | `backend-java/src/main/java/com/cretas/aims/service/impl/` | Handler 调度执行 |
| `ai_intent_configs` | 数据库表 | 意图配置（关键词、正则、描述） |
| `ai_learned_expressions` | 数据库表 | 自学习的表达缓存 |
| `ai_semantic_cache` | 数据库表 | 语义缓存 |

---

## 核心决策逻辑总结

```
                    用户输入
                        │
                        ▼
            ┌───────────────────────┐
            │  QuestionType 检测    │
            │  (Layer 0)            │
            └───────────┬───────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   CONVERSATIONAL  GENERAL_QUESTION  OPERATIONAL/
   (闲聊)          (泛问题)          UNDETERMINED
        │               │               │
        │               │               ▼
        │               │      ┌─────────────────┐
        │               │      │  5层意图匹配    │
        │               │      │  Layer 1-5      │
        │               │      └────────┬────────┘
        │               │               │
        │               │          ┌────┴────┐
        │               │     匹配成功    匹配失败
        │               │          │         │
        └───────────────┴──────────┴─────────┘
                        │
                        ▼
                ┌───────────────┐
                │   LLM 回复    │
                │   (智能对话)  │
                └───────────────┘
```

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| V3.0 | 2026-01-08 | 重构文档结构，增加 Layer 0 预筛详解，补充完整示例 |
| V2.0 | 2026-01-06 | 增加5层架构详解 |
| V1.0 | 2026-01-02 | 初始版本 |

---

*本文档由 AI 意图识别系统开发团队维护*
