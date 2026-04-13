# Web-Admin 综合 E2E 测试方案

**版本**: v3.0 (二次审计修正版)
**日期**: 2026-04-13
**目标**: 对 139.196.165.140:8086 web-admin 进行全覆盖 E2E 测试
**执行方式**: 5 轮循环，每轮 7 步

---

## 0. 审计修正记录

### v1→v2 (第一次 code-reviewer 审计)

| 编号 | 问题 | 修正 |
|-----|------|------|
| C1-C5 | 角色覆盖/权限不一致/F003命名/无FACTORY账号/API违规 | §2-3 全面重建 |
| I1-I7 | 需求覆盖缺口/NOT_IMPLEMENTED 不准/数学错误 | §7+§9 补充 |
| S1-S8 | 缺 L5/Google Fonts/数据清理/未实现清单 | §1+§8 新增 |

### v2→v3 (agent-team 二次审计 — 3 Researcher + Analyst, 评分 6/10→修正)

| 编号 | 严重度 | 问题 | 修正 |
|-----|--------|------|------|
| **F-1** | 致命 | 存在两套权限矩阵(store vs utils)，spec 未提及 | §3.4 新增权威来源声明 |
| **F-2** | 致命 | `w` 权限语义 spec 写"不可查列表"，代码实际可查列表 | §3.3 修正 `w` 定义 |
| **F-3** | 致命 | I1 声称修复 6 个 P1，实际新增 4 条全是 P0 | §7 新增 L4-25~30 覆盖 P1 |
| **H-1** | 高危 | NOT_IMPLEMENTED 清单 6/7 项实际已实现 | §9 仅保留 1 项真正未实现 |
| **H-2** | 高危 | finance_manager 有路由白名单，spec 未提及 | §3.5 新增路由白名单机制 |
| **H-3** | 高危 | 工厂 ID 不可预设 "F_TEST"，Round 0 步骤不完整 | §2.1 改为 API 创建 + 动态 ID |
| **H-4** | 高危 | L4-07 时间戳标注错误 (P0-9→P0-3b) | §7 L4-07 修正 |
| **H-5** | 高危 | L4-16/L4-19 是 P2 功能但未标 EXPECTED_FAIL | §7 添加 P2-deferred 标记 |
| **H-6** | 高危 | production_manager(deprecated) 未列入 | §3.1 新增行 |
| **M-1** | 中等 | L4-20 覆盖深度不足，缺财务多节点链路 | §7 L4-20 拆分 a+b |
| **M-2** | 中等 | web-admin 无法创建工厂 | §2.1 明确 API-only |
| **M-3** | 中等 | restaurant_manager 在 FACTORY 工厂中几乎无权限 | §3.1 注释 |
| **M-4** | 中等 | 密码硬编码违反规范 | §2.2 改为环境变量 |

---

## 1. 测试架构

### 1.1 分层模块化脚本

| 脚本 | 职责 | 输出 |
|------|------|------|
| `e2e-L1-accessibility.mjs` | 全账号 × 全路由页面扫描 | `e2e-L1-R{N}.json` |
| `e2e-L2-crud.mjs` | RW 做 CRUD + R 验证只读 + `-` 验证 403 | `e2e-L2-R{N}.json` |
| `e2e-L3-cross-module.mjs` | 12 条跨模块数据流 | `e2e-L3-R{N}.json` |
| `e2e-L4-business-flow.mjs` | 30 条端到端业务链路 | `e2e-L4-R{N}.json` |
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

### 2.1 Round 0 Setup: 通过 API 创建 FACTORY 类型测试工厂

**为什么**: F001 是 RESTAURANT 类型，工厂模块全被屏蔽。

**操作** (仅通过 API，web-admin 无工厂创建页面):

