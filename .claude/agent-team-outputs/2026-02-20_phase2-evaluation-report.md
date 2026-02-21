# Phase 2 方案评估报告：报工闭环 + 餐饮进销存

**日期**: 2026-02-20
**模式**: Full | 语言: Chinese | 代码溯源: ENABLED

---

## 执行摘要

- **核心结论**：Phase 2A（报工闭环）后端骨架已就绪，核心阻力是业务决策而非代码缺失；批次完成事件触发链已存在（`ProcessingServiceImpl` + `SupplyChainOrchestrator`），将其标记为"缺失"是错误的。
- **信心**：中高（Critic 对最关键两个声明的驳斥经代码验证属实）。
- **最高风险**：`createFinishedGoodsFromBatch()` 存在 `expireDate / storageLocation / createdBy` 等字段为 null，可能触发 DDL NOT NULL 约束导致静默失败，优先级 P0。
- **工期影响**：Phase 2A 不是"补触发点的2周"，而是"明确双路径业务规则 + null字段修复 + 前端 UserDTO 补丁"，预计 3-4 天后端 + 1 周前端，合计约 1.5 周。
- **复用率**：Phase 2C（餐饮进销存）约 60-70% 后端可复用，Phase 2C 因蓝图表无种子数据，冷启动成本约 1 周额外投入。

---

## 共识与分歧对照表

| 议题 | Researcher | Analyst | Critic | 最终裁定 |
|------|-----------|---------|--------|---------|
| BatchCompletedEvent 触发链是否缺失 | A/B 称"缺触发点" | 采信"缺触发点" | ⚠️ 驳斥：ProcessingServiceImpl.completeProduction() 已发布事件 | **触发链完整**，问题是双路径业务规则未明确 |
| 报工状态机"四态" | A 称"四态完整" | 采信四态 | ❌ submitReport 直接置 SUBMITTED，实为三态 | **实际三态**，DRAFT 无法从提交路径进入 |
| createFinishedGoodsFromBatch() 可直接使用 | A 称"已实现" | 中等信心 | ⚠️ expireDate/storageLocation/createdBy 均 null | **已实现但不完整**，null 字段是 P0 风险 |
| UserDTO 缺 factoryType 字段 | C 确认 | 确认 | ✅ 完全确认 | **三方一致** |
| FAManagementScreen 无条件渲染 | C 确认 | 确认 | ✅ 完全确认 | **三方一致** |
| hasProductionCapability() 排除 RESTAURANT | B 隐含 | 未标注 | ⚠️ 语义冲突 | **确认为潜在陷阱** |
| 前端审批 UI 100% 可复用 | A 确认 | 高信心 | ✅ 确认 | **三方一致** |
| Phase 2C 蓝图无 RESTAURANT 种子数据 | B/C 确认 | 列为前提 | ✅ 确认 | **三方一致，硬性前提** |

---

## 关键发现详情

### 1. 事件触发链：已存在但双路径未锁定

系统存在**两条独立的批次完成路径**：
- **路径 A**：车间主管直接调用 `completeProduction()`（绕过报工审批）→ 发布 BatchCompletedEvent
- **路径 B**：报工员提交 → 主管审批 → 批次状态变更

真正待决策：报工审批通过后是否应该自动将关联批次标记为 COMPLETED，还是两条路径并存。

### 2. createFinishedGoodsFromBatch() null 字段风险 (P0)

```java
// SupplyChainOrchestrator:239-252
fg.setUnit(batch.getUnit() != null ? batch.getUnit() : "kg");
// expireDate: 未设置 ← 食品合规必须
// storageLocation: 未设置
// createdBy: 未设置
```

若 DDL 有 NOT NULL 约束 → `save()` 抛 DataIntegrityViolationException → try/catch 静默吞噬 → 报工成功但成品不入库。

### 3. 可复用模块清单

