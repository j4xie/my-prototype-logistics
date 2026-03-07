# 餐饮端缺口产品逻辑分析 — 优先级与实施方案

**日期**: 2026-03-03
**Agent Team Mode**: Full (3 Researchers + Analyst + Critic + Integrator)
**研究主题**: 从产品逻辑角度深入分析餐饮端 6+1 个缺口的修复优先级和实施方案

---

## Executive Summary

- **核心建议**: Sprint 1 必须将 Gap7（意图Handler数据真实性）与 Gap2-minimal（餐饮四表基础CRUD）捆绑实施，单独修Gap7会导致AI回答从"不准确"退化为"暂无数据"
- **置信度**: 中高（Critic对"Gap7不可单独做"的挑战经代码验证成立，三位Researcher数据一致）
- **核心风险**: RestaurantIntentHandler注入0个餐饮Repository + F002四表零数据，修一个不修另一个必然回归
- **时间线**: 实际5-6周（非Analyst估计的4周），Sprint 1扩展为1.5周是关键调整
- **工作量**: 快速修复约350行/4天 + Gap7约500行/5天 + Gap2-minimal约3000行/1.5周 + Gap2-full约8000行/2周

---

## 一、缺口全景

| # | 缺口 | 严重度 | 成本 | 核心发现 |
|---|------|--------|------|----------|
| **7** | **意图-Controller数据鸿沟** | 极高 | 3-5天 | Handler注入0个餐饮Repo，18意图全读共享表，损耗用expire_date估算（代码注释"临时实现"） |
| **1** | Vue Sidebar无factoryType过滤 | 高 | <1天(代码)+产品决策 | 纯RBAC，餐饮用户看到全部14个一级菜单 |
| **2** | 餐饮专属前端缺失 | 极高 | 2-3周 | 29个后端端点零前端消费者，需18新文件(RN 11屏+Vue 7视图) |
| **3** | Vue路由无factoryType守卫 | 中 | <0.5天 | URL可直接访问/production/plans等工厂专属页面 |
| **4** | useBusinessMode利用率8.6% | 中 | 1-2天 | 7/81 Vue views使用，15-20个文件需接入 |
| **5** | CENTRAL_KITCHEN跨端逻辑 | 待确认 | <0.5天 | 可能是有意设计（RN工厂操作/Vue管理术语），非Bug |
| **6** | RN仓储子页面硬编码术语 | 中 | 1天 | 库存管理i18n覆盖率约30%，大量标签硬编码 |

---

## 二、共识与分歧

| 议题 | Analyst建议 | Critic挑战 | 最终裁定 |
|------|------------|-----------|---------|
| Gap7优先级 | 本周单独做（3-5天） | 单独做会回归——Handler正确读空表返回"暂无数据"比估算更差 | **Critic正确**。Gap7必须配对Gap2-minimal |
| Gap2时间安排 | Sprint 4（第3-4周） | 不可等3-4周，至少Gap2-minimal需前置 | **折中**：拆为Gap2-minimal(Sprint 1)+Gap2-full(Sprint 3-4) |
| Gap1实际难度 | <1天 | 隐藏产品决策——"哪些菜单对餐饮可见"矩阵未定义 | **Critic正确**。代码<1天，但前置需菜单可见矩阵 |
| Gap5是否Bug | Sprint 2快速修复 | 可能是有意设计（不同端面向不同角色） | **暂缓**。降级为条件任务，待确认设计意图 |
| 总时间线 | 4周 | 5-7周 | **实际5-6周**（Gap2-minimal前置+测试+产品决策延迟） |

---

## 三、关键代码证据

### 3.1 RestaurantIntentHandler — 数据鸿沟验证

```java
// RestaurantIntentHandler.java 行68-75 — 注入的5个Repository
@Autowired private ProductTypeRepository productTypeRepository;
@Autowired private MaterialBatchRepository materialBatchRepository;
@Autowired private RawMaterialTypeRepository rawMaterialTypeRepository;
@Autowired private SalesOrderRepository salesOrderRepository;
@Autowired private SalesOrderItemRepository salesOrderItemRepository;
// 缺失: RecipeRepository, WastageRecordRepository, StocktakingRecordRepository, MaterialRequisitionRepository
```

