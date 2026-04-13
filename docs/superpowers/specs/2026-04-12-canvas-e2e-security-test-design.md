# Canvas E2E 安全 + 功能测试设计

**日期**: 2026-04-12
**状态**: Reviewed (5 MUST-FIX applied)
**前置**: 15 个安全修复已部署 test (10011), PR #4 merged to main
**环境**: SSH tunnel `localhost:10011` → test (主路径), 139:8086 → prod (仅对比用)
**运行方式**: 独立 Node.js 脚本 (`chromium.launch()`) + API 辅助
**主测工厂**: `FOOD_3101_038` (已有 24 ACTIVE 动态字段, CANVAS 模式, 现有测试基准)

---

## 1. 背景

Canvas V3 经历 4 轮安全审计，修复 15 个漏洞 (1 SQL 注入 + 4 跨租户 + 1 权限缺失 + 1 prompt injection + 2 静默数据丢失 + 1 cron DDoS + 3 NonUniqueResult + 1 表名注入 + 1 审计丢失)。

**现有测试缺口** (审计发现):
- 22 个散落 .mjs 脚本全用同一管理员账号，零多角色覆盖
- 15 个安全修复零前端验证
- 无跨租户攻击测试
- 无负面路径 (权限拒绝) 测试

**客户对齐** (六扇门食品):
- 非标熟食加工，30-40 辅料/SKU
- 人员级权限 (非角色级): "按人分配任务"
- 税率分组开票 (9% 原料 + 13% 加工)
- 物料 6 步链 (SO→需求→备料→调拨→报工→退料)

---

## 2. 角色体系

### 双层权限模型

| 层 | 机制 | 位置 |
|---|---|---|
| Layer 1 | Vue Router Guard (MOBILE_ONLY + ROLE_PATH_WHITELIST) | `web-admin/src/router/guards.ts` |
| Layer 2 | `@RequireRole` 注解 + JwtAuthInterceptor | Java Controller |

### 测试角色矩阵

| 角色 | Web 登录 | Canvas 编辑器 | Config 写 | Config 读 | 旅程 |
|------|---------|-------------|----------|----------|------|
| `factory_super_admin` (F006) | ✅ | ✅ | ✅ 全部 | ✅ | J1, J6 |
| `permission_admin` (若有) | ✅ | ✅ | ✅ 部分 (不能 approve/publish) | ✅ | J2 |
| `sales_manager` | ✅ 业务页 | ❌ 403 | ❌ 403 | ✅ (消费配置) | J3 |
| `finance_manager` | ✅ SmartBI 仅 | ❌ 403 | ❌ 403 | ✅† (路由拦截) | J5 |
| `operator` | ❌ MOBILE_ONLY | ❌ | ❌ | ❌ | J5 |
| `warehouse_worker` | ❌ MOBILE_ONLY | ❌ | ❌ | ❌ | J5 |
| `factory_super_admin` (F002 跨租户) | ✅ | ✅ | ✅ 自己工厂 | ✅ 自己工厂 | J4 |

---

## 3. 测试环境

### 连接方式 (SSH tunnel, 主路径)

`139.196.165.140:8086` 实际代理到 **prod** (10010), 不是 test。不修改 nginx, 用 SSH tunnel:

```bash
# 开 tunnel (测试全程保持)
ssh -L 10011:localhost:10011 -L 5173:localhost:5173 root@47.100.235.168 -N &
```

| 项目 | 值 |
|------|-----|
| API URL (test) | `http://localhost:10011/api/mobile` |
| Web-Admin | `http://139.196.165.140:8086` (prod 对比用, 非主测) |
| 测试工厂 A | `FOOD_3101_038` (`food_3101_038_admin`, 已有 24 动态字段) |
| 测试工厂 B | `F002` (`factory_admin2`, 需 J0 激活) |
| 默认密码 | `123456` |
| Playwright | headless chromium, `chromium.launch()` |

### 账号矩阵 (J0 验证+激活)