| 模块 | 复用率 | 说明 |
|------|--------|------|
| 审批 UI (PurchaseOrderDetailScreen) | 100% | Alert 确认 + 条件按钮 + STATUS_MAP |
| 列表模式 (ReturnOrderListScreen) | 100% | FlatList + SegmentedButtons + RefreshControl |
| API 客户端 (workReportingApiClient) | 100% | 单例 + factoryId 注入 + PageResponse |
| 订单状态流转 (PurchaseServiceImpl) | 90% | 编号生成 + 总额计算 + A/R 同步 |
| 事件驱动 (SupplyChainOrchestrator) | 90% | @EventListener + 异常隔离模式 |
| BaseEntity 软删除 | 100% | @SQLDelete + @Where + 审计时间戳 |
| FactoryType 枚举 | 80% | 需新增 hasFoodServiceCapability() |
| FactoryTypeBlueprint | 70% | 结构就绪但缺种子数据 + String 非 JSONB |
| EncodingRule 编码规则 | 100% | 6 种占位符可直接用于餐饮单据 |
| InsightGenerator LLM | 60% | 框架可复用但需全新餐饮场景基准 |

### 4. 意图路由扩展能力

现有 3 级映射架构（28 条 override 规则）可承载报工和餐饮新意图：
- 在 `INTENT_CODE_HANDLER_OVERRIDE` 添加 `LABOR_REPORTING` / `INVENTORY_RESTAURANT` 类别
- SmartBI 场景角色新增 `labor_efficiency` + `restaurant_inventory`
- EncodingRule 为餐饮生成单据编号：`PO-{RESTAURANT}-{YYYYMMDD}-{SEQ:3}`

### 5. 动态定义系统现状

| 层级 | 组件 | 状态 |
|------|------|------|
| Level 1 (蓝图) | FactoryTypeBlueprint (5个 JSON 字段) | 结构就绪，缺 RESTAURANT 数据 |
| Level 2 (实例化) | FactoryFeatureConfig (enabled + jsonb) | 后端就绪，前端未消费 |
| Level 3 (运行时) | IntentHandler + LLM 路由 | 5 场景可扩展 |
| 编码规则 | EncodingRule (6 种占位符) | 可直接复用 |
| 规则引擎 | Drools (rule_content + decision_table) | 表结构就绪，待激活 |

---

## 置信度评估

| 结论 | 置信度 | 证据 |
|------|--------|------|
| BatchCompletedEvent 触发链完整 | ★★★★★ | 代码验证 |
| createFinishedGoodsFromBatch() null 字段风险 | ★★★★★ | 代码验证 |
| 报工实际三态（非四态） | ★★★★☆ | 代码验证（间接） |
| UserDTO 缺 factoryType | ★★★★★ | 三方一致 |
| FAManagementScreen 无条件渲染 | ★★★★★ | 三方一致 |
| 前端审批 UI 100% 可复用 | ★★★★★ | 三方一致 |
| hasProductionCapability() 排除 RESTAURANT | ★★★★☆ | 代码验证 |
| Phase 2C 复用率 60-70% | ★★★☆☆ | 估算 |
| Phase 2A 工期 1.5 周 | ★★★☆☆ | 估算（含业务决策不确定性） |
| 餐饮 LLM 指标需全新配置 | ★★★★☆ | 三方共识 |

---

## 可执行建议

### 立即执行
1. **P0** 修复 createFinishedGoodsFromBatch() null 字段（expireDate/createdBy 默认值）
2. **P0** 明确双路径业务规则：报工审批 vs 直接 completeProduction
3. **P1** 独立 PR：UserDTO 补充 factoryType 字段

### 短期（本周）
4. FAManagementScreen 添加 factoryType 条件渲染
5. 明确 DRAFT 状态语义（实现或移除）
6. FactoryType 新增 hasFoodServiceCapability() 方法
7. 创建 RESTAURANT 蓝图种子数据 SQL

### 条件执行
8. 若"审批驱动"：approveReport() 中发布 BatchCompletedEvent
9. 若 Phase 2C 立项：InsightGenerator 新增餐饮场景模块
10. 若蓝图演示：运行种子脚本 + 前端蓝图配置 UI

---

## 待解决问题

1. 双路径权威性：completeProduction() vs 报工审批，哪条是主路径？
2. finished_goods_batches 表 DDL：expireDate 等字段是否 NOT NULL？
3. submitReport() 完整逻辑：DRAFT 是否有隐藏激活路径？
4. batchId null 比例：现有数据中多少报工无关联批次？
5. FactoryFeatureConfig 前端消费：是否有其他屏幕已部分消费？
6. 餐饮 BOM 最小范围：是否需要食谱管理还是仅采购/库存/销售？

---

## Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 24 (all codebase sources)
- Key disagreements: 3 resolved (trigger chain, state machine, blueprint fields), 1 unresolved (DDL constraints)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: disabled (codebase-grounded)
- Competitor profiles: N/A
