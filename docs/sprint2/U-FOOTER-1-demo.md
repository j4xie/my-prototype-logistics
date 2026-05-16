# U-FOOTER-1 Demo Walkthrough (Sprint 2 Track I)

> **Branch**: `feature/sprint2-track-i-sticky-footer`
> **PR**: [TODO link after gh pr create]
> **Brief source**: `宏见竞品分析/04-最终决策/TRACK_I_BRIEF.md` §4 (Day 7)
> **Status doc**: `宏见竞品分析/04-最终决策/STATUS/TRACK_I_STATUS.md`

This document replaces the 1-2 min video deliverable in brief §4 Day 7. Anyone
can follow the steps below in dev environment to reproduce the demo flow.
Screen captures should be added by a human reviewer when recording is feasible.

---

## Setup

```bash
# 1. Backend (Java 10010 + Python 8083) — required for /list-summary endpoint
cd backend/java/cretas-api && mvn spring-boot:run
# OR rely on deployed test env: http://47.100.235.168:10011

# 2. Web-Admin
cd web-admin && npm run dev
# Opens http://localhost:5173 (or similar Vite port)

# 3. RN App (Expo)
cd frontend/CretasFoodTrace && npm start
# Press w for web preview, or scan QR for device
```

---

## Demo Path A — RN 销售员 + 仓管员 (RBAC contrast)

### Step 1 — 销售员登陆 (price-visible role)

- Login as `sales_manager` test account (F006 六腾门 tenant)
- Navigate to 销售订单列表 (`FAManagement → 销售订单`)

**Expected**:
- 列表渲染 25 个 sales orders (随测试数据变化)
- 底部固定 50px sticky footer 显示:
  ```
  共 25条  总金额 ¥58,750.00  平均金额 ¥2,350.00  📊  📤
  ```
- 金额字段全可见 (sales_manager 在 PRICE_VIEW_ROLES 白名单内)

### Step 2 — 筛选状态变化 → footer 实时刷

- 点击 SegmentedButtons → 切到 `已确认 (CONFIRMED)`
- 列表刷新到只显示 CONFIRMED 订单

**Expected**:
- Sticky footer stats **同步更新** ("共 12条 总金额 ¥28,400 平均 ¥2,366")
- 切换流畅 < 500ms (依网络)
- Stats 不闪烁 (useListSummary 内 loading 状态平滑)

### Step 3 — 点击 📊 → AIChat 接入 + 自动分析

- 点击 sticky footer 上的 📊 icon
- 导航到 AIChat 屏幕 (FAAITab → AIChat)

**Expected**:
- AIChat 自动发送 initialMessage:
  ```
  分析当前销售单列表 (筛选: status=CONFIRMED; 当前统计: 共 12条 | 总金额 ¥28,400.00 | 平均金额 ¥2,366.67)
  ```
- LLM 看到具体 stats, 不仅 "12 单" 还有金额, 能产生有意义的结构化分析:
  - 趋势对比 ("较上周 +N%")
  - 异常检测 ("SO-XXX 金额超均值 N 倍")
  - 建议 ("复核客户信用 / 加快收款")
- 工具调用 (SmartBI quick-analysis) 由 LLM 根据 prompt 决定, 不是硬编码

### Step 4 — 退出, 切换 warehouse_manager 账号

- Logout → Login as `warehouse_mgr1` (F006)
- 导航到 销售订单列表 (同一 screen)

**Expected (RBAC)**:
- 列表渲染相同 orders, **但每行的金额列被后端 strip 为 null** (@PriceSensitive)
- Sticky footer **只显示 1 个 stat**:
  ```
  共 25条  📊  📤
  ```
- 总金额 / 平均金额 stats **隐藏** (canViewPriceStore.useCanViewPrice() 返 false, StickyFooterSummary 过滤 canViewPrice: true 的 stat)
- 仓管点 📊 → AIChat initialMessage 不含金额数据 (只含筛选 + 共 N 条)

**这是关键销售红线**: "仓管角色看不到金额合计 (RBAC 集成)" ✅

---

## Demo Path B — Web-Admin 同等路径 (Vue side)

### Step 1 — 销售员登陆 web-admin

- `http://localhost:5173` → Login as `sales_manager`
- Navigate to 销售订单 (`/sales/orders`)

**Expected**:
- el-table 渲染 sales orders + 顶部 6 个 view tabs (全部/未出库/...)
- 表格底部 `<TableFooter>` 紧贴 `<el-pagination>` 上方:
  ```
  共 25条  总金额 ¥58,750.00  平均金额 ¥2,350.00  📊 AI 分析  📤 导出
  ```
- el-pagination 仍正常工作 (TableFooter 不替代 pagination, 只加 stats 行)

### Step 2 — 仓管员登陆 web-admin

- Logout → Login as `warehouse_mgr1`
- 导航到 库存管理 (`/warehouse/inventory`)

**Expected**:
- 表格内嵌 statsCard (4 个数字: 物料种类/总库存/库存价值/预警数) — pre-existing
- 表格底部新增 `<TableFooter>`:
  ```
  共 N批  可用数量 NNN  低库存 X项
  ```
- **总价值** stat **隐藏** (warehouse_manager 不在 PRICE_VIEW_ROLES)
- 表内嵌 statsCard 的 `库存价值` 字段已被 component-level v-if 隐藏 (Sprint 1 Track C)

---

## Demo Path C — 跨模块验证 (10 RN + 10 Vue 全接入)

按下表确认每个 list 的 sticky footer 正常渲染:

