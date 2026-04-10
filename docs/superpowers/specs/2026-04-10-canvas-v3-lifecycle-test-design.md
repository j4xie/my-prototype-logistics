# Canvas V3 全生命周期 E2E 测试设计

**日期**: 2026-04-10
**状态**: Approved
**前置**: Canvas V3+V4 已部署 prod (17 commits on feat/canvas-v3-v4-full-configurability)
**范围**: 新工厂开通 → Canvas 配置 → 业务验证 → 需求变更 → 变更后验证

---

## 1. 测试架构

### 双层测试策略

| 层 | 方式 | 覆盖内容 | E2E Skill 约束 |
|---|---|---|---|
| **L0 基础设施** | API 调用 (curl/Node.js) | 工厂创建、Canvas 配置、DDL 执行、发布流程 | 不受约束 — 基础设施配置非业务 CRUD |
| **L2-L4 业务验证** | Playwright 浏览器 | 动态字段渲染、表单提交、校验拦截、子表操作、权限过滤 | 完全遵守 E2E Skill 规则 |

### E2E Skill 合规要求

| 规则 | 执行方式 |
|------|---------|
| API 禁用于 CRUD | Phase 2/4 全部 Playwright 浏览器操作 |
| 6 行证据结构 | 每个 CRUD: filled/toast/API/list after/validation/screenshot |
| WARN = FAIL | 最终报告 WARN > 0 → exit code 1 |
| 截图强制 | 每个 CRUD 操作至少 2 张 (表单 + 结果) |
| 覆盖矩阵 | 测试前后打印，标注实际执行范围 |
| 前后端校验一致 | 动态字段 required 属性 vs 前端 ★ 标记 |

### 覆盖矩阵

```
Canvas V3 全生命周期测试 — 模块覆盖矩阵
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 模块               L0配置  L2CRUD  L3跨模块  L4流程  备注
 sales_order        ✅      ✅       -         ✅      主测模块: 动态字段+子表+校验+显隐+权限
 bom                ✅      ✅       -         -       辅测模块: 子表
 production_plan    -       -        -         -       本次不测
 purchase_order     -       -        -         -       本次不测
 ... (其余 12 模块本次不在 scope)

 聚焦: Canvas V3 动态字段 / 子表 / 校验规则 / 条件渲染 / 权限过滤 / DDL 执行
```

---

## 2. 前置条件

### 2.1 服务器环境

```bash
# 修复 internal.api.key 环境变量
ssh root@47.100.235.168 "
  # 在 cretas-backend-green.service 加 INTERNAL_API_KEY
  grep -q 'INTERNAL_API_KEY' /etc/systemd/system/cretas-backend-green.service || \
    sed -i '/INTERNAL_API_SECRET/a Environment=INTERNAL_API_KEY=cretas-internal-sec-87a9caca9f57b1f2' \
    /etc/systemd/system/cretas-backend-green.service
  # 同步到 cretas-backend.service (blue)
  grep -q 'INTERNAL_API_KEY' /etc/systemd/system/cretas-backend.service || \
    sed -i '/INTERNAL_API_SECRET/a Environment=INTERNAL_API_KEY=cretas-internal-sec-87a9caca9f57b1f2' \
    /etc/systemd/system/cretas-backend.service
  systemctl daemon-reload
"

# 确认 canvas 表已存在
ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas_user -d cretas_prod_db \
  -c \"SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'canvas%';\""
# 预期: canvas_dynamic_field, canvas_ddl_log
```

### 2.2 测试凭证

| 用途 | 值 |
|------|-----|
| Internal API Key | `cretas-internal-sec-87a9caca9f57b1f2` |
| 后端 URL | `http://139.196.165.140:8086/api/mobile` (通过 nginx) |
| 直连 URL | `http://47.100.235.168:10020/api/mobile` (当前 active green) |
| Web-Admin | `http://139.196.165.140:8086` |
| 默认密码 | `123456` |

### 2.3 @Value 映射说明

`OnboardingController` 使用 `@Value("${internal.api.key}")`:
- Spring Boot relaxed binding: 环境变量 `INTERNAL_API_KEY` → 属性 `internal.api.key`
- 如果未配置: 默认随机 UUID (每次启动不同)
- 配置后需重启服务生效

---

## 3. Phase 1: L0 基础设施 (API 层)

### 1.1 创建测试工厂

