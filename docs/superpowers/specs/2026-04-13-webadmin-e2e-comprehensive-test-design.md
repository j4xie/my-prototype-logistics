# Web-Admin 综合 E2E 测试方案

**版本**: v1.0
**日期**: 2026-04-13
**目标**: 对 139.196.165.140:8086 web-admin 进行全覆盖 E2E 测试，覆盖所有权限账号 × 所有页面 × 所有功能(CRUD+业务流)
**测试工厂**: F003 (绿源食品, FACTORY 类型) — 工厂模块全开放
**执行方式**: 5 轮循环，每轮 7 步 (审计A→审计B→审计C→执行→审计结果→修复→审计修复)

---

## 1. 测试架构

### 1.1 分层模块化脚本

| 脚本 | 职责 | 输出 |
|------|------|------|
| `e2e-L1-accessibility.mjs` | 8 账号 × 全路由页面扫描 | `e2e-L1-results-{round}.json` |
| `e2e-L2-crud.mjs` | RW 账号做 CRUD + R 账号验证只读 + `-` 验证 403 | `e2e-L2-results-{round}.json` |
| `e2e-L3-cross-module.mjs` | 12 条跨模块数据流验证 | `e2e-L3-results-{round}.json` |
| `e2e-L4-business-flow.mjs` | 20 条端到端业务链路 | `e2e-L4-results-{round}.json` |
| `e2e-audit-compare.mjs` | 对比多轮结果趋势 | `e2e-audit-{round}.json` |

所有脚本使用 `chromium.launch({ headless: true })` 独立浏览器实例，互不干扰。

### 1.2 Evidence 标准 (E2E Skill 硬规则)

每个测试必须包含:

```
action: [具体操作]
evidence:
  - filled: 字段A=值1, 字段B=值2
  - toast: "exact toast message"
  - API: HTTP 200, success=true
  - list after: [刷新后数据可见/不可见]
  - validation: 前端required vs 后端NotNull = [YES/NO]
result: PASS / FAIL / KNOWN_BUG [reason]
```

**没有 evidence 的 PASS 视为 UNVERIFIED，必须重跑。**

---

## 2. 测试账号

| 账号 | 角色 | 密码 | 工厂 | Web登录 |
|------|------|------|------|---------|
| factory_admin1 | factory_super_admin | 123456 | F001 (RESTAURANT) | YES |
| hr_admin1 | hr_admin | 123456 | F001 | YES |
| dispatcher1 | dispatcher | 123456 | F001 | YES |
| warehouse_mgr1 | warehouse_manager | 123456 | F001 | YES |
| finance_mgr1 | finance_manager | 123456 | F001 | YES |
| viewer1 | viewer | 123456 | F001 | YES |
| operator1 | operator | 123456 | F001 | NO → /mobile-only |
| restaurant_admin1 | factory_super_admin | 123456 | F002 (RESTAURANT) | YES |

**F003 测试账号**: 需要在 Round 1 执行前创建（L4-01 新工厂链路）

---

## 3. 权限 × 操作矩阵

### 3.1 FACTORY 类型 (F003) — 工厂模块全开

| 模块 | factory_admin | dispatcher | warehouse_mgr | finance_mgr | hr_admin | viewer |
|------|:-:|:-:|:-:|:-:|:-:|:-:|
| dashboard | **RW** | RW | R | R | R | R |
| production | **RW** | RW | R | - | - | R |
| warehouse | **RW** | R | **RW** | - | - | R |
| quality | **RW** | R | - | - | - | R |
| procurement | **RW** | R | R | - | - | R |
| sales | **RW** | R | R | R | - | R |
| hr | **RW** | R | - | - | **RW** | - |
| equipment | **RW** | R | - | - | - | R |
| finance | **RW** | R | - | **RW** | - | - |
| system | **RW** | R | - | - | R | - |
| analytics | **RW** | RW | - | R | - | R |
| scheduling | **RW** | RW | R | - | - | R |
| restaurant | - | - | - | - | - | - |

**RW = CRUD 测试** | **R = 只读验证(无新建按钮)** | **- = 403 拦截验证**

### 3.2 RESTAURANT 类型 (F001) — 工厂模块屏蔽