```bash
# Step 1: 获取 platform_admin JWT (需要先在 DB 确认有 platform_admin 账号)
TOKEN=$(curl -s -X POST http://139.196.165.140:8086/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"platform_admin_account","password":"xxx"}' | jq -r '.data.accessToken')

# Step 2: 创建工厂 (ID 由系统自动生成，格式 FOOD_3101_NNN)
FACTORY_RESP=$(curl -s -X POST http://139.196.165.140:8086/api/platform/factories \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"E2E测试食品厂","industryCode":"FOOD","regionCode":"3101","subscriptionPlan":"BASIC"}')
FACTORY_ID=$(echo $FACTORY_RESP | jq -r '.data.id')

# Step 3: 逐个创建 16 个账号 (provisionDefaultUsers 只建 3 个，不够)
for role in factory_super_admin hr_admin procurement_manager sales_manager dispatcher \
  warehouse_manager equipment_admin quality_manager finance_manager restaurant_manager \
  workshop_supervisor viewer quality_inspector operator warehouse_worker; do
  curl -s -X POST "http://139.196.165.140:8086/api/mobile/$FACTORY_ID/users" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"test_${role}\",\"roleCode\":\"${role}\",\"password\":\"${E2E_PASSWORD}\",\"fullName\":\"E2E ${role}\"}"
done
```

**关键约束**:
- 工厂 ID 由系统自动生成，不能硬编码 — 测试脚本必须从 response 中读取
- 密码从环境变量 `E2E_PASSWORD` 读取 (默认 `.env.test` 配置)
- 需确认 production 环境存在 `platform_admin` 账号

### 2.2 全部测试账号 (13 个 Web + 3 个 Mobile-only)

| # | 账号 | 角色 | Level | Web | 说明 |
|---|------|------|-------|-----|------|
| 1 | test_factory_super_admin | factory_super_admin | 0 | YES | 工厂最高权限 |
| 2 | test_hr_admin | hr_admin | 10 | YES | 人事经理 |
| 3 | test_procurement_mgr | procurement_manager | 10 | YES | 采购经理 |
| 4 | test_sales_mgr | sales_manager | 10 | YES | 销售经理 |
| 5 | test_dispatcher | dispatcher | 10 | YES | 调度员 |
| 6 | test_warehouse_mgr | warehouse_manager | 10 | YES | 仓储经理 |
| 7 | test_equipment_admin | equipment_admin | 10 | YES | 设备管理 |
| 8 | test_quality_mgr | quality_manager | 10 | YES | 质量经理 |
| 9 | test_finance_mgr | finance_manager | 10 | YES | 财务经理 |
| 10 | test_restaurant_mgr | restaurant_manager | 10 | YES | 餐饮管理 (FACTORY 类型下几乎无权限) |
| 11 | test_workshop_sup | workshop_supervisor | 20 | YES | 车间主管 |
| 12 | test_viewer | viewer | 50 | YES | 只读查看者 |
| 13 | test_production_mgr | production_manager | 10 | YES | (deprecated, 等同 dispatcher) |
| 14 | test_quality_insp | quality_inspector | 30 | NO | Mobile-only → /mobile-only |
| 15 | test_operator | operator | 30 | NO | Mobile-only → /mobile-only |
| 16 | test_warehouse_worker | warehouse_worker | 30 | NO | Mobile-only → /mobile-only |

密码: 从环境变量 `E2E_PASSWORD` 读取

---

## 3. 完整权限矩阵

### 3.1 角色 × 模块权限 (FACTORY 类型，restaurant 被 FACTORY_TYPE_FILTER 屏蔽为 `-`)

| 角色 | dash | prod | ware | qual | proc | sales | hr | equip | fin | sys | anal | sched | rest |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| factory_super_admin | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | - |
| platform_admin | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | rw | - |
| hr_admin | r | - | - | - | - | - | rw | - | - | r | - | - | - |
| procurement_manager | r | r | r | - | rw | - | - | - | r | - | - | - | - |
| sales_manager | r | r | r | - | - | rw | - | - | r | - | r | - | - |
| dispatcher | rw | rw | r | r | r | r | r | r | r | r | rw | rw | - |
| production_manager | rw | rw | r | r | r | r | r | r | r | r | rw | rw | - |
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

**注**: `production_manager` 已废弃，行为等同 `dispatcher`，保留向后兼容。

### 3.2 FACTORY_TYPE_MODULE_FILTER

- **FACTORY**: restaurant → `-`
- **RESTAURANT**: production/warehouse/quality/equipment/scheduling → `-`

