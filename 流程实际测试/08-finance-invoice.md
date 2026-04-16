# 08. 段 6 — 开票 + 审核 + PDF 回写 + 收款

**会议来源**: `研发样品至财务回款全流程文档.md` §6.1-6.3
**涉及角色**: sales (申请) / finance (审核+开具+收款)
**前置**: SO 状态 SHIPPED, 段 5 发货完成
**耗时**: 15 min
**⭐ 关联**: [09-killer-feature-g1.md](09-killer-feature-g1.md) 税率分组开票 (本节会引用)

---

## 8.1 流程

```
SO 已 SHIPPED (段 5)
    ↓
sales 开票申请 (SO 详情 Tab "开票申请")
    ├── 普通开票 (单张) — 本节 8.2
    └── ⭐ 税率分组开票 G1 — [09-killer-feature-g1.md]
    ↓ 发票 status=PENDING_REVIEW
finance 审核
    ├── 通过 → status=APPROVED
    └── 驳回 → status=REJECTED
    ↓
finance 开具 (上传 PDF)
    ↓ status=ISSUED, PDF 回写 SO
sales 下载发票 (或转客户)
    ↓
finance 录入收款
    ↓ SO 状态 "已结清"
```

---

## 8.2 开票申请 (普通单张)

### 前置
- **账号**: `sales / 123456`
- **URL**: `/sales/orders/{orderId}/detail` → Tab "**开票申请**"
- **前置状态**: SO `SHIPPED`

### 步骤 (如果不走税率分组)
1. 切 `sales`
2. 进 SO 详情 Tab "**开票申请**"
3. 点 "**+ 新建开票申请**" 或类似按钮
4. 弹对话框

### 字段
| 字段 | 组件 | 必填 | 示例值 |
|------|------|------|-------|
| **发票类型** invoiceType | el-radio | ✅ | `NORMAL` (普通发票) / `VAT` (增值税专票) |
| 开票金额 amount | el-input-number | ✅ | 自动填 SO 总额 ¥5000 |
| **税率** taxRate | el-select | ✅ | 13% / 9% / 6% / 3% / 免税 |
| 客户名称 customerName | 自动填 | - | 永辉超市 |
| 客户税号 customerTaxNumber | el-input | ⚪ | `91310110123456789X` |
| 备注 remark | el-input textarea | ⚪ | `Part 2 开票测试` |

### 操作
1. 选 **发票类型**
2. 确认金额
3. 选 **税率** (单一税率)
4. 点 "**提交申请**"

### ✅ PASS
- Toast "**开票申请已提交**"
- Tab "开票申请" 列表多一条, status `PENDING_REVIEW`
- **Network**: `POST /api/mobile/F001/finance/invoices/request` 200

### 推荐走 09 而非本节
普通单税率**不能演示客户最强调的 G1 分组功能**. 推荐直接走 [09-killer-feature-g1.md](09-killer-feature-g1.md).

---

## 8.3 财务审核发票 (sales 提交后)

### 前置
- **账号**: `finance / 123456`
- **URL**: `/finance/invoices/list`
- **前置**: 发票 `PENDING_REVIEW`

### 步骤
1. 切 `finance`
2. 侧边栏 "**财务管理**" → "**开票管理**"
3. 列表找 status=`PENDING_REVIEW` 的发票
4. 点行 "**审核**" 按钮

### 路径 A: 审核通过
1. 点 "**审核通过**"
2. (可选) 输意见 `金额正确, 同意开具`
3. 点 "**确定**"

### ✅ PASS
- Toast "**审核通过**"
- 状态变 `APPROVED`
- **Network**: `POST /api/mobile/F001/finance/invoices/{id}/approve` 200

### 路径 B: 驳回
1. 点 "**驳回**"
2. 输原因 `金额有误, 差额 ¥200`
3. 点 "**确定**"

### ✅ PASS
- 状态变 `REJECTED`
- sales 可修改重新申请

---

## 8.4 开具发票 + PDF 上传

### 前置
- **账号**: `finance`
- **前置**: 发票 `APPROVED`

### 步骤
1. 发票列表找 `APPROVED` 行
2. 点 "**开具**" 按钮
3. 弹 PDF 上传对话框
4. 拖拽 `.pdf` 文件到上传区 (或点 "点击选择")
5. 上传完成显示预览或文件名
6. 点 "**确定**"

### ✅ PASS
- Toast "**开具成功**"
- 状态变 `ISSUED`
- 发票 URL 字段填充 (`invoicePdfUrl`)
- **Network**: `POST /api/mobile/F001/finance/invoices/{id}/issue` (multipart) 200

### ❌ FAIL
- 上传失败 → 检查 PDF 大小 (应 < 10MB), 格式是否 PDF
- 上传成功但字段未填 → 后端 MinIO/OSS 写入失败

---

## 8.5 发票回写 SO 验证 ⭐

### 前置
- 发票 `ISSUED`

