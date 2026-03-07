# Vue Web-Admin Round 2 UI/UX 修复验证报告

**日期**: 2026-03-02
**测试环境**: http://139.196.165.140:8086
**后端**: http://47.100.235.168:10010
**测试用户**: `factory_admin1` / `123456`
**测试工具**: Playwright MCP (Chromium)

---

## 一、修复总结

| 修复项 | 影响范围 | 状态 |
|--------|----------|------|
| **emptyCell formatter** — 空值显示 "-" | 40 文件, ~200 列 | ✅ 已部署 |
| **Form :rules 验证** — 空提交拦截 | 21 文件, 21+ 表单 | ✅ 已部署 |
| **empty-text** — 空表格业务语义提示 | 45 文件, 52 表格 | ✅ 已部署 |
| **activeMenu** — 详情页侧边栏高亮 | router + sidebar 组件 | ✅ 已部署 |
| **show-overflow-tooltip** — 长文本省略+悬浮 | 40 文件, ~200 列 | ✅ 已部署 |
| **silent catch blocks** — console.error 补全 | 30+ 文件 | ✅ 已部署 |

---

## 二、Playwright 验证结果

### 2.1 emptyCell formatter (空值 → "-")

| 页面 | 验证列 | 结果 |
|------|--------|------|
| `/hr/employees` | 手机号列 (null → "-") | **PASS** |
| `/hr/employees` | 部门列 (null → "-") | **PASS** |
| `/equipment/alerts` | 处理时间列 (null → "-") | **PASS** |
| `/procurement/suppliers` | 联系电话列 (null → "-") | **PASS** |
| `/scheduling/plans` | 平均完成概率列 (null → "-") | **PASS** |
| `/scheduling/plans` | 确认时间列 (null → "-") | **PASS** |
| `/scheduling/plans/:id` | 工人列 (null → "-") | **PASS** |

### 2.2 Form :rules 验证

| 页面 | 操作 | 预期 | 结果 |
|------|------|------|------|
| `/hr/employees` → 添加员工 | 空表单点击"确定" | 阻止提交 + 显示校验错误 | **PASS** |
| 验证消息 1 | — | "请输入员工姓名" | **PASS** |
| 验证消息 2 | — | "请输入手机号" | **PASS** |
| 验证消息 3 | — | "请选择角色" | **PASS** |

### 2.3 empty-text (空表格业务语义提示)

| 页面 | 预期 empty-text | 实际显示 | 结果 |
|------|-----------------|----------|------|
| `/calibration/list` (0条记录) | "暂无校准记录" | "暂无校准记录" | **PASS** |
| `/transfer/list` (0条记录) | "暂无调拨记录" | "暂无调拨记录" | **PASS** |

### 2.4 activeMenu (详情页侧边栏高亮)

| 页面 | 预期高亮菜单项 | 实际 | 结果 |
|------|---------------|------|------|
| `/procurement/orders/PO-F001-202501-001` | "采购订单" 蓝色高亮+左侧蓝条 | 截图确认: 采购订单保持高亮 | **PASS** |
| 面包屑 | "采购管理 / 采购订单详情" | 正确显示 | **PASS** |

---

## 三、修改文件清单

### 3.1 emptyCell formatter (v19 plan)

**工具函数**: `src/utils/tableFormatters.ts`

```typescript
export function emptyCell(_row: any, _column: any, cellValue: any): string {
  return cellValue != null && cellValue !== '' ? String(cellValue) : '-';
}
```

**40 文件** 每个自闭合 `<el-table-column>` 添加 `:formatter="emptyCell"` + `show-overflow-tooltip`。

### 3.2 Form :rules (21 文件)

| # | 文件 | 表单数 |
|---|------|--------|
| 1 | `hr/employees/list.vue` | 2 (添加+编辑) |
| 2 | `hr/departments/index.vue` | 1 |
| 3 | `hr/whitelist/index.vue` | 1 |
| 4 | `procurement/orders/list.vue` | 1 |
| 5 | `procurement/suppliers/list.vue` | 1 |
| 6 | `procurement/price-lists/list.vue` | 1 |
| 7 | `production/plans/list.vue` | 1 |
| 8 | `production/conversions/index.vue` | 1 |
| 9 | `production/bom/index.vue` | 3 (BOM+人工+费用) |
| 10 | `quality/disposals/list.vue` | 1 |
| 11 | `sales/orders/list.vue` | 1 |
| 12 | `sales/customers/list.vue` | 1 |
| 13 | `warehouse/shipments/list.vue` | 1 |
| 14 | `warehouse/inventory/index.vue` | 1 |
| 15 | `warehouse/materials/list.vue` | 1 |
| 16 | `equipment/list/index.vue` | 3 (添加+编辑+维保) |
| 17 | `equipment/maintenance/list.vue` | 1 |
| 18 | `system/pos/list.vue` | 1 |
| 19 | `finance/reports/list.vue` | 1 |
| 跳过 | `scheduling/plans/list.vue` | 无表单 (跳转创建页) |
| 跳过 | `hr/attendance/list.vue` | 只读页 (无表单) |