production/warehouse/quality/equipment/scheduling 被 FACTORY_TYPE_MODULE_FILTER 屏蔽 → 403 (by design)

---

## 4. Layer 1: 页面可访问性 (~600 测试点)

### 4.1 路由清单 (94 条)

按模块分组的完整路由列表（省略详细列表，见本文件末尾附录 A）。

### 4.2 每账号测试逻辑

```
for each account:
  login(account)
  for each route:
    navigate(route)
    wait 3s (Vue render)
    check:
      - 不是 /403? → 页面有权限
      - 不是 /login? → session 有效
      - 不是 /404? → 路由存在
      - 无 .el-message--error? → 无报错
      - bodyLen > 10? → 非空白页
    record: { route, status, bodyLen, consoleErrors, networkErrors }
```

### 4.3 验收标准

- 有权限的页面: 100% PASS (无 ERROR_TOAST, 无空白)
- 无权限的页面: 100% 正确拦截到 /403
- operator1: 不能登录 web (→ /mobile-only)
- 0 console.error, 0 network 4xx/5xx (排除 by-design 的 factory type 403)

---

## 5. Layer 2: CRUD 操作 (~280 测试点)

### 5.1 RW 模块 CRUD (factory_admin + 各角色)

对每个有 RW 权限的模块执行:

| 操作 | 步骤 | Evidence 必须项 |
|------|------|----------------|
| **Create** | 点新建 → 填必填字段 → 提交 | `filled:` + `toast:` + `list after:` |
| **Read** | 列表有数据 + 点详情 → 字段值一致 | `detail:` 字段值 |
| **Update** | 点编辑 → 修改字段 → 提交 | `filled:` + `toast:` + `list after:` 更新值 |
| **Delete** | 点删除 → 确认 → 验证消失 | `toast:` + `list after:` 数据不可见 |

**失败处理**: 分析错误原因 → 补充缺失字段 → 重试(最多3次) → 仍失败标 KNOWN_BUG

### 5.2 R 模块只读验证

- 列表页能加载数据(或显示"暂无数据" empty state)
- **不存在** "新建"/"编辑"/"删除" 按钮 (存在 = 权限泄露 FAIL)

### 5.3 `-` 模块 403 验证

- 直接导航 URL → 被拦截到 /403

### 5.4 CRUD 模块明细

| 模块 | Create 实体 | 关键字段 |
|------|------------|---------|
| 采购订单 | PurchaseOrder | 供应商, 产品, 数量, 单价 |
| 采购-供应商 | Supplier | 名称, 联系人, 电话 |
| 采购-价格表 | PriceList | 供应商, 产品, 价格, 有效期 |
| 销售订单 | SalesOrder | 客户, 产品(多行), 数量, 单价, 税率 |
| 销售-客户 | Customer | 名称, 联系人, 地址 |
| 销售-运营报价 | OperationalQuote | 客户, 产品, BOM成本, margin |
| 生产计划 | ProductionPlan | 产品, 关联SO, 数量, 工序 |
| 生产批次 | ProductionBatch | 关联计划, PC批次号 |
| BOM配方 | Bom | 产品, 版本, 辅料明细(原料/辅料/包材 3tab) |
| 原材料批次 | MaterialBatch | 物料类型, 数量, 单价, 供应商 |
| 质检记录 | QualityInspection | 批次, 标准, 结果 |
| 质检标准 | QualityStandard | 名称, 项目, 阈值 |
| 员工 | User | 姓名, 角色, 部门, 电话 |
| 部门 | Department | 名称, 上级部门 |
| 设备 | Equipment | 名称, 类型, 位置 |
| 维护记录 | MaintenanceRecord | 设备, 类型, 描述 |
| 开票 | InvoiceRecord | 关联SO, 税率分组, 金额 |
| 收款 | PaymentRecord | 关联SO, 金额, 方式 |
| 产品 | ProductType | 名称, 类别, 单位 |
| 工序 | WorkProcess | 名称, 顺序 |

---

## 6. Layer 3: 跨模块数据流 (12 条)

