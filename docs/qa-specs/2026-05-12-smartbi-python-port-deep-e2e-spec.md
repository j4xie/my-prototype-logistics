# SmartBI + Java→Python Port Deep E2E Test Spec

**Date**: 2026-05-12
**Author**: organizer chat (review pending)
**Trigger**: Steve directive — 测试做好 持续, 找全 SmartBI + Java→Python 转换的模块做 deep E2E.
**Skill compliance**: `depth-first-e2e` (Rule 1-11) + `qa-prompt v2.4` (Rule 1-17).
**Status**: 📝 **DRAFT — 等 Steve review**, 审核通过后按 §6 执行序列 dispatch chats.

---

## §0 范围 & 目标

### 0.1 In-scope (本 spec 覆盖)

**Python smartbi_compat 18 endpoints** (Phase 2A→2C 完整 port):

| Phase | Module | Endpoints | Java 端 |
|---|---|---|---|
| 2A core | analysis_finance | composite + budget-achievement + yoy-mom + category-comparison | **deleted** in T6.5 Phase C |
| 2A core | analysis_sales / inventory / procurement / region / department / drilldown | 6 endpoints | **deleted** |
| 2A list | analysis.py (4 list) | query-templates / datasource/list / alerts / recommendations | **deleted** |
| 2B | analysis_production / analysis_quality | 2 endpoints | **STILL ALIVE** (NOT_SAFE_KEEP) |
| 2C Tier 1 | config_thresholds | 5 CRUD endpoints | Tier 1 pilot, Java stays |
| 2C Tier 2 | dashboard_composite + dashboard | 4 endpoints | composite pilot |
| 2C Tier 3 | datasource (5) + query_templates_write (3) + incentive_plan (1) | 9 endpoints | Phase 2C write ops |
| (legacy) | upload.py | upload endpoint | n/a |