### 3.3 empty-text (45 文件, 52 表格)

<details>
<summary>完整列表 (点击展开)</summary>

**主列表页 (31 文件)**

| 文件 | empty-text |
|------|-----------|
| `calibration/CalibrationListView.vue` | 暂无校准记录 |
| `equipment/alerts/index.vue` | 暂无告警记录 |
| `equipment/maintenance/list.vue` | 暂无维保记录 |
| `equipment/list/index.vue` | 暂无设备数据 |
| `production/plans/list.vue` | 暂无生产计划 |
| `production/batches/list.vue` | 暂无生产批次 |
| `production/conversions/index.vue` | 暂无转化规则 |
| `procurement/orders/list.vue` | 暂无采购订单 |
| `procurement/price-lists/list.vue` | 暂无价格协议 |
| `quality/inspections/list.vue` | 暂无质检记录 |
| `quality/disposals/list.vue` | 暂无处置记录 |
| `warehouse/shipments/list.vue` | 暂无出入库记录 |
| `warehouse/materials/list.vue` | 暂无物料数据 |
| `warehouse/inventory/index.vue` | 暂无库存数据 |
| `hr/employees/list.vue` | 暂无员工数据 |
| `hr/departments/index.vue` | 暂无部门数据 |
| `hr/whitelist/index.vue` | 暂无白名单记录 |
| `hr/attendance/list.vue` | 暂无考勤记录 |
| `sales/customers/list.vue` | 暂无客户数据 |
| `sales/orders/list.vue` | 暂无销售订单 |
| `sales/finished-goods/list.vue` | 暂无成品库存 |
| `sales/shipments/list.vue` | 暂无发货记录 |
| `transfer/list.vue` | 暂无调拨记录 |
| `system/users/list.vue` | 暂无用户数据 |
| `system/roles/index.vue` | 暂无角色数据 |
| `system/ai-intents/index.vue` | 暂无意图配置 |
| `system/products/index.vue` | 暂无产品数据 |
| `scheduling/plans/list.vue` | 暂无排程计划 |
| `finance/reports/list.vue` | 暂无报表数据 |
| `analytics/AlertDashboard.vue` | 暂无告警数据 |
| `analytics/ai-reports/index.vue` | 暂无AI报告 |

**详情/子表格 (11 文件, 18 表格)**

| 文件 | empty-text |
|------|-----------|
| `production/bom/index.vue` (×3) | 暂无BOM物料 / 暂无人工成本 / 暂无制造费用 |
| `calibration/CalibrationDetailView.vue` | 暂无异常项 |
| `transfer/detail.vue` | 暂无调拨明细 |
| `scheduling/plans/detail.vue` | 暂无产线排程 |
| `finance/reports/index.vue` | 暂无成本明细 |
| `finance/ar-ap/index.vue` (×3) | 暂无应收数据 / 暂无应付数据 / 暂无账龄数据 |
| `procurement/orders/detail.vue` (×2) | 暂无订单明细 / 暂无收货记录 |
| `sales/orders/detail.vue` (×2) | 暂无订单明细 / 暂无发货记录 |
| `warehouse/inventory/index.vue` | 暂无调整记录 |
| `production-analytics/ProductionAnalysis.vue` | 暂无生产明细 |
| `production-analytics/EfficiencyAnalysis.vue` | 暂无效率数据 |

**配置页 (3 文件)**

| 文件 | empty-text |
|------|-----------|
| `smartbi-config/ChartTemplateView.vue` | 暂无图表模板 |
| `smartbi-config/DataSourceConfigView.vue` | 暂无数据源配置 |
| `smartbi-config/SmartBIConfigView.vue` | 暂无阈值配置 |

</details>

### 3.4 activeMenu

路由 `meta.activeMenu` 添加到所有隐藏/详情路由，侧边栏组件读取 `route.meta.activeMenu || route.path` 作为 `default-active`。

---

## 四、部署记录

| 步骤 | 命令 | 结果 |
|------|------|------|
| Build | `npm run build` | 30.26s, 成功 |
| Deploy | `rsync -avz --delete dist/ root@139.196.165.140:/www/wwwroot/web-admin/` | 5.97MB, 成功 |
| 健康检查 | `curl http://139.196.165.140:8086/` | HTTP 200 |

---

## 五、测试统计

| 指标 | 值 |
|------|-----|
| Playwright 验证项 | **13** |
| PASS | **13** |
| FAIL | **0** |
| 通过率 | **100%** |
| 修改文件总数 | **~95 files** |
| 涉及修复类型 | 6 (formatter, tooltip, rules, empty-text, activeMenu, catch blocks) |
