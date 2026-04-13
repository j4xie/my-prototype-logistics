# Web-Admin 综合 E2E 测试方案

**版本**: v2.0 (审计修正版)
**日期**: 2026-04-13
**目标**: 对 139.196.165.140:8086 web-admin 进行全覆盖 E2E 测试
**执行方式**: 5 轮循环，每轮 7 步

---

## 0. v1→v2 审计修正记录

| 审计编号 | 问题 | 修正 |
|---------|------|------|
| C1 | 只测 6 角色，代码有 15 个 | §3 扩展到全部 15 角色 |
| C2 | 权限值与代码不一致 | §3 直接从 permission.ts 复制 |
| C3 | F003 名字不对 | §1 改为 Round 0 新建专用测试工厂 |
| C4 | 无 FACTORY 类型测试账号 | §2 Round 0 创建 F_TEST 工厂+全角色账号 |
| C5 | L4-02 直接调 API 违规 | §7 L4-02 改为浏览器操作 |
| I1 | P0-2/6/11/18 + 6个P1 无 L4 覆盖 | §7 新增 L4-21~24 |
| I2 | OperationalQuote 无 Vue 页面 | §9 标记为 NOT_IMPLEMENTED |
| I3 | BomItem.materialGroup 不存在 | §9 标记为 NOT_IMPLEMENTED |
| I4 | 三价对比是 P2 非 P0 | §7 L4-08 标注 P2-deferred |
| I5 | 车间仓清仓 cron 未实现 | §9 标记 |
| I6 | L1 测试点数学错误 | §4 修正为 752 |
| I7 | 良品率三色标前端可能没实现 | §9 标记 |
| S1 | 缺 L5 业务正确性检查 | §6 新增 |
| S2 | 缺 Business Journey 测试 | 合入 L4 |
| S3 | 附录路由列表未嵌入 | 引用文件路径 |
| S4 | 缺 Google Fonts blocking | §1.3 新增 |
| S5 | 未定义 Playwright launch 模式 | §1.2 明确 |
| S7 | 缺轮间数据清理策略 | §8.3 新增 |
| S8 | 缺"已知未实现"清单 | §9 新增 |
| X1-3 | 三处矛盾 | Round 0 setup 解决 |

---

## 1. 测试架构

### 1.1 分层模块化脚本

| 脚本 | 职责 | 输出 |
|------|------|------|
| `e2e-L1-accessibility.mjs` | 全账号 × 全路由页面扫描 | `e2e-L1-R{N}.json` |
| `e2e-L2-crud.mjs` | RW 做 CRUD + R 验证只读 + `-` 验证 403 | `e2e-L2-R{N}.json` |
| `e2e-L3-cross-module.mjs` | 12 条跨模块数据流 | `e2e-L3-R{N}.json` |
| `e2e-L4-business-flow.mjs` | 24 条端到端业务链路 | `e2e-L4-R{N}.json` |
| `e2e-audit-compare.mjs` | 多轮结果趋势对比 | `e2e-audit-R{N}.json` |

### 1.2 Playwright 执行配置

```javascript
// 强制使用独立 Node.js 脚本，不用 MCP browser 工具
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  ignoreHTTPSErrors: true,
});
// Google Fonts blocking — 中国网络必须阻止，否则 Vue 不渲染
await context.route('**fonts.googleapis.com**', route => route.fulfill({ status: 200, body: '' }));
await context.route('**fonts.gstatic.com**', route => route.fulfill({ status: 200, body: '' }));
```

### 1.3 Evidence 标准 (E2E Skill 硬规则 — 6 条)

1. **禁止 API 代替 UI** — 所有 CRUD 必须通过浏览器操作，curl 仅用于 health check
2. **无证据 PASS 无效** — 每个 PASS 必须有 `evidence:` 区块
3. **表单必须提交+持久化** — `filled:` + `toast:` + `list after:` 三行缺一不可
4. **跨模块必须验证下拉** — `下拉列表:` 行列出实际选项
5. **前后端校验对齐** — 前端 required 星号 vs 后端 @NotNull
6. **失败必须重试** — 分析原因 → 补字段 → 重提交，最多 3 次