### 3.3 `w` 权限语义 (v3 修正 — F-2)

**代码实际行为**: `w` (write-only) 在前端代码中 `canAccess()` 返回 true，**页面可以加载且列表可见**。与 `rw` 的唯一区别是：`canWrite()` 返回 true 但 `canRead()` 语义上不保证。实际效果是 `w` 角色能看到列表页，也能提交表单。

**当前 `w` 只出现在 3 个 Mobile-only 角色** (quality_inspector/quality=w, operator/production=w, warehouse_worker/warehouse=w)。由于这 3 个角色被 `MOBILE_ONLY_ROLES` 拦截在登录阶段，`w` 的 Web 端行为目前被"巧合掩盖"。

**测试策略**: `w` 权限在 Web 端不测（因为 `w` 角色全是 Mobile-only），但在测试报告中注明此设计约束。

### 3.4 权限矩阵权威来源 (v3 新增 — F-1)

代码中存在两套权限矩阵:
- **`store/modules/permission.ts`** — Pinia store，被路由守卫 `guards.ts:56` import，**是运行时实际生效的唯一来源**
- **`utils/permission.ts`** — 工具函数，**零引用，不被任何 Vue 文件使用**，warehouse_manager/finance_manager 值与 store 不同

**本测试方案以 `store/modules/permission.ts` 为唯一权威**。`utils/permission.ts` 应标记为 deprecated 或删除。

### 3.5 finance_manager 路由白名单 (v3 新增 — H-2, v3.1 精确化 — B-1)

`guards.ts:22-33` 对 `finance_manager` 有 `ROLE_PATH_WHITELIST` 机制，**精确 10 条路径**（非通配符）:

```
/dashboard
/smart-bi/dashboard
/smart-bi/finance
/smart-bi/financial-dashboard
/smart-bi/sales
/smart-bi/query
/smart-bi/query-templates
/smart-bi/analysis
/403
/404
```

**以下路由对 finance_manager 被白名单拦截到 /403**（即使矩阵标注有权限）:

| 模块 | 被拦截路由 | 矩阵权限 | 实际结果 |
|------|----------|---------|---------|
| finance | `/finance/costs`, `/finance/reports`, `/finance/ar-ap`, `/finance/sku-margin`, `/finance/invoices`, `/finance/payments` (6条) | rw | **403(白名单)** |
| sales | `/sales/orders`, `/sales/quotes`, `/sales/finished-goods`, `/sales/customers`, `/sales/shipments` (5条) | r | **403(白名单)** |
| analytics | `/analytics/overview`, `/analytics/trends`, `/analytics/ai-reports`, `/analytics/kpi`, `/analytics/production-report`, `/analytics/alert-dashboard`, `/analytics/supply-chain` (7条) | r | **403(白名单)** |
| smart-bi | `/smart-bi/upload`, `/smart-bi/data-completeness`, `/smart-bi/food-kb-feedback`, `/smart-bi/calibration`, `/smart-bi/whatif`, `/smart-bi/restaurant-v2` (6条) | — | **403(白名单)** |

**finance_manager 实际只能访问 8 条业务路由** (dashboard + 7 条 smart-bi)。L1 测试时这 24 条被拦截路由的预期结果必须标为 403(白名单)，不是 PASS。

**L4 链路影响 (B-3)**:
- **L4-15** (出货→开票→收款): finance_manager 无法访问 `/finance/invoices` 和 `/finance/payments`。开票/收款操作改用 **factory_super_admin** 执行。
- **L4-20b** (财务多节点链路): finance_manager 的 4 个操作节点中，"开票"和"收款"两个节点因白名单拦截改用 super_admin。finance_manager 只在 `/smart-bi/finance`（财务分析看板）节点操作。
- 这是**已知的设计限制**（finance_manager 的 web 操作被刻意收窄为 SmartBI 只读分析），不是 bug。

---

## 4. Layer 1: 页面可访问性 (13 Web + 3 Mobile × 94 路由)

13 个 Web 账号 × 94 路由 = 1222 测试点。3 个 Mobile-only 账号只测登录拦截(→/mobile-only)。

### 4.1 验收标准

