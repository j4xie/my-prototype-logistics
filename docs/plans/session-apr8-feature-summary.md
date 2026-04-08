# Apr 8 Session 新增功能汇总

**日期**: 2026-04-08
**主题**: 客户会议 v3 P0 功能落地 + 深度核对补丁
**范围**: 12 大块功能 (Java 后端 + Web Admin + RN App + AI 知识库)

---

## 功能清单

### 1. P0-6 指定人员授权 (用户级菜单权限覆盖)

**说明**: 在标准角色权限基础上，允许对单个用户 GRANT / REVOKE 指定菜单权限，不用为个别用户新建角色。

**关键文件**:
- 迁移: `V20260408_06__user_menu_permissions.sql`
- Controller: `UserMenuPermissionController.java` — 5 个 REST 端点
  - `GET /users/{userId}/menu-permissions`
  - `POST /users/{userId}/menu-permissions/grant`
  - `POST /users/{userId}/menu-permissions/revoke`
  - `DELETE /users/{userId}/menu-permissions/{menuCode}`
  - `GET /users/{userId}/effective-menus`
- Entity: `UserMenuPermission.java`

**使用入口**: 系统管理 → 用户管理 → 选中用户 → 「菜单权限」Tab

---

### 2. P0-12 生产计划关联销售订单行

**说明**: 生产计划可直接关联到 `SalesOrderItem` 级别，而不是只关联到 SO 头。

**关键文件**:
- 迁移: `V20260408_08__production_plan_source_order_item.sql`
- Entity: `ProductionPlan.sourceOrderItemId` 外键到 `SalesOrderItem`
- Web: 生产计划新建页 — 来源类型下拉 + SO → item 级联

**使用入口**: 生产管理 → 生产计划 → 新建 → 来源类型「销售订单」

---

### 3. P0-13 发货批次强制分配

**说明**: 发货时每行产品必须完成批次分配才允许发货，避免同产品多批次混乱。

**关键文件**:
- 迁移: `V20260408_07__sales_delivery_item_batch_allocations.sql`
- Entity: `SalesDeliveryItemBatchAllocation.java`
- Service: `shipDelivery()` 入口校验所有 item 必须存在 allocation 且 sum = qty

**使用入口**: 销售订单 → 发货 → 发货明细页 → 每行「批次分配」

---

### 4. P0-14 BOM 拆原料 / 辅料 / 包材 3 块

**说明**: BOM 行增加 `materialCategory` 字段，前端按 RAW / AUXILIARY / PACKAGING 3 Tab 展示。

**关键文件**:
- 迁移: `V20260408_03__bom_item_material_category.sql`
- Entity: `BomItem.materialCategory` (enum)
- Web: BOM 编辑页 3 Tab 分组

**使用入口**: 研发管理 → BOM 管理 → 编辑 BOM

---

### 5. P0-15 报工三种模式 (mode_1 / mode_2 / mode_3)

**说明**: 生产计划维度配置报工模式 — 按工序 / 按批次 / 按人头。

**关键文件**:
- 迁移: `V20260408_04__production_report_mode.sql`
- Entity: `ProductionPlan.reportMode` (ReportMode enum)
- Web/App: 报工表单根据 mode 切换

**使用入口**: 生产计划新建时「报工模式」下拉

---

### 6. P0-16 RN App 拍照签收

**说明**: 车间领料签收页集成相机拍照。

**关键文件**:
- `frontend/CretasFoodTrace/src/screens/.../MaterialReceiptScreen.tsx`
- 依赖: `expo-image-picker`

**使用入口**: RN App → 领料签收 → 「拍照」按钮

---

### 7. P0-17 入库发起单强制分类

**说明**: 所有入库必须指定 `sourceDocType`，共 6 类来源凭据类型。

**关键文件**:
- 迁移: `V20260408_02__material_batch_source_doc.sql`
- Entity: `MaterialBatch.sourceDocType` (枚举 PURCHASE_RECEIVE / MATERIAL_REQUISITION_RETURN / SALES_RETURN / INVENTORY_GAIN / FREE_GIFT / MANUAL_ADJUST)

**使用入口**: 仓储管理 → 入库 → 新建 → 来源类型必选

---

### 8. P0-18 两级组长角色 (TEAM_LEADER / GROUP_LEADER)

**说明**: 引入两级组长角色以适配车间多层级管理。

