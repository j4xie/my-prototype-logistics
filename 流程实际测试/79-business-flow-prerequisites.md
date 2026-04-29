# 79. 业务流程前置条件 (81-85 共用)

**适用**: §81-85 五大业务流程演示前**必做**
**耗时**: 15-20 min 全部铺齐
**原则**: 任一项未通过 → 按 §0 遇缺补齐先补, 再跑流程

---

## 79.1 数据链路 (跨 § 跳转地图)

```
§18 HR           — 员工 + 工牌 QR
  ↓
§18 工位配置     — 工序 QR + 产线
  ↓
§19 设备         — 设备可用 + 保养日历
  ↓
§49/§23 BOM      — 产品配方 + 工序链
  ↓
§04 销售订单     — SO + 多税率商品 (准备 G1 §09)
  ↓
§06 生产计划     — 关联 SO, 指派 operator  ⭐ 81 入口
  ↓
§05 原料库存     — 到货 + 批次 (为 81 领料)
  ↓
§20 质检项       — 质检绑定产品 (为 83)
  ↓
§40 摄像头       — V1 注册 + RTSP (为 83 V1)
```

---

## 79.2 前置 Checklist (15 min 全过)

| # | 项 | 对应 § | 验证 | 通过? |
|---|---|-------|------|------|
| 1 | 员工 E001-E003 已建 + 工牌 QR 打印 | §18 | RN 扫码能识别员工 | ☐ |
| 2 | 工序 "切配/烹饪/包装" 三道 QR 贴工位 | §18 | 扫码能识别工序 | ☐ |
| 3 | 产线 L1/L2 在 `/scheduling/production-lines` 可见 | §19 | GET 有数据 | ☐ |
| 4 | 产品 A 的 BOM 配置完整 (主料/辅料) | §49 | BOM 页面有 ≥ 2 行 | ☐ |
| 5 | 产品 A 的工序链 (3 道) 已配 | §23 | 工序页面可见 | ☐ |
| 6 | SO-xxx 创建 + 审核通过 | §04 | status=CONFIRMED | ☐ |
| 7 | ⭐ SO 含 9%+13% 两种税率商品 (G1 前置) | §09.2 | items 税率 > 1 种 | ☐ |
| 8 | 生产计划创建 + 绑定 SO + 指派 operator | §06 | status=READY | ☐ |
| 9 | 采购单收货 + 原料库存 ≥ BOM 预计量 | §05 | material_batches status=AVAILABLE | ☐ |
| 10 | 产品 A 绑定质检项 (金属/异物/重量) | §20 | quality-check-items/bindings 有数据 | ☐ |
| 11 | 摄像头 1 路已注册 + RTSP 可播 | §40 | /cameras 有 ACTIVE 设备 | ☐ |
| 12 | 5 个测试账号 (admin/sales/finance/foreman/operator) 能登 | §02 | 5/5 登录成功 | ☐ |
| 13 | operator 账号绑 employeeId = E001 | §02 | JWT payload 含 userId | ☐ |
| 14 | RN APK 已装 + 环境指向 prod (10010) | 移动端 §01 | /health 返 200 | ☐ |
| 15 | Web-admin 8086 可访问 + sales 登录 | §02 | 登录后见工厂名 | ☐ |

---

## 79.3 数据生成验证 SQL

```sql
-- 前置 6: SO 含多税率
SELECT so.order_number, soi.tax_rate, COUNT(*)
FROM sales_orders so JOIN sales_order_items soi ON soi.sales_order_id = so.id
WHERE so.factory_id = ? GROUP BY so.order_number, soi.tax_rate;
-- 预期: 同一 order 至少 2 行不同 tax_rate

-- 前置 8: 计划已指派 operator
SELECT pp.id, pp.planned_quantity, pp.status, pa.user_id AS operator
FROM production_plans pp
LEFT JOIN plan_assignments pa ON pa.plan_id = pp.id
WHERE pp.factory_id = ? AND pp.status = 'READY';
-- 预期: operator 非 NULL

-- 前置 9: 库存充足
SELECT material_type_id,
       SUM(receipt_quantity - used_quantity - reserved_quantity) AS available
FROM material_batches
WHERE factory_id = ? AND status = 'AVAILABLE'
GROUP BY material_type_id;
-- 预期: available >= BOM 预计量
```

---

## 79.4 常见卡点 + 恢复

| 卡点 | 症状 | 恢复 |
|------|------|------|
| BOM 未配 | 报工时 "BOM 未找到" | §49 补 BOM 行 |
| 工序 QR 未贴 | RN 扫无反应 | §18 生成 QR + 打印 |
| 员工工牌丢 | RN 扫不识别 | 主管代录 (需权限) |
| 库存不足 | 计划无法确认 | §05 走采购收货补 |
| 质检项未绑 | 报工后无质检入口 | §20 绑定产品 |
| RN 环境指向 test | 看不到 prod 数据 | 重装 APK 或改 .env.local |

---

## 79.5 跨文件数据一致性规则

- **批次状态枚举**: `AVAILABLE / INSPECTING / RESERVED / SCRAPPED / DEPLETED / EXPIRED` (见 `MaterialBatchStatus` enum)
- **审批状态**: `PENDING → APPROVED / REJECTED` (81 报工 / 84 发票 统一)
- **跨端延迟基线** (全文档): 轮询 5-10s, 推送 3-5s, 手动刷新即时 (§14.8)
- **FIFO**: 按 `inbound_date ASC, production_date ASC` (85.6 统一)
- **跨工厂隔离**: 所有查询 WHERE factory_id = ? (硬规则)

---

**通过本 §79 Checklist 后** → 按 §80.4 执行顺序走 `82 → 81 → 85 → 83 → 84`.
