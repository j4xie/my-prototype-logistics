# 04. 段 2 — 销售订单创建 + 财务审核

**会议来源**: `研发样品至财务回款全流程文档.md` §2.1-2.2
**涉及角色**: sales (创建) / finance (审核)
**业务价值**: 订单驱动整个业务链 (采购 + 生产 + 出库 + 开票)
**耗时**: 15 min

---

## 4.1 订单状态流

```
[新建] DRAFT
    ↓ sales 点 "确认"
CONFIRMED
    ↓ sales 点 "提交财务审核"
PENDING_FINANCE_REVIEW
    ↓ finance 点 "审核通过" / "审核驳回"
    ├── FINANCE_APPROVED  → 进入段 3 (采购) / 段 4 (生产)
    └── FINANCE_REJECTED  → 退回 sales 修改

    ↓ (发货后)
SHIPPED (段 5 触发)
    ↓ (开票+收款后)
COMPLETED / 已结清
```

---

## 4.2 新建销售订单

### 前置
- **账号**: `sales / 123456`
- **URL**: `/sales/orders`
- **前置数据**: 客户列表至少 1 个 (F001 有 28 个, 放心)
- **可选前置**: 段 1 样品审核通过 (可关联)

### 步骤
1. 侧边栏 "**销售管理**" → "**销售订单**"
2. 点右上角 "**新建**" 按钮 (type=primary)
3. ⚠️ **注意**: 页面从列表视图**整页切换到创建视图**, 不是弹对话框 (Canvas V3 动态模块)

### 字段 (11 个)
| 字段 | 组件 | 必填 | 示例值 | 说明 |
|------|------|------|-------|------|
| 客户 | el-select (28+ 选项) | ✅ | `永辉超市` | 下拉加载 `/customers` |
| 产品 | el-select | ✅ | 选任意 | 联动规格/单位 |
| 数量 | el-input-number | ✅ (>0) | `100` | - |
| 单位 | el-input | ✅ | `kg` | 随产品变 |
| 单价 | el-input-number | ✅ (>0) | `50` | - |
| 交货日期 | el-date-picker | ⚪ | 7 天后 | - |
| 交货地址 | el-input | ⚪ | `上海市浦东新区测试路 123 号` | - |
| 业务员 | el-select (可搜索+自建) | ⚪ | `sales` | - |
| 含运费 | el-switch | ⚪ | 不勾 | 勾了才能填运费 |
| 运费 | el-input-number (v-if) | ⚪ | - | - |
| 额外费用 | 动态列表 | ⚪ | 添加 `装卸费 / 200 / 备注` | 可多行 |
| 备注 | el-input textarea | ⚪ | `Part 2 全流程 QA 测试` | - |

### 字段联动规则
- **产品** 选中后, **单位** 自动填充 (如选 "辣椒酱" → 单位 `kg`, 规格 `200g/盒`)
- **含运费** 勾 → 显示 "**运费**" 数字输入
- **额外费用** 点 "+" 添加一行, 每行含: 名称/金额/备注

### 操作
1. 填全必填字段
2. 添加至少 1 行产品明细
3. (可选) 添加额外费用
4. 点底部 "**保存**" 按钮

### ✅ PASS
- Toast: "**创建成功**"
- 自动返回列表
- 新订单行状态 `DRAFT`
- **Network**: `POST /api/mobile/F001/sales/orders` 返回 200
- **记下**: `orderNumber` 或 order.id (后续段全部要用这个订单)

### ❌ FAIL
- 必填空能提交 → 前端校验 bug (D2 /D10 类型)
- 400 "must not be blank" → 前端漏传字段
- **URL 双前缀** `/api/mobile/api/mobile/` → #4 bug 复活, 立即上报

### 记下
```
orderNumber: SO-xxxx
orderId: xxxx-uuid
客户: 永辉超市
产品: XXX
数量: 100 kg
单价: 50
总金额: 5000 + 额外费用
```

---

## 4.3 确认订单 (DRAFT → CONFIRMED)

### 前置
- **账号**: `sales`
- **前置状态**: 订单 `DRAFT`

### 步骤
1. 订单列表找 4.2 创建的订单
2. 点行操作列 "**确认**" 按钮
3. 弹确认框 "确认提交?"
4. 点 "**确定**"

### ✅ PASS
- Toast "**确认成功**"
- 状态变 `CONFIRMED`
- **Network**: `POST /api/mobile/F001/sales/orders/{id}/confirm` 200

### ❌ FAIL
- 状态未变 → 检查后端 workflow_config 配置

---

## 4.4 提交财务审核 (CONFIRMED → PENDING_FINANCE_REVIEW)

