# 07. 段 5 — 成品出库 (FIFO 批次分配)

**会议来源**: `研发样品至财务回款全流程文档.md` §5
**涉及角色**: sales (发起) / warehouse (确认)
**核心亮点**: FIFO 批次自动分配 (P0-13)
**耗时**: 10 min

---

## 7.1 流程

```
SO 状态 FINANCE_APPROVED (段 2)
+ 成品入库 (段 4 完工审批后)
    ↓
sales 新建发货单 (在 SO 详情 Tab "销售出库")
    ↓ status=PENDING_SHIP
sales/warehouse 批次分配 FIFO (P0-13)
    ↓
warehouse 确认发货
    ↓ 成品库存 -100, SO → SHIPPED
    ↓ 生成送货单
客户签收 (可选)
    ↓ status=RECEIVED
```

---

## 7.2 新建发货单

### 前置
- **账号**: `sales / 123456`
- **URL**: `/sales/orders/{orderId}/detail`
- **前置**: SO `FINANCE_APPROVED`, 成品库存足 (段 4 完成)

### 步骤
1. 切 `sales`
2. 进 04 SO 的详情页 (订单列表点订单号)
3. 顶部 Tab 切到 "**销售出库**"
4. 点 "**+ 新建发货单**" 按钮

### 字段
| 字段 | 组件 | 必填 | 示例值 |
|------|------|------|-------|
| 收货地址 deliveryAddress | el-input | ⚪ | 默认 SO 地址 |
| 物流公司 logisticsCompany | el-input / select | ⚪ | `顺丰` |
| 物流单号 trackingNo | el-input | ⚪ | 空 (发货后填) |
| 发货日期 shipDate | el-date-picker | ⚪ | 今天 |
| 明细 items[] | 动态表格 | ✅ | 自动预填 SO 产品 |
| - 产品 | 只读 / select | - | 自动 |
| - 发货数量 | el-input-number | ✅ | `100` |
| - 单位 | - | ✅ | `kg` |
| - 单价 | - | ✅ | `50` |
| 备注 | el-input textarea | ⚪ | `Part 2 测试发货` |

### 操作
1. 检查收货地址正确
2. 填物流公司 `顺丰`
3. 发货数量默认 100 (SO 数量), 可调整
4. 点 "**保存**"

### ✅ PASS
- Toast "**发货单创建成功**"
- 状态 `PENDING_SHIP` 或 `CREATED`
- **Network**: `POST /api/mobile/F001/sales/deliveries` 200
- **记下**: deliveryId

---

## 7.3 批次分配 FIFO (P0-13)

### 前置
- 发货单已创建, status `PENDING_SHIP`

### 步骤
1. 发货单列表或详情, 找 "**批次分配**" 按钮
2. 点 "**批次分配**"
3. 弹窗 `BatchAllocationDialog`

### FIFO 自动预填
系统按**先进先出** (FIFO) 原则自动预填:
- 取成品库存中**最早的批次** 优先使用
- 若单批次不够, 自动补下一批
- 示例:
  - Batch-20260410 剩 60 kg
  - Batch-20260412 剩 80 kg
  - 需出 100 kg → 预填 Batch-20260410 用 60 + Batch-20260412 用 40

### 字段
| 字段 | 组件 | 必填 | 说明 |
|------|------|------|------|
| 批次号 batchNo | 只读 | - | 自动显示 |
| 生产日期 | 只读 | - | - |
| 可用库存 | 只读 | - | 当前剩余 |
| **分配数量** | el-input-number | ✅ | 可调整 |
| 剩余需求 | 只读 | - | 实时计算 |

### 操作
1. 检查自动预填
2. (可选) 手动调整分配
3. 点 "**确认分配**"

### ✅ PASS
- Toast "**分配成功**"
- 分配结果记录到发货单

### ❌ FAIL
- 库存不足 → 提示 "可用库存不足, 请先生产"
- 未自动填 FIFO → 批次分配逻辑 bug

---

## 7.4 确认发货 (warehouse)

### 前置
- **账号**: `warehouse / 123456` (**切号!**)
- 发货单 status `PENDING_SHIP`, 已批次分配

### 步骤
1. 切 `warehouse`
2. 进发货单详情 (或 `/warehouse/shipments` 列表)
3. 点 "**确认发货**" 按钮
4. (可选) 弹框填物流单号 `SF1234567890`
5. 点 "**确定**"

### ✅ PASS ⭐ (多联动!)
- Toast "**发货成功**"
- 发货单状态变 `SHIPPED`
- ⭐ **SO 状态自动变 `SHIPPED`** (关键联动)
- ⭐ **成品库存 -100** (实际扣减批次数量)
- ⭐ 相关批次状态可能变 `PARTIAL_USED` / `DEPLETED`
- SO 详情时间线新增 `发货 @warehouse`

### Network
- `POST /api/mobile/F001/sales/deliveries/{id}/ship` 200

### ❌ FAIL
- SO 状态未联动变 SHIPPED → trigger chain 配置漏
- 成品库存未扣 → 批次分配未真正关联

---

## 7.5 客户签收 (可选)

### 前置
- 发货单 `SHIPPED`

### 步骤
1. 客户收到货后, sales 或仓库登记签收
2. 找发货单 "**已签收**" / "**确认签收**" 按钮
3. 点击
4. (可选) 上传签收照片

### ✅ PASS
- 状态变 `RECEIVED` / `SIGNED`

---

## 7.6 `sales/shipments` vs `warehouse/shipments` 区别

### 会议中的说法
两者指向**同一批数据**, 只是视图不同:
- **sales/shipments**: 销售视角 (客户/产品/金额为主)
- **warehouse/shipments**: 仓库视角 (批次/仓位/库存扣减为主)

### 验证
1. sales 在 `/sales/shipments` 看发货单
2. warehouse 在 `/warehouse/shipments` 也能看到**同一单**
3. 操作权限不同 (sales 发起, warehouse 确认)

---

## 7.7 本节 Checklist (10 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 7.2 发货单创建 toast | sales | ☐ |
| 2 | 7.2 SO 详情 Tab "销售出库" 显示新发货单 | sales | ☐ |
| 3 | 7.3 批次分配对话框弹出 | sales | ☐ ⭐ |
| 4 | 7.3 FIFO 自动预填 (最早批次优先) | sales | ☐ ⭐ |
| 5 | 7.3 批次分配确认成功 | sales | ☐ |
| 6 | 7.4 warehouse 确认发货 toast | warehouse | ☐ |
| 7 | 7.4 SO 状态自动变 SHIPPED | warehouse | ☐ ⭐⭐ |
| 8 | 7.4 成品库存扣减 | warehouse | ☐ ⭐⭐ |
| 9 | 7.5 客户签收 (可选) | sales | ☐ |
| 10 | 7.6 sales/warehouse 看到同一单 | - | ☐ |

---

## 7.8 下一步

段 5 完成 (已发货). 下一步:
- 段 6 [08-finance-invoice.md](08-finance-invoice.md) + **[09-killer-feature-g1.md](09-killer-feature-g1.md) 税率分组开票**
