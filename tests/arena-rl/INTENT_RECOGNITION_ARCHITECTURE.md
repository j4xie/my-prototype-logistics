# 意图识别系统架构（含 ArenaRL）

## 一、整体架构图

```
                              用户输入
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Layer 1: 精确表达匹配                                  │
│                    (Hash 查表, O(1), 100% 置信度)                         │
│                                                                          │
│   ExpressionLearningService.matchExactExpression()                       │
│   - 完全相同的历史表达式匹配                                               │
│   - 用户反馈后学习的表达                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │ 未命中
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Layer 0: 问题类型分类                                  │
│                    (规则引擎, 快速过滤)                                   │
│                                                                          │
│   IntentKnowledgeBase.detectQuestionType()                              │
│   ├─ CONVERSATIONAL (闲聊) ──────────────► 直接拒绝，不匹配业务意图       │
│   ├─ GENERAL_QUESTION (模糊) ────────────► 提高置信度阈值到 0.90         │
│   └─ OPERATIONAL (操作) ─────────────────► 正常处理                      │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    语义路由层                                            │
│                    (向量相似度, Top-5 召回)                              │
│                                                                          │
│   semanticFirstRouting() → EmbeddingService                             │
│   - 使用 GTE 向量模型计算语义相似度                                       │
│   - 返回 Top-5 候选意图及其语义分数                                       │
│                                                                          │
│   示例: "原材料批次MB001"                                                 │
│   ├─ MATERIAL_BATCH_QUERY: 0.78                                         │
│   ├─ TRACE_BATCH: 0.76                                                  │
│   ├─ PROCESSING_BATCH_LIST: 0.72                                        │
│   └─ ...                                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    精确验证层                                            │
│                    (规则调整分数)                                         │
│                                                                          │
│   preciseVerification()                                                 │
│   ├─ 短语匹配验证: +0.15 (如果输入包含已注册短语)                          │
│   ├─ 操作类型匹配: +0.10 (如果动词与意图类型匹配)                          │
│   ├─ 领域匹配验证: -0.05 (如果领域不匹配)                                 │
│   └─ v7.0 短语注入: 未在 Top-5 的短语匹配意图注入 (基础分 0.80)           │
│                                                                          │
│   示例: "原材料批次MB001" + 短语 "原材料批次"                              │
│   ├─ MATERIAL_BATCH_QUERY: 0.78 + 0.15 = 0.93 ✓                         │
│   └─ TRACE_BATCH: 0.76 + 0 = 0.76                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    置信度决策层                                          │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  高置信度 (≥ 0.85)                                               │   │
│   │  ──────────────────────────────────────────────────────────────  │   │
│   │                                                                  │   │
│   │  v7.1 新增: 操作类意图强制验证                                     │   │
│   │  • 如果是写入操作 (CREATE/UPDATE/DELETE/START/STOP 等)           │   │
│   │  • 且有近距离竞争者 (top1 - top2 < 0.12)                         │   │
│   │  → 即使高置信度，也强制进入 ArenaRL 验证                           │   │
│   │                                                                  │   │
│   │  否则直接返回最佳匹配，无需 LLM 确认                                │   │
│   │  延迟: 查询类 ~100-500ms，操作类 ~30s                             │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                           │                                              │
│   ┌───────────────────────▼─────────────────────────────────────────┐   │
│   │  中置信度 (0.65-0.85) + 候选分数接近                              │   │
│   │  ──────────────────────────────────────────────────────────────  │   │
│   │                                                                  │   │
│   │  ArenaRL 触发条件检查:                                            │   │
│   │  • top1 - top2 < 0.15 (置信度差距小)                             │   │
│   │  • top1 < 0.85 (最高置信度不够高)                                 │   │
│   │                                                                  │   │
│   │  ┌──────────────────────────────────────────────────────────┐   │   │
│   │  │           ArenaRL 锦标赛裁决                              │   │   │
│   │  │  ────────────────────────────────────────────────────── │   │   │
│   │  │  1. 种子排序: 按语义分数排序                              │   │   │
│   │  │  2. 单淘汰锦标赛: LLM 两两比较                            │   │   │
│   │  │  3. 返回冠军意图                                          │   │   │
│   │  │                                                          │   │   │
│   │  │  配置:                                                    │   │   │
│   │  │  • model: qwen-turbo                                     │   │   │
│   │  │  • max-candidates: 3                                     │   │   │
│   │  │  • bidirectional: false                                  │   │   │
│   │  │  • timeout: 8000ms                                       │   │   │
│   │  │                                                          │   │   │
│   │  │  延迟: ~1-5s                                              │   │   │
│   │  └──────────────────────────────────────────────────────────┘   │   │
│   │                           │                                      │   │
│   │                           ▼ ArenaRL 失败或未触发                  │   │
│   │  ┌──────────────────────────────────────────────────────────┐   │   │
│   │  │           LLM Reranking 回退                             │   │   │
│   │  │  ────────────────────────────────────────────────────── │   │   │
│   │  │  N-way 分类重排序                                         │   │   │
│   │  │  延迟: ~2-5s                                              │   │   │
│   │  └──────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                           │                                              │
│   ┌───────────────────────▼─────────────────────────────────────────┐   │
│   │  低置信度 (< 0.65)                                               │   │
│   │  ──────────────────────────────────────────────────────────────  │   │
│   │  LLM Fallback: 全意图列表重新分类                                  │   │
│   │  延迟: ~3-8s                                                     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                            返回识别结果
```