```
POST http://47.100.235.168:10020/api/internal/onboarding/create-factory
Header: X-Internal-Key: cretas-internal-sec-87a9caca9f57b1f2
Header: Content-Type: application/json
Body: {
  "factoryName": "Canvas测试食品厂",
  "industryCode": "FOOD",
  "regionCode": "3101",
  "contactName": "Canvas测试管理员",
  "contactPhone": "13800000099"
}

预期响应:
{
  "success": true,
  "data": {
    "factoryId": "FOOD_3101_xxx",     // 自动生成
    "users": [{
      "username": "...",               // 记录用于后续登录
      "role": "factory_super_admin"
    }]
  }
}

记录: FACTORY_ID, ADMIN_USERNAME, ADMIN_PASSWORD
```

### 1.2 用新工厂管理员登录获取 Token

```
POST /api/mobile/auth/unified-login
Body: {"username": ADMIN_USERNAME, "password": "123456"}
→ 记录 TOKEN

验证: success=true, accessToken 非空
```

### 1.3 应用行业模板

```
POST /api/mobile/{FACTORY_ID}/config/v2/apply-template/food_processing
Header: Authorization: Bearer {TOKEN}

验证: GET /config/v2/tools 返回工具列表
```

### 1.4 创建动态字段 (4 条)

所有请求通过服务器 localhost 执行 (避免 nginx POST body 问题):

```bash
ssh root@47.100.235.168 "curl -s -X POST -H 'Authorization: Bearer {TOKEN}' \
  -H 'Content-Type: application/json' \
  'http://localhost:10020/api/mobile/{FACTORY_ID}/config/v2/dynamic-fields' \
  -d '{JSON}'"
```

字段 1: 客户等级 (SELECT)
```json
{"moduleCode":"sales_order","fieldCode":"customer_level","fieldType":"SELECT",
 "label":"客户等级","config":{"options":[{"value":"A","label":"A级"},{"value":"B","label":"B级"},{"value":"C","label":"C级"}]}}
```

字段 2: 交货优先级 (TEXT)
```json
{"moduleCode":"sales_order","fieldCode":"delivery_priority","fieldType":"TEXT","label":"交货优先级"}
```

字段 3: 预期毛利率 (DECIMAL)
```json
{"moduleCode":"sales_order","fieldCode":"expected_margin","fieldType":"DECIMAL","label":"预期毛利率"}
```

字段 4: 预付款记录 (SUB_TABLE)
```json
{"moduleCode":"sales_order","fieldCode":"prepayment_records","fieldType":"SUB_TABLE",
 "label":"预付款记录","config":{"columns":[
   {"code":"amount","label":"金额","type":"DECIMAL"},
   {"code":"date","label":"日期","type":"DATE"},
   {"code":"remark","label":"备注","type":"TEXT"}]}}
```

验证:
```
GET /config/v2/dynamic-fields?moduleCode=sales_order
→ 4 条, 全部 status=PENDING_DDL
```

### 1.5 创建校验规则

```
PUT /config/v2/validation-rules/so_amount_min
Body: {"moduleCode":"sales_order","operation":"CREATE",
       "condition":"totalAmount >= 100","errorMessage":"订单金额不能低于100元",
       "severity":"BLOCK","enabled":true,"sortOrder":1}

验证: GET /validation-rules?moduleCode=sales_order 含此规则
```

### 1.6 配置条件显隐

```
PUT /config/v2/dynamic-fields/expected_margin
Body: {"moduleCode":"sales_order","visibleWhen":"customer_level == 'A'"}

验证: GET /dynamic-fields → expected_margin.visibleWhen 有值
```

### 1.7 配置触发链

```
PUT /config/v2/trigger-chains/so_confirmed_chain
Body: {"eventType":"SalesOrderConfirmedEvent","enabled":true,
       "steps":[{"order":1,"tool":"scheduling_list","condition":"","enabled":true,"params":{}}],
       "errorStrategy":"CONTINUE"}

验证: GET /trigger-chains 含此链
```

### 1.7b 创建聚合公式

```
PUT /config/v2/formulas/tax_group_sum
Body: {"moduleCode":"sales_order","formulaCode":"tax_group_sum",
       "expression":"GROUP_BY(sales_order_items, 'tax_rate', SUM('amount'))",
       "resultType":"AGGREGATE","precisionVal":2}

验证: GET /formulas?moduleCode=sales_order 含 tax_group_sum, resultType=AGGREGATE
```

### 1.7c 配置 Tab 布局