### 1.4 L5 业务正确性检查 (嵌入 L2-L4)

每个 CRUD 操作额外检查:

| 检查项 | 方法 | 失败标记 |
|--------|------|---------|
| UUID 检测 | 列表/详情页不展示 UUID 原值 | UUID_LEAK |
| 重复提交 | 快速双击提交按钮 → 只产生 1 条记录 | DOUBLE_SUBMIT |
| 字段类型 | 数字字段输入文字 → 前端拦截 | TYPE_MISMATCH |
| 自动计算 | 修改数量/单价 → 总价自动变 | CALC_ERROR |
| 只读字段 | 系统字段(创建时间等)不可编辑 | READONLY_LEAK |
| 状态标签 | 状态显示中文标签(非英文枚举) | LABEL_RAW |

---

## 2. 测试账号

### 2.1 Round 0 Setup: 创建 FACTORY 类型测试工厂

**为什么**: F001 是 RESTAURANT 类型，production/warehouse/quality/equipment/scheduling 全被屏蔽。必须创建 FACTORY 类型工厂才能测试工厂端模块。

**操作**: 通过 web-admin 或 DB 创建:
- 工厂 ID: `F_TEST` (或 onboarding API 生成)
- 名称: "E2E测试食品厂"
- 类型: **FACTORY**
- 创建 15 个测试账号 (对应 permission.ts 全部角色)

### 2.2 全部测试账号 (15 个 Web + 3 个 Mobile-only)

| # | 账号 | 角色 | Level | 工厂 | Web | 说明 |
|---|------|------|-------|------|-----|------|
| 1 | test_super_admin | factory_super_admin | 0 | F_TEST | YES | 最高权限 |
| 2 | test_platform_admin | platform_admin | 0 | F_TEST | YES | 平台管理员 |
| 3 | test_hr_admin | hr_admin | 10 | F_TEST | YES | 人事经理 |
| 4 | test_procurement_mgr | procurement_manager | 10 | F_TEST | YES | 采购经理 |
| 5 | test_sales_mgr | sales_manager | 10 | F_TEST | YES | 销售经理 |
| 6 | test_dispatcher | dispatcher | 10 | F_TEST | YES | 调度员 |
| 7 | test_warehouse_mgr | warehouse_manager | 10 | F_TEST | YES | 仓储经理 |
| 8 | test_equipment_admin | equipment_admin | 10 | F_TEST | YES | 设备管理 |
| 9 | test_quality_mgr | quality_manager | 10 | F_TEST | YES | 质量经理 |
| 10 | test_finance_mgr | finance_manager | 10 | F_TEST | YES | 财务经理 |
| 11 | test_restaurant_mgr | restaurant_manager | 10 | F_TEST | YES | 餐饮管理 |
| 12 | test_workshop_sup | workshop_supervisor | 20 | F_TEST | YES | 车间主管 |
| 13 | test_viewer | viewer | 50 | F_TEST | YES | 只读查看者 |
| 14 | test_quality_insp | quality_inspector | 30 | F_TEST | NO | Mobile-only |
| 15 | test_operator | operator | 30 | F_TEST | NO | Mobile-only |
| 16 | test_warehouse_worker | warehouse_worker | 30 | F_TEST | NO | Mobile-only |

密码统一: `123456`

---

## 3. 完整权限矩阵 (直接从 permission.ts 复制)

### 3.1 角色 × 模块权限 (FACTORY 类型，restaurant 被 FACTORY_TYPE_FILTER 屏蔽为 `-`)

