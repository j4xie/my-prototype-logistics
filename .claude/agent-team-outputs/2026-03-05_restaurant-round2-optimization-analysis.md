# 餐饮模块第二轮优化分析

**日期**: 2026-03-05
**模式**: Full | Language: Chinese | Grounding: ENABLED

---

## 执行摘要

餐饮模块代码质量整体合格，但存在16处 `any` 类型污染、导出无上限防护、以及一个未使用的 Dashboard DTO 死代码。Critic 提出的"Dashboard字段名零交集"问题经代码验证为**误报** — 实际 Service 返回 Map 字段名与前端完全匹配，DTO 是死代码。建议优先执行 A1-A2 类型清理(低风险高回报)，导出加 size 上限(A5)，其余按需推进。

---

## 共识与分歧映射

| 主题 | 全员共识/分歧 | 最终裁定 |
|------|-------------|---------|
| A1-A2: tableData/detailData `any` | **共识** — 4文件共8处 any 需清理 | 定义4个interface即可消除 |
| A3: loadStatistics 失败隐藏 | **分歧** — Analyst认为bug, Critic认为合理降级 | **采纳Critic** — statsLoaded不设true=无声降级，合理设计 |
| A5: export size=total无上限 | **共识** — 应加上限 | 加 `Math.min(total, 10000)` |
| C2: Dashboard DTO 字段断裂 | **分歧** — Critic升为P0, Integrator验证为误报 | **DTO是死代码** — Controller返回Map, 字段名与前端匹配 |
| C1: canWrite 自审自批 | **分歧** — Analyst认为High ROI, Critic认为过度工程化 | **采纳Critic** — 原型阶段单角色，记为技术债 |
| B1: 行预警着色 | **分歧** — 盘点已有diffColor | 盘点已实现，损耗可选做 |
| BOM watch 防抖 | **共识** — 应加debounce | 加300ms debounce |

---

## 优先级行动计划

### Immediate (立即执行, 预计1天)

**1. A1-A2: 类型安全批量修复**
- 新增 `types/restaurant.ts` 定义 `RequisitionItem`, `RecipeItem`, `StocktakingRecord`, `WastageRecord` interface
- 替换4文件的 `ref<any[]>([])` → `ref<XxxItem[]>([])` (recipes:219, requisitions:240, stocktaking:220, wastage:218)
- 替换4文件的 `ref<any>(null)` → `ref<XxxItem | null>(null)` (recipes:226, requisitions:247, stocktaking:227, wastage:225)
- formRef 加 `ref<FormInstance>()` 泛型 (4处)

**2. A5: 导出安全阀**
- 4文件的 `handleExport` 中: `size: Math.min(pagination.value.total, 10000)` + 超限提示
- 文件: recipes:359, requisitions:429, stocktaking:344, wastage:352

### Short-term (本周)

**3. BOM watch 防抖**
- `requisitions/list.vue:273` watch 添加 300ms debounce

**4. 删除死代码**
- 删除 `RestaurantDashboardSummary.java` DTO (确认无引用)
- 删除 `getRecipesByDish` 和 `getRequisitionDailySummary` (零调用API, 但需确认后者路径不影响calculate)

### Conditional (按需)

- **C1 权限拆分**: 多角色需求明确时，拆分 `canSubmit`/`canApprove`
- **损耗行着色**: 参考盘点 `diffColor` 模式，对损耗金额加阈值着色
- **配方展开行**: el-table expand-row 按菜品分组展示食材
- **损耗分类Tab**: 利用已有 `statsData.byType` 数据，增加 el-tabs 分区展示

---

## 关键发现详情

### C2 Dashboard DTO 误报还原

- **Critic声称**: Java DTO字段 (`todayRevenue`, `stockAlertCount`) 与前端 (`todayRequisitionCount`, `pendingApprovalCount`) 零交集 → P0
- **Integrator验证**: Controller 返回 `ApiResponse<Map<String, Object>>`，Service 构建 Map 的 key 为 `todayRequisitionCount`, `pendingApprovalCount`, `thisMonthWastageCost`, `latestStocktakingDate` — 与前端完全匹配
- **结论**: DTO 是早期设计遗留死代码，从未被任何 Controller 引用。Dashboard 运行正常。

### 导出 Spring Data 限制

- 4文件 `handleExport` 用 `size: pagination.value.total` 请求全量
- Spring Data 默认 `max-page-size=2000`，超出会截断
- 风险: 导出超2000条时数据不完整，用户无感知
- 修复: 前端加上限 + 后端确认 `spring.data.web.pageable.max-page-size` 配置

---

## 置信度评估

| 结论 | 置信度 | 依据 |
|------|--------|------|
| tableData/detailData any 需清理 | ★★★★★ | 4文件逐行验证 |
| Dashboard 运行正常(DTO死代码) | ★★★★★ | Controller+Service+前端三方交叉验证 |
| 导出 size 无上限存在风险 | ★★★★☆ | 前端确认，后端max配置未验证 |
| canWrite 自审自批为合理技术债 | ★★★★☆ | Critic和Analyst共识 |
| loadStatistics 降级策略合理 | ★★★★☆ | v-if控制渲染，无需toast |
| BOM watch 需防抖 | ★★★★☆ | 模式明确 |

---

## 开放问题

1. 后端 `spring.data.web.pageable.max-page-size` 是否已自定义?
2. `RestaurantDashboardSummary.java` DTO 是否有其他分支在使用?
3. 餐饮模块是否计划支持多角色?
4. UX 模式移植是否纳入下一迭代?

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (parallel)
- Browser explorer: OFF
- Total codebase files examined: ~12
- Key disagreements: 3 (C2 误报已推翻, A3 降级采纳Critic, C1 延迟采纳Critic)
- Phases: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded)
- Healer: 5 checks passed, 0 auto-fixed ✅