### 前置
- **账号**: `sales`
- **前置状态**: `CONFIRMED`

### 步骤
1. 订单列表点行 "**提交审核**" 按钮 (或进详情页点)
2. 弹确认框
3. 点 "**确定**"

### ✅ PASS
- Toast "**提交成功**"
- 状态变 `PENDING_FINANCE_REVIEW`
- **Network**: `POST /api/mobile/F001/sales/orders/{id}/submit-finance-review` 200

---

## 4.5 财务审核通过 ⭐ (核心环节)

### 前置
- **账号**: `finance / 123456` (**换号!**)
- **URL**: `/sales/orders/{orderId}/detail`
- **前置状态**: `PENDING_FINANCE_REVIEW`

### 路径 A: 审核通过

#### 步骤
1. **切账号**: 退登 sales → 登 `finance / 123456` → Ctrl+Shift+R 强刷
2. 进订单详情页 (列表点订单号进)
3. 详情页右上角应看到两个按钮 (**仅 PENDING_FINANCE_REVIEW 时显示**):
   - "**审核通过**" (success 绿色)
   - "**审核驳回**" (danger 红色)
4. 点 "**审核通过**"
5. 弹 `ElMessageBox.prompt()`: "**审核意见 (可选)**"
6. 输 `成本合理, 同意执行` (或留空)
7. 点 "**确定**"

#### ✅ PASS
- Toast "**审核通过**"
- 状态变 `FINANCE_APPROVED`
- **订单详情页底部时间线**新增:
  - 事件: `财务审核通过 @finance @时间`
  - 备注: 显示输入的审核意见
- 按钮消失 (状态不再是 PENDING_FINANCE_REVIEW)

#### Network
- `POST /api/mobile/F001/sales/orders/{id}/finance-approve` 200
- Body: `{"notes": "成本合理, 同意执行"}`

### 路径 B: 审核驳回

#### 步骤
1. 同 A 进详情页
2. 点 "**审核驳回**"
3. 弹 prompt: "**请输入驳回原因**" (**必填**)
4. 输 `单价过低, 请调高至 55`
5. 点 "**确定**"

#### ✅ PASS
- Toast "**驳回成功**"
- 状态变 `FINANCE_REJECTED`
- 时间线新增 `财务审核驳回 @finance 原因: ...`
- 销售账号可看到订单回退, 修改后可重新提交

#### 驳回原因空校验
- 驳回**必填**原因, 为空点确定应报 "请输入驳回原因"

---

## 4.6 成本自动拉取验证 ⚠️ (部分实现)

### 会议需求
"系统自动动作: 拉取该产品对应的 BOM 标准成本、历史生产成本，自动计算订单总成本及预期利润, 为财务审核提供数据支撑."

### 实际实现
- 订单详情页**只显示最终 "预估利润"**
- **没有**分项拆解:
  - BOM 标准成本 ❌
  - 历史生产成本 ❌
  - 总成本 / 预期利润 (合计有, 明细无)

### 验证
进详情页, 找 "**成本分析**" 或 "**利润预估**" 区:
- ✅ PASS: 有 `estimatedProfit` 数字
- ❌ FAIL: 没有任何成本信息 (严重)
- ⚠️ 部分: 只有 estimatedProfit, 无分项 (当前状态)

### V2 需求
详情页补 "**成本构成**" 折叠面板:
- BOM 标准成本: ¥XXX
- 历史均价成本: ¥XXX  
- 当前预计成本: ¥XXX
- 售价: ¥XXX
- 预估毛利率: XX%

---

## 4.7 订单详情页全功能检查

### 标签页 (Tabs)
订单详情页应有以下 Tab, 逐个点开验证:

| Tab | 内容 | 触发条件 |
|-----|------|---------|
| **基本信息** | 订单号/客户/产品/金额/状态 | 默认显示 |
| **订单明细** | 产品列表 + 数量 + 单价 + 小计 | - |
| **采购订单** | 关联的采购单 (如有) | 段 3 触发后显示 |
| **生产任务** | 关联的生产计划 | 段 4 触发后显示 |
| **销售出库** | 发货单列表 + 新建发货 | FINANCE_APPROVED 后可用 |
| **开票申请** | 发票列表 + ⭐ **一键开票申请(按税率分组)** | SHIPPED 后可用 |
| **收款记录** | 收款列表 + 新建收款 | 开票后可用 |
| **审批进度 / 时间线** | 20+ 事件时间线 | 底部固定显示 |