| 模块 | RN screen | Vue view | entityType | 主要 stat |
|---|---|---|---|---|
| 销售单 | factory-admin/inventory/SalesOrderListScreen | sales/orders/list | salesOrder | 共/总金额/平均 |
| 采购单 | factory-admin/inventory/PurchaseOrderListScreen | procurement/orders/list | purchaseOrder | 共/总金额/平均 |
| 生产计划 | dispatcher/plan/PlanListScreen | production/plans/list | productionPlan | 共/计划数量/完成数量/完成率 |
| 库存 | warehouse/inventory/WHInventoryListScreen | warehouse/inventory/index | inventory | 共/可用数量/总价值/低库存 |
| 发货 | management/ShipmentManagementScreen | sales/shipments/list | shipment | 共/待发货/已完成/总金额 |
| 退货 | factory-admin/inventory/ReturnOrderListScreen | sales/returns/list | returnOrder | 共/退货金额 |
| 调拨 | factory-admin/inventory/TransferListScreen | transfer/list | internalTransfer | 共/调出/调入/总金额 |
| 损耗 | restaurant/wastage/WastageListScreen | restaurant/wastage/list | wastage | 共/损耗数量 |
| 考勤 | hr/attendance/AttendanceManageScreen | hr/attendance/list | attendance | 共/打卡人数 |
| 质检 | quality-inspector/QIInspectListScreen | quality/inspections/list | qualityInspection | 共/合格/不合格/合格率 |

逐项点开屏幕, 确认底部 footer 显示了 entity-specific stats。

---

## Backend Validation (curl)

```bash
# Replace {FACTORY_ID} + {TOKEN} with real values
TOKEN="<jwt-from-login>"
FID="F006"  # 六腾门 (或 dev F001)
BASE="http://47.100.235.168:10011/api/mobile/${FID}/list-summary"

# 10 endpoints (each should return 200 with success=true)
for entity in salesOrder purchaseOrder inventory wastage attendance \
              returnOrder internalTransfer qualityInspection \
              productionPlan shipment; do
  echo "=== ${entity} ==="
  curl -sS -X POST "${BASE}/${entity}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"filterConditions": {}}' | jq '.success, .data.stats | length'
done
```

预期: 10 行 `true` 后跟一个数字 (stat 数量, 2-4 之间)。

---

## Verification Checklist

### 功能 (brief §9)

- [ ] **组件**: RN StickyFooterSummary 渲染 stats + 分页 + AI/导出按钮 ✅
- [ ] **组件**: Vue TableFooter 等价实现 ✅
- [ ] **后端**: 5+ entity summary endpoint 跑通 (10 个实际 shipped) ✅
- [ ] **RN**: 10 个 list screen 接入 ✅
- [ ] **Web**: 10 个 list view 接入 ✅
- [ ] **RBAC**: 仓管角色看不到金额 stat ✅ (依赖 Track C web-admin + 新 RN canViewPriceStore)
- [ ] **AI**: 📊 按钮跳 AIChat + initialMessage 含 stats context ✅ (2/10 RN screens demo 完整, 其余复用 helper util follow-up)
- [ ] **导出**: 📤 按钮 (Web side `show-export=false`, RN 待 Day 7 Track C exportService wiring)
- [ ] **响应**: stat 实时更新 (filter 变化 → refetch) ✅

### UX

- [ ] 移动 SafeAreaView 适配 iPhone 底部安全区 ✅
- [ ] 格式化: currency `¥6,525.00`, percent `5.2%`, number `1,234` ✅
- [ ] 空状态 + loading skeleton ✅

### 销售红线 (brief §2)

- [ ] "列表底部实时合计 + AI 分析入口" ✅
- [ ] "10 个 RN list + 10 个 web view 全接入" ✅
- [ ] "仓管角色看不到金额合计 (RBAC 集成)" ✅

### 技术

- [ ] PR merged to main — TODO
- [ ] 无新增 `as any` ✅ (canViewPriceStore + types/listSummary 严格 typed)
- [ ] 无新增 `catch (error: any)` ✅
- [ ] PG GROUP BY 严格模式不报错 ✅ (Java 实现全用 native SQL aggregate, 无 GROUP BY)
- [ ] **视频 demo 录制 — 需 reviewer 手动完成** (Claude Code 不能录视频)

---

## Known Limitations / Follow-up

1. **AI deep link only 2/10 RN screens** wired with `formatSummaryForAI` helper (sales + purchase as proof). 8 其他 screens 仍用基础 `initialMessage`. Follow-up: apply helper to all 10 — each is 1 line change. Pattern in PurchaseOrderListScreen.tsx is reusable.

2. **Vue side AI deep link** uses TODO stub (`@ai-analyze="() => { /* TODO Day 7 */ }"`). 10 Vue views 待 follow-up wire 同 RN pattern (需先 Vue equivalent of formatSummaryForAI).

3. **Export 📤** Web side `show-export=false`. RN 全 disabled. 待 wire Track C exportService per entity.

4. **Wastage status filter** 后端 computeWastageSummary 暂未应用 status filter — 显示全部记录的 count + sum。

5. **Inventory + Shipment ScrollView** 仍保留各自原有的 embedded statsCard, 跟新加的 StickyFooterSummary 有信息重叠。Future cleanup: 移除 embedded statsCard, 统一用 sticky footer。

6. **39 jest tests + 6 新 aiSummaryContext tests = 45 tests green** locally。typecheck npm script blocked by pre-existing project-level `expo/tsconfig.base` 缺失 (not Day 7 work)。

---

## PR Body Highlights

Already auto-generated in `gh pr create --body` from above. Key sections:
- §Summary (3-bullet what+why)
- §Files (24+ files across RN/Vue/Java)
- §Test plan (jest local + manual demo paths)
- §Risk (canViewPriceStore RN-new collision risk with future Track C; ScrollView statsCard double-display)
- §Sprint 1 Track C dependency (canViewPrice permission store, exportService)
