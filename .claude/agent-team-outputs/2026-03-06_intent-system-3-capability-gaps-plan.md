# 意图识别系统三大能力缺口实现计划 — 最终综合报告

**日期**: 2026-03-06
**模式**: Full | 语言: Chinese
**增强**: Codebase grounding: ON | Fact-check: OFF

---

## 执行摘要

经三阶段代码验证（含延迟完成的Researcher 2深度分析），最终结论如下：

**Gap 2（餐饮/工厂隔离）**：v32已在BERT/Semantic/LLM三层实现后置过滤，但存在3个残留问题：(1) Phrase层工厂Map残留~91条RESTAURANT词条造成交叉污染；(2) BERT 259标签中缺3个RESTAURANT意图(DISH_UPDATE/TABLE_TURNOVER/WASTAGE_RECORD)；(3) **执行层factoryType校验为零**（JWT不携带factoryType）。9个缺失handler确认存在，其中3个LOW/4个MEDIUM/2个HIGH(需数据模型扩展)。

**Gap 3（Type分类层）**：两套ActionType枚举独立运作不冲突，实际影响有限。

**Gap 1（MLRL闭环）**：`applySuggestion`核心业务逻辑为TODO，是最需要投入的工作。

**总工作量**：从分析师估算的18天修正为 **8-14天**（Gap 1: 5-7天, Gap 2: 3-5天, Gap 3: 0-2天条件性）。

---

## 共识与分歧对照表

| 论点 | 分析师判断 | 评审师判断 | 代码验证结果 | 最终结论 |
|------|-----------|-----------|-------------|---------|
| **Gap 2: BERT层无业态隔离** | 需新建filterByBusinessDomain() (2天) | v32已有过滤逻辑 | **评审师正确但不完整** — v32后置过滤存在，但BERT缺3个RESTAURANT label(DISH_UPDATE/TABLE_TURNOVER/WASTAGE_RECORD) | 后置过滤已实现，但label覆盖需补充 |
| **Gap 2: Handler缺9/27个intent** | 需补9个case (3天) | 确认缺9/27 | **Researcher 2确认缺9个**: 3个LOW(AVG_TICKET/DISH_DELETE/DISH_PRODUCT_SALES_RANKING), 4个MEDIUM(DISH_CREATE/DISH_UPDATE/PROCUREMENT_CREATE/WASTAGE_RECORD), 2个HIGH(RETURN_RATE需退单表/TABLE_TURNOVER需翻台率字段) | 需补全，但2个HIGH需数据模型扩展 |
| **Gap 2: Phrase层交叉污染** | 需审计分离 (1天) | ROI不明 | **Researcher 2发现**: 工厂phraseToIntentMapping残留~91条RESTAURANT_*词条，虽matchPhrase()按domain选Map，但工厂用户仍可能误命中 | 需清理迁移到restaurantPhraseMapping |
| **Gap 2: 执行层无保护** | 未提及 | 未提及 | **Researcher 2新发现**: JWT不携带factoryType，IntentExecutorServiceImpl无factoryType校验，隔离仅停留在识别层 | 新handler应增加factoryType断言 |
| **Gap 3: 两个ActionType枚举冲突** | 需统一 (2天) | dto版可能是死代码 | `dto.intent.ActionType`(8值) 通过 `IntentSemantics` 被使用，`IntentKnowledgeBase.ActionType`(6值) 被主流程使用。独立运作不冲突 | 可优化但非阻塞 |
| **Gap 1: applySuggestion为空壳** | 需完整实现 (5天) | 状态更新已实现 | **分析师更准确** — 核心业务逻辑标注`TODO: Actually apply the suggestion` | 是真正需要投入的工作 |

---

## 最终置信度评估

| 缺口 | 实际严重程度 | 置信度 | 说明 |
|------|------------|--------|------|
| Gap 2 (餐饮/工厂隔离) | **中** — 识别层已隔离但有残留问题 | 80% | v32三层后置过滤存在，但Phrase层91条交叉污染 + 9个handler缺失 + 执行层无factoryType校验 |
| Gap 3 (ActionType分类) | **低-中** — 存在但不阻塞 | 85% | 两套枚举独立运作 |
| Gap 1 (MLRL闭环) | **高** — 核心TODO未实现 | 95% | `applySuggestion` 业务逻辑为空，聚类质量存疑 |

---

## 可执行建议

### 立即执行 (本周, 1-2天)