---

## 二、各层职责详解

### Layer 1: 精确表达匹配
- **目的**: 零延迟匹配已学习的表达式
- **数据源**: `learned_expressions` 表
- **触发**: 用户输入与历史表达完全相同
- **置信度**: 100%

### Layer 0: 问题类型分类
- **目的**: 快速过滤非业务查询
- **规则**:
  - 闲聊关键词: "你好", "天气", "今天星期几" → 拒绝
  - 模糊问题: "xxx怎么样", "xxx情况" → 提高阈值
  - 操作指令: 包含业务关键词 → 正常处理

### 语义路由层
- **目的**: 语义相似度召回候选
- **模型**: GTE 向量模型 (阿里云)
- **输出**: Top-5 候选 + 语义分数

### 精确验证层
- **目的**: 用规则调整语义分数
- **加分项**:
  - 短语匹配: +0.15
  - 操作类型匹配: +0.10
- **减分项**:
  - 领域不匹配: -0.05

### ArenaRL 锦标赛
- **目的**: 歧义场景下的精确裁决
- **触发条件**: `gap < 0.15 && top1 < 0.85`
- **算法**: 种子单淘汰锦标赛
- **比较器**: LLM 两两比较

---

## 三、失败测试分析

### 3.1 失败分类统计

| 类别 | 数量 | 占比 | 说明 |
|------|------|------|------|
| 短语映射缺失 | 12 | 50% | 需要添加短语映射 |
| 语义混淆 | 6 | 25% | ArenaRL 应该介入但未触发 |
| 测试期望问题 | 3 | 12.5% | 测试用例本身不合理 |
| 歧义查询 | 3 | 12.5% | 用户输入太短无法判断 |

### 3.2 具体失败分析

#### A. 短语映射缺失 (12 个)

| 查询 | 期望 | 实际 | 需要添加的短语 |
|------|------|------|----------------|
| 过期原料 | MATERIAL_EXPIRED_QUERY | MATERIAL_BATCH_QUERY | "过期原料" |
| 消耗原料 | MATERIAL_BATCH_CONSUME | MATERIAL_BATCH_QUERY | "消耗原料" |
| 释放原料 | MATERIAL_BATCH_RELEASE | MATERIAL_BATCH_QUERY | "释放原料" |
| 结束生产 | PROCESSING_BATCH_COMPLETE | SCHEDULING_SET_MANUAL | "结束生产" |
| 暂停生产 | PROCESSING_BATCH_PAUSE | SCHEDULING_SET_MANUAL | "暂停生产" |
| 批次时间线 | PROCESSING_BATCH_TIMELINE | PROCESSING_BATCH_START | "批次时间线" |
| 按日期发货 | SHIPMENT_BY_DATE | SHIPMENT_QUERY | "按日期发货" |
| 关键检验项 | QUALITY_CRITICAL_ITEMS | QUALITY_CHECK_QUERY | "关键检验项" |
| 部门考勤 | ATTENDANCE_DEPARTMENT | ATTENDANCE_TODAY | "部门考勤" |
| 下班打卡 | CLOCK_OUT | CLOCK_IN | "下班打卡" |
| 客户统计 | CUSTOMER_STATS | REPORT_DASHBOARD_OVERVIEW | "客户统计" |
| 按品类供应商 | SUPPLIER_BY_CATEGORY | SUPPLIER_SEARCH | "按品类供应商" |

#### B. 语义混淆 (6 个) - ArenaRL 应该介入

