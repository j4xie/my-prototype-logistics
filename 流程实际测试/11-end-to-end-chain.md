# 11. 端到端完整业务链路 (1 订单全程)

**目的**: 模拟真实业务场景, 从客户提需求到回款, **1 个订单跑完全部 6 段**
**耗时**: 60-90 min
**角色切换**: 7 次 (sales / admin / finance / purchase / warehouse / production / operator / foreman)
**用途**: 客户演示 / 验收测试 / 新员工培训

---

## 11.1 剧本: "永辉超市 · 黑胡椒牛肉酱订单"

### 场景背景
```
客户: 永辉超市
时间: 2026 年 4 月
需求: 开发新口味牛肉酱, 月底前交付 100 kg
关键字段:
  - 样品: 黑胡椒牛肉酱-V1
  - 产品规格: 200g/盒
  - 数量: 100 kg
  - 目标售价: 50 元/kg
  - 税率: 多税率 (原料 9% + 加工 13%)
  - 总价: 5000 元 (含税 3629 元为演示简化)
```

### 7 角色分工
| 步 | 角色 | 动作 |
|---|------|------|
| 1 | sales | 记录客户需求 |
| 2-4 | admin | 研发建样品 + 追踪 + 提交审核 |
| 5 | admin | 审核通过 → BOM + 报价任务 |
| 6 | sales | 核对报价, 建 SO |
| 7 | finance | 审核 SO |
| 8 | purchase | 采购原料, 触发三价预警 |
| 9 | finance | 审核采购单 |
| 10 | warehouse | 到货入库 |
| 11 | production | 下达生产 |
| 12 | operator | 报工完工 |
| 13 | foreman | 审批报工 → 成品入库 |
| 14 | sales | 新建发货单 |
| 15 | warehouse | 确认发货, SO→SHIPPED |
| 16 | sales | 一键按税率分组开票 (**杀手锏!**) |
| 17 | finance | 审核 2 张发票 + 开具 + 上传 PDF |
| 18 | finance | 录入收款 |
| 19 | admin | 追溯性验证 (从发票反查全链) |

---

## 11.2 执行

### 步 1: 发起研发需求 (sales) — 2 min

详见 [03-rd-sample.md §3.2](03-rd-sample.md)

- 登录 `sales / 123456`
- `/rd/samples` → Tab "研发需求" → "新建研发需求"
- 填: 客户=`永辉超市`, 需求=`开发新口味黑胡椒牛肉酱, 100kg, 月底交货`
- 提交 → ✅ Toast "研发需求已创建"

### 步 2: 研发建样品 (admin) — 3 min

详见 [03-rd-sample.md §3.3](03-rd-sample.md)

- **切账号**: 退登 → `admin`
- Tab "样品管理" → "新建样品"
- 填: 样品=`黑胡椒牛肉酱-V1`, 客户=`永辉超市`, 规格=`200g/盒`, 级别=`A`, 储存=`冷藏`
- 创建 → ✅ Toast "样品已创建"
- 记下 **sampleId**

### 步 3: 追踪记录 × 2 (admin) — 2 min

详见 [03-rd-sample.md §3.4](03-rd-sample.md)

- Day 1: `完成 V1 配方调试, 外观红亮, 辣度中等`
- Day 2: `V2 微调花椒比例, 口感稳定, 准备送审`

### 步 4: 提交审核 (admin) — 1 min

详见 [03-rd-sample.md §3.5](03-rd-sample.md)

- 样品行 "提交审核" → ✅ `SUBMITTED`

### 步 5: 审核通过 (admin) — 1 min ⭐

详见 [03-rd-sample.md §3.6](03-rd-sample.md)

- 点 "通过" → 审核意见 `配方合格, 同意量产` → ✅
- ✅ Toast "**审核通过成功, 报价任务已自动创建**"
- ✅ 切 Tab "报价任务" 应见新任务

### 步 6: 创建 SO (sales) — 5 min

详见 [04-sales-order.md §4.2](04-sales-order.md)

- **切账号**: `sales`
- `/sales/orders` → "新建"
- 填:
  - 客户=`永辉超市`
  - 产品: 选步 5 审核通过的样品 (**关键! 验证链路 2**)
  - 数量=`100`, 单位=`kg`, 单价=`50`
  - 交货日期: 月底
  - 业务员=`sales`
  - 备注=`Part 2 E2E 测试订单`