**1. Gap 1 Phase A: 手动触发的Suggestion应用** (1.5天)
- **文件**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/ActiveLearningServiceImpl.java`
- **当前状态**: 第515行 `TODO: Actually apply the suggestion` — 状态更新已实现，业务执行为空
- **行动**: 实现按suggestion type分支的应用逻辑:
  - `ADD_KEYWORD` -> 调用 `AIIntentConfigService` 添加关键词到对应intent
  - `ADD_EXPRESSION` -> 添加短语到 `IntentKnowledgeBase.commonPhraseMapping`
  - `MERGE_INTENT` -> 标记为需人工确认(不自动执行)
- **关键约束**: 仅支持APPROVED状态的suggestion，必须记录变更前快照用于回滚

**2. 数据验证** (0.5天)
```sql
-- 验证RESTAURANT意图配置完整性
SELECT intent_code, business_type, is_active FROM ai_intent_configs
WHERE intent_code LIKE 'RESTAURANT_%' ORDER BY intent_code;

-- 验证suggestion积压量
SELECT status, suggestion_type, COUNT(*) FROM learning_suggestions
GROUP BY status, suggestion_type;

-- 验证ActionType实际使用率
SELECT intent_code, COUNT(*) FROM intent_match_records
WHERE intent_code LIKE 'RESTAURANT_%' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY intent_code;
```

### 短期执行 (2周内, 3-5天)

**3. Gap 1 Phase B: 自动调度 + Python reload** (3天)
- **文件**: `ActiveLearningServiceImpl.java` — 添加 `@Scheduled` 定时任务
- **文件**: `backend/python/intent_classifier/classifier_service.py` — 添加 `/api/classifier/reload` 端点
- **文件**: 新建 `ActiveLearningController.java` — 手动触发API
- **安全护栏**: 每次应用前运行E2E子集(50个核心case)，准确率低于95%自动回滚
- **关键风险**: 聚类质量(hashCode + 前3词Jaccard)可能导致错误合并，**必须设置人工审批门槛**

**4. Gap 3 增量优化** (条件性, 1-2天)
- **触发条件**: 数据验证确认ActionType错分率>5%
- **文件**: `IntentSemanticsParserImpl.java` — 为RESTAURANT_*意图添加SEMANTIC_MAPPINGS
- **文件**: `dto/intent/ActionType.java` 和 `IntentKnowledgeBase.ActionType` — 考虑统一

### 短期执行 (2周内) — Gap 2 补充

**5. Phrase层交叉污染清理** (0.5天)
- **文件**: `IntentKnowledgeBase.java`
- **问题**: 工厂`phraseToIntentMapping`中残留~91条`RESTAURANT_*`词条（行5009-5041, 5327-5381, 5534-5536）
- **行动**: 将这91条迁移到`restaurantPhraseMapping`，确保工厂用户不会命中餐饮意图

**6. 9个缺失Handler补全** (2-4天)
- **文件**: `RestaurantIntentHandler.java`
- **需注入新Repository**: `PurchaseOrderRepository`, `WastageRecordRepository`

| 意图 | 难度 | 复用基础 | 备注 |
|------|------|---------|------|
| RESTAURANT_AVG_TICKET | LOW | `handleDailyRevenue`已查SalesOrder | 加avg计算 |
| RESTAURANT_DISH_DELETE | LOW | `productTypeRepository`已注入 | 设isActive=false |
| RESTAURANT_DISH_PRODUCT_SALES_RANKING | LOW | `handleDishSalesRanking`几乎相同 | 可合并 |
| RESTAURANT_DISH_CREATE | MEDIUM | `productTypeRepository`已注入 | 写操作需参数解析 |
| RESTAURANT_DISH_UPDATE | MEDIUM | 同上 | findById + save |
| RESTAURANT_PROCUREMENT_CREATE | MEDIUM | `PurchaseOrderRepository`已存在 | 需新注入 |
| RESTAURANT_WASTAGE_RECORD | MEDIUM | `WastageRecordRepository`已存在 | 写入操作 |
| RESTAURANT_RETURN_RATE | HIGH | SalesOrder无REFUNDED状态 | **需新增退单状态或表** |
| RESTAURANT_TABLE_TURNOVER | HIGH | SalesOrder无tableNo/partySize字段 | **需数据模型扩展** |

**7. 执行层factoryType断言** (0.5天)
- **文件**: `RestaurantIntentHandler.java` 入口处
- **行动**: 新handler增加`factoryType==RESTAURANT`断言，防止API层直接调用

### 条件执行 (视数据而定)

**8. Gap 2 Phrase层进一步审计**
- **触发条件**: 清理91条后E2E仍有餐饮用户命中工厂意图
- **文件**: `IntentKnowledgeBase.java` — 审计 `commonPhraseMapping` 中歧义短语

**9. Gap 1 Phase C: 前端管理界面**
- **触发条件**: Phase B稳定运行2周且suggestion积压>50条
- **位置**: `web-admin/src/views/system/ai-intents/index.vue` — 扩展现有意图管理页面

---

## 修正后的工作量估算

| 项目 | 分析师估算 | 修正估算 | 原因 |
|------|-----------|---------|------|
| Gap 2 总计 | 6天 | **3-5天** | v32后置过滤存在但: Phrase清理(0.5天) + 7个LOW/MEDIUM handler(2天) + 2个HIGH handler需数据模型(1-2天) + 执行层factoryType断言(0.5天) |
| Gap 3 总计 | 2天 | **0-2天** (条件性) | 需先验证实际错分率 |
| Gap 1 总计 | 10天 | **5-7天** | Phase A(1.5天) + Phase B(3天) + 护栏(1-2天)，Phase C推迟 |
| **总计** | **18天** | **8-14天** | Gap 1(5-7) + Gap 2(3-5) + Gap 3(0-2条件性) |

---

## 未解决问题

1. **BERT 259标签覆盖率**: v7模型259标签包含25个RESTAURANT_*意图，但**缺3个**(DISH_UPDATE/TABLE_TURNOVER/WASTAGE_RECORD)。这3个只能通过Phrase或LLM层匹配
2. **生产环境suggestion数据量**: `learning_suggestions` 表当前有多少APPROVED待应用的suggestion?
3. **聚类算法质量**: hashCode+前3词Jaccard聚类实际准确率? 建议先抽样100条评估
4. **餐饮E2E覆盖**: 1232个测试case中RESTAURANT_*占多少? 如果<50个需补充

---

## 风险矩阵

| 失败模式 | 概率 | 影响 | 缓解措施 |
|---------|------|------|---------|
| Gap 1: 低质量聚类导致suggestion错误 | 高 (85%) | 高 | 人工审批门槛 + 应用前快照 |
| Gap 1: 模型热加载破坏生产稳定性 | 中 (30%) | 极高 | 双模型buffer原子切换 + 自动回滚 |
| Gap 1: 自动重训引入回归 | 高 (60%) | 高 | E2E门槛: F1>=当前-0.5% |
| Gap 3: 枚举统一导致编译错误 | 高 (70%) | 低 | 全局搜索替换 + CI验证 |
| 全局: DB businessType字段不完整 | 中 (40%) | 高 | 先运行SQL验证 |
| Gap 2: Phrase层91条交叉污染 | 已确认 (100%) | 中 | 迁移到restaurantPhraseMapping |
| Gap 2: 2个HIGH handler需数据模型扩展 | 高 (90%) | 中 | RETURN_RATE需退单表, TABLE_TURNOVER需翻台率字段 |
| Gap 2: 执行层无factoryType校验 | 已确认 (100%) | 高 | JWT不携带factoryType，需handler断言 |

---

## 关键文件索引

| 文件 | 用途 | 操作 |
|------|------|------|
| `backend/java/.../service/impl/ActiveLearningServiceImpl.java` | Gap 1核心 — applySuggestion TODO | 实现业务逻辑 |
| `backend/java/.../service/impl/AIIntentServiceImpl.java` | v32业态隔离 (已完成) | 仅参考 |
| `backend/java/.../service/handler/RestaurantIntentHandler.java` | 18/27 intent已实现，缺9个 | 补全handler + 注入新Repository |
| `backend/java/.../service/impl/IntentSemanticsParserImpl.java` | SEMANTIC_MAPPINGS | 条件性添加RESTAURANT |
| `backend/java/.../dto/intent/ActionType.java` | 8值枚举 | 条件性统一 |
| `backend/java/.../config/IntentKnowledgeBase.java` | 6值ActionType + 短语映射 | 条件性审计 |
| `backend/python/intent_classifier/classifier_service.py` | BERT分类器 | 添加reload端点 |
| `scripts/finetune/data/v8_label_mapping.json` | 标签映射 | 验证RESTAURANT覆盖 |
| `tests/intent-routing-e2e-150.py` | E2E测试 | 验证基准 |

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (MLRL, Restaurant/Factory, Type Classification)
- Total sources found: 24 (all codebase-grounded)
- Key disagreements: 2 resolved (BERT isolation exists, handler count corrected), 1 unresolved (ActionType actual error rate)
- Phases completed: Research (parallel) -> Analysis -> Critique -> Integration -> Heal
- Fact-check: disabled (all claims are codebase-grounded)

### Healer Notes
- [Fixed] Analyst claimed "BERT无隔离" — corrected with code evidence (v32 filter at line 902-909)
- [Fixed] Work estimate 18天 -> 5-10天 after removing already-completed work
- [Fixed] Priority reordered: Gap 1 is now highest priority (only real TODO), Gap 2/3 demoted to conditional
- [Passed] All recommendations have concrete file paths and next steps