### 步骤
1. 切回 `sales` 账号 (或 admin)
2. 进 SO 详情页 → Tab "**开票申请**"

### ✅ PASS ⭐
- 发票列表显示 `ISSUED` 状态
- 行末多了 "**下载发票**" 链接 (`row.invoicePdfUrl`)
- 点击链接可**下载 PDF**, 能打开
- 订单总体状态显示 "**已开票**"

### ❌ FAIL
- 发票列表无下载链接
- 下载 404

---

## 8.6 录入收款

### 前置
- **账号**: `finance`
- **URL**: `/finance/payments/list`
- **前置**: 有已开票的订单

### 步骤
1. 切 `finance`
2. 侧边栏 "**财务管理**" → "**收款管理**"
3. 点 "**录入收款**" 按钮
4. 弹对话框

### 字段
| 字段 | 组件 | 必填 | 示例值 |
|------|------|------|-------|
| 关联销售订单 salesOrderId | el-select | ✅ | 选 04 SO |
| 收款金额 amount | el-input-number | ✅ (>0) | `5000` (或按发票金额, 如税率分组 `3629`) |
| 收款方式 paymentMethod | el-select | ✅ | 银行转账 / 现金 / 支票 / 微信 / 支付宝 / 其他 |
| 收款日期 paymentDate | el-date-picker | ✅ | 今天 |
| 凭证号 paymentReference | el-input | ⚪ | `BANK-REF-{时间戳}` |
| 附件 attachment | el-upload | ⚪ | 上传银行流水截图 |
| 备注 remark | el-input textarea | ⚪ | `客户全款` |

### 操作
1. 选 **关联销售订单** (下拉选 04 SO)
2. 填 **金额**
3. 选 **收款方式** `银行转账`
4. 填 **凭证号**
5. (可选) 上传附件
6. 点 "**确定**"

### ✅ PASS ⭐
- Toast "**收款登记成功**"
- 收款记录列表新增
- **Network**: `POST /api/mobile/F001/finance/payments/record` 200
- **SO 状态更新**:
  - 若金额 = 总额 → SO 标记 "**已结清**"
  - 若金额 < 总额 → 标记 "**部分收款**"
- SO 详情时间线新增 `收款 @finance 金额: ¥5000`

### 部分收款验证
- 连续录 2 次, 第一次 ¥2000, 第二次 ¥3000
- SO 状态应从 "部分收款" → "已结清"

---

## 8.7 完整可追溯验证

### 步骤
1. 进 SO 详情
2. 底部时间线应有 20+ 事件:
   - ✓ 订单创建 @sales
   - ✓ 订单确认
   - ✓ 财务审核通过 @finance
   - ✓ 采购单创建 @purchase (如有)
   - ✓ 采购财务审核 @finance
   - ✓ 到货收货 @warehouse
   - ✓ 生产计划创建 @production
   - ✓ 报工 @operator
   - ✓ 报工审批 @foreman
   - ✓ 成品入库 (自动)
   - ✓ 发货单创建 @sales
   - ✓ 批次分配
   - ✓ 确认发货 @warehouse
   - ✓ 开票申请 @sales (×N, 如税率分组 ×2)
   - ✓ 发票审核通过 @finance
   - ✓ 发票开具 + PDF @finance
   - ✓ 收款登记 @finance (×N)
   - ✓ 已结清

### ✅ PASS ⭐⭐
- 时间线完整, 每个事件显示 **操作人** + **时间**
- 按时间顺序排列
- 点击事件可展开详情 (如有)

---

## 8.8 本节 Checklist (14 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 8.2 普通开票申请 toast (可跳过, 走 G1) | sales | ☐ |
| 2 | 8.3 审核通过路径 | finance | ☐ ⭐ |
| 3 | 8.3 驳回路径 | finance | ☐ (可选) |
| 4 | 8.4 PDF 上传成功 | finance | ☐ ⭐ |
| 5 | 8.4 开具状态 ISSUED | finance | ☐ |
| 6 | 8.5 SO 详情回写发票下载链接 | sales | ☐ ⭐ |
| 7 | 8.5 下载 PDF 可用 | sales | ☐ |
| 8 | 8.6 收款录入 toast | finance | ☐ ⭐ |
| 9 | 8.6 关联 SO 下拉有选项 | finance | ☐ |
| 10 | 8.6 收款方式 6 种可选 | finance | ☐ |
| 11 | 8.6 SO 状态变 "已结清" | finance | ☐ ⭐ |
| 12 | 8.6 部分收款流转正确 | finance | ☐ (可选) |
| 13 | 8.7 时间线 20+ 事件完整 | admin | ☐ ⭐⭐ |
| 14 | 8.7 事件有操作人+时间 | admin | ☐ |

⭐⭐ = 业务闭环最终门

---

## 8.9 下一步

本节完成 (普通开票). **核心演示** → [09-killer-feature-g1.md](09-killer-feature-g1.md) **税率分组开票 G1**.