- **TEAM_LEADER 班长**: Level 25, 7 项权限
- **GROUP_LEADER 组长**: Level 28, 5 项权限

**关键文件**: 角色常量配置 + 权限种子脚本

**使用入口**: 系统管理 → 用户管理 → 编辑用户 → 角色下拉

---

### 9. B1/B2 销售订单运费 + 其他费用

**说明**:
- 运费: 复用已有字段 `shippingIncluded` + `shippingFee`
- 其他费用: 新字段 `extraFees` (JSONB 数组)，结构 `[{name, amount, remark}]`

**关键文件**:
- 迁移: `V20260408_09__sales_order_extra_fees.sql`
- Entity: `SalesOrder.extraFees`
- Web: `web-admin/src/views/sales/orders/list.vue` 编辑表单

**使用入口**: 销售订单 → 编辑 → 附加费用区

---

### 10. B8 生产进度数字打屏看板

**说明**: 全屏大字看板，30 秒自动刷新，供车间大屏展示。

**关键文件**:
- Web: `web-admin/src/views/dashboard/production-progress.vue` (路由 `/dashboard/production-progress`)
- API: 复用现有生产进度查询接口

**使用入口**: 浏览器访问 `/dashboard/production-progress`，投影到车间电视

---

### 11. C4 周转耗材 (框) 管理

**说明**: 追踪周转框出货/归还/丢失，支持赔偿核算。

**关键文件**:
- 迁移: `V20260408_10__reusable_containers.sql`
- Entity: `ReusableContainer.java` + 状态机 SHIP_OUT → RETURN_IN / LOSS / ADJUST
- Service/Controller: CRUD + 状态流转接口

**使用入口**: 仓储管理 → 周转耗材管理

---

### 12. G1 税率分组开票 (客户会议杀手锏演示)

**客户原话**: 会议 2645s "一张订单要能分别开 9 个点原料和 13 个点加工费的两张发票"

**说明**: 销售订单可按税率自动聚合 `taxBreakdown`，一键生成多张开票申请。

**关键文件**:
- 迁移: `V20260407_01__invoice_tax_breakdown.sql` (头)
- 前端: `TaxGroupInvoiceDialog.vue`
- API: `POST /finance/invoices/request-from-order`

**使用入口**: 销售订单详情 → 「开票申请」按钮

---

## 本 Session 相关 Migration 全列表

| 文件 | 功能 |
|------|------|
| `V20260407_01__invoice_tax_breakdown.sql` | G1 税率分组开票 |
| `V20260408_01__production_plans_drift_fix.sql` | drift 修复 |
| `V20260408_02__material_batch_source_doc.sql` | P0-17 |
| `V20260408_03__bom_item_material_category.sql` | P0-14 |
| `V20260408_04__production_report_mode.sql` | P0-15 |
| `V20260408_06__user_menu_permissions.sql` | P0-6 |
| `V20260408_07__sales_delivery_item_batch_allocations.sql` | P0-13 |
| `V20260408_08__production_plan_source_order_item.sql` | P0-12 |
| `V20260408_09__sales_order_extra_fees.sql` | B1/B2 |
| `V20260408_10__reusable_containers.sql` | C4 |
| `V20260408_11__sales_orders_drift_fix.sql` | drift 修复 |
| `V20260408_12__test_drift_full_fix.sql` | drift 修复 |
| `V20260408_13__new_features_intents.sql` | AI 意图绑定 (本 commit 新增) |

---

## 同步变更

1. **操作手册 HTML**: `docs/plans/operation-manual-full.html` + `web-admin/public/operation-manual.html` 同步追加新章节 "Apr 8 新增功能"
2. **AI 意图知识库**: `V20260408_13__new_features_intents.sql` 新增 12 条 intent 配置，包含关键词匹配以便 LLM fallback 能识别
3. **版本号**: 操作手册升级到 v3.3 (2026-04-08)

---

## 下次需要补的事

- B8 生产看板的专用 Tool 类 (intent `PRODUCTION_PROGRESS_DASHBOARD` 已绑 tool_name 但 Tool 实现待做)
- C4 周转耗材的 Tool 实现 (查询/出货/归还/丢失 4 个)
- G1 TaxGroupInvoiceDialog 的 Playwright E2E 演示录屏
- 操作手册部署到 139 showcase 服务器
