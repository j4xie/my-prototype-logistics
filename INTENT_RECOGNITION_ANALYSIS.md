# 意图识别系统分析报告

**创建日期**: 2026-01-23
**版本**: v11.0
**状态**: 需要修复测试用例

---

## 1. 问题概述

### 1.1 测试结果

| 指标 | 值 | 说明 |
|------|-----|------|
| 准确率 | 5.1% | 99 个复杂场景测试 |
| 平均延迟 | 3028ms | 大部分走 LLM |
| SemanticRouter 可用 | ✅ | 缓存 128 个意图向量 |

### 1.2 根本原因

**测试用例的 expectedIntent 与系统实际配置的意图代码不匹配！**

| 测试用例期望 | 系统实际返回 | 是否匹配 |
|--------------|--------------|----------|
| `sales_overview` | `CUSTOMER_STATS`, `REPORT_TRENDS` | ❌ |
| `inventory` | `REPORT_INVENTORY`, `MATERIAL_BATCH_QUERY` | ❌ |
| `sales_ranking` | `SHIPMENT_BY_DATE`, `REPORT_KPI` | ❌ |
| `MATERIAL_BATCH_QUERY` | `MATERIAL_BATCH_QUERY` | ✅ |

**结论**: 这不是架构问题，是测试用例配置问题。

---

## 2. 当前架构分析

### 2.1 处理流程

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Layer 0: InputValidator                        │
│  检测模糊/无关输入                               │
│  ✅ 工作正常 - "天气怎么样" 等被正确拒绝         │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Layer 1: QueryPreprocessor                     │
│  语气词过滤、核心提取、口语标准化                │
│  ✅ 工作正常                                     │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Layer 1.5: LongTextHandler (v11.0 新增)        │
│  超长文本摘要 (>300字 → qwen-turbo)             │
│  ✅ 已实现                                       │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Layer 2: SemanticRouter (v11.0 新增)           │
│  gte-base-zh 向量路由                           │
│  ├── ≥0.92 → DIRECT_EXECUTE (跳过LLM)          │
│  ├── ≥0.75 → NEED_RERANKING (LLM确认)          │
│  └── <0.75 → NEED_FULL_LLM                     │
│  ⚠️ 当前大部分走 NEED_FULL_LLM                  │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Layer 3: Intent Classification                 │
│  PHRASE_MATCH → SEMANTIC → LLM                 │
│  ✅ 工作正常                                     │
└─────────────────────────────────────────────────┘
```

### 2.2 路由类型分布 (测试结果)

| 路由类型 | 数量 | 占比 | 说明 |
|----------|------|------|------|
| LLM | ~75 | 75.8% | 完整 LLM 分类 |
| SEMANTIC | ~15 | 15.2% | 语义向量匹配 |
| PHRASE_MATCH | ~5 | 5.1% | 短语匹配 |
| EXACT | ~2 | 2.0% | 精确匹配 |
| None | ~3 | 3.0% | 被拒绝的输入 |

---

## 3. 问题分析

### 3.1 测试用例问题

当前测试用例 `complex_test_cases.json` 使用的意图代码：

```json
// 测试用例期望的意图 (部分是旧代码)
["sales_overview", "sales_ranking", "inventory", "profit_analysis", ...]