- **关键**: 如果产品支持多明细, 添加:
  - 行 1: 原料 50kg × 30 (9% 税)
  - 行 2: 原料 40kg × 25 (9% 税)
  - 行 3: 加工服务 1 × 500 (13% 税)
  - 行 4: 包装 1 × 300 (13% 税)
- 保存 → ✅ Toast "创建成功"
- 确认订单 → DRAFT → CONFIRMED
- 提交财务审核 → PENDING_FINANCE_REVIEW
- 记下 **orderNumber**

### 步 7: 财务审核 SO (finance) — 2 min ⭐

详见 [04-sales-order.md §4.5](04-sales-order.md)

- **切账号**: `finance / 123456` + Ctrl+Shift+R 强刷
- 进 SO 详情
- 右上角 "审核通过" 绿按钮
- 输意见 `成本合理, 同意` → ✅
- ✅ 状态 `FINANCE_APPROVED`
- 时间线新增 "财务审核通过 @finance"

### 步 8: 采购原料 (purchase) — 5 min ⭐

详见 [05-procurement.md §5.2-5.3](05-procurement.md)

- **切账号**: `purchase`
- `/procurement/orders` → "新建"
- 填:
  - 供应商: 选一个
  - **关联销售订单**: 选步 6 的 SO (**关键! 验证链路 4**)
  - 明细行 1: 辣椒 50kg × 30 元 (故意高, 触发三价预警)
- 保存 → ✅
- 进详情 → 点开 "**三价对比分析**"
- ✅ 验证 BOM 标准价 / 移动均价 / 当前价 3 列都有值
- ✅ 验证 > 10% 偏差 `异常` 红 tag
- 提交财务审核

### 步 9: 财务审核采购单 (finance) — 1 min

详见 [05-procurement.md §5.5](05-procurement.md)

- **切账号**: `finance`
- 进采购单详情
- 看三价对比 (finance 也能看)
- 点 "**财务通过**" → ✅ `FINANCE_APPROVED`

### 步 10: 到货入库 (warehouse) — 3 min ⭐

详见 [05-procurement.md §5.6-5.7](05-procurement.md)

- **切账号**: `warehouse / 123456`
- 进采购单详情 → "**收货**"
- 实收数量 = 订购数量 (50kg)
- 确认收货 → ✅ 生成收货单
- 确认入库 → ✅ **库存 +50 + 批次生成** (链路 5 ⭐)

### 步 11: 生产计划 (production) — 3 min

详见 [06-production.md §6.2-6.3](06-production.md)

- **切账号**: `production`
- `/production/plans/list` → "新建计划"
- 填:
  - 产品: 同 SO
  - 数量=`100`
  - 主管=`foreman`
  - sourceType=`CUSTOMER_ORDER`
  - 关联 SO: 步 6 的 SO (**关键!**)
- 保存 → ✅
- 下达生产 → `IN_PROGRESS`

### 步 12: 报工 (operator) — 2 min

详见 [06-production.md §6.5](06-production.md)

- **切账号**: `operator`
- `/production/plans/{id}` → 找任务 → "报工"
- 填: 完工数量=`100`, 良品=`98`, 次品=`2`
- 提交 → ✅ `PENDING_APPROVAL`

### 步 13: 审批报工 (foreman 或 admin) — 2 min ⭐

详见 [06-production.md §6.6](06-production.md)

- **切账号**: `foreman` 或 `admin`
- `/production/approval` → 找报工记录 → "审批通过"
- ✅ **三联动** (链路 6 ⭐):
  - 成品库存 +100
  - 成品批次生成
  - 原料库存 -50 (BOM 消耗)

### 步 14: 新建发货单 (sales) — 3 min

详见 [07-shipment.md §7.2-7.3](07-shipment.md)

- **切账号**: `sales`
- 进 SO 详情 → Tab "销售出库"
- "**+ 新建发货单**"
- 填: 物流=`顺丰`, 明细自动预填
- 保存 → ✅
- "**批次分配**" → ✅ FIFO 自动预填 → 确认

### 步 15: 确认发货 (warehouse) — 2 min ⭐⭐

详见 [07-shipment.md §7.4](07-shipment.md)

- **切账号**: `warehouse`
- 进发货单 → "**确认发货**"
- (可选) 填物流单号
- ✅ **三联动** (链路 7 ⭐⭐):
  - SO 状态 `SHIPPED`
  - 成品库存 -100
  - 批次状态 `DEPLETED` 或 `PARTIAL_USED`