```
PUT /config/modules/sales_order (通过 ConfigController)
Body: {"layoutConfig":{"tabs":[
  {"code":"basic","label":"基本信息","type":"fields"},
  {"code":"payment","label":"预付款记录","type":"sub_table","fieldCode":"prepayment_records",
   "columns":[{"code":"amount","label":"金额","type":"DECIMAL"},{"code":"date","label":"日期","type":"DATE"},{"code":"remark","label":"备注","type":"TEXT"}]}
]}}

验证: GET /config/modules/sales_order/effective → layoutConfig.tabs 包含 2 个 tab
```

### 1.7d 配置 computedWhen

```
PUT /config/v2/dynamic-fields/delivery_priority
Body: {"moduleCode":"sales_order",
       "computedWhen":"customer_level == 'A' ? '加急' : '普通'"}

验证: GET /dynamic-fields → delivery_priority.computedWhen 有值
```

### 1.7e 通过 AI Chat 添加字段 (AI Tool 验证)

```
POST /config/v2/ai/chat
Body: {"mode":"autopilot","message":"给销售订单加一个订单备注字段，文本类型"}

验证:
  - AI 返回包含 canvas_add_field 调用
  - GET /dynamic-fields?moduleCode=sales_order → 新增 1 条 (order_remark 或类似)
  - status=PENDING_DDL
```

### 1.8 变更集 → 审批 → 应用 → 发布

```
Step A: POST /config-changes
Body: {"configType":"RULE","configId":"canvas-v3-init",
       "configName":"Canvas V3 初始配置",
       "afterSnapshot":"{\"dynamicFields\":4,\"rules\":1,\"triggers\":1}"}
→ 记录 CHANGESET_ID

Step B: POST /config-changes/{CHANGESET_ID}/approve
Body: {"comment":"Canvas V3 初始配置审批通过"}

Step C: POST /config-changes/{CHANGESET_ID}/apply

Step D: POST /config/publish?summary=Canvas+V3+initial+publish
→ 执行 DDL:
  ALTER TABLE sales_orders ADD COLUMN cf_customer_level VARCHAR(100)
  ALTER TABLE sales_orders ADD COLUMN cf_delivery_priority VARCHAR(500)
  ALTER TABLE sales_orders ADD COLUMN cf_expected_margin NUMERIC(18,4)
  CREATE TABLE sales_order_prepayment_records_items (...)
```

验证:
```
GET /config/v2/ddl-log → 4 条 status=EXECUTED
GET /config/v2/dynamic-fields?moduleCode=sales_order → 全部 ACTIVE
psql: \d sales_orders → 含 cf_customer_level, cf_delivery_priority, cf_expected_margin
psql: \dt sales_order_prepayment_records_items → 表存在
```

### 1.9 有效配置验证

```
GET /config/modules/sales_order/effective?roleCode=factory_super_admin

验证:
  - fields 包含 JPA 字段 (customerName, orderDate...) source="jpa"
  - fields 包含动态字段 (customer_level, delivery_priority, expected_margin) source="dynamic"
  - customer_level.options = [{value:"A",label:"A级"}, ...]
  - expected_margin.visibleWhen = "customer_level == 'A'"
```

---

## 4. Phase 2: L2-L4 业务验证 (Playwright 浏览器)

### 2.1 登录新工厂

```
action: 打开 http://139.196.165.140:8086 → 输入用户名密码 → 登录
evidence:
  - filled: 用户名={ADMIN_USERNAME}, 密码=123456
  - toast: "登录成功" 或跳转到首页
  - screenshot: P2-01-login-success.png
result: ✅/❌
```

### 2.2 创建销售订单 (含动态字段)

```
action: 侧边栏 → 销售管理 → 销售订单 → 新建按钮 → 填写表单 → 提交
evidence:
  - filled: 客户名=Canvas测试客户, 订单日期=2026-04-10,
            产品=任意现有产品, 数量=100, 单价=50,
            客户等级=A (动态 SELECT), 交货优先级=加急 (动态 TEXT)
  - toast: "创建成功" / "操作成功"
  - API: HTTP 200, success=true
  - list after: 刷新页面, 列表包含"Canvas测试客户"行
  - validation: 前端★必填标记 vs 后端@NotNull = [记录结果]
  - screenshot: P2-02a-so-form.png, P2-02b-so-list.png
result: ✅/❌
```

### 2.3 验证动态字段持久化

```
action: 列表点击刚创建的订单 → 详情页
evidence:
  - detail: 客户等级=A (回显), 交货优先级=加急 (回显)
  - screenshot: P2-03-so-detail-dynamic.png
result: ✅/❌
```

