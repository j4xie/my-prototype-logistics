# 六扇门 9 步全链路 E2E 测试 Spec

> **For agentic workers:** Use superpowers:subagent-driven-development to implement.

**Goal:** 模拟客户张权的日常操作, 从研发样品到财务回款 9 步串行走完, 验证全链路数据流转正确.

**架构:** 混合方案 C — 独立 Node.js 脚本跑全链路 + Playwright spec 做二次 UI 验证.

---

## 1. 全链路 9 步

每步产出 E2E skill 强制证据: `filled:` + `toast:` / `API:` + `list after:` + `validation:`

### Step 1: 研发样品创建 (UI form)
- 导航 `/rd/samples` → 点"新建样品"
- filled: 样品名称=梅酱小排500g, 规格=500g/盒, 等级=A
- toast: 成功
- list after: 刷新后"梅酱小排"在列表中
- 输出: `sampleId`

### Step 2: BOM 报价 (UI form + API)
- API: POST `/quotes` — sampleId + customerId + productTypeId
- API: PUT `/quotes/{id}/submit-price` — unitPrice=45, costPrice=28, quoteType=FIXED
- API: PUT `/quotes/{id}/approve`
- 导航 `/sales/quotes` → 验证报价状态=APPROVED + marginRate显示
- 输出: `quoteId`, `unitPrice=45`

### Step 3: 销售下单 (UI form)
- 导航 `/sales/orders` → 点"新建销售订单"
- filled: 客户=鼎鲜火锅, 产品=梅酱小排500g, 数量=100, 单价=45, 单位=盒, 税率=9%, quoteId
- toast: 创建成功
- list after: 新 SO 在列表中, 状态=DRAFT
- 输出: `salesOrderId`, `orderNumber`

### Step 4: 财务审核 (API — 3 步状态流转)
- API: POST `/sales/orders/{id}/confirm` → CONFIRMED
- API: POST `/sales/orders/{id}/submit-for-review` → PENDING_FINANCE_REVIEW
- API: POST `/sales/orders/{id}/finance-approve` → FINANCE_APPROVED
- 导航 `/sales/orders` → 验证状态标签变化
- 验证: SupplyChainOrchestrator 触发 (检查是否自动生成 ProductionPlan)
- 输出: SO status=FINANCE_APPROVED

### Step 5: 采购入库 (UI form PO + API 审批+入库)
- UI: 导航 `/procurement/orders` → 新建 PO
- filled: 供应商=泰森禽业, 原料=猪肉, 数量=500kg, 单价=25
- toast: 创建成功
- API: submit → finance-approve → create receive → confirm receive
- 验证: MaterialBatch 创建, 库存增加
- 输出: `purchaseOrderId`, `materialBatchId`

### Step 6: 生产排产 (UI form plan + API FMR)
- UI: 导航 `/production/plans` → 新建计划
- filled: 产品=梅酱小排500g, 计划数量=100, 关联SO
- toast: 创建成功
- API: POST `/material-requisitions/generate` → fmrId
- API: FMR start-picking → transfer → receive (物流仓→车间仓)
- 输出: `planId`, `fmrId`

### Step 7: 工序报工 (API — Web 无报工 form)
- API: POST `/process-work-reporting/normal` — processTaskId, outputQuantity=50
- API: 再报一次 outputQuantity=50 (累加式, 总计100)
- 验证: 导航 `/production/plans` → 计划状态更新
- 输出: `reportIds[]`

### Step 8: 成品出库 (API)
- API: GET `/recommend-fifo` — productTypeId, requiredQty=100 → 推荐批次列表
- API: POST `/sales/deliveries` → deliveryId
- API: POST `/sales/deliveries/{id}/ship` → 扣减库存
- 验证: 导航 `/warehouse/shipments` → 出货记录可见
- 输出: `deliveryId`, `shipmentId`

### Step 9: 开票+回款 (UI 开票 + API 回款)
- UI: 导航 SO 详情 → 开票 tab → 点"申请开票"
- API: POST `/invoices/request-from-order` → 自动按 9% 税率分组
- 验证: invoiceId + taxBreakdown 有 9% 条目
- API: POST `/payments/record` — salesOrderId, amount=4500, paymentMethod=BANK_TRANSFER
- 验证: 导航 SO 详情 → 收款 tab → 收款记录可见, paymentStatus 变化
- 输出: `invoiceId`, `paymentId`

---

## 2. 文件结构

```
test-e2e-business-chain.mjs              ← 9 步全链路脚本
test-e2e-chain-results.json              ← 脚本产出的 ID + 证据
tests/v1-e2e/web/chain-verify.spec.ts    ← Playwright 二次验证
```

---

## 3. 证据格式 (per step)

```json
{
  "step": 1,
  "name": "研发样品创建",
  "status": "PASS",
  "evidence": {
    "filled": "样品名称=梅酱小排500g, 规格=500g/盒",
    "toast": "创建成功",
    "API": "POST 200, success=true, sampleId=xxx",
    "list_after": "梅酱小排500g 在刷新后列表中可见",
    "validation": "前端必填标记: [样品名称]"
  },
  "output": { "sampleId": "xxx" }
}
```

---

## 4. chain-verify.spec.ts 验证点

读 `test-e2e-chain-results.json`, 对每个 output ID:
1. 导航到对应页面, 验证数据存在
2. 验证状态正确 (SO=FINANCE_APPROVED, PO=审核通过, etc.)
3. 验证跨模块引用 (SO 详情的关联采购 tab 有 PO, 开票 tab 有 invoice)

---

## 5. 成功标准

- [ ] 9 步全部 PASS (脚本 exit 0)
- [ ] chain-verify.spec.ts 全部 PASS
- [ ] 每步有完整 filled/toast/list-after 证据
- [ ] 全链路 1 条数据线从 sampleId 穿到 paymentId
- [ ] run-full.sh 包含 chain-verify (纳入 CI)