```java
// 行984 — 损耗估算（临时实现）
// 尝试基于过期批次估算损耗（作为临时实现）
var expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);
```

### 3.2 后端API就绪但无前端消费者

| Controller | 端点数 | 状态机 | 缺口 |
|-----------|--------|--------|------|
| RecipeController | 8 | 软删除(isActive) | 缺版本管理、批量导入 |
| MaterialRequisitionController | 8 | DRAFT→SUBMITTED→APPROVED/REJECTED ✅ | 缺cancel-draft、趋势查询 |
| WastageRecordController | 6 | DRAFT→SUBMITTED→APPROVED ⚠️ | **缺REJECTED**，缺时序分析 |
| StocktakingRecordController | 6 | IN_PROGRESS→COMPLETED/CANCELLED ✅ | 仅单品盘点，无批量，无库存回写 |
| RestaurantDashboardController | 1 | — | 仅summary端点 |

### 3.3 F002测试数据现状

| 表 | 数据量 | 来源 |
|----|--------|------|
| sales_orders | 10条 | insert_restaurant_test_data.sql |
| material_batches | 有数据 | insert_restaurant_test_data.sql |
| **recipes** | **0** | 未填充 |
| **wastage_records** | **0** | 未填充 |
| **stocktaking_records** | **0** | 未填充 |
| **material_requisitions** | **0** | 未填充 |

---

## 四、置信度评估

| 结论 | 置信度 | 证据基础 |
|------|--------|---------|
| Handler未注入餐饮Repository | ★★★★★ | 代码直接验证 |
| F002四表零数据 | ★★★★☆ | SQL文件验证 |
| Gap7不可单独实施（必须配对数据+CRUD） | ★★★★☆ | Critic逻辑链+代码验证 |
| Gap1隐藏产品决策依赖 | ★★★★☆ | 逻辑推演 |
| Gap5是Bug而非Feature | ★★★☆☆ | 仅推测，无文档佐证 |
| 总时间线4周可完成 | ★★☆☆☆ | Analyst估4周，Critic估5-7周 |

---

## 五、实施路线图

### Sprint 1（第1-2周，7-8工作日）— 数据真实性 + 最小可用

| # | 任务 | 文件 | 工期 | 里程碑 |
|---|------|------|------|--------|
| 1 | F002四表测试数据SQL | `insert_restaurant_test_data.sql` | 1天 | 四表各≥10条关联数据 |
| 2 | Handler注入4个餐饮Repository | `RestaurantIntentHandler.java` | 0.5天 | 编译通过 |
| 3 | 重写损耗类3个意图(读wastage_records) | `RestaurantIntentHandler.java` | 1天 | WASTAGE_SUMMARY/RATE/ANOMALY返回真实数据 |
| 4 | 重写COST_TREND(读recipes BOM) | `RestaurantIntentHandler.java` + Repository | 1天 | 返回按周/月聚合趋势 |
| 5 | WastageRecord添加REJECTED状态 | `WastageRecord.java` + Controller | 0.5天 | 状态机完整 |
| 6 | Vue: 4个基础CRUD列表页 | `views/restaurant/*.vue`(新建4文件) | 3天 | 菜谱/损耗/盘点/领料可查看+新增 |
| 7 | E2E验证 | `restaurant-full-e2e.py` | 1天 | 餐饮域response quality ≥90% |

### Sprint 2（第3周前半，3-4工作日）— 基础设施 + 术语

| # | 任务 | 文件 | 工期 |
|---|------|------|------|
| 8 | Gap3: Vue路由守卫factoryType | `guards.ts` + `index.ts` | 0.5天 |
| 9 | Gap4: useBusinessMode扩展15-20个Vue视图 | 15-20个Vue文件 | 1.5天 |
| 10 | Gap6: RN仓储i18n补充 | `warehouse.json` + 4-6个Screen文件 | 1天 |