| 角色 | dash | prod | ware | qual | proc | sales | hr | equip | fin | sys | anal | sched | rest |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| factory_super_admin | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | - |
| platform_admin | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | - |
| hr_admin | r | - | - | - | - | - | rw | - | - | r | - | - | - |
| procurement_manager | r | r | r | - | rw | - | - | - | r | - | - | - | - |
| sales_manager | r | r | r | - | - | rw | - | - | r | - | r | - | - |
| dispatcher | rw | rw | r | r | r | r | r | r | r | r | rw | rw | - |
| warehouse_manager | r | r | rw | - | r | r | - | - | - | - | - | r | - |
| equipment_admin | r | r | - | - | - | - | - | rw | - | - | - | - | - |
| quality_manager | r | r | - | rw | - | - | - | - | - | - | - | - | - |
| finance_manager | r | - | - | - | - | r | - | - | rw | - | r | - | - |
| restaurant_manager | r | - | - | - | r | - | - | - | r | - | r | - | - |
| workshop_supervisor | r | r | r | w | - | - | r | r | - | - | - | r | - |
| quality_inspector | r | r | - | w | - | - | - | - | - | - | - | - | - |
| operator | r | w | - | - | - | - | - | - | - | - | - | - | - |
| warehouse_worker | r | - | w | - | - | - | - | - | - | - | - | - | - |
| viewer | r | r | r | r | r | r | - | r | - | - | r | r | - |
| unactivated | - | - | - | - | - | - | - | - | - | - | - | - | - |

**注**: `w` = write-only (可提交但不可查列表), `rw` = 读写, `r` = 只读, `-` = 403

### 3.2 FACTORY_TYPE_MODULE_FILTER

- **FACTORY**: restaurant → `-` (工厂不需要餐饮模块)
- **RESTAURANT**: production/warehouse/quality/equipment/scheduling → `-`

### 3.3 测试操作映射

| 权限 | L1 | L2 | L5 |
|------|-----|-----|-----|
| **rw** | 页面加载 OK | Create+Read+Update+Delete | UUID/重复提交/计算 |
| **r** | 页面加载 OK | 有数据 + 无新建/编辑/删除按钮 | 只读字段验证 |
| **w** | 页面加载 OK | 能提交表单 + 无列表查看 | 提交后验证 |
| **-** | 导航→ /403 | 跳过 | 跳过 |

---

## 4. Layer 1: 页面可访问性 (13 账号 × 94 路由 ≈ 1222 测试点)

13 个 Web 账号 × 94 条路由 = 1222 测试点。3 个 Mobile-only 账号只测登录拦截。

### 4.1 验收标准

- 有权限的页面: 100% PASS (无 ERROR_TOAST, 无空白, bodyLen > 10)
- 无权限的页面: 100% 拦截到 /403
- Mobile-only 账号: 登录后→ /mobile-only
- Console errors: 0 (排除 by-design 的 factory-type 403)
- Network 4xx/5xx: 0

### 4.2 路由清单引用

完整 94 条路由见: `web-admin/src/router/index.ts`
按模块分组: dashboard(2) + production(9) + warehouse(5) + transfer(2) + quality(3) + procurement(3) + sales(6) + hr(4) + equipment(3) + finance(6) + rd(2) + system(16) + analytics(7) + calibration(2) + scheduling(7) + restaurant(8) + production-analytics(2) + smart-bi(13) + canvas(1) + dynamic(1) = 94

---

## 5. Layer 2: CRUD 操作 (~400 测试点)

### 5.1 CRUD 模块明细 (20 个可写模块)