- 有权限的页面: 100% PASS
- 无权限的页面: 100% 拦截到 /403
- finance_manager: 按 §3.5 白名单规则判定(非矩阵)
- Mobile-only 账号: → /mobile-only
- Console errors: 0 | Network 4xx/5xx: 0

路由清单: `web-admin/src/router/index.ts` (94 条)

---

## 5. Layer 2: CRUD 操作 (~400 测试点)

(与 v2 相同，此处省略重复 — 见 v2 §5)

---

## 6. Layer 3: 跨模块数据流 (12 条)

(与 v2 相同 — 见 v2 §6)

---

## 7. Layer 4: 业务链路 (30 条)

### 原 L4-01~24 (v2 已有，以下仅列 v3 修正项):

**L4-07 修正 (H-4)**: 时间戳标注修正为 "会议2906s, v3 **P0-3b**" (原错标为 P0-9)

**L4-08 修正 (H-5)**: 三价对比标注 "P2-deferred, 已有 UI 在 procurement/orders/detail.vue 内嵌"（原标 NOT_IMPLEMENTED，实际已实现）

**L4-12 修正 (H-1)**: 良品率三色标 "已实现: production/batches/detail.vue (≥95%绿/≥80%橙/<80%红)"，移除 VERIFY_NEEDED

**L4-16 标注 (H-5)**: "P2-deferred — v3 §4.4 P2-5 财务深化，R1 标记 EXPECTED_FAIL_P2"

**L4-18 修正 (H-1)**: 车间仓清仓 "已实现: FmrExpiryScanner.java @Scheduled(cron='0 0 20 * * ?')，但只发通知不做自动关单"，移除 NOT_IMPLEMENTED

**L4-19 标注 (H-5)**: "P2-deferred — v3 §4.4 P2-6 SmartBI deepening，R1 标记 EXPECTED_FAIL_P2"

**L4-20 拆分 (M-1)**:
- **L4-20a**: 全角色轮转 — 6 角色依次操作验证各自权限范围
- **L4-20b**: 财务多节点介入链路 — finance 在 SO审核 + PO审核 + 开票 + 收款 4 个节点分别操作

**L4-23 修正 (H-1)**: 大组长/小组长 "已实现: FactoryUserRole enum team_leader(25)+group_leader(28)"，移除 VERIFY_NEEDED

**L4-24 修正 (H-1)**: 指定人员授权 "已实现: CanvasSetUserPermissionTool.java"，移除 VERIFY_NEEDED

### 新增 L4-25~30 (v3 — 补 P1 覆盖缺口, 修正 F-3)

### L4-25: 销售订单明细字段补全 (v3 P0-8) [补 F-3]
**步骤**: 创建 SO → 填 specification(规格)、box_quantity(箱数) 字段 → 提交 → 验证持久化
**验证**: 详情页显示规格和箱数字段

### L4-26: SO 列表智能筛选 Tab (v3 P1-6) [补 F-3]
**步骤**: 进入销售订单列表 → 验证 6 个筛选 Tab 存在(全部/未出库/部分出库/已出库/未收款/已结清) → 切换验证数据过滤
**验证**: Tab 切换后列表数据过滤正确

### L4-27: 预订合同附件上传 (v3 P1-7) [补 F-3]
**步骤**: 创建/编辑 SO → 上传合同附件(PDF) → 保存 → 验证附件可下载
**验证**: 附件字段持久化 + 下载可用

### L4-28: 研发样品追踪记录 (v3 P1-8) [补 F-3]
**步骤**: 进入研发样品详情 → 添加追踪记录(日期+内容+操作人) → 保存 → 验证记录列表显示
**验证**: 子表数据持久化

### L4-29: BOM 追踪记录 (v3 P1-9) [补 F-3]
**步骤**: 进入 BOM 详情 → 添加变更追踪记录 → 保存 → 验证历史记录
**验证**: BOM 痕迹追踪可见

### L4-30: 研发样品页面合并验证 (v3 P1-3) [补 F-3]
**步骤**: 导航到研发模块 → 验证路由结构为 2 页(非 3 页) → 功能完整
**验证**: 路由合并正确 + 功能不缺失

