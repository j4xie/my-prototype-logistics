# Intent Recognition Architecture Analysis

## Current Architecture Review

```
用户输入
    │
    ▼
预处理 (写操作检测、长文本处理等)
    │
    ▼
Layer 0: 短语匹配优先短路 (0.98)
Layer 0.5: 动词+名词消歧 (>=0.80)
Layer 0.6: TwoStageClassifier 多维分类 (>=0.92)
Layer 1: 精确表达匹配 (Hash 查表)
    │
    ▼
v6.0 语义优先架构
├── Step 1: 语义路由 (GTE 向量 Top-5)
├── Step 2: 精确验证 (+短语/操作分数)
├── Step 2.5: 多意图检测
├── Step 3: 置信度决策
│   ├── >=0.85: 直接返回
│   ├── 0.65-0.85: ArenaRL + LLM Reranking
│   └── <0.65: LLM Fallback
```

## Gap Analysis (Based on Complex Test Failures)

| Category | Count | Root Cause | Current Handling |
|----------|-------|------------|-----------------|
| typo (错别字) | 5 | 无拼写纠正 | None |
| multi_intent | 5 | 多意图分离不足 | MultiLabelIntentClassifier (弱) |
| incomplete | 5 | 无上下文理解 | None |
| date_format | 5 | 日期实体解析弱 | None |
| sentiment | 5 | 情感词影响匹配 | None |
| single_word | 4 | 模糊输入默认处理 | Partial |

## Recommended Architecture Improvements

### Layer -1: 拼写纠正预处理 (NEW)

**Research Findings:**
- 82.4% 中文错误来自相同拼音 ([Source](https://arxiv.org/html/2502.11508v1))
- Pinyin-Soundex 算法有效 ([IEEE](https://ieeexplore.ieee.org/document/6006343/))

**Implementation Options:**
1. **Python: fuzzychinese** - 轻量级拼音模糊匹配
2. **Java: Pinyin4j + SymSpell** - 拼音转换 + 编辑距离
3. **LLM-based**: 调用 qwen-turbo 进行纠错 (已有 correctionModel)

**Proposed Flow:**
```
用户输入 "销受情况"
    │
    ▼
拼音转换: "xiao shou qing kuang"
    │
    ▼
候选生成: 编辑距离1的词 → "销售情况"
    │
    ▼
置信度校验 → 输出纠正后的文本
```

### Layer 0.3: 实体预提取 (NEW)

**Purpose:** 在意图匹配前提取日期、人名、批次号等实体

**Target Entities:**
- `DATE`: "上上周", "2024年Q1", "最近30天"
- `PERSON`: "张三", "王经理"
- `BATCH_ID`: "BN20240115-001", "批次20240115"
- `LOCATION`: "华东区", "上海市"

**Implementation:**
```java
public class EntityPreExtractor {
    // 正则 + 词典混合方法
    public ExtractedEntities extract(String input) {
        // 1. 日期正则匹配
        // 2. 人名词典匹配
        // 3. 批次号模式匹配
        return entities;
    }
}
```

### Step 2.5 Enhancement: Multi-Intent Detection

**Current Issue:** "销售怎么样谁最厉害" 只返回第一个意图

**Research-backed Approach:**
- 多标签分类 with sigmoid threshold ([AAAI 2024](https://ojs.aaai.org/index.php/AAAI/article/view/29952/31664))
- 意图分离触发词: "和", "以及", "还有", "跟", "同时"

**Enhanced Flow:**
```
输入: "销售怎么样谁最厉害"
    │
    ▼
触发词检测: 无明确分隔词，但有两个疑问
    │
    ▼
子句分割: ["销售怎么样", "谁最厉害"]
    │
    ▼
独立意图识别:
  - "销售怎么样" → REPORT_DASHBOARD_OVERVIEW
  - "谁最厉害" → REPORT_KPI
    │
    ▼
返回: 主意图 REPORT_KPI (排名类优先)
```

### Context-Aware Layer (NEW)

**Purpose:** 处理 "再查一次", "继续", "上次那个" 等上下文依赖查询

**Implementation:**
```java
public class ConversationContext {
    private String lastIntent;
    private String lastQuery;
    private long lastTimestamp;

    public String resolveContextualQuery(String input) {
        if (isContextDependent(input)) {
            return expandWithContext(input, lastQuery);
        }
        return input;
    }
}
```

## Proposed New Architecture

```
用户输入
    │
    ▼
[NEW] Layer -1: 拼写纠正 (Pinyin + EditDistance)
    │
    ▼
[NEW] Layer -0.5: 上下文展开 (ConversationContext)
    │
    ▼
预处理 (写操作检测、长文本处理等)
    │
    ▼
[NEW] Layer 0.3: 实体预提取 (Date, Person, Batch, Location)
    │
    ▼
Layer 0: 短语匹配优先短路 (0.98)
Layer 0.5: 动词+名词消歧 (>=0.80)
Layer 0.6: TwoStageClassifier 多维分类 (>=0.92)
Layer 1: 精确表达匹配 (Hash 查表)
    │
    ▼
v6.0 语义优先架构
├── Step 1: 语义路由 (GTE 向量 Top-5)
├── Step 2: 精确验证 (+短语/操作分数 + 实体权重)
├── [ENHANCED] Step 2.5: 多意图检测 (子句分割 + 多标签)
├── Step 3: 置信度决策
│   ├── >=0.85: 直接返回
│   ├── 0.65-0.85: ArenaRL + LLM Reranking
│   └── <0.65: LLM Fallback
```

## Implementation Priority

| Priority | Feature | Expected Impact | Effort |
|----------|---------|-----------------|--------|
| P0 | 拼写纠正 (Pinyin-based) | +5% complex | Medium |
| P1 | 实体预提取 (Date/Batch) | +5% complex | Medium |
| P2 | 多意图分离增强 | +3% complex | High |
| P3 | 上下文理解 | +3% complex | High |

## Quick Wins (Low Effort)

1. **特殊字符清理**: 在预处理中移除 `【】>>><<<——!@#$%`
2. **英文意图映射**: 添加 `sales`, `inventory`, `production` 短语
3. **单字默认处理**: 单字输入默认到 REPORT_DASHBOARD_OVERVIEW

## Sources

- [Intent Recognition Pipeline](https://link.springer.com/article/10.1007/s41870-023-01642-8)
- [Multi-Intent Detection](https://arxiv.org/pdf/2512.11258)
- [Chinese Spelling Correction Survey](https://arxiv.org/html/2502.11508v1)
- [Rasa NLU Pipeline](https://rasa.com/blog/intents-entities-understanding-the-rasa-nlu-pipeline/)
- [DIET Architecture](https://rasa.com/blog/rasa-nlu-in-depth-part-1-intent-classification/)
- [Spello Library](https://www.haptik.ai/tech/spello-the-spell-correction-library)
- [fuzzychinese](https://github.com/znwang25/fuzzychinese)