| 模块路径 | 实体 | Create 关键字段 | 有 RW 的角色 |
|---------|------|----------------|-------------|
| /procurement/orders | PurchaseOrder | 供应商,产品,数量,单价 | super_admin,procurement_mgr |
| /procurement/suppliers | Supplier | 名称,联系人,电话 | super_admin,procurement_mgr |
| /procurement/price-lists | PriceList | 供应商,产品,价格 | super_admin,procurement_mgr |
| /sales/orders | SalesOrder | 客户,产品(多行),税率 | super_admin,sales_mgr |
| /sales/customers | Customer | 名称,联系人,地址 | super_admin,sales_mgr |
| /sales/quotes | OperationalQuote | 客户,产品,BOM成本 | super_admin |
| /production/plans | ProductionPlan | 产品,关联SO,数量 | super_admin,dispatcher |
| /production/batches | ProductionBatch | 关联计划,PC批次 | super_admin,dispatcher |
| /production/bom | Bom | 产品,版本,辅料明细 | super_admin,dispatcher |
| /warehouse/materials | MaterialBatch | 物料,数量,单价 | super_admin,warehouse_mgr |
| /warehouse/shipments | ShipmentRecord | 关联SO,产品,数量 | super_admin,warehouse_mgr |
| /warehouse/inventory | Inventory | 盘点数据 | super_admin,warehouse_mgr |
| /quality/inspections | QualityInspection | 批次,标准,结果 | super_admin,quality_mgr |
| /quality/standards | QualityStandard | 名称,项目,阈值 | super_admin,quality_mgr |
| /hr/employees | User | 姓名,角色,部门 | super_admin,hr_admin |
| /hr/departments | Department | 名称,上级部门 | super_admin,hr_admin |
| /equipment/list | Equipment | 名称,类型,位置 | super_admin,equipment_admin |
| /equipment/maintenance | MaintenanceRecord | 设备,类型,描述 | super_admin,equipment_admin |
| /finance/invoices | InvoiceRecord | 关联SO,税率分组 | super_admin,finance_mgr |
| /finance/payments | PaymentRecord | 关联SO,金额,方式 | super_admin,finance_mgr |
| /system/products | ProductType | 名称,类别,单位 | super_admin |
| /system/work-processes | WorkProcess | 名称,顺序 | super_admin |

### 5.2 只读验证 (R 权限)

对每个 R 权限组合:
1. 页面加载有数据或 empty state
2. 扫描页面 DOM: **不存在** 新建/编辑/删除按钮
3. 如果发现写操作按钮 → **PERMISSION_LEAK** FAIL

### 5.3 403 验证 (`-` 权限)

直接导航 URL → 验证拦截到 /403

---

## 6. Layer 3: 跨模块数据流 (12 条)

| # | 源 → 目标 | 验证 |
|---|-----------|------|
| 1 | 创建客户 → 销售订单客户下拉 | 包含新客户 |
| 2 | 创建供应商 → 采购订单供应商下拉 | 包含 |
| 3 | 创建产品 → 销售订单产品下拉 | 包含 |
| 4 | 创建产品 → BOM 成品下拉 | 包含 |
| 5 | 创建员工 → 部门成员列表 | 包含 |
| 6 | 创建 BOM → 生产计划 BOM 下拉 | 包含 |
| 7 | 创建采购单 → 应收应付 AP | 出现 |
| 8 | 创建销售单 → 应收应付 AR | 出现 |
| 9 | 创建销售单 → 出货记录可关联 | 可选 |
| 10 | 创建发票 → 收款管理可关联 | 可选 |
| 11 | SmartBI 上传 → AI 问答可查询 | 数据可见 |
| 12 | 创建用户 → 销售订单销售员下拉 | 包含 |

---

## 7. Layer 4: 业务链路 (24 条)

### L4-01: Round 0 Setup — 创建测试工厂+全角色账号
**步骤**: platform_admin 创建 FACTORY 工厂 → 创建 5 个部门 → 创建 13 个 Web 账号 + 3 个 Mobile 账号 → 各账号登录验证
**验证**: 全部登录成功 + 菜单符合 §3.1 权限矩阵

### L4-02: factoryId 行级隔离 (v3 P0-1)
**步骤**: F_TEST 创建客户"隔离测试客户" → 用 F001 账号登录 → 浏览器导航到客户列表 → 搜索"隔离测试" → 验证搜索结果为空
**验证**: 跨工厂数据不可见 (纯浏览器操作，不调 API)

### L4-03: 研发样品→审核→BOM→报价 (全流程文档§1, 会议1007s)
**步骤**: 创建研发样品 → 审核通过 → BOM 生成 → 验证辅料分组 → 报价推送
**已知未实现**: OperationalQuote Vue 页面不存在; BomItem.materialGroup 字段不存在 (标记 NOT_IMPLEMENTED)

### L4-04: BOM 版本管理 (会议1265s)
**步骤**: 创建 v1(辣椒300g) → 修改 v2(280g) → v1 存档 v2 激活 → 生产关联 v2