| # | 源 | 操作 | 目标 | 验证 |
|---|-----|------|------|------|
| 1 | 客户管理 | 创建客户 | 销售订单 | 客户下拉包含新客户 |
| 2 | 供应商管理 | 创建供应商 | 采购订单 | 供应商下拉包含 |
| 3 | 产品管理 | 创建产品 | 销售订单 | 产品下拉包含 |
| 4 | 产品管理 | 创建产品 | BOM配方 | 成品下拉包含 |
| 5 | 员工管理 | 创建员工 | 部门管理 | 部门成员包含 |
| 6 | BOM配方 | 创建配方 | 生产计划 | BOM下拉包含 |
| 7 | 采购订单 | 创建采购单 | 应收应付 | AP记录出现 |
| 8 | 销售订单 | 创建销售单 | 应收应付 | AR记录出现 |
| 9 | 销售订单 | 创建销售单 | 出货记录 | 可关联出货 |
| 10 | 开票管理 | 创建发票 | 收款管理 | 可关联收款 |
| 11 | SmartBI | 上传Excel | AI问答 | 数据可查询 |
| 12 | 用户管理 | 创建用户 | 销售订单 | 销售员下拉包含 |

---

## 7. Layer 4: 业务链路 (20 条)

### L4-01: 新工厂开通+组织搭建
**来源**: v3 §3.1
**步骤**:
1. platform_admin 创建新工厂(FACTORY类型)
2. 创建部门: 生产部/仓储部/质检部/财务部/销售部
3. 创建各角色员工(factory_admin/dispatcher/warehouse_mgr/finance_mgr/hr_admin/viewer)
4. 各账号登录验证菜单正确(FACTORY模块全开)
**验证**: 6个账号全部登录成功 + 菜单符合权限矩阵

### L4-02: factoryId 行级隔离
**来源**: v3 P0-1
**步骤**:
1. 工厂A(F003)创建客户"测试客户A"
2. 切换到工厂B(F001)登录
3. 验证客户列表不包含"测试客户A"
4. 直接调用API GET /api/mobile/F003/customers → 403
**验证**: 跨工厂数据完全隔离

### L4-03: 研发样品→审核→BOM→报价
**来源**: 全流程文档§1, 会议1007s
**步骤**:
1. 创建研发样品(GPS牛腩, 录入配方30种辅料)
2. 样品审核通过
3. BOM自动生成(验证辅料按原料/辅料/包材3 tab分组)
4. 报价推送给运营部(指定人员, 非岗位)
5. 运营创建报价(含BOM成本+margin自动计算)
**验证**: BOM 3 tab 展示 + 报价关联样品

### L4-04: BOM版本管理
**来源**: 会议1265s
**步骤**:
1. 创建GPS牛腩配方v1(辣椒300g)
2. 修改为v2(辣椒→280g)
3. v1存档, v2激活
4. 创建生产计划 → 自动关联v2(不是v1)
**验证**: 生产用v2配方, v1不可选

### L4-05: 销售订单+SKU去重+财务审核
**来源**: v3 P0-7~9, 会议2906s
**步骤**:
1. 创建客户
2. 创建销售单(GPS牛腩×50盒 9%税 + 鱿鱼圈×30盒 13%税)
3. 尝试添加第二行GPS牛腩 → **验证去重校验报错**
4. 财务成本核算审核 → 通过
5. 验证3个状态字段(付款/开票/发货)
**验证**: SKU去重拦截 + 审核流程 + 状态字段

### L4-06: 销售订单驳回→修改→重审
**来源**: 全流程文档§2.2
**步骤**:
1. 创建销售单(单价过低)
2. 财务审核驳回
3. 销售修改单价
4. 重新提交 → 审核通过
**验证**: 驳回→修改→通过 全流程

### L4-07: 销售订单金额联动
**来源**: 会议2906s, v3 P0-9
**步骤**:
1. 创建销售单(总金额10000)
2. 未出库状态 → 验证显示"订单金额"10000
3. 部分出库(50%) → 验证显示"出库金额"5000
4. 全部出库 → 验证显示"出库金额"10000
**验证**: 金额随出库状态联动