### 2.4 验证条件显隐

```
action: 编辑订单 → 客户等级切换 A→B → 观察"预期毛利率"
evidence:
  - 客户等级=A 时: 预期毛利率字段存在于 DOM
  - 客户等级=B 时: 预期毛利率字段从 DOM 消失
  - screenshot: P2-04a-visible-A.png, P2-04b-hidden-B.png
result: ✅/❌
```

### 2.5 验证校验规则拦截

```
action: 新建订单 → 金额填 50 → 提交
evidence:
  - filled: 金额=50
  - toast: "订单金额不能低于100元"
  - API: HTTP 400 或 error response
  - list after: 列表未新增行 (拦截成功)
  - screenshot: P2-05-validation-block.png
result: ✅/❌
```

### 2.6 子表 CRUD

**2.6a 添加行**
```
action: 订单详情 → 预付款记录 tab → "添加行" → 填写 → 保存
evidence:
  - filled: 金额=2000, 日期=2026-04-10, 备注=定金
  - toast: 保存成功 (或行出现在表格)
  - list after: 子表显示 1 行, 金额=2000
  - screenshot: P2-06a-subtable-add.png
result: ✅/❌
```

**2.6b 编辑行**
```
action: 点击金额单元格 → 改为 2500 → 保存
evidence:
  - filled: 金额=2500
  - list after: 金额更新为 2500
  - screenshot: P2-06b-subtable-edit.png
result: ✅/❌
```

**2.6c 删除行**
```
action: 点击删除按钮 → 确认
evidence:
  - list after: 子表 0 行 (或减少 1 行)
  - screenshot: P2-06c-subtable-delete.png
result: ✅/❌
```

### 2.7 权限过滤验证

```
action: 退出登录 → 用仓库管理员账号登录 → 进入同一订单详情
evidence:
  - 预期毛利率字段不存在于页面 (权限过滤 hidden)
  - 其他字段正常显示
  - screenshot: P2-07-permission-warehouse.png
result: ✅/❌

注意: 需要先确认新工厂有仓库管理员角色的用户。
如果没有, 此步骤标记 SKIP (前置条件不满足), 不影响总判定。
```

### 2.8 验证聚合公式

```
action: 通过 API 调用聚合公式 (FormulaEngine 后端能力验证, 无对应 UI)
  POST /api/mobile/{FACTORY_ID}/formulas/evaluate
  Body: {"moduleCode":"sales_order","formulaCode":"tax_group_sum",
         "variables":{"parentId":"{orderId}","factoryId":"{FACTORY_ID}"}}

  如果无专用 evaluate 端点, 通过 AI Chat 触发:
  POST /config/v2/ai/chat
  Body: {"mode":"action","message":"计算订单 {orderId} 的税率分组汇总"}

evidence:
  - API: 返回按 tax_rate 分组的 SUM 结果 (或 AI 返回计算结果)
  - 如果 sales_order_items 无 tax_rate 列: 标记 KNOWN_BUG (预置数据不足)
result: ✅/❌/KNOWN_BUG
```

### 2.9 验证 computedWhen

```
action: 编辑订单 → 客户等级切换 A→B → 观察"交货优先级"显示值
evidence:
  - 客户等级=A 时: 交货优先级显示值 = "加急" (computedWhen 计算)
  - 客户等级=B 时: 交货优先级显示值 = "普通"
  - screenshot: P2-09a-computed-A.png, P2-09b-computed-B.png
result: ✅/❌

如果 SchemaFormRenderer 未渲染 computedWhen:
→ KNOWN_BUG: "SchemaFormRenderer computedWhen 显示未生效"
```

### 2.10 验证 Tab 布局

```
action: 订单详情页 → 检查是否按 layoutConfig.tabs 渲染为 el-tabs
evidence:
  - tab 1: "基本信息" (字段分组)
  - tab 2: "预付款记录" (子表)
  - screenshot: P2-10-tab-layout.png
result: ✅/❌

如果 DynamicModulePage 未使用 TabLayoutRenderer:
→ KNOWN_BUG: "layoutConfig.tabs 未驱动渲染"
→ 子表 CRUD 仍通过直接访问验证 (2.6 已覆盖)
```

---

## 5. Phase 3: 需求变更 (API 层)

### 3.1 添加附件字段

```
POST /config/v2/dynamic-fields
Body: {"moduleCode":"sales_order","fieldCode":"contract_attachment",
       "fieldType":"ATTACHMENT","label":"合同附件",
       "config":{"accept":".pdf,.doc,.docx","maxSize":10485760,"maxCount":3}}

验证: status=PENDING_DDL
```