### L4-05: 销售订单+SKU去重+财务审核 (v3 P0-7~9, 2906s)
**步骤**: 创建客户 → 创建 SO(9%+13%税率) → 同产品加两行→去重报错 → 财务审核通过 → 验证3状态字段

### L4-06: 销售订单驳回→修改→重审 (全流程文档§2.2)
**步骤**: 创建 SO → 财务驳回 → 修改单价 → 重审通过

### L4-07: 销售订单金额联动 (会议2906s, v3 P0-9)
**步骤**: 创建 SO(10000) → 未出库=订单金额 → 部分出库=出库金额 → 全部出库

### L4-08: 采购全链路 (全流程文档§3)
**步骤**: 创建供应商 → 创建 PO(关联SO) → 财务审核 → 入库 → 库存+AP
**注**: 三价对比为 P2-deferred, R1 预期 NOT_IMPLEMENTED

### L4-09: 原料批次+移动均价+FIFO (会议2: 动态库存)
**步骤**: 入库批次1(¥10×100kg) → 批次2(¥12×50kg) → 均价¥10.67 → FIFO → 趋势图

### L4-10: 入库必须有发起单 (会议4870s, v3 P0-17)
**步骤**: 仓库直接入库→被拦截 → 从采购单入库→成功

### L4-11: 生产6步链路 (会议3128s, v3 G3)
**步骤**: 生产计划(关联SO+PC批次) → 物料需求单 → 备料 → 调拨 → 报工(累积) → 退料

### L4-12: 报工+良品率+出成率 (会议1, 会议2)
**步骤**: 工序报工(投入100/产出95/良品90) → 出成率95%/良品率94.7% → 三色标
**已知未实现**: 三色标前端可能未实现 (标记 VERIFY_NEEDED)

### L4-13: BOM达成率+工序投入产出 (会议2)
**步骤**: 计划28kg 实际30kg → 达成率93.3% → 超耗红标 → 工序对比

### L4-14: 质检→废弃处理
**步骤**: 质检标准 → 执行质检 → 不合格→废弃 → 库存扣减

### L4-15: 出货→开票→发票回传→收款 (全流程文档§5-6, 会议2585-2974s)
**步骤**: 成品出库 → 开票(9%/13%分组) → 上传PDF→回写订单 → 收款(定金+尾款) → 结清

### L4-16: SKU毛利率+成本分析 (会议2)
**步骤**: 物料成本+人工成本 → SKU毛利率排名

### L4-17: 周转耗材SKU化 (会议3438s, v3 P1-2)
**步骤**: 创建周转筐商品 → 采购入库 → 随出货发出 → 回收入库

### L4-18: 双仓体系 (会议3225s, v3 P1-4)
**步骤**: 物流仓→车间仓调拨 → 生产领料 → 退料回物流仓
**已知未实现**: 20:00 自动清仓 cron 未实现 (标记 NOT_IMPLEMENTED)

### L4-19: SmartBI 全链路
**步骤**: 上传Excel → AI分析 → 图表 → KPI → What-If

### L4-20: 全角色端到端+权限边界 (全流程文档§7)
**步骤**: 6 角色轮转(super_admin→finance→procurement→warehouse→dispatcher→viewer) + 越权→403

### L4-21: 产品大类隔离 (v3 P0-2, 会议1503s) [补 C1 审计]
**步骤**: 选"成品"类别 → 验证不显示"原料"类别的产品

### L4-22: SO 业务中心 4-Tab (v3 P0-11) [补 I1 审计]
**步骤**: 销售订单详情页 → 验证4个Tab(开票/出库/收款/采购关联)存在且可切换

### L4-23: 大组长/小组长角色分工 (v3 P0-18) [补 I1 审计]
**步骤**: 大组长登录→可审批报工 / 小组长→可提交报工但不可审批
**已知未实现**: 角色可能未区分 (标记 VERIFY_NEEDED)

### L4-24: 指定人员授权 (v3 P0-6, 会议1737s) [补 I1 审计]
**步骤**: 创建运营报价 → 指定到具体人员(非岗位) → 该人员能看到任务
**已知未实现**: 权限表 user_id 字段可能未加 (标记 VERIFY_NEEDED)