| 账号 | 工厂 | 角色 | 来源 | 用途 |
|------|------|------|------|------|
| `food_3101_038_admin` | FOOD_3101_038 | factory_super_admin | 已存在 | J1, J6 |
| J0 创建 | FOOD_3101_038 | permission_admin | J0 SQL | J2 |
| J0 创建或已有 | FOOD_3101_038 | sales_manager | J0 SQL | J3 |
| `factory_admin2` | F002 | factory_super_admin | seed data, 需激活 | J4 |
| `operator1` | F001 | operator | seed data | J5 |
| `finance_mgr1` | F001 | finance_manager | seed data | J5 |

---

## 4. 共享工具库 `canvas-test-helpers.mjs`

```
exports:
  login(username, password) → { token, factoryId, role }
  apiGet(path, token) → data
  apiPost(path, body, token) → data
  navigateTo(page, path)
  waitForToast(page) → text
  screenshot(page, name)
  assertEvidence(name, evidence)  // E2E skill 强制证据模板
  FACTORY_A, FACTORY_B, BASE_URL
```

---

## 5. 六条旅程

### J0: 环境准备 (API 层, 无 Playwright)

**目的**: 确保两个工厂可用，角色账号激活

```
步骤:
1. 登录 F006 admin → 成功 → 记录 token
2. 激活 F002 admin (或 API 创建新工厂 B)
3. 确认 canvas 表存在 (canvas_dynamic_field, canvas_ddl_log)
4. 确认 module_schemas 有数据 (≥10 模块)
```

---

### J1: 超级管理员 — Canvas 全生命周期

**角色**: `f006_admin` (factory_super_admin, F006)
**时长**: ~15 分钟
**覆盖**: Onboarding → 模板 → 动态字段 → 校验规则 → 发布(DDL) → 业务验证 → 回滚

```
Phase A: 配置
  A1. 登录 → 导航到 /canvas-editor
  A2. 应用食品加工模板 (FOOD_PROCESSING)
      evidence: toast 成功, 工具列表非空
  A3. 添加 7 个动态字段 (覆盖全部 DDL 类型映射 [Fix 3]):
      - customer_level (SELECT: A/B/C)
      - delivery_priority (TEXT)
      - expected_margin (DECIMAL)
      - is_urgent (BOOLEAN)
      - deadline (DATETIME)
      - related_po (REFERENCE)
      - prepayment_records (SUB_TABLE: amount/date/remark)
      evidence: 每个字段 → status=PENDING_DDL, 7 条
  A4. 创建校验规则: totalAmount ≥ 100 (BLOCK)
  A5. 配置条件显隐: expected_margin visibleWhen="customer_level == 'A'"

Phase B: 发布
  B0. 验证模板审计: GET /config/v2/ddl-log → 检查 applyTemplate 记录
      包含当前用户 operatorId (非 0L) [Fix 7]
  B1. 点击"发布" → DDL 执行
      evidence: DDL log 7 条 EXECUTED (对应 7 个字段)
      验证列类型: SELECT→VARCHAR(100), DECIMAL→NUMERIC(18,4),
      BOOLEAN→BOOLEAN, DATETIME→TIMESTAMP, REFERENCE→VARCHAR(64) [Fix 3]
  B2. 验证: dynamic-fields status 全部 → ACTIVE
  B3. 导航到 sales_order 模块 → 验证动态字段出现在表单

Phase C: 业务验证 (Playwright)
  C1. 新建销售订单 → 看到 customer_level 下拉
  C2. 选 customer_level=A → expected_margin 显示
  C3. 选 customer_level=B → expected_margin 隐藏 (条件显隐)
  C4. 填写子表: 添加预付款记录 (amount=5000, date=今天, remark=首付)
  C5. 提交 → 成功
  C6. 详情页验证: 自定义字段值正确

Phase D: 回滚
  D1. 回到 canvas-editor → 回滚到模板应用前版本
  D2. 验证: 动态字段从表单消失
  D3. 再次发布 → 字段恢复
```

**安全修复验证点**:
- [Fix 4] publishConfig 同时接受 DRAFT 和 APPROVED
- [Fix 13] findDraft/findApproved ORDER BY LIMIT 1
- [Fix 14] DDL 执行时 hasFactoryIdColumn 检测

---

### J2: 配置管理员 — 编辑器 7 Tab + 权限边界