### 步 16: 税率分组开票 ⭐⭐⭐ (sales) — 3 min

详见 [09-killer-feature-g1.md](09-killer-feature-g1.md) 完整版

- **切账号**: `sales`
- 进 SO 详情 → Tab "**开票申请**"
- "**+ 一键开票申请 (按税率分组)**"
- 对话框: "**一键按税率分组开票**"
- ✅ **客户最爱画面**:
  - 卡片 1: `9% · 原料` | 不含税 ¥2500 | 税 ¥225 | **发票金额 ¥2725** (红粗体) | 2 行
  - 卡片 2: `13% · 加工费` | 不含税 ¥800 | 税 ¥104 | **发票金额 ¥904** (红粗体) | 2 行
- ✅ Toast "已按税率生成 2 组开票明细"
- ✅ Tab 列表出现 2 条 `PENDING_REVIEW`

### 步 17: 审核 + 开具 2 张发票 (finance) — 5 min

详见 [08-finance-invoice.md §8.3-8.4](08-finance-invoice.md) + [09-killer-feature-g1.md §9.6](09-killer-feature-g1.md)

- **切账号**: `finance`
- `/finance/invoices/list` → 2 条 `PENDING_REVIEW`
- 逐条:
  1. 点 "审核" → "审核通过" → ✅
  2. 点 "开具" → 上传 PDF (任意 .pdf) → ✅ `ISSUED`
- ✅ 两张都开完, PDF 都挂了

### 步 18: 验证 SO 回写 (sales) — 1 min

- **切账号**: `sales`
- 进 SO 详情 Tab "开票申请"
- ✅ 2 条发票都 `ISSUED`
- ✅ 每条都有 "下载" 按钮, 点能下 PDF
- ✅ SO 总状态 "**已开票**"

### 步 19: 录入收款 (finance) — 2 min ⭐

详见 [08-finance-invoice.md §8.6](08-finance-invoice.md)

- **切账号**: `finance`
- `/finance/payments/list` → "**录入收款**"
- 填:
  - 关联 SO: 步 6 的 SO
  - 金额 = `3629` (= 2725 + 904)
  - 方式: `银行转账`
  - 凭证号: `BANK-REF-E2E-{时间}`
- 确定 → ✅ Toast "收款登记成功"
- ✅ SO 状态 "**已结清**"

### 步 20: 追溯性验证 (admin) — 3 min

详见 [10-cross-module-dataflow.md §10.11](10-cross-module-dataflow.md)

- **切账号**: `admin`
- 从发票反查:
  - `/finance/invoices/list` → 点步 17 开具的发票之一
  - 关联链路: 发票 ← SO ← 发货 ← 生产 ← 采购 ← 样品 ← 研发需求
  - 每个链接点开能跳转
- 从 SO 正查:
  - SO 详情底部**时间线应有 20+ 事件**:
    1. 订单创建 @sales
    2. 订单确认
    3. 提交财务审核
    4. 财务审核通过 @finance
    5. 采购单 @purchase
    6. 三价预警触发
    7. 采购财务审核 @finance
    8. 收货 @warehouse
    9. 物料入库
    10. 生产计划 @production
    11. 下达生产
    12. 报工 @operator
    13. 报工审批 @foreman
    14. 成品入库 (自动)
    15. 发货单 @sales
    16. 批次分配 FIFO
    17. 确认发货 @warehouse
    18. SO → SHIPPED
    19. 开票申请 @sales (税率分组 2 组)
    20. 发票审核 @finance × 2
    21. 发票开具 + PDF × 2
    22. 收款 @finance
    23. SO → 已结清

---

## 11.3 E2E 总耗时: 约 45-60 min (不含等待)

### 时间分布
- 研发段 (1-5): ~10 min
- 销售段 (6-7): ~7 min
- 采购段 (8-10): ~10 min
- 生产段 (11-13): ~7 min
- 出库段 (14-15): ~5 min
- 财务段 (16-19): ~12 min
- 追溯段 (20): ~3 min

### 等待时间
- LLM 分析 (BI 看板): 10-20s
- 审核异步: 1-2s
- 批次分配: 1-2s

---

## 11.4 E2E checklist (40 项)