### 3.2 修改校验阈值

```
PUT /config/v2/validation-rules/so_amount_min
Body: {"moduleCode":"sales_order","operation":"CREATE",
       "condition":"totalAmount >= 500","errorMessage":"订单金额不能低于500元",
       "severity":"BLOCK","enabled":true,"sortOrder":1}

验证: GET 返回 condition 含 "500"
```

### 3.3 给 BOM 加变更记录子表

```
POST /config/v2/dynamic-fields
Body: {"moduleCode":"bom","fieldCode":"change_records","fieldType":"SUB_TABLE",
       "label":"变更记录","config":{"columns":[
         {"code":"change_date","label":"变更日期","type":"DATE"},
         {"code":"change_type","label":"变更类型","type":"TEXT"},
         {"code":"description","label":"说明","type":"TEXT"},
         {"code":"operator","label":"操作人","type":"TEXT"}]}}

验证: status=PENDING_DDL
```

### 3.4 变更集 → 审批 → 发布

```
POST /config-changes → CHANGESET_ID_2
POST /config-changes/{CHANGESET_ID_2}/approve
POST /config-changes/{CHANGESET_ID_2}/apply
POST /config/publish?summary=V3+add+attachment+modify+rules

验证:
  GET /config/v2/ddl-log → 新增 2 条 EXECUTED (总计 6 条)
  GET /config/v2/dynamic-fields → 总计 6 个 ACTIVE (4 原有 + 1 attachment + 1 bom sub_table)
```

---

## 6. Phase 4: 变更后验证 (Playwright 浏览器)

### 4.1 旧数据完整性

```
action: 管理员登录 → 进入 Phase 2 创建的订单详情
evidence:
  - detail: 客户等级=A (旧动态字段仍在)
  - detail: 交货优先级=加急 (旧动态字段仍在)
  - screenshot: P4-01-old-data-intact.png
result: ✅/❌
```

### 4.2 新附件字段

```
action: 编辑订单 → 找到"合同附件"上传区域 → 上传 test.pdf
evidence:
  - filled: 合同附件=test.pdf (或任意小文件)
  - toast: 上传成功
  - detail: 附件链接/文件名可见
  - screenshot: P4-02-attachment-upload.png
result: ✅/❌

如果 web-admin 的 SchemaFormRenderer 未渲染 attachment 类型:
→ 标记 KNOWN_BUG: "SchemaFormRenderer 未处理 type=attachment 渲染"
→ 记录 expected: el-upload 组件, actual: 无渲染
```

### 4.3 新校验阈值生效

```
action: 新建订单 → 金额填 300 → 提交
evidence:
  - filled: 金额=300
  - toast: "订单金额不能低于500元" (不是旧的 100)
  - API: HTTP 400 或 error, message 含 "500"
  - screenshot: P4-03-validation-500.png
result: ✅/❌
```

### 4.4 BOM 子表

```
action: 进入 BOM 管理 → 选一个 BOM 记录 → 变更记录 tab → 添加记录
evidence:
  - filled: 变更日期=2026-04-10, 变更类型=配方调整, 说明=辅料比例改, 操作人=张权
  - toast: 保存成功
  - list after: 子表 1 条记录
  - screenshot: P4-04-bom-subtable.png
result: ✅/❌

如果 BOM 页面无"变更记录" tab:
→ 标记 KNOWN_BUG: "BOM 详情页未读取 layoutConfig.tabs 渲染 sub_table tab"
→ 仍通过 API 验证子表 CRUD 功能: POST /bom/{bomId}/sub-table/change_records
```

### 4.5 全量一致性 (API)

```
GET /config/v2/dynamic-fields → 7+ 个 ACTIVE (4 原始 + 1 AI创建 + 1 attachment + 1 bom sub_table)
GET /config/v2/ddl-log → 7+ 条 EXECUTED
psql: SELECT COUNT(*) FROM canvas_dynamic_field WHERE status='ACTIVE' AND factory_id='{FACTORY_ID}'
psql: SELECT COUNT(*) FROM canvas_ddl_log WHERE status='EXECUTED' AND factory_id='{FACTORY_ID}'

验证: 前后一致
```

---

## 7. 判定标准

### 总体通过条件 — V3 七大能力全覆盖