### L4-08: 采购全链路+三价对比
**来源**: 全流程文档§3, v3 P2-1
**步骤**:
1. 创建供应商
2. 创建价格表
3. 创建采购单(关联SO, 3种辅料)
4. 验证三价同屏(BOM标准价/历史均价/当前价)
5. 财务审核通过
6. 到货分批入库
7. 验证库存增加 + AP生成
**验证**: 三价对比展示 + 财务审核 + 库存联动

### L4-09: 原料批次+移动均价+FIFO
**来源**: 会议2: 动态库存
**步骤**:
1. 入库辣椒批次1(¥10/kg × 100kg)
2. 入库辣椒批次2(¥12/kg × 50kg)
3. 验证移动均价 = (10×100 + 12×50) / 150 = ¥10.67
4. 领料时验证FIFO(先出批次1)
5. 查看物料均价趋势图
**验证**: 均价计算正确 + FIFO顺序 + 趋势图展示

### L4-10: 入库必须有发起单
**来源**: 会议4870s, v3 P0-17
**步骤**:
1. 仓库人员直接创建入库单(无关联采购单)→ **被拦截**
2. 从采购单发起入库 → 成功
**验证**: 无源单的入库被403拦截

### L4-11: 排产→物料需求单→备料→调拨→报工→退料 (生产6步)
**来源**: 会议3128s, v3 G3
**步骤**:
1. 创建生产计划(必须关联SO, 带PC批次)
2. 自动生成物料需求单
3. 仓库备料(按需求单)
4. 物流仓→车间仓调拨
5. 生产报工(累积式, per_process)
6. 多余原料退料回仓
**验证**: 6步链路全通 + 库存变动正确

### L4-12: 报工+良品率+出成率
**来源**: 会议1: 出成率, 会议2: 投入产出
**步骤**:
1. 工序1拆箱(投入100kg, 产出95kg, 良品90kg)
2. 验证出成率=95%, 良品率=90/95=94.7%
3. 验证三色标: 绿≥95% / 橙85-95% / 红<85%
4. 工序2卤制 → 工序3包装 → 完工入库
**验证**: 出成率+良品率计算正确 + 三色标正确

### L4-13: BOM达成率+工序投入产出
**来源**: 会议2: 达成率追踪
**步骤**:
1. 报工完成后查看BOM达成率页
2. 计划用辣椒28kg, 实际用30kg → 达成率93.3%
3. 验证超耗批次红色标记
4. 查看工序投入产出对比(4工序)
**验证**: 达成率数据正确 + 超耗标记 + 工序对比

### L4-14: 质检→废弃处理
**步骤**:
1. 创建质检标准(温度/菌落/外观)
2. 对生产批次执行质检
3. 外观不合格 → 废弃处理
4. 验证库存扣减
**验证**: 质检流程 + 库存联动

### L4-15: 出货→开票→发票回传→收款
**来源**: 全流程文档§5-6, 会议2585-2974s
**步骤**:
1. 成品出库 → 生成送货单
2. 开票申请(9%原料+13%加工费 税率分组)
3. 财务审核开票
4. 上传发票PDF → **回写到原销售订单**
5. 销售可下载发票
6. 收款(定金50% + 尾款50% + 上传凭证)
7. 订单标记"已结清"
**验证**: 税率分组开票 + PDF回传 + 分次收款 + 结清标记

### L4-16: SKU毛利率+成本分析
**来源**: 会议2: 财务核心需求
**步骤**:
1. 查看SKU毛利率页
2. 物料成本(移动均价×实际用量) + 人工成本(工时×时薪)
3. 对比售价 → 毛利率
4. 验证排名(鱿鱼圈37.6%最高 vs 带鱼段14.5%最低)
**验证**: 成本构成正确 + 毛利率排名

### L4-17: 周转耗材SKU化
**来源**: 会议3438s, v3 P1-2
**步骤**:
1. 创建"周转筐"为商品
2. 采购周转筐 → 入库
3. 随出货发出 → 客户签收
4. 客户归还 → 入库
5. 查看周转筐进销存
**验证**: 周转筐作为独立SKU的完整进销存