### Sprint 3-4（第3-5周，2-3周）— 完整餐饮前端

| # | 任务 | 文件 | 工期 |
|---|------|------|------|
| 11 | RN: 菜谱管理(列表/详情/编辑) | 3个新Screen文件 | 3天 |
| 12 | RN: 损耗记录(列表/新建) | 2个新Screen文件 | 2天 |
| 13 | RN: 盘点管理(列表/执行/汇总) | 3个新Screen文件 | 3天 |
| 14 | RN: 领料申请(申请/审批/详情) | 3个新Screen文件 | 3天 |
| 15 | Vue: 餐饮Dashboard | `DashboardRestaurant.vue`(新建) | 1天 |
| 16 | Vue: 成本分析/损耗趋势图表 | 2个新Vue视图 | 2天 |
| 17 | 集成测试 + E2E | 测试文件 | 2天 |

### 条件任务（需先确认再执行）

| # | 任务 | 前置条件 | 工期 |
|---|------|---------|------|
| C1 | Gap1: Vue侧边栏factoryType过滤 | 产品经理定义餐饮菜单可见矩阵 | <1天 |
| C2 | Gap5: CENTRAL_KITCHEN双端一致性 | 确认不一致是Bug而非Feature | <0.5天 |

---

## 六、需要的产品决策（工程无法单独决定）

| # | 决策项 | 影响范围 | 建议 |
|---|--------|---------|------|
| **P1** | 餐饮菜单可见矩阵 | Gap1（阻塞条件任务C1） | 建议：隐藏"智能调度""设备管理""生产分析""转换率"，保留采购/销售/仓储/HR/财务 |
| **P2** | CENTRAL_KITCHEN功能边界 | Gap5 | 建议：暂保持现状（RN工厂模式/Vue餐饮术语），待有实际中央厨房客户再统一 |
| **P3** | 损耗记录REJECTED后流程 | Sprint 1 | 建议：REJECTED→允许修改后重新提交(REJECTED→DRAFT) |
| **P4** | 盘点是否自动回写库存 | Sprint 3-4 | 建议：盘点完成后管理员确认→手动触发库存调整（非全自动） |
| **P5** | AI精度vs速度权衡 | Sprint 1 | 建议：先不做缓存，观察Gap7修复后实际延迟，超过1s再优化 |
| **P6** | 餐饮Dashboard核心指标 | Sprint 3-4 | 建议：今日营业额 + 食材损耗率 + 待审批数（取代当前3张卡） |

---

## 七、Open Questions

1. **F002四表数据库实际状态？** SQL文件分析显示零数据，但需直接查询生产数据库确认
2. **餐饮用户实际使用比例（AI vs 表单 vs RN操作）？** 影响Gap7 vs Gap2优先级
3. **StocktakingController盘点回写策略？** 当前仅计算差异不修改库存
4. **RecipeController版本管理是否需要？** 小型餐厅(15 SKU)变更频率低，可能不需要
5. **竞品功能对标缺失** 美团餐饮管家/客如云的功能矩阵未对比

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (后端API/前端成本/产品定位)
- Browser explorer: OFF
- Total source files examined: 20+
- Key code references: RestaurantIntentHandler.java, 5个餐饮Controller, insert_restaurant_test_data.sql, AppSidebar.vue, useBusinessMode.ts, factoryType.ts, guards.ts, permission.ts, FAHomeScreen.tsx, FAManagementScreen.tsx, restaurant-full-e2e.py
- Key disagreements: 2 resolved (Gap7单独vs配对→配对; Gap2整体延后vs分阶段→分阶段), 2 unresolved (Gap5是Bug还是Feature; 总时间线)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase grounding mode)
- Healer: All checks passed (structural completeness verified, cross-references consistent, recommendations actionable with file paths and LOC estimates)
- New finding: Gap7回归风险 (Critic发现 — 修复Handler+空表=退化)