| 查询 | 期望 | 实际 | 分析 |
|------|------|------|------|
| 添加新原料 | MATERIAL_BATCH_CREATE | MATERIAL_UPDATE | "添加" vs "更新" 语义混淆 |
| 正在生产的批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | "正在" 被理解为动作 |
| 今天的生产批次 | PROCESSING_BATCH_LIST | PROCESSING_BATCH_START | 同上 |
| 最近的发货 | SHIPMENT_QUERY | SHIPMENT_CREATE | "发货" 被理解为动作 |
| 质量检查 | QUALITY_CHECK_EXECUTE | QUALITY_CHECK_QUERY | "检查" 歧义 |
| 质检记录 | QUALITY_CHECK_QUERY | QUALITY_CHECK_EXECUTE | "记录" 歧义 |

#### C. 测试期望问题 (3 个)

| 查询 | 期望 | 实际 | 说明 |
|------|------|------|------|
| 批次详情 | MATERIAL_BATCH_QUERY | PROCESSING_BATCH_DETAIL | 实际结果更合理 |
| 更新发货状态 | SHIPMENT_UPDATE | SHIPMENT_STATUS_UPDATE | 两个都对 |
| 生产进度 | PROCESSING_BATCH_TIMELINE | PROCESSING_BATCH_LIST | 实际结果也合理 |

#### D. 歧义查询 (3 个)

| 查询 | 期望 | 实际 | 说明 |
|------|------|------|------|
| 统计 | QUALITY_STATS | REPORT_DASHBOARD_OVERVIEW | 用户意图不明确 |
| 列表 | MATERIAL_BATCH_QUERY | REPORT_DASHBOARD_OVERVIEW | 用户意图不明确 |
| 查询 | MATERIAL_BATCH_QUERY | CUSTOMER_SEARCH | 用户意图不明确 |

---

## 四、优化方案

### 4.1 短期优化：补充短语映射

```java
// IntentKnowledgeBase.java - 需要添加的短语映射

// 原料操作类
phraseToIntentMapping.put("过期原料", "MATERIAL_EXPIRED_QUERY");
phraseToIntentMapping.put("消耗原料", "MATERIAL_BATCH_CONSUME");
phraseToIntentMapping.put("释放原料", "MATERIAL_BATCH_RELEASE");

// 生产控制类
phraseToIntentMapping.put("结束生产", "PROCESSING_BATCH_COMPLETE");
phraseToIntentMapping.put("暂停生产", "PROCESSING_BATCH_PAUSE");
phraseToIntentMapping.put("批次时间线", "PROCESSING_BATCH_TIMELINE");
phraseToIntentMapping.put("生产时间线", "PROCESSING_BATCH_TIMELINE");

// 发货类
phraseToIntentMapping.put("按日期发货", "SHIPMENT_BY_DATE");
phraseToIntentMapping.put("日期发货", "SHIPMENT_BY_DATE");

// 质检类
phraseToIntentMapping.put("关键检验项", "QUALITY_CRITICAL_ITEMS");
phraseToIntentMapping.put("关键检验", "QUALITY_CRITICAL_ITEMS");

// 考勤类
phraseToIntentMapping.put("部门考勤", "ATTENDANCE_DEPARTMENT");
phraseToIntentMapping.put("下班打卡", "CLOCK_OUT");
phraseToIntentMapping.put("下班", "CLOCK_OUT");

// 客户/供应商类
phraseToIntentMapping.put("客户统计", "CUSTOMER_STATS");
phraseToIntentMapping.put("按品类供应商", "SUPPLIER_BY_CATEGORY");
phraseToIntentMapping.put("供应商品类", "SUPPLIER_BY_CATEGORY");
```

### 4.2 中期优化：调整 ArenaRL 触发阈值

当前问题：语义混淆的 6 个用例，ArenaRL 没有触发。

**原因分析**：
- 短语匹配给了某个候选 +0.15 加分
- 加分后置信度 > 0.85，直接返回，跳过 ArenaRL

**优化方案**：
```properties
# 方案 A: 降低高置信度阈值
cretas.ai.intent.semantic-first.high-threshold=0.90

# 方案 B: 扩大 ArenaRL 触发范围
cretas.ai.arena-rl.intent-disambiguation.min-trigger-confidence=0.90
cretas.ai.arena-rl.intent-disambiguation.ambiguity-threshold=0.20
```

### 4.3 长期优化：操作类型感知增强

针对 "正在生产的批次"、"最近的发货" 等语义混淆问题：

1. **增强时态检测**：
   - "正在" → 查询状态 (LIST)
   - "开始" → 执行动作 (START)

2. **增强动词意图映射**：
   ```java
   // 查询类动词
   Set<String> queryVerbs = Set.of("查询", "查看", "显示", "列出", "正在", "最近");

   // 操作类动词
   Set<String> actionVerbs = Set.of("开始", "创建", "添加", "执行", "启动");
   ```