### L4-18: 双仓(物流仓+车间仓)
**来源**: 会议3225s, v3 P1-4
**步骤**:
1. 原料在物流仓
2. 调拨到车间仓
3. 生产领料(从车间仓)
4. 多余退料回物流仓
5. 20:00自动清仓(车间仓归零)
**验证**: 双仓调拨 + 车间仓清仓

### L4-19: SmartBI全链路
**步骤**:
1. 上传Excel数据
2. AI自动分析 → 生成图表
3. KPI看板展示
4. 趋势分析
5. What-If模拟
6. 供应链闭环总览
**验证**: 数据→分析→展示 全链路

### L4-20: 全角色端到端+权限边界
**来源**: 全流程文档§7, 会议1737s
**步骤**:
1. factory_admin 创建销售单
2. finance_mgr 审核通过
3. factory_admin 创建采购单
4. warehouse_mgr 入库
5. dispatcher 排产
6. dispatcher 报工
7. warehouse_mgr 出库
8. finance_mgr 开票+收款
9. viewer 全程只读验证(无写操作按钮)
10. **权限边界**: warehouse_mgr 改生产计划→403 / finance 改采购单→403 / viewer 所有写操作→403
**验证**: 多角色协作全通 + 越权操作全部403

---

## 8. 每轮循环流程 (5轮)

```
① 审计A: 方案自审 (覆盖度+规则合规)
② 审计B: Agent 独立审计方案
③ 审计C: 修复审计发现的方案问题
④ 执行: 运行 L1+L2+L3+L4
⑤ 审计E2E结果: 分析 FAIL/WARNING 根因，输出修复清单
⑥ 修复: 按清单修复所有 bug (前后端代码+部署)
⑦ 审计修复: 重跑 FAIL 子集验证修复+无回归
→ 通过后进入下一轮
```

### 8.1 轮间改进规则

- R1→R2: 修复所有 FAIL, 优化不稳定测试(timing/selector)
- R2→R3: 补充 R1+R2 遗漏的测试点, 加深 L4 验证
- R3→R4: 聚焦回归测试, 确认无新增 FAIL
- R4→R5: 最终稳定性验证, 生成覆盖基线
- R5 结束: 输出 5 轮趋势对比报告

### 8.2 通过标准

| 指标 | R1 | R2 | R3 | R4 | R5 (最终) |
|------|-----|-----|-----|-----|-----|
| L1 PASS 率 | ≥90% | ≥95% | ≥98% | 100% | 100% |
| L2 PASS 率 | ≥70% | ≥85% | ≥90% | ≥95% | ≥95% |
| L3 PASS 率 | ≥60% | ≥80% | ≥90% | ≥95% | ≥95% |
| L4 PASS 率 | ≥50% | ≥70% | ≥80% | ≥90% | ≥90% |
| 0 UNVERIFIED PASS | YES | YES | YES | YES | YES |
| 回归 (新FAIL) | N/A | ≤5 | ≤3 | ≤1 | 0 |

---

## 9. 报告格式

每轮生成标准报告:

```
=== E2E 验收报告 Round {N} ===
日期: {date}
平台: Web-Admin (http://139.196.165.140:8086)
工厂: F003 (绿源食品, FACTORY)

## 总计
L1: XX/YY PASS (ZZ%)
L2: XX/YY PASS (ZZ%)
L3: XX/YY PASS (ZZ%)
L4: XX/YY PASS (ZZ%)

## vs 上轮对比
新增 PASS: [list]
新增 FAIL: [list] (回归!)
修复确认: [list]

## Layer 1: 页面可访问性
[per-account results table]

## Layer 2: CRUD 操作
### [模块名] — [操作] — [账号]
  action: ...
  evidence:
    - filled: ...
    - toast: ...
    - list after: ...
  result: PASS / FAIL / KNOWN_BUG

## Layer 3: 跨模块数据
[per-flow results]

## Layer 4: 业务链路
[per-chain results with full evidence]

## 遗留问题
[KNOWN_BUG list with root cause]
```

---

## 附录 A: 完整路由清单

(见本对话上下文中 Explore agent 的输出，94 条路由完整列表)

## 附录 B: 权限矩阵原始数据

(见 `web-admin/src/store/modules/permission.ts` 完整定义)