---

## 8. 每轮循环流程

### 8.1 单轮 7 步

```
① 审计A: 方案自审 (覆盖度+规则合规)
② 审计B: Agent 独立审计
③ 审计C: 修复审计发现的方案问题
④ 执行: 运行 L1+L2+L3+L4
⑤ 审计E2E结果: 分析 FAIL/WARNING 根因，输出修复清单
⑥ 修复: 按清单修复 bug (前后端+部署)
⑦ 审计修复: 重跑 FAIL 子集确认修复+无回归
→ 通过后进入下一轮
```

### 8.2 通过标准 (逐轮递增)

| 指标 | R1 | R2 | R3 | R4 | R5 |
|------|-----|-----|-----|-----|-----|
| L1 PASS 率 | ≥90% | ≥95% | ≥98% | 100% | 100% |
| L2 PASS 率 | ≥70% | ≥85% | ≥90% | ≥95% | ≥95% |
| L3 PASS 率 | ≥60% | ≥80% | ≥90% | ≥95% | ≥95% |
| L4 PASS 率 | ≥40% | ≥60% | ≥75% | ≥85% | ≥85% |
| UNVERIFIED PASS | 0 | 0 | 0 | 0 | 0 |
| 回归 (新 FAIL) | N/A | ≤5 | ≤3 | ≤1 | 0 |

注: L4 初始 PASS 率低是因为 §9 中的 NOT_IMPLEMENTED 功能会在后续 Round 逐步实现。

### 8.3 轮间数据清理策略

- 每轮测试数据使用带 Round 编号的前缀: `R1_测试客户_xxx`, `R2_测试客户_xxx`
- L4 链路创建的数据不删除（供下轮 L3 验证用）
- 每轮开始前检查数据前置条件，缺失则补充

### 8.4 轮间改进规则

- R1→R2: 修复所有 FAIL, 优化不稳定测试
- R2→R3: 补 R1+R2 遗漏的测试点, 实现 NOT_IMPLEMENTED 功能
- R3→R4: 聚焦回归测试
- R4→R5: 最终稳定性验证
- R5 结束: 5 轮趋势对比报告

---

## 9. 已知未实现功能 (预期 R1 FAIL)

| 功能 | 影响的 L4 | 预期 FAIL 原因 | 修复 Round |
|------|----------|---------------|-----------|
| OperationalQuote Vue 页面 | L4-03 | 无前端路由/页面 | R2 |
| BomItem.materialGroup 字段 | L4-03 | 实体无此字段，无 3-tab | R2 |
| 三价同屏 web UI | L4-08 | P2-deferred, 无前端组件 | R3+ |
| 车间仓 20:00 清仓 cron | L4-18 | scheduler 未实现 | R3 |
| 良品率三色标前端 | L4-12 | 可能未实现，需验证 | R1 验证 |
| 大组长/小组长角色区分 | L4-23 | 角色可能未创建 | R2 |
| 指定人员授权 (user_id) | L4-24 | 权限表可能无此字段 | R2 |

这些在 R1 结果审计时标记为 **EXPECTED_FAIL**，不计入 PASS 率。从 R2 开始逐步实现并计入。

---

## 10. 报告格式

```
=== E2E 验收报告 Round {N} ===
日期: {date}
工厂: F_TEST (E2E测试食品厂, FACTORY)

## 总计
L1: XX/YY PASS (ZZ%) [目标: ≥{threshold}%]
L2: XX/YY PASS (ZZ%)
L3: XX/YY PASS (ZZ%)
L4: XX/YY PASS (ZZ%) [排除 EXPECTED_FAIL: N 项]

## vs 上轮对比
新增 PASS: [list]
新增 FAIL: [list] — 回归!
修复确认: [list]
NOT_IMPLEMENTED → IMPLEMENTED: [list]

## Layer 详细
[per-layer, per-account, per-test evidence blocks]

## 遗留问题
[KNOWN_BUG + NOT_IMPLEMENTED + EXPECTED_FAIL]
```
