# Web-Admin UI/UX Deep Audit Round 2

**日期**: 2026-03-02
**范围**: 全站 52+ Vue 页面, Playwright 实际验证 4 个有数据的页面
**方法**: Codebase Grep/Read (8+ queries) + Playwright Browser 实际访问

---

## 执行摘要

Round 2 审计聚焦于 Round 1 已修复项之外的数据展示、表单交互、导航一致性和错误处理。整体质量良好 — 金额/日期格式化、面包屑、侧边栏高亮等核心 UI 模式均正确。主要发现 2 个 P1 问题（静默 catch、表单校验缺失）和 2 个 P2 问题。

## Round 1 已修复（不再重复）

- ECharts memory leaks (4 files, 13 charts)
- ECharts theme inconsistency (4 files)
- Anonymous resize listeners (2 files)
- Dialog close-on-click-modal (16 dialogs, 15 files)

---

## P1 — 需要修复

### 1. 静默 catch 块 — 数据加载失败无用户反馈

**严重程度**: P1 | **影响**: ~37 文件 | **修复难度**: 中等

**问题**: 52 个文件有 `catch + console.error`，但约 37 个文件在数据加载失败时只写了 console.error，没有 `ElMessage.error` 给用户提示。

**Browser 验证**: Dashboard 页 4 个 API 返回 502 时，KPI 卡片显示 "0" 和 "-" 但没有任何错误弹窗。

**仅有 console.error 的核心文件示例**:
- `analytics/trends/index.vue:69` — 加载趋势数据失败
- `analytics/ai-reports/index.vue:38` — 加载AI报告失败
- `warehouse/shipments/list.vue:62,77,91` — 多个加载函数
- `equipment/list/index.vue:113` — 加载设备失败
- `warehouse/materials/list.vue:65` — 加载原料失败
- `sales/shipments/list.vue:49` — 加载发货失败
- `equipment/alerts/index.vue:65` — 加载预警失败
- `production/bom/index.vue:113,125,235,247,335,420` — 6 个加载函数
- `finance/reports/index.vue:104` — 加载财务数据失败
- `finance/cost/analysis.vue:30` — 加载成本分析失败
- `system/users/list.vue:94` — 加载用户失败

**已有 ElMessage.error 的文件** (15 个): bom提交、conversions提交、plans提交、disposals提交、whitelist提交等 — 这些是提交操作的 catch，已正确。

**修复模板**:
```typescript
// BEFORE
} catch (error) {
  console.error('加载失败:', error);
}

// AFTER
} catch (error) {
  console.error('加载失败:', error);
  ElMessage.error('数据加载失败，请刷新重试');
}
```

**建议**: 仅修复核心列表页的 loadData catch (~15 个文件)。图表/分析页已有 loading 态，可暂不修。

---

### 2. 表单校验缺失 — 21/27 表单无 :rules

**严重程度**: P1 | **影响**: 21 表单 | **修复难度**: 复杂（需逐表单定义规则）

**问题**: 仅 6/27 表单使用了 `:rules` + `formRef.validate()`，其余 21 个表单仅靠 HTML `required` 属性（Element Plus 的 required 只显示红色星号，不做真正校验）。

**使用 :rules 的文件** (6): products/index, users/list, ChartTemplateView, DataSourceConfigView, CalibrationListView, login/index

**缺少 :rules 的关键表单**:
- `hr/employees/list.vue` — 添加员工
- `hr/departments/index.vue` — 新建部门
- `hr/whitelist/index.vue` — 添加白名单
- `procurement/orders/list.vue` — 新建采购单
- `production/plans/list.vue` — 新建生产计划
- `production/conversions/index.vue` — 新增转换率
- `production/bom/index.vue` — 3 个表单
- `quality/disposals/list.vue` — 新建废弃申请
- `sales/orders/list.vue` — 新建销售单
- `warehouse/shipments/list.vue` — 新建出货
- `warehouse/inventory/index.vue` — 调整库存
- `equipment/list/index.vue` — 添加设备
- `equipment/maintenance/list.vue` — 记录维护
- `warehouse/materials/list.vue` — 入库
- `sales/customers/list.vue` — 新建客户
- `procurement/suppliers/list.vue` — 新建供应商
- `procurement/price-lists/list.vue` — 新建价格表
- `system/pos/list.vue` — 新建POS连接
- `finance/reports/list.vue` — 生成报表