| # | V3 能力 | 检查点 | PASS 条件 | 测试步骤 | 权重 |
|---|---------|--------|----------|---------|------|
| 1 | 动态字段 | 工厂创建 | factoryId 返回 + 用户可登录 | 1.1 | P0 |
| 2 | 动态字段 | 字段创建 | 4+ 条 PENDING_DDL | 1.4 | P0 |
| 3 | 动态字段 | DDL 执行 | publish 后全部 EXECUTED | 1.8 | P0 |
| 4 | 动态字段 | 有效配置合并 | JPA + dynamic 混合返回 | 1.9 | P0 |
| 5 | 动态字段 | UI 渲染 | 表单中显示动态 SELECT/TEXT | 2.2 | P0 |
| 6 | 动态字段 | 持久化 | custom-fields PUT/GET + 详情回显 | 2.3 | P0 |
| 7 | 校验规则 | 拦截 | BLOCK 阻止提交 + 正确信息 | 2.5 | P0 |
| 8 | 条件渲染 | visibleWhen | SpEL 前端正确评估 | 2.4 | P1 |
| 9 | 条件渲染 | computedWhen | 动态计算值随字段切换 | 2.9 | P1 |
| 10 | 子表 | CRUD | 增删改查全通 | 2.6 | P0 |
| 11 | 子表 | Tab 渲染 | layoutConfig.tabs 驱动 el-tabs | 2.10 | P1 |
| 12 | 聚合公式 | GROUP_BY+SUM | 聚合结果正确 | 2.8 | P1 |
| 13 | 用户权限 | 角色过滤 | 不同角色看到不同字段 | 2.7 | P1 |
| 14 | 文件上传 | attachment | type=attachment 渲染 + 上传 | 4.2 | P1 |
| 15 | Tab 布局 | layoutConfig | tabs 结构化配置生效 | 1.7c + 2.10 | P1 |
| 16 | AI Tools | AI Chat | canvas_add_field 被调用 | 1.7e | P1 |
| 17 | 二次发布 | 变更后 DDL | 新增 2 条 + 旧数据不丢 | 3.4 + 4.1 | P0 |
| 18 | 二次发布 | 新校验生效 | 500 替换 100 | 4.3 | P0 |
| 19 | 二次发布 | BOM 子表 | 变更记录子表可用 | 4.4 | P1 |

### V3 七大能力覆盖矩阵

```
能力                  Phase1配置  Phase2验证  Phase3变更  Phase4再验
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 动态字段 (DDL)     1.4 创建    2.2 渲染    3.1 追加    4.1 不丢
                      1.8 DDL     2.3 持久化              4.2 新字段
2. 子表               1.4 创建    2.6 CRUD    3.3 BOM     4.4 BOM
3. 用户级权限         -           2.7 角色     -           -
4. 文件上传           -           -           3.1 追加    4.2 上传
5. 条件渲染           1.6 配置    2.4 显隐    -           -
                      1.7d 计算   2.9 计算
6. 聚合公式           1.7b 创建   2.8 验证    -           -
7. Tab 布局           1.7c 配置   2.10 渲染   -           -

AI Tools              1.7e Chat   -           -           -
变更集流程            1.8 完整    -           3.4 完整    -
```

### PASS 阈值

- **P0 全部 PASS (9 项)**: 测试通过 — V3 核心能力验证
- **P1 允许 KNOWN_BUG (10 项)**: 最多 3 个 KNOWN_BUG (UI 集成问题), 不影响 P0 通过
- **任何 P0 FAIL**: 测试不通过, 需修复后重测

### KNOWN_BUG 预期 (可能出现)

Canvas V3 前端组件是新建的, 可能的 UI 集成问题:
1. DynamicModulePage 未读取 layoutConfig.tabs → 子表 tab 不渲染 (P1-11)
2. SchemaFormRenderer 的 attachment/sub_table 类型可能需要额外集成 (P1-14)
3. computedWhen 前端显示可能未完全接通 (P1-9)
4. 新工厂可能没有预置的仓库管理员用户 (P1-13)
5. sales_order_items 可能无 tax_rate 列, 聚合公式预置数据不足 (P1-12)

这些属于 P1 级别, 不阻塞 V3 后端核心验证。

---

## 8. 测试产出物

| 产出 | 路径 |
|------|------|
| 测试脚本 | `tests/canvas-v3-lifecycle-e2e.mjs` |
| 测试报告 | `test-canvas-v3-lifecycle-results.json` |
| 截图 | `tests/screenshots/canvas-v3/P2-*.png, P4-*.png` |
| 覆盖矩阵 | 嵌入测试报告 |