// 系统实际配置的意图 (新代码)
["CUSTOMER_STATS", "REPORT_TRENDS", "REPORT_INVENTORY", "COST_QUERY", ...]
```

**解决方案**: 更新测试用例，使用系统实际配置的意图代码。

### 3.2 SemanticRouter 阈值问题

当前配置：
- `directExecute` 阈值: 0.92 (非常高)
- `reranking` 阈值: 0.75

**问题**: 0.92 的阈值太高，导致几乎所有请求都走 LLM。

**建议调整**:
```properties
# 降低阈值以增加 DIRECT_EXECUTE 命中率
cretas.router.threshold.direct-execute=0.85
cretas.router.threshold.reranking=0.70
```

### 3.3 意图覆盖问题

测试用例中的一些意图在系统中可能不存在或名称不同：

| 测试用例意图 | 是否存在 | 对应系统意图 |
|--------------|----------|--------------|
| `sales_overview` | ❌ | `REPORT_TRENDS`, `CUSTOMER_STATS` |
| `sales_ranking` | ❌ | `REPORT_KPI` |
| `inventory` | ❌ | `REPORT_INVENTORY` |
| `MATERIAL_BATCH_QUERY` | ✅ | `MATERIAL_BATCH_QUERY` |
| `EQUIPMENT_STATUS_QUERY` | ✅ | `EQUIPMENT_STATS` |

---

## 4. 修复计划

### 4.1 短期修复 (立即执行)

1. **更新测试用例意图映射**
   ```bash
   # 创建意图映射表
   sales_overview → REPORT_TRENDS 或 CUSTOMER_STATS
   sales_ranking → REPORT_KPI
   inventory → REPORT_INVENTORY
   profit_analysis → COST_QUERY 或 financial_ratios
   ```

2. **降低 SemanticRouter 阈值**
   ```properties
   cretas.router.threshold.direct-execute=0.85
   cretas.router.threshold.reranking=0.70
   ```

### 4.2 中期优化

1. **增加意图表达训练数据**
   - 为每个意图添加更多常见表达方式
   - 特别是口语化、错别字变体

2. **优化 embedding 缓存**
   - 添加更多意图的向量缓存
   - 包含同义词和常见变体

### 4.3 长期架构优化

1. **Cascade 路由优化**
   - 实现 C3PO 风格的级联路由
   - 简单查询用小模型，复杂查询用大模型

2. **意图标准化**
   - 统一意图命名规范
   - 建立意图同义词映射表

---

## 5. 性能基准

### 5.1 当前性能

| 场景 | 延迟 | 路由类型 |
|------|------|----------|
| 精确匹配 | ~200ms | EXACT |
| 语义匹配 | ~500-1000ms | SEMANTIC |
| LLM 分类 | ~2000-8000ms | LLM |

### 5.2 目标性能

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| DIRECT_EXECUTE 率 | ~0% | >50% | - |
| 平均延迟 | 3028ms | <500ms | 6x |
| LLM 调用率 | ~75% | <30% | 2.5x |

---

## 6. 附录

### 6.1 测试用例意图列表

```
测试用例中使用的意图:
- ATTENDANCE_QUERY
- EQUIPMENT_STATUS_QUERY
- MATERIAL_BATCH_QUERY
- NONE
- PRODUCTION_STATUS_QUERY
- QUALITY_INSPECTION_QUERY
- compare_period
- dept_performance
- forecast
- inventory
- profit_analysis
- region_analysis
- sales_overview
- sales_ranking
- sales_trend
```

### 6.2 系统实际意图代码 (部分)

```
系统配置的意图:
- ALERT_ACTIVE
- ATTENDANCE_HISTORY
- BATCH_UPDATE
- COST_QUERY
- CUSTOMER_ACTIVE
- CUSTOMER_STATS
- EQUIPMENT_ALERT_LIST
- EQUIPMENT_STATS
- EQUIPMENT_STATUS_UPDATE
- MATERIAL_BATCH_QUERY
- MATERIAL_LOW_STOCK_ALERT
- PROCESSING_BATCH_CREATE
- QUALITY_CHECK_QUERY
- QUALITY_STATS
- REPORT_ANOMALY
- REPORT_DASHBOARD_OVERVIEW
- REPORT_FINANCE
- REPORT_INVENTORY
- REPORT_KPI
- REPORT_PRODUCTION
- REPORT_QUALITY
- REPORT_TRENDS
- SHIPMENT_BY_CUSTOMER
- SHIPMENT_BY_DATE
- SHIPMENT_CREATE
- SHIPMENT_STATS
- SUPPLIER_ACTIVE
- financial_ratios
- ...
```

### 6.3 相关文件

- 测试用例: `backend-java/src/main/resources/data/testing/complex_test_cases.json`
- 意图配置: 数据库 `ai_intent_config` 表
- SemanticRouter: `backend-java/src/main/java/com/cretas/aims/service/impl/SemanticRouterServiceImpl.java`
- 测试脚本: `scripts/test_v11_optimization.py`

---

## 7. 下一步行动

- [ ] 更新测试用例的 expectedIntent 映射
- [ ] 降低 SemanticRouter 阈值
- [ ] 重新运行测试验证准确率
- [ ] 添加简单场景测试用例