**建议**: 高成本修复，建议仅给 3-5 个最关键表单添加（用户管理、采购订单、生产计划）。后端已有校验兜底。

---

## P2 — 建议优化

### 3. show-overflow-tooltip 覆盖不全

**严重程度**: P2 | **影响**: 19/52 文件 | **修复难度**: 简单

**有 tooltip 的文件**: 33 个文件, 63 列
**缺失的文件** (19): hr/employees/list, procurement/orders/list, procurement/orders/detail, sales/orders/list, sales/orders/detail, quality/inspections/list, scheduling/plans/detail, scheduling/plans/list, hr/attendance/list, calibration/CalibrationListView, calibration/CalibrationDetailView, 等

### 4. 路由缺少 activeMenu 配置

**严重程度**: P2 | **影响**: 子页面/详情页 | **修复难度**: 简单

**问题**: 路由配置中未找到 `activeMenu` 设置。当导航到子页面（如 `/sales/orders/123`）时，侧边栏可能丢失高亮。

**Browser 验证**: 一级菜单页面高亮正确，但未测试详情页跳转后的情况。

---

## P3 — 可选改进

### 5. 表格空状态 — 51/52 默认 "暂无数据"

仅 `FoodKBFeedback.vue` 使用了自定义 `empty-text`。其余使用 Element Plus 默认值。可改进但非必要。

### 6. tableFormatters.ts 功能单一

目前只有 `emptyCell()` 函数。可添加 `formatMoney`, `formatWeight` 等但当前各文件的内联格式化已正确运行。

---

## 正面发现 ✅

| 检查项 | 状态 | 详情 |
|--------|------|------|
| emptyCell formatter | ✅ 良好 | 172 次使用, 40/52 文件 |
| 日期格式化 | ✅ 正确 | dateFormat.ts 工具 + 28 文件使用 |
| 金额格式化 | ✅ 优秀 | ¥245,000.00 (千分位+2位小数) |
| 中文枚举翻译 | ✅ 完整 | 状态/角色/类型全部中文化 |
| 面包屑 | ✅ 自动 | AppHeader.vue 从 route.matched 生成 |
| 侧边栏高亮 | ✅ 正确 | 一级菜单全部正确 |
| 提交防重复 | ✅ 良好 | 绝大多数 submit 有 :loading |
| Dialog 防误关 | ✅ 已修 | Round 1 修复, 34 个 dialog |

---

## 修复优先级建议

| 优先级 | 问题 | 修复量 | 建议 |
|--------|------|--------|------|
| **立即修** | 核心页面静默 catch 加 ElMessage | ~15 文件 | 高 ROI |
| **本轮可修** | show-overflow-tooltip 补全 | ~19 文件 | 简单批量操作 |
| **下轮考虑** | 关键表单 :rules | 3-5 表单 | 选择性修复 |
| **跳过** | 空状态自定义 / formatters 扩展 | — | 成本 > 收益 |

---

## Process Note

- Mode: Full
- Researchers deployed: 2 (codebase) + 2 (browser) = 4 (output capture failed, manual fallback)
- Browser explorer: ON — 4 pages visited with live data
- Codebase queries: 8+ Grep scans covering tables, forms, formatters, catch blocks, routing
- Phases completed: Research → Analysis → Critique (combined due to agent output issue)
- Key stats: 52 el-table files, 27 el-form files, 313 catch blocks, 204 ElMessage.error calls