**角色**: F006 的 `permission_admin` (若无则创建)
**时长**: ~10 分钟
**覆盖**: 7 个编辑器 Tab 逐个操作 + 验证不能 approve/publish

```
Tab 1: 流程设计
  - 查看 sales_order 工作流状态列表
  - 关闭"财务审核"步骤 (enabled=false)
  evidence: workflowStates 变化

Tab 2: 触发链
  - 查看已有链 (SalesOrderConfirmedEvent)
  - 修改 enabled=false → 保存
  evidence: triggerChain.enabled=false

Tab 3: 校验规则
  - 创建规则: so_remark_required (condition="备注为空", severity=WARN)
  evidence: validation-rules 列表含新规则

Tab 4: 字段配置
  - 修改 orderNumber label → "合同编号"
  - 隐藏 shippingFee 字段 (visible=false)
  evidence: customLabels 更新

Tab 5: 权限矩阵
  - 查看角色×字段矩阵
  evidence: permissionConfig 有内容

Tab 6: 工具技能
  - 禁用某个 tool (canvas_toggle_tool enabled=false)
  evidence: toolConfigs 更新

Tab 7: 定时任务
  - 创建 cron: "0 0 2 * * ?" (每天凌晨2点)
  evidence: schedulerConfigs 含新任务
  - ❌ 尝试 "* * * * * ?" → 被拒绝 [Fix 11]

权限边界:
  - 点击 submit-review → ✅ 成功 (permission_admin 可提交)
  - 点击 approve → ❌ 403 (只有 super_admin 可审批)
  - 点击 publish → ❌ 403
  evidence: 错误 toast 或 API 403
```

**安全修复验证点**:
- [Fix 9] ConfigChangeSet @RequireRole
- [Fix 11] Cron 频率校验

---

### J3: 销售经理 — 动态表单消费者

**角色**: F006 的 sales_manager 或类似业务角色
**时长**: ~10 分钟
**覆盖**: 看到动态字段 → 填表 → 子表 → 条件显隐 → 校验拦截 → 详情验证

```
S1. 登录 (Playwright: 输用户名+密码+点登录)
S2. 导航到销售订单列表 → 点"新建"
S3. 验证动态字段渲染:
    - customer_level: el-select (A/B/C 选项)
    - delivery_priority: el-input
    - expected_margin: 初始不可见 (visibleWhen)
S4. 选 customer_level=A → expected_margin 出现
    evidence: snapshot 确认 margin 字段 visible
S5. 填写订单 (含动态字段)
S6. 填子表: 添加 2 行预付款记录
    evidence: sub-table 行数=2
S7. 故意不填金额 (totalAmount < 100) → 提交 → 校验拦截
    evidence: toast "订单金额不能低于100元"
S8. 补全 → 提交成功
S9. 详情页: 核对所有动态字段值 + 子表数据
S10. ❌ 导航到 /canvas-editor → 403 或重定向
    evidence: URL 不是 /canvas-editor, 或页面显示"无权限"
```

**安全修复验证点**:
- [Fix 5] custom-fields 读写有 factory_id 过滤
- [Fix 14] setDynamicFields affected-row 检查

---

### J4: 跨租户安全 — 工厂 B 攻击工厂 A

**角色**: F002 admin (攻击者) vs F006 (受害者)
**时长**: ~8 分钟
**覆盖**: 6 种攻击向量 → 全部被拒