3. **ArenaRL Prompt 优化**：
   在比较 Prompt 中明确强调时态和动词语义。

---

## 五、ArenaRL 与现有系统的协作关系

```
                    ┌─────────────────────────────────────┐
                    │         请求流量分布                 │
                    └─────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
    ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
    │  高置信度路径  │      │ ArenaRL 路径  │      │  LLM 回退路径  │
    │    (~60%)     │      │    (~5%)      │      │    (~35%)     │
    ├───────────────┤      ├───────────────┤      ├───────────────┤
    │ 短语匹配成功   │      │ 语义分数接近   │      │ 低置信度      │
    │ 或语义分数高   │      │ 需要精确裁决   │      │ 需要重新分类   │
    ├───────────────┤      ├───────────────┤      ├───────────────┤
    │ 延迟: <500ms  │      │ 延迟: 1-5s    │      │ 延迟: 3-8s    │
    │ 成本: 0       │      │ 成本: 低      │      │ 成本: 高      │
    │ 准确率: 高    │      │ 准确率: 最高   │      │ 准确率: 中    │
    └───────────────┘      └───────────────┘      └───────────────┘
```

### ArenaRL 的核心价值

1. **精准歧义裁决**：当两个候选语义分数接近时，两两比较比 N-way 分类更准确
2. **O(N) 复杂度**：种子单淘汰算法，只需 N-1 次比较
3. **可解释性**：每次比较都有 reasoning 输出

### ArenaRL 的局限性

1. **依赖短语层先行**：如果短语映射不完整，ArenaRL 可能不会触发
2. **延迟开销**：每次 LLM 调用 ~500-1000ms
3. **不适合高并发**：更适合准确率敏感场景

---

## 六、监控指标建议

| 指标 | 说明 | 目标值 |
|------|------|--------|
| 短语匹配命中率 | 短语匹配成功的请求比例 | > 40% |
| ArenaRL 触发率 | ArenaRL 实际触发的请求比例 | 5-10% |
| ArenaRL 成功率 | ArenaRL 返回有效结果的比例 | > 95% |
| 高置信度比例 | 置信度 > 0.85 的请求比例 | > 60% |
| 平均延迟 | 端到端意图识别延迟 | < 1000ms |
| 需确认率 | 返回 requiresConfirmation=true 的比例 | < 20% |

---

## 七、v7.1 测试结果 (2026-01-19)

### 7.1 版本变更

**操作类意图强制 ArenaRL 验证**：

```java
// AIIntentServiceImpl.java
// 高置信度: 检查是否需要强制 LLM 验证
if (confidence >= highThreshold) {
    // v7.1: 操作类意图即使高置信度也需要 ArenaRL 验证
    boolean isWriteOperation = isWriteOperationType(opType, bestCandidate.intentCode);
    boolean hasCloseCompetitor = (top1 - top2) < 0.12;

    if (isWriteOperation && hasCloseCompetitor) {
        // 继续执行，进入 ArenaRL/LLM Reranking 流程
    } else {
        // 查询类意图或差距足够大，直接返回
    }
}
```

**判断写入操作类型**：
- ActionType: CREATE, UPDATE, DELETE
- IntentCode 后缀: _START, _STOP, _PAUSE, _RESUME, _COMPLETE, _EXECUTE, _CONSUME, _RELEASE, _RESERVE, _ACKNOWLEDGE, _RESOLVE, CLOCK_IN, CLOCK_OUT

### 7.2 测试结果

| 指标 | v7.0 | v7.1 | 变化 |
|------|------|------|------|
| 准确率 | 84.7% | 84.7% | - |
| 平均延迟 | 1143ms | 10534ms | +9391ms |
| 操作类延迟 | ~1-3s | ~30s | ArenaRL 触发 |

### 7.3 剩余失败分析 (14 个)

| 类别 | 数量 | 示例 | 原因 |
|------|------|------|------|
| ArenaRL 判断错误 | 7 | "下班打卡"→CLOCK_IN | ArenaRL 语义理解不准确 |
| 语义歧义 | 3 | "生产进度"→LIST | 需要上下文才能区分 |
| 单词查询太模糊 | 4 | "统计", "列表" | 无法判断具体领域 |

### 7.4 下一步优化方向

1. **优化 ArenaRL Prompt**：
   - 添加时态提示："正在"应理解为查询状态
   - 添加动词意图提示："开始"是执行动作，"查看"是查询

2. **增加短语优先级**：
   - 对于冲突短语，设置优先级（如"暂停生产"优先于"暂停"）

3. **单词查询降级**：
   - 单词查询（< 3 字符）强制要求上下文