**注**: P0-16(手机端拍照签收) 和 P1-1(工人欠退扫码) 为 RN Mobile-only 功能，不在 web-admin E2E 范围内，此处有意排除。

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

### 8.2 通过标准

| 指标 | R1 | R2 | R3 | R4 | R5 |
|------|-----|-----|-----|-----|-----|
| L1 PASS 率 | ≥90% | ≥95% | ≥98% | 100% | 100% |
| L2 PASS 率 | ≥70% | ≥85% | ≥90% | ≥95% | ≥95% |
| L3 PASS 率 | ≥60% | ≥80% | ≥90% | ≥95% | ≥95% |
| L4 PASS 率 | ≥40% | ≥60% | ≥75% | ≥85% | ≥85% |
| UNVERIFIED | 0 | 0 | 0 | 0 | 0 |
| 回归 | N/A | ≤5 | ≤3 | ≤1 | 0 |

### 8.3 轮间数据清理

- 每轮数据使用 Round 前缀: `R1_xxx`, `R2_xxx`
- L4 创建的数据保留供下轮 L3 验证
- 每轮开始前检查数据前置条件

### 8.4 轮间改进

- R1→R2: 修复所有 FAIL + 优化不稳定测试
- R2→R3: 补遗漏测试点 + 实现 §9 未实现功能
- R3→R4: 聚焦回归
- R4→R5: 最终稳定性
- R5: 5 轮趋势报告

---

## 9. 已知未实现功能 (v3 修正 — 仅 1 项确认未实现)

### 确认未实现 (R1 标记 EXPECTED_FAIL)

| 功能 | 影响 L4 | 原因 | 修复 Round |
|------|---------|------|-----------|
| BomItem.materialGroup 字段 | L4-03 (BOM 3-tab) | 实体有 materialCategory 但无 materialGroup，前端无 3-tab 分组 | R2 |

### v2 误标为未实现，实际已实现 (v3 转为正常测试)

| 功能 | 实际代码位置 | 验证文件 |
|------|-------------|---------|
| OperationalQuote Vue 页面 | `sales/quotes/list.vue` (443行完整CRUD) | router:275 |
| 三价对比 UI | `procurement/orders/detail.vue` 内嵌 collapse | detail.vue:28-280 |
| 车间仓清仓 cron | `FmrExpiryScanner.java` @Scheduled 20:00 | scheduler/ |
| 良品率三色标 | `production/batches/detail.vue` ≥95绿/≥80橙/<80红 | detail.vue:179-184 |
| 大组长/小组长角色 | `FactoryUserRole.java` team_leader(25)+group_leader(28) | enums/ |
| 指定人员授权 | `CanvasSetUserPermissionTool.java` 写 UserMenuPermission | ai/tool/impl/canvas/ |

### P2-deferred (R1 标记 EXPECTED_FAIL_P2，不计入 PASS 率)

| 功能 | L4 | v3 优先级 |
|------|-----|----------|
| SKU 毛利率分析 | L4-16 | P2-5 |
| SmartBI 全链路 | L4-19 | P2-6 |

### 有意排除 (非 web-admin 范围)

| 功能 | 原因 |
|------|------|
| P0-16 手机端拍照签收 | RN Mobile-only |
| P1-1 工人欠退/换岗扫码 | RN Mobile-only |

---

## 10. 报告格式

```
=== E2E 验收报告 Round {N} ===
日期: {date}
工厂: {FACTORY_ID} (E2E测试食品厂, FACTORY)

## 总计
L1: XX/YY PASS (ZZ%) [目标: ≥{threshold}%]
L2: XX/YY PASS (ZZ%)
L3: XX/YY PASS (ZZ%)
L4: XX/YY PASS (ZZ%) [排除 EXPECTED_FAIL: N, P2-deferred: M]

## vs 上轮对比
新增 PASS: [list]
新增 FAIL: [list] — 回归!
修复确认: [list]

## finance_manager 白名单验证
[列出 /finance/*, /sales/* 等被白名单拦截的路由, 预期 403]

## 遗留
EXPECTED_FAIL: [BomItem.materialGroup]
P2-deferred: [L4-16, L4-19]
Mobile-excluded: [P0-16, P1-1]
```