```
准备: 登录 F002 admin → 获取 token

Attack 1: SQL 注入 (fieldCode)
  POST /F002/config/v2/dynamic-fields
  body: {fieldCode: "x; DROP TABLE sales_orders", ...}
  expected: 400, "fieldCode 必须匹配"
  [Fix 1]

Attack 2: SQL 注入 (sub-table column)
  POST /F002/sales_order/{recordId}/sub-table/prepayment_records
  body: {"amount; DROP TABLE x": 100}
  expected: 400, "非法列名"
  [Fix 1, Fix 12]

Attack 3: 跨租户子表读
  GET /F002/sales_order/{F006_RECORD_ID}/sub-table/prepayment_records
  expected: 403, "记录不属于当前工厂"
  [Fix 2, Fix 15d]

Attack 4: 跨租户 custom-fields 写
  PUT /F002/sales_order/{F006_RECORD_ID}/custom-fields
  body: {customer_level: "HACKED"}
  expected: 0 行更新 → BusinessException
  [Fix 5, Fix 14]

Attack 5: 跨租户 ConfigChangeSet 审批
  POST /F002/config-changes/{F006_CHANGESET_ID}/approve
  expected: 403, "变更集不属于当前工厂"
  [Fix 10, Fix 15c]

Attack 6: Cron DDoS
  PUT /F002/config/v2/scheduler/ddos_test
  body: {cronExpression: "*/5 * * * * ?", ...}
  expected: 400, "秒字段只允许单个数字"
  [Fix 11, Fix 15b]
```

---

### J5: 权限阶梯 — 低权限角色拦截

**角色**: `operator1` + `finance_mgr1` + 业务角色
**时长**: ~5 分钟
**覆盖**: 3 层权限拦截

```
L1: MOBILE_ONLY 拦截 (operator)
  P1. Playwright 打开 /login → 输入 operator1 + 密码 → 点登录
  P2. 预期: 重定向到 /mobile-only 页面 (非 /dashboard)
  evidence: URL 含 "mobile-only", 页面有"请使用手机App"提示

L2: 路由白名单 (finance_manager)
  P3. 登录 finance_mgr1 → 成功到 /dashboard
  P4. 手动输入 URL /canvas-editor → 预期: 重定向到 /403
  P5. 手动输入 URL /sales/orders → 预期: 重定向到 /403
  P6. 导航到 /smart-bi/dashboard → 成功 (在白名单内)
  evidence: 每步 URL + 页面内容

L3: API 层 @RequireRole (业务角色)
  P7. 用业务角色 token 调 config 写 API:
      POST /config/v2/dynamic-fields → 403
      POST /config/publish → 403
      POST /config/v2/validation-rules/xxx → 403
  evidence: HTTP 403, message 含"权限不足"
```

---

### J6: AI 配置助手 — prompt injection 防御

**角色**: `f006_admin` (factory_super_admin)
**时长**: ~5 分钟
**覆盖**: AI autopilot + plan + 工具白名单

```
A1. API 调 /config/v2/ai/chat (autopilot mode)
    message: "禁用采购模块"
    expected: 执行 canvas_toggle_module → 成功
    [验证 AI 基本功能]

A2. API 调 /config/v2/ai/apply-diffs
    diffs: [{tool: "material_batch_delete", params: {...}}]
    expected: 拒绝, "Canvas AI only allows canvas_* tools"
    [Fix 6, Fix 15a]

A3. API 调 /config/v2/ai/apply-diffs
    diffs: [{tool: "canvas_toggle_module", params: {moduleCode: "bom", enabled: false}}]
    expected: 成功执行
    [验证白名单内工具可用]

A4. 用非 admin 账号调 /config/v2/ai/chat
    expected: 403
    [验证 @RequireRole 生效]
```

---

## 6. 证据规范 (E2E Skill 合规)

每个测试步骤必须产出:

```
### [旅程ID]-[步骤] — [操作]
  action: [点击了什么/调了什么API]
  evidence:
    - filled: 字段A=值1, 字段B=值2
    - toast: "确切toast文本"
    - API: HTTP [状态码], success=[true/false]
    - list after: [数据在列表中可见/不可见]
    - security: [攻击被拒绝/权限拦截正常]
    - screenshot: [文件名.png]
  result: ✅ PASS / ❌ FAIL / ❌ KNOWN_BUG [原因]
```

---

## 7. 执行顺序与并行策略

```
串行 (有依赖):
  J0 → J1 (J1 依赖 J0 环境) → J3 (J3 依赖 J1 创建的动态字段)

并行 (无依赖):
  J2 ∥ J4 ∥ J5 ∥ J6 (各自独立, 用不同账号)

推荐执行顺序:
  Phase 1: J0 (环境准备)
  Phase 2: J1 (Canvas 生命周期 — 创建测试数据)
  Phase 3: J2 + J3 + J4 + J5 + J6 (并行)
```