**3 Customer-facing Vue 改** (今天 prod ship):
- `procurement/orders/list.vue` (#423 v-if + #413 PDF)
- `procurement/receives/list.vue` (#423 v-if + #414 收货数量列)
- `sales/orders/list.vue` (#423 v-if)

**Web-admin SmartBI pages** (~20 Vue files) 全部需 L1 smoke 覆盖 (Rule 11 breadth).

### 0.2 Out-of-scope (本 spec 不动)

- 非 SmartBI 模块 (HR / Equipment / 其他 ERP)
- Phase 2D factory dispatch stub (empty envelope, no logic to test)
- 14 R_*_REAL 餐饮 chain parity 测试 (已 close 在 PR #398/#403)
- AI Agent layer (default disabled, SMARTBI_AGENT_LAYER_ENABLED=false)
- OTA Track A (chat5 待 unblock)

### 0.3 双层目标

| 层次 | 验证目的 |
|---|---|
| **数据层** | API contract 正确 / DB 持久化无 silent-drop / RBAC strip 实际生效 / Rule 10/11/12 regression 锁 |
| **UX 层** | 页面渲染 / 表单交互 / Toast 文案 (Rule 7-8 MutationObserver) / 错误 UX 四位一体 / 跨模块导航 |

---

## §1 模块覆盖矩阵 (Rule 11 breadth)

当前 baseline:

| Module | 单元测试 (今天 ship) | E2E 数据层 | E2E UX 层 |
|---|---|---|---|
| analysis_finance (4 endpoint) | ✅ 27+19 tests | ❌ none | ❌ none |
| analysis_sales | ✅ 46 tests | ❌ | ❌ |
| analysis_inventory | ✅ 42 tests | ❌ | ❌ |
| analysis_procurement | ✅ 20 tests (Rule 12 locked) | ❌ | ❌ |
| analysis_region | ✅ 104 tests | ❌ | ❌ |
| analysis_department | ✅ 45 tests | ❌ | ❌ |
| analysis_drilldown | ✅ 14 tests (Rule 12 locked) | ❌ | ❌ |
| analysis_production (Phase 2B) | ✅ 29 tests | ❌ | ❌ |
| analysis_quality (Phase 2B) | ✅ 29 tests | ❌ | ❌ |
| analysis.py 4 list | ✅ 44 tests | ❌ | ❌ |
| config_thresholds (5 endpoint) | ✅ 41 tests (gold standard) | ❌ | ❌ |
| dashboard_composite (3) | ✅ 68 tests | ❌ | ❌ |
| dashboard (data-date-range) | ✅ 14 tests | ❌ | ❌ |
| datasource (5 endpoint) | ✅ 21 tests (含 upload 边界) | ❌ | ❌ |
| query_templates_write (3) | ✅ 18 tests | ❌ | ❌ |
| incentive_plan | ✅ 44 tests | ❌ | ❌ |
| upload.py | ⚠️ unknown | ❌ | ❌ |

**E2E 覆盖率: 0%** (单元测试 100% 但端到端 0%).

按 Rule 11.4: 3 round 都 `none` 必须 breadth round 覆盖全部. 本 spec 起步设计就含 R1 breadth.

---

## §2 数据层测试条例 (API + DB)

### 2.1 通用 acceptance bar (每个 endpoint)

每个 endpoint 至少 **5 项** (按 Rule 10/11):

| # | 检查 | qa-prompt rule |
|---|---|---|
| D1 | Happy path API status 200 + envelope shape | Rule 11.② shape audit |
| D2 | 最小 body 测试 (FE emptyForm 字段集, 验缺字段不被 entity @NotBlank 误拦) | Rule 10 |
| D3 | Roundtrip — POST/PUT 后立刻 GET, 逐字段 diff (silent-drop bug catch) | Rule 11.③ re-GET |
| D4 | Error 路径 — 触发 4xx (auth/cross-factory/missing param), 验 response.data.message 具体 | qa-prompt 第四步 a) |
| D5 | RBAC strip — warehouse_mgr token 看 price 字段 = null; admin token 看真值 | PR #423 实战 |

### 2.2 Rule 10/11/12 regression locks (跨 endpoint)

| Lock | 触发 endpoint | 测试 |
|---|---|---|
| **Rule 10** divide-multiply 中间 quantize | analysis_finance `_safe_growth_rate` / analysis_sales `_calculate_completion_rate` / analysis_procurement `_query_supplier_concentration` | `1/3*100 == Decimal("33.3300")` (scale 4) 不是 `33.3333` |
| **Rule 11** μs LocalDateTime trim | datasource.list / query_templates list (含 createdAt) | `_java_isoformat(dt with μs=150710) == ".15071"` (drop 末 0) |
| **Rule 12** HALF_UP vs banker's | analysis_procurement supplier concentration / analysis_drilldown `_build_kpi_card` | `Decimal("46.55").quantize(0.1, ROUND_HALF_UP) == "46.6"` 非 banker's "46.5" |

每个 lock 用 **F999 demo factory** seed 已知 boundary value 触发 + assert.

### 2.3 RBAC price strip 跨 endpoint sweep (Rule 8 same-cause)

PR #423 annotated 13 fields across MaterialBatch / Purchase / SalesOrder. Sweep 所有相关 endpoint:

| Endpoint | 含 price 字段? | warehouse 应 strip? |
|---|---|---|
| `/material-batches` | ✅ unitPrice/totalPrice/totalValue | ✅ 已 prod-verified (admin=9.32, warehouse=null) |
| `/material-batches/{id}` | ✅ same fields | 需测 |
| `/material-batches/expiring` | ✅ | 需测 |
| `/material-batches/low-stock` | ✅ | 需测 |
| `/material-batches/inventory/valuation` | ✅ 整页含 price | **高 risk** — 整 endpoint 可能要 disable for warehouse, 需 spec |
| `/purchase-orders` | ✅ totalAmount/unitPrice | 需测 (#423 annotated) |
| `/purchase-orders/{id}` | ✅ | 需测 |
| `/purchase-receives` | ✅ | 需测 (#423 annotated, today's #414 加列) |
| `/sales-orders` | ✅ unitPrice/totalAmount | 需测 (#423 annotated) |
| `/sales-orders/{id}` | ✅ | 需测 |
| `/analysis/finance` (Python) | ✅ KPI 含金额 | **不在 PR #423 scope** — 财务分析本就限 finance_manager+ 看 (需 verify) |
| `/dashboard_composite/executive` | ✅ | 同上 |

**Sweep 输出**: 每条 endpoint × {admin, warehouse, operator} 3-token matrix = 36 验证点. 任何 leak = silent RBAC bug.

### 2.4 Java→Python parity 测试 (限 Phase 2B 4 endpoints)

Java handlers **仅 Phase 2B production / quality / query / drill-down 还活着**. 其他 Phase 2A 已 delete (per F999 retest doc §1.1). 所以真 parity 只在这 4 个:

| Endpoint | Java 端 | Python 端 | 验证方式 |
|---|---|---|---|
| `/analysis/production` | 10020 active | 8083 active | F999 + F001/F006 同时 curl, dict-eq 比对 |
| `/analysis/quality` | 10020 | 8083 | 同上 |
| POST `/smart-bi/query` | 10020 | (Phase 2C `/query` CUT, Java only) | Java single-source verify |
| POST `/smart-bi/drill-down` | 10020 | (CUT, Java only) | Java single-source verify |

Phase 2A 50 endpoints — **不是 parity 测试**, 是 **Python-only correctness**. 用 chat4 audit doc + 现有 单元测试 goldens 当 source-of-truth.

### 2.5 数据 boundary 抽检 (Rule 9 — 中段 + 末段)

数据类 endpoint (list / 图表 / 表格) 必须 sample 3-5 行避巧合:

| Endpoint 类 | Top 3 | 中段 (len/2) | 末段 2-3 行 | 抽检 acceptance |
|---|---|---|---|---|
| /material-batches?page=1 | 抽 | 抽 | 抽 | 业务语义合理 (非 pseudo-rows / 序号 / 表头) |
| /analysis/sales 销售排行 | 抽 | 抽 | 抽 | 客户/商品名真实 (非 "1.0/2.0") |
| /analysis/inventory 库存表 | 抽 | 抽 | 抽 | 名称非 "门店名称" 表头字 |
| /dashboard_composite KPI cards | n/a (单 record) | n/a | n/a | unit 字段非空, value 合理范围 |

---

## §3 UX 层测试条例 (Vue + Element Plus)

### 3.1 通用 acceptance bar (每个 customer-facing 页)

| # | 检查 | qa-prompt rule | 工具 |
|---|---|---|---|
| U1 | 页面 L1 smoke — Locator API navigate + table 渲染 + 无 console error | qa-prompt Rule 5/6 | Playwright browser_navigate + browser_console_messages |
| U2 | 表单 submit happy path — fillAllRequiredFields + 提交 + API 200 + toast text 精确 | qa-prompt Rule 7 | MutationObserver 抓 toast (不用 querySelectorAll) |
| U3 | 列表 +1 delta strict — `rowsAfter === rowsBefore + 1` 不是 `>` | depth-first-e2e Rule 1 deep | countTableRows pre + post |
| U4 | 详情页 roundtrip — 点击 row → 详情打开 → 字段值 = 提交值 | depth-first-e2e Rule 2 step 12 | page.evaluate read detail fields |
| U5 | Error 四位一体 — 触发 400/403, 验 a) network msg b) toast 文案=msg c) sticky d) next action | qa-prompt 特别规则 | MutationObserver + 5s 后 re-read 验 sticky |
| U6 | RBAC v-if — warehouse 角色看价格列 `—` 非 null; admin 看真值 | PR #423 UI defense | screenshot 对比 |
| U7 | Bug #37 抽检 — 数据类页 Top3+中段+末段 3-5 行业务语义合理 | qa-prompt Rule 9 | sample 5 rows random index |

### 3.2 Customer-facing 3 PR L4 deep tests (最高优先级 — 今天刚 ship)

#### L4-CF-1: PR #423 RBAC v-if defense (3 Vue file)

**步骤**:
1. Login `f001_warehouse_mgr` / `123456` (warehouse_manager role)
2. Navigate `/material-batches` (or `/inventory/batches`)
3. 截图 + 验列 "单价" / "总价" / "库存价值" 显示 `—` (非空白, 非 "null" 字面字)
4. 切到 `/procurement/orders` 同样验
5. 切到 `/sales/orders` 同样验
6. 登出 → 重 login `factory_admin1` 同账号
7. 同 3 页同列 → 验真实数字 (`9.32`, `25890.96`, `15.0` etc)
8. console 0 error / network 0 4xx (除 expected 403 跨 factory)
9. **Acceptance**: 3 page × 2 role = 6 screenshot, RBAC consistent

#### L4-CF-2: PR #413 PDF 打印 + 条码

**步骤**:
1. Login factory_admin1
2. 进采购单详情页 (找 1 个 confirmed status SO)
3. 找 "PDF 打印" / "供货单" 按钮 → click
4. 验生成 PDF (browser_pdf_save 截 binary)
5. 验 PDF 含: 供应商名 / 订单号 / 商品行 / 总金额 / **条码** (binary header check)
6. **Acceptance**: PDF 生成 200 + content 4+ 字段 verifiable

#### L4-CF-3: PR #414 收货数量列

**步骤**:
1. Login factory_admin1
2. Navigate `/inventory/receives` 或 `/purchase/receives`
3. 验有 "收货数量" 列 (text match column header)
4. 抽 1 row 验数值 (numeric, 非 null)
5. 跨 admin/warehouse role 对比 (warehouse 看收货数量 OK, 单价 strip)
6. **Acceptance**: 列存在 + 数据 + role 区分正确

### 3.3 SmartBI Analysis L4 deep tests (按 module)

每个 SmartBI analysis 端点对应 1+ Vue page. Per Rule 2 每 round 至少 1 deep:

| Module | Vue page | L4 deep 步骤 (deep template) |
|---|---|---|
| finance | `analytics/smart-bi/AdvancedFinanceAnalysis.vue` | 选 periodType=MONTH + dateRange → 加载 → KPI cards 渲染真值 → drill-down KPI → 详情图表 → console 0 error / network only 200 |
| sales | `analytics/index.vue` (或 sales dashboard) | period 切换 → trend chart 渲染 → ranking table 抽检 5 row 业务名 → 错误路径触发 (无 token) |
| inventory | (inventory dashboard) | 库存周转分析 → expiry warnings → 业务语义抽检 |
| procurement | (procurement dashboard) | 供应商集中度 → **Rule 12 boundary**: 选 46.55% 临界值 case → 显示 "46.6%" 非 "46.5%" |
| dashboard composite | `analytics/AlertDashboard.vue` / dashboard/executive | 3 dashboard endpoint × period 切换 → KPI 矩阵渲染 |
| drilldown | (drill-down popup or dedicated page) | trigger drill-down POST → response render → **Rule 12**: KPI raw_value boundary 100.005 → 显示 100.01 |
| RBAC (跨 endpoint) | sales/procurement/material-batches list | warehouse 角色看 KPI 含金额? 应 strip 还是整页禁止? |

### 3.4 错误路径 (Rule 5 各 round 至少 1 error-deep)

每 round 触发至少 1 个业务错误:

| Round 错误类型 | 触发方式 | 期望 UX |
|---|---|---|
| 跨 factory 越权 | f001 token curl `/F002/...` | 403 + actionHint "请检查工厂" + sticky toast |
| Missing required param | analysis_finance 不传 periodType | 422 + toast "periodType 必填" + sticky |
| 数据为空 fallback | f006_admin 查 analysis/sales 但 F006 没 sales data | 200 + UI 显示 "无数据" 非空白 + KPI=0 不是 null |
| Token 过期 | 等 24h 后 token 自动刷新 OR manual delete cookie | 自动 refresh + 重发原请求 (per JWT rule) |
| 上传超大 Excel | datasource 上传 100MB Excel | 413 OR 422 + toast "文件过大" + sticky |

---

## §4 测试环境 + 凭证

| 项 | 值 |
|---|---|
| **测试 URL** | `http://139.196.165.140:8097/` (test web-admin, **NOT prod**) |
| **Java test backend** | `http://47.100.235.168:10011/` |
| **Python test service** | `http://47.100.235.168:8084/` |
| **测试 DB** | `cretas_db` + `smartbi_db` (test, NOT _prod_db) |
| **测试账号 F001** | `factory_admin1` / `warehouse_mgr1` / `f001_operator` (all pw `123456`) |
| **测试账号 F006** | `f006_admin` / `f006_worker1` (pw `123456`) |
| **F999 demo** | 0 users (per F999 retest), 不能 login 测试 — Java fallthrough only |

⚠️ 硬规则 (qa-prompt 测试环境硬规则): 任何 `--env prod` 必须 Steve 明确说"部 prod". 本 spec 全部 test env.

---

## §5 Round 执行计划

按 risk-based 排序:

### Round 1 — Breadth smoke (覆盖全部 18 endpoint + 3 customer-facing UI + 20 SmartBI Vue page)

**目标**: 满足 Rule 11 breadth — 任何 module 不留 `none` 覆盖.

**Scope** (~5h):
- 18 Python endpoint: L1 smoke (curl + check 200) — 数据层
- 20 SmartBI Vue page: L1 smoke (Playwright navigate + check render + 0 console error) — UX 层
- 3 customer-facing UI page: L4 deep (full template per §3.2) — UX 层

**Depth target**: smoke=18, medium=0, deep=3 (Rule 2 满足).

**Output**: round-1-results.json + 21 screenshot.

### Round 2 — Customer-facing 深度 + RBAC sweep

**目标**: PR #423/#413/#414 三个客户面 PR 全 verified + RBAC strip 跨 endpoint sweep.

**Scope** (~6h):
- §3.2 L4-CF-1/2/3 重复跑 + 加 error-deep 路径 (跨 factory 403 / token 过期)
- §2.3 RBAC sweep — 12 endpoint × 3 token = 36 验证点
- 任何 leak = P0 bug, Rule 8 same-cause sweep

**Depth target**: deep=10+ (4 customer-facing + 6 RBAC critical)

### Round 3 — SmartBI Tier 1 deep (analysis_finance / sales / inventory)

**目标**: 3 个 customer-facing analytics dashboard L4 full roundtrip.

**Scope** (~5h):
- §3.3 3 module × L4 deep template
- §2.2 Rule 10 lock-down test 触发 (finance _safe_growth_rate boundary)
- §2.5 数据 boundary 抽检 (Top + 中段 + 末段 5 rows)

**Depth target**: deep=6+ (含 Rule 10 regression locked)

### Round 4 — SmartBI Tier 2 deep (procurement / region / department / drilldown)

**目标**: Tier 2 4 module + Rule 12 critical regression lock.

**Scope** (~5h):
- §3.3 4 module L4 deep
- §2.2 Rule 12 boundary: procurement 46.55% → "46.6" (非 banker's)
- drilldown `_build_kpi_card` 100.005 → 100.01

**Depth target**: deep=6+ (含 Rule 12 regression locked)

### Round 5 — 边界 + Phase 2B parity + regression

**目标**: 数据 upload boundary / Phase 2B Java+Python parity / Rule 17 backend antipattern sweep.

**Scope** (~5h):
- datasource upload: 100MB / 0-byte / malformed Excel / Unicode 文件名 (chat5 已 unit-test, E2E 验)
- Phase 2B production/quality Java vs Python dict-eq (限 4 endpoint, 已 close 在 PR #398/#403 餐饮 chain)
- Rule 17 backend reverse-pattern grep (controller @RequestBody Entity / mapper partial-update / @Transient setter)

**Depth target**: deep=5+, error-deep=3+

### Round 6 (条件) — Bug fix + same-cause sweep

**触发**: Round 1-5 抓到任何真 bug.

按 Rule 8: 每 bug → identify pattern → grep sibling → vulnerable/safe verdict → 修 OR 写 ticket.
按 Rule 9: 独立 reviewer agent verify fix.
按 Rule 10: 修完 push + PR + 部 test → re-smoke verify → delivery plan.

---

## §6 执行序列 (Dispatch chats)

**前提**: Steve review 通过本 spec.

| 顺序 | Round | Chat 数 | 估时 | 输出 |
|---|---|---|---|---|
| 1 | R1 Breadth smoke | 3 chats parallel | ~5h | smoke matrix |
| 2 | R2 Customer-facing + RBAC sweep | 4 chats parallel | ~6h | 4 PR L4 verified + RBAC 36 cells |
| 3 | R3 Tier 1 deep | 3 chats parallel | ~5h | finance/sales/inventory full roundtrip |
| 4 | R4 Tier 2 deep | 4 chats parallel | ~5h | procurement/region/dept/drilldown + Rule 12 lock |
| 5 | R5 边界 + parity + Rule 17 | 3 chats parallel | ~5h | upload boundary + Phase 2B parity + reverse-pattern grep |
| 6 | R6 (条件) Bug fix | 1-3 chats | depends | Rule 8 sweep + Rule 9 critic + Rule 10 delivery |

**Total**: ~26h wall-clock with 3-4 parallel chats. **Real days**: ~3-4 天 with 5-chat pool.

每 round 后:
- Audit per Rule 5 (depth scrutiny) + Rule 3 (bug-discovery capability)
- 独立 critic agent (Rule 9)
- Rule 10 delivery 检查 (commit → push → PR → 测试环境部 → re-smoke)
- Update coverage matrix (Rule 11)

---

## §7 Bug 记录 + 分类 (qa-prompt 6 类)

每个抓到的 bug 立刻:

| 类 | 例 | 优先级 |
|---|---|---|
| 业务逻辑 bug | analysis_finance Rule 10 divide 不 quantize | P1 |
| **silent-drop bug** (qa-prompt v2.4 独立类) | PUT /thresholds 200 success=true 但 DB threshold value 未更新 | **P0** |
| UX bug | toast fallback "操作失败" 而非 backend message | P2 |
| RBAC bug | warehouse_mgr 看到 /analysis/finance 含 KPI 金额 | **P0** (客户面合规) |
| 数据一致性 bug | SO 状态 confirm 后 PO 自动生成漏掉 | P1 |
| 流程事故 bug | deploy script 误部 prod (本 spec 严格 test only) | n/a (流程已防) |

**记录格式** (per qa-prompt 起步动作 1):
```
TaskCreate: [Round-N] [Module] [简述]
  Evidence: endpoint / status / message / screenshot path
  根因猜测: ...
  Sister sweep candidate: ...
```

---

## §8 Acceptance — 整 spec 完成定义

| 项 | 满足条件 |
|---|---|
| Breadth (Rule 11) | 18 Python endpoint + 3 customer-facing UI + 20 SmartBI Vue page 全 ≥ smoke |
| Depth (Rule 2) | 每 round 至少 1 new deep L4. 总 deep ≥ 25 (5 round × 5/round) |
| RBAC sweep | 12 critical endpoint × 3 role = 36 验证点 全 verified, 0 leak |
| Rule 10/11/12 locks | 3 specific boundary test 跑过 + sanity-check (临时改 helper 看 test fail 验 lock 真有效) |
| Error 路径 | 每 round ≥ 1 error-deep (四位一体: msg + toast + sticky + actionHint) |
| 数据 boundary 抽检 (Rule 9) | 数据类页 Top + 中段 + 末段 3-5 row 业务语义 OK |
| Same-cause sweep (Rule 8) | 任何 bug 找到 sibling code 按 vulnerable/safe verdict 处理 |
| Independent critic (Rule 9) | 每 round Step ⑤ audit 用独立 agent (zero context) |
| Delivery (Rule 10) | 每 round commit → push → PR → re-smoke verify, 不停留 unshipped branch |

---

## §9 风险 + 缓解

| 风险 | 缓解 |
|---|---|
| 0 客户 → test 容易 smoke padding (depth-first-e2e Rule 4 警告 "next round") | Rule 2 强制每 round 至少 1 deep, Critic agent 抓 padding |
| Phase 2A Java handler deleted → 不能 parity 比对 | Phase 2A 改 Python-only correctness 测; 单元测试 + chat4 audit 当 source-of-truth |
| F999 demo factory 0 users → 不能 login | F001/F006 真有 user 替代 (per F999 audit doc §6) |
| RBAC sweep 36 验证点工作量大 | 按 token 复用模式批量 — 1 chat 跑 12 endpoint × 1 token, 3 chats 并行 = 36 cells in 2-3h |
| 长 round 链 (5-6 round × 3-4 天) 中途有 customer trigger | 0 customers right now (per handoff), 低风险窗口 |

---

## §10 不在 spec scope 的后续候选

- **Phase 2D Silver migration** — DEFERRED 直到真客户 sign
- **OTA Track A E2E** — chat5 待 unblock
- **AI Agent layer** (Week 5) — default disabled
- **Customer onboarding runbook** — 原 chat1 round 1 task 未做
- **chat1 baseline audit 6 gap items** — 散 follow-up
- **Java prod OOM 风险** — backlog (Xmx → 2g 或 heap profile)
- **Python 3.8 EOL** — backlog (venv38 → venv311)

---

## §11 Steve 决策点 — REVIEWED 2026-05-12

| # | 问题 | Steve 答 | impact |
|---|---|---|---|
| 1 | Round 顺序 | **Risk-based** (customer-facing 优先) | §5 顺序保持原样 |
| 2 | RBAC 含 finance dashboard 看 KPI 金额? | **Strip price-related KPI for warehouse** (与 PR #423 逻辑一致) | **新 P1 PR 在 R2 前 ship** — 见 §11.1 |
| 3 | 节奏 26h × 3-4 天 4-chat parallel | **OK 严格跑** | §6 dispatch 序按原计划 |

### §11.1 新 P1 PR — 在 R2 前 ship (Steve 决策 2 触发)

**Scope**: 加 `@PriceSensitive` annotation 到 finance/dashboard KPI value 字段, 让 PriceFieldResponseAdvice 对 warehouse role strip.

**触发 endpoint** (含金额 KPI):
- `analysis_finance` composite + 3 sub-types — KPI fields: GROSS_PROFIT.rawValue / GROSS_PROFIT.value / 现金流 / 应收应付金额 等
- `analysis_sales` — KPI: 销售额 / 客单价 / GMV
- `analysis_inventory` — KPI: INVENTORY_VALUE.rawValue / 库存周转金额
- `analysis_procurement` — KPI: 采购总额 / 供应商集中度金额
- `dashboard_composite` (/executive, /executive/custom, /dashboard) — composite KPI 含全部上面字段
- `analysis_drilldown` POST — KPI rawValue / value boundary

**实施 chat dispatch** (在 R1 同期或之前):
- 1 chat /clear (~3-4h)
- 加 `@PriceSensitive` to Python response builder helpers (Python side mirror Java ResponseAdvice 行为, 因为 Phase 2A Java handler 已 delete, 只能 Python strip)
- **OR**: 让 PriceFieldResponseAdvice 在 Java side 仍 active 的部分 strip; Python side 加 `_strip_price_for_role()` 通用 helper
- 测试: warehouse_mgr1 token curl /analysis/finance → KPI.rawValue=null, admin → 真值

**为什么这 PR 在 R2 之前**: R2 RBAC sweep 包含 finance dashboard, 如果 PR 未 ship, R2 会抓 leak 当 bug; 不如先把 strip 加上, R2 直接 verify works.

### §11.2 Spec 未明确点 — R1 探测期解决

| 点 | 处理 |
|---|---|
| §3.3 Vue page 与 endpoint mapping 100% 对应 | R1 chat 探测时 grep `web-admin/src/views/**/*.vue` 找 axios call 路径反查 endpoint, 输出 mapping table 作为 R1 副产物 |
| §0.1 scope 是否漏 | R1 之前 organizer grep 一遍 `backend/python/smartbi_compat/api/*.py` + `backend/python/smartbi/api/*.py`, 任何漏的加 spec |
| upload.py 单元测试覆盖? | R1 探测时 verify, ❌ 则 Round 5 边界含 upload backfill |

### §11.3 GO 决定

Spec **APPROVED** by Steve 2026-05-12.

执行序:
1. **首先** dispatch finance/dashboard KPI strip PR (§11.1) — 1 chat ~3-4h
2. **同期** dispatch R1 Breadth smoke 3 chats — ~5h
3. R1 + KPI PR 都 ship 后, fire R2 (customer-facing + RBAC sweep)
4. R3/R4/R5 按 §5

我 standby cascade + admin merge + 每 round 后 Critic agent independent audit.