| # | 段 | 项目 | 账号 | 勾选 |
|---|---|------|------|------|
| 1 | 研发 | 1.1 需求创建 | sales | ☐ |
| 2 | 研发 | 1.2 样品创建 | admin | ☐ |
| 3 | 研发 | 1.3 追踪 × 2 | admin | ☐ |
| 4 | 研发 | 1.4 提交审核 | admin | ☐ |
| 5 | 研发 | 1.5 审核通过 → 自动报价任务 | admin | ☐ ⭐ |
| 6 | 销售 | 2.1 SO 创建 (多税率) | sales | ☐ ⭐ |
| 7 | 销售 | 2.2 产品下拉含新样品 | sales | ☐ |
| 8 | 销售 | 2.3 SO 审核通过 | finance | ☐ ⭐ |
| 9 | 采购 | 3.1 采购单创建关联 SO | purchase | ☐ |
| 10 | 采购 | 3.2 三价对比全值 | purchase | ☐ ⭐ |
| 11 | 采购 | 3.3 > 10% 偏差标红预警 | purchase | ☐ ⭐ |
| 12 | 采购 | 3.4 财务审核 | finance | ☐ |
| 13 | 采购 | 3.5 收货入库 | warehouse | ☐ ⭐ |
| 14 | 采购 | 3.6 库存+批次更新 | warehouse | ☐ ⭐ |
| 15 | 生产 | 4.1 生产计划关联 SO | production | ☐ |
| 16 | 生产 | 4.2 下达生产 | production | ☐ |
| 17 | 生产 | 4.3 报工 | operator | ☐ |
| 18 | 生产 | 4.4 报工审批通过 | foreman | ☐ ⭐ |
| 19 | 生产 | 4.5 成品库存+批次 | warehouse | ☐ ⭐ |
| 20 | 生产 | 4.6 原料 BOM 扣减 | warehouse | ☐ ⭐ |
| 21 | 出库 | 5.1 发货单创建 | sales | ☐ |
| 22 | 出库 | 5.2 FIFO 批次自动 | sales | ☐ |
| 23 | 出库 | 5.3 确认发货 | warehouse | ☐ ⭐⭐ |
| 24 | 出库 | 5.4 SO 状态 SHIPPED | - | ☐ ⭐⭐ |
| 25 | 出库 | 5.5 成品库存扣减 | warehouse | ☐ ⭐⭐ |
| 26 | 开票 | 6.1 G1 对话框弹出 | sales | ☐ ⭐⭐⭐ |
| 27 | 开票 | 6.2 2 张卡片显示 | sales | ☐ ⭐⭐⭐ |
| 28 | 开票 | 6.3 金额计算正确 | sales | ☐ ⭐⭐⭐ |
| 29 | 开票 | 6.4 2 条发票 PENDING_REVIEW | sales | ☐ |
| 30 | 开票 | 6.5 发票审核通过 × 2 | finance | ☐ |
| 31 | 开票 | 6.6 PDF 上传 × 2 | finance | ☐ ⭐ |
| 32 | 开票 | 6.7 SO 回写 2 个下载链接 | sales | ☐ ⭐ |
| 33 | 开票 | 6.8 下载 PDF 可用 | sales | ☐ |
| 34 | 收款 | 7.1 录入收款 | finance | ☐ ⭐ |
| 35 | 收款 | 7.2 SO 已结清 | finance | ☐ ⭐ |
| 36 | 追溯 | 8.1 发票反查跳转 | admin | ☐ |
| 37 | 追溯 | 8.2 SO 时间线 20+ 事件 | admin | ☐ ⭐⭐ |
| 38 | 全 | 整程 Console 0 error | - | ☐ ⭐⭐ |
| 39 | 全 | 整程 Network 无 4xx/5xx | - | ☐ ⭐⭐ |
| 40 | 全 | 无双前缀 URL | - | ☐ ⭐⭐ |

---

## 11.5 演示版本 (精简 30 min)

若时间紧 (客户现场演示), 可跳过某些步骤:

| 跳过 | 原因 |
|------|------|
| 追踪记录 × 2 | 1 条即可 |
| 三价同屏深度验证 | 看一眼就过 |
| 部分收款分笔 | 一次性录完 |
| 追溯反查 | 只看时间线 |

**演示重点**: 步 5 (自动报价任务) + 步 10 (三价预警) + 步 16 (**G1 税率分组**) + 步 20 (时间线)

---

## 11.6 下一步

跑完 E2E 后:
- [12-role-permission.md](12-role-permission.md) 用各角色交叉验证
- [16-full-checklist.md](16-full-checklist.md) 总 checklist 交付