---

## 8. 成功标准

| 指标 | 目标 |
|------|------|
| 安全修复验证 | 15/15 修复全部有对应测试覆盖 |
| 角色覆盖 | 6 种角色 (super_admin + permission_admin + sales + finance + operator + warehouse_worker) |
| RBAC 验证 | 3 层权限拦截全部验证 (MOBILE_ONLY + 路由白名单 + @RequireRole) |
| 跨租户 | 6 种攻击向量全部被拒 |
| Canvas 功能 | 7 Tab 编辑器 + 动态字段生命周期 + 条件显隐 + 子表 + 校验规则 |
| E2E Skill 合规 | 100% 证据完整 (filled/toast/API/screenshot), 0 WARN |

---

## 9. 文件结构

```
tests/canvas-security-e2e/
├── canvas-test-helpers.mjs          # 共享工具库
├── j0-setup.mjs                     # 环境准备
├── j1-lifecycle.mjs                 # 超级管理员全生命周期
├── j2-editor-tabs.mjs               # 配置管理员 7 Tab
├── j3-consumer.mjs                  # 销售经理消费动态表单
├── j4-cross-tenant.mjs              # 跨租户攻击
├── j5-permission-ladder.mjs         # 权限阶梯
├── j6-ai-agent.mjs                  # AI 助手 + prompt injection
├── results/                         # 测试结果 JSON
└── screenshots/                     # 截图证据
```

---

## 10. E2E Skill 偏差声明

J4 (跨租户安全) 和 J6 (AI prompt injection) 使用 **API 调用** 而非 Playwright UI 操作。
这是有意为之:

- SQL 注入 payload (`x; DROP TABLE`) 无法通过 UI 输入 — 前端 el-input 会阻止分号
- 跨租户 recordId 篡改无法通过 UI 触发 — URL 由前端路由构建
- Prompt injection 需要精确控制 tool name 字符串

**规则**: J1/J2/J3/J5 的 Playwright 部分严格遵守 E2E Skill 规则 (填表单/验证 toast/截图)。
J4/J6 标记为 `SECURITY_API_TEST`, 不适用 "禁止 API CRUD" 规则。

---

## 11. Fix 覆盖矩阵

| Fix | 描述 | 旅程 | 步骤 | 可回归? |
|-----|------|------|------|---------|
| 1 | SQL injection (column names) | J4 | Attack 1, 2 | ✅ |
| 2 | Cross-tenant sub-table (verifyParentOwnership) | J4 | Attack 3 | ✅ |
| 3 | Type mapping sync (13 types) | J1 | A3 (7 类型), B1 (DDL 类型验证) | ✅ |
| 4 | publishNow accepts APPROVED | J1 | B1 (发布流程) | ✅ |
| 5 | custom-fields tenant isolation | J4 | Attack 4 | ✅ |
| 6 | CanvasAI tool whitelist | J6 | A2 | ✅ |
| 7 | applyTemplate audit operatorId | J1 | B0 (审计日志验证) | ✅ |
| 8 | publishNow dead code cleanup | — | 代码清理, 不可测 | N/A |
| 9 | ConfigChangeSet @RequireRole | J2 | 权限边界测试 | ✅ |
| 10 | Cross-tenant change set | J4 | Attack 5 | ✅ |
| 11 | Cron frequency validation | J2 Tab7, J4 Attack 6 | ✅ | ✅ |
| 12 | subTableName regex | J4 | Attack 2 | ✅ |
| 13 | ORDER BY LIMIT 1 (NonUnique) | J1 | B1 (多次发布不崩溃) | ✅ |
| 14 | hasFactoryIdColumn + affected-row | J1 B1, J3 S8 | ✅ | ✅ |
| 15a | Canvas tool regex [a-z0-9_] | J6 | A3 | ✅ |
| 15b | Cron rewrite | J4 | Attack 6 | ✅ |
| 15c | Null factoryId rejection | J4 | Attack 5 | ✅ |
| 15d | verifyParentOwnership factory_id check | J4 | Attack 3 | ✅ |

**覆盖率: 14/15 (93%)** — Fix 8 为代码清理不可测, 其余全覆盖。