### 验证
- 每个 Tab 点开不应报错
- Tab 切换不触发 `TypeError: Failed to fetch` (Bug #2 修复验证)

---

## 4.8 跨账号验证 (可选深度)

### 用 viewer 账号看订单详情
1. 切账号 `viewer / 123456`
2. 进订单详情页

### ✅ PASS
- 详情显示, 但**按钮全隐藏** (只读)
- 无 "审核" / "确认" 按钮
- 时间线可看

### ❌ FAIL
- viewer 能看到操作按钮 (权限漏)
- viewer 403 整页 (权限过严)

### 用 warehouse 账号看订单
- 应能看, 但不能审核
- 可能能看"销售出库" Tab (仓库相关)

---

## 4.9 本节 Checklist (12 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 4.2 SO 创建 toast "创建成功" | sales | ☐ |
| 2 | 4.2 客户下拉 28+ 选项 | sales | ☐ ⭐ |
| 3 | 4.2 必填校验 (空字段应阻止提交) | sales | ☐ |
| 4 | 4.2 Network 无双前缀 | sales | ☐ ⭐⭐ |
| 5 | 4.3 DRAFT → CONFIRMED | sales | ☐ |
| 6 | 4.4 CONFIRMED → PENDING_FINANCE_REVIEW | sales | ☐ |
| 7 | 4.5 路径 A: finance 审核通过 | finance | ☐ ⭐ |
| 8 | 4.5 时间线显示审核事件 + 意见 | finance | ☐ |
| 9 | 4.5 路径 B: 驳回 + 原因必填 | finance | ☐ (可选) |
| 10 | 4.6 成本显示 (至少 estimatedProfit) | finance | ☐ |
| 11 | 4.7 详情页 Tab 切换无 error | finance | ☐ |
| 12 | 4.8 viewer 只读, 按钮隐藏 | viewer | ☐ (可选) |

⭐ = 核心, ⭐⭐ = 质量门

---

## 4.10 已知限制

| 项 | 影响 | V2 补救 |
|---|------|---------|
| 审核按钮不区分 finance 角色 | sales 也能审自己的 (理论漏洞) | 前端加 `v-if="isFinance"` |
| 成本无分项拆解 | 财务看不到 BOM/历史成本构成 | 详情页补面板 |
| 无 Workflow 配置 UI | 状态转换硬编码 | Canvas V3 支持 |

---

## 4.11 ⭐ SO 列表高级功能 (Agent 1 审计补充)

### 4.11.1 6 个智能筛选 Tab (P1-6)
列表顶部 Tab 组:
| Tab | 筛选规则 |
|-----|---------|
| 全部 | - |
| 未出库 | status IN (DRAFT, CONFIRMED, FINANCE_APPROVED) |
| 部分出库 | shippedQty > 0 && shippedQty < orderQty |
| 未收款 | paidAmount == 0 |
| 部分收款 | paidAmount > 0 && paidAmount < total |
| 已完成 | status=COMPLETED |

### ✅ PASS
- 每 Tab 切换列表筛选正确
- 数字显示每 Tab 订单数

### 4.11.2 行级快速操作
- 每行应有快速按钮: **快速出库** / **快速开票** / **快速收款**
- 点击弹相应对话框 (不需进详情)

### 4.11.3 ⭐ 取消订单
1. 状态 DRAFT 或 CONFIRMED 的订单行
2. 点 "**取消**" 按钮
3. 弹框填取消原因: `客户变更需求`
4. 确定
### ✅ PASS
- 状态变 `CANCELLED`
- API: `POST /sales/orders/{id}/cancel`
- 时间线新增取消事件

### 4.11.4 合同上传 (P1-7)
1. 创建 SO 时, 点 "**上传合同**"
2. 选 PDF/Word/图片
3. 保存
### ✅ PASS
- API: `POST /api/mobile/{factoryId}/upload/contract`
- SO 详情显示合同附件

### 4.11.5 SO 详情 5 个 Tab
| Tab | 说明 |
|-----|------|
| 订单详情 | 基本信息 |
| 开票申请 | (见 08) |
| 销售出库 | (见 07) |
| 收款记录 | (见 08) |
| **采购订单** | **关联的 PO** (之前漏了!) |
| 时间线 | 底部常驻 |

### 4.11.6 客户信息扩展字段 (创建客户时)
- 纳税号 taxNumber (开票必填)
- 开票地址
- 银行账户 bankAccount
- 信用额度 creditLimit
- 结算模式 paymentTerm (现结/月结/季结)

---

## 4.12 下一步

段 2 完成后:
- **订单状态**: `FINANCE_APPROVED`
- **下游分流**:
  - 原料够 → 直接段 4 [06-production.md](06-production.md) 生产
  - 原料缺 → 段 3 [05-procurement.md](05-procurement.md) 采购

推荐先走 [05-procurement.md](05-procurement.md) 走完整流程.
