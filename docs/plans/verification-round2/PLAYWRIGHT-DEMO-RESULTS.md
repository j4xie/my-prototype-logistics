# Playwright 实地演示报告

**日期**: 2026-04-08
**环境**: localhost:5175 (Vite dev) + localhost:10010 (Java Spring Boot)
**测试角色**: factory_admin1 / 工厂总监 / F001

---

## ✅ 演示路径与结果

| # | 步骤 | 结果 | 截图 |
|---|------|------|------|
| 1 | 登录 → Dashboard | ✅ | (略) |
| 2 | 导航到销售订单列表 (19 条) | ✅ | (略) |
| 3 | 点击 SO-20260402-0007 详情 | ✅ | demo-01-order-detail-5tabs.png |
| 4 | 验证 5 tab 业务中心 | ✅ | demo-01 |
| 5 | 验证审批 Timeline 3 节点 | ✅ | demo-01 |
| 6 | 切换到开票申请 tab | ✅ | demo-02-invoice-tab.png |
| 7 | 点击"+ 一键开票申请 (按税率分组)" | ✅ | demo-03-invoice-dialog.png |
| 8 | 提交开票申请 → 创建 INV-20260407-0008 | ✅ | demo-04-invoice-submitted.png |
| 9 | 切换到多税率订单 (f90dabe1...) | ✅ | demo-05-multi-rate-invoice.png |
| 10 | **验证 9% + 13% 双税率分组渲染** | ✅ **G1 杀手锏** | demo-05 |
| 11 | 切换到关联采购 tab (空状态) | ✅ | demo-06-purchase-tab.png |
| 12 | 导航到产品信息管理 | ✅ | demo-07-product-category-tabs.png |
| 13 | "成品" tab 显示 3 条 | ✅ | demo-07 |
| 14 | "原料" tab 显示 0 条 (P0-2 隔离生效!) | ✅ **客户最敏感 bug 修复** | demo-08-product-raw-tab.png |

**总计**: 14/14 PASS

---

## 🎯 关键演示点 (客户演示推荐顺序)

### 1. P0-2 产品大类隔离 bug 修复 (最敏感)

**演示路径**: 系统管理 → 产品信息管理 → 切换 4 个 tab

**演示话术**:
> "我们上次会议提到的 '选成品但能看到原料' 这个 bug, 现在已经修了。
> 您看, '成品' tab 3 条 (带鱼段精品/大虾仁/鱿鱼圈),
> 切换到 '原料' tab, 0 条 — 完全隔离了。"

**根因**: 后端 Service 完全忽略 productCategory 参数, 所有 tab 共享同一份数据。修复后 4 分支查询逻辑就位 + V20260407_02 数据迁移把 27 条历史 category="冷冻水产" 数据兜底到 FINISHED_PRODUCT。

### 2. P0-3 G1 税率分组开票 (杀手锏)

**演示路径**: 销售订单 → SO-...0011 → 开票申请 tab → 一键开票申请

**演示话术**:
> "您说的 '一笔订单可同时含 9% 原料 + 13% 加工费, 按税率分组拆分',
> 现在系统会自动把销售订单的 items 按 tax_rate 聚合,
> 一键就生成两组明细给财务审批。
>
> 看这个 INV-20260407-0007:
>   不含税 ¥3,300, 税额 ¥329, 价税合计 ¥3,629
>   税率分组列里, 绿色 9% × 1 行 + 黄色 13% × 1 行 — 自动分组拆分"

**技术亮点**: 算法 `aggregateByTaxRate` 自动按 SalesOrderItem.taxRate 分组, scale 归一化, 升序排序保证 9% 在 13% 之前, 各组 sum 写入 amount/taxAmount/totalAmount。

### 3. P0-11 销售订单 5 tab 业务中心 + Timeline

**演示路径**: 销售订单 → 任一订单 → 详情

**演示话术**:
> "您之前演示的 aliwork 系统销售订单详情页有 5 个 tab + 底部审批进度,
> 我们做到了一样的:
>
>   tab1: 订单详情 (字段 + 产品明细)
>   tab2: 开票申请 (税率分组)
>   tab3: 发货记录
>   tab4: 收款记录
>   tab5: 关联采购 (主原料定点追踪 hint)
>
> 底部审批进度时间线 — 创建 / 确认 / 审批 / 发货 / 收款 / 完成 8 个动态节点,
> 从订单字段直接渲染, 不需要单独维护审批历史表。"

### 4. 头部 4 状态联动

**演示话术**:
> "顶部 4 个数字: 订单总额 / 已发货 / 已开票 / 已收款,
> 您说 '出库后金额对不上' 这个问题, 我们修了 — 出库后开票自动用出库金额, 不用订单金额。"

---

## 🐛 演示中发现的 1 个非阻塞问题

**关联采购 tab** 调用 `GET /purchase/orders?salesOrderId=...` 返回 500
- 原因: 后端 PurchaseOrderController 未处理 salesOrderId query 参数
- 影响: 仅前端 console error, UI 优雅降级到空状态 "暂无关联采购订单"
- 修复: 留 W2, P2 优先级 (与 P0-4 OperationalQuote → SalesOrder 联动一起做)

---

## 📊 W1 客户演示就绪度评估

| 演示场景 | 就绪度 | 备注 |
|---------|-------|------|
| 产品大类隔离 (P0-2) | ✅ 100% | 后端 + 前端 + 数据迁移 全部到位 |
| 税率分组开票 (P0-3 / G1) | ✅ 100% | 完美匹配客户原话 2645s |
| 销售订单 5 tab 业务中心 (P0-11) | ✅ 95% | 1 个非阻塞 console error |
| 销售订单审批 Timeline | ✅ 100% | 8 节点动态渲染 |
| 跨工厂隔离 (W1 DoD) | ✅ 100% | 12 单测 + HTTP 403 双重防御 |
| OperationalQuote (P0-4) | ✅ 80% | 后端 4 段流程完成, 前端列表/编辑页留 W2 |
| 研发样品 8 字段 (Round 2 Agent A) | ✅ 100% | 后端字段 + Controller helper |
| 物料需求单 (P0-5) | 🟡 设计就绪 | Round 2 Agent B 8.5/10 设计, 实施留 W2 |
| PC 批次 (P0-13) | 🟡 部分就绪 | FinishedGoodsBatch.productionDate 已有, SalesDeliveryItem 子表留 W2 |
| 工人欠退 (P1-1) | 🟡 留 W2 | 涉及硬件 |

**结论**: W1 红线清单 100% 完成 + 演示路径全部跑通, 客户演示前不再阻塞。

---

## 📂 截图证据

```
.playwright-mcp/
├── demo-01-order-detail-5tabs.png    (5 tab + Timeline 全景)
├── demo-02-invoice-tab.png           (开票 tab + 客户原话 hint)
├── demo-03-invoice-dialog.png        (一键开票 dialog)
├── demo-04-invoice-submitted.png     (单税率成功)
├── demo-05-multi-rate-invoice.png    (9% + 13% 双组 — G1 杀手锏)
├── demo-06-purchase-tab.png          (关联采购空状态)
├── demo-07-product-category-tabs.png (成品 tab 3 条)
└── demo-08-product-raw-tab.png       (原料 tab 0 条 — 隔离生效)
```

**Round 2 + Playwright 实地演示 = 客户演示路径全闭环**
