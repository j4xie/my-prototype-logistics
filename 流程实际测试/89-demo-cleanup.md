# 89. 演示后数据重置手册

**触发时机**: 每次客户演示结束后 + 下次演示前
**目标**: 清除演示产生的脏数据, 保留**黄金种子数据** (F001 工厂 + 账号 + 基础 BOM).
**耗时**: 10 min

---

## 89.1 清理策略

| 要清 | 保留 |
|------|------|
| 本次 demo 新建的 SO / PO / 发票 / 报工 / 批次 | F001 工厂 |
| 质检记录 / 处置记录 | 15 个账号 (admin/sales/finance...) |
| 演示生成的用户附件 / 照片 | 产品 BOM / 工序链 |
| AI 对话历史 (含敏感信息) | 供应商 / 客户主数据 |
| 审计日志 (可选, 看合规要求) | 工位 QR / 员工工牌 |

---

## 89.2 SQL 清理脚本 (DBA 审核后执行)

⚠️ **生产库禁止盲跑**. 演示库 (F001) 才执行.

```sql
BEGIN;

-- 1. 清发票 + 收付款 (保留 schema 层测试数据)
DELETE FROM invoice_items WHERE invoice_id IN (
  SELECT id FROM invoices WHERE factory_id = 'F001' AND created_at >= :demo_start
);
DELETE FROM invoices WHERE factory_id = 'F001' AND created_at >= :demo_start;
DELETE FROM payments WHERE factory_id = 'F001' AND created_at >= :demo_start;

-- 2. 清报工 + 消耗
DELETE FROM material_consumption WHERE factory_id = 'F001' AND created_at >= :demo_start;
DELETE FROM production_reports WHERE factory_id = 'F001' AND created_at >= :demo_start;

-- 3. 清生产计划
DELETE FROM production_plans WHERE factory_id = 'F001' AND created_at >= :demo_start;

-- 4. 清采购/销售订单 (演示新建的)
DELETE FROM purchase_order_items WHERE purchase_order_id IN (
  SELECT id FROM purchase_orders WHERE factory_id = 'F001' AND created_at >= :demo_start
);
DELETE FROM purchase_orders WHERE factory_id = 'F001' AND created_at >= :demo_start;

DELETE FROM sales_order_items WHERE sales_order_id IN (
  SELECT id FROM sales_orders WHERE factory_id = 'F001' AND created_at >= :demo_start
);
DELETE FROM sales_orders WHERE factory_id = 'F001' AND created_at >= :demo_start;

-- 5. 清批次 + 批次状态日志
DELETE FROM batch_status_history WHERE batch_id IN (
  SELECT id FROM material_batches WHERE factory_id = 'F001' AND created_at >= :demo_start
);
DELETE FROM material_batches WHERE factory_id = 'F001' AND created_at >= :demo_start;

-- 6. 清质检/处置
DELETE FROM quality_disposition_logs WHERE factory_id = 'F001' AND created_at >= :demo_start;

-- 7. 清 AI 对话 (含敏感信息, 重要!)
DELETE FROM ai_chat_history WHERE factory_id = 'F001' AND created_at >= :demo_start;

-- 8. 清审计日志 (可选)
-- DELETE FROM audit_logs WHERE factory_id = 'F001' AND created_at >= :demo_start;

COMMIT;
```

**参数**: `:demo_start` = 演示开始的 UTC 时间戳. 保守做法取演示前 1 h.

---

## 89.3 OSS / 文件清理

```bash
# 清 OSS 附件 (照片 / PDF / 导出 Excel)
aliyun oss rm oss://cretas-media/demo/F001/ --recursive \
  --include "*.jpg" --include "*.png" --include "*.pdf" --include "*.xlsx" \
  --start-time "2026-04-16T08:00:00Z"

# 检查本地 tmp
rm -rf /tmp/demo-*/F001/*
```

---

## 89.4 缓存 / Session 清理

```bash
# Redis (Java 后端)
ssh root@47.100.235.168 "redis-cli --scan --pattern 'cretas:F001:*' | xargs -n 100 redis-cli del"

# Python 服务 (如 SmartBI 有缓存)
ssh root@47.100.235.168 "redis-cli --scan --pattern 'smartbi:F001:*' | xargs -n 100 redis-cli del"
```

---

## 89.5 黄金种子数据验证 (清完必查)

清理后跑 §79 前置 checklist, 确认核心仍在:

```sql
-- 账号应该 15 个
SELECT COUNT(*) FROM users WHERE factory_id = 'F001';  -- 预期 15

-- BOM 仍在
SELECT COUNT(*) FROM bill_of_materials WHERE factory_id = 'F001';  -- > 0

-- 产品仍在
SELECT COUNT(*) FROM product_types WHERE factory_id = 'F001';  -- > 0

-- 供应商/客户主数据
SELECT COUNT(*) FROM suppliers WHERE factory_id = 'F001';  -- > 0
SELECT COUNT(*) FROM customers WHERE factory_id = 'F001';  -- > 0
```

**若任一项缺** → 从 §79.3 的 seed SQL 重建, 或从备份恢复.

---

## 89.6 下次演示准备 (5 min 快速复原)

```bash
# 重新跑 §79 数据生成 (如有 seed 脚本)
bash scripts/demo/seed-f001-demo.sh

# 验证 §79.2 checklist 15/15 过
# 然后按 §87 演练 2 h
```

---

## 89.7 Checklist (演示后 10 min 必做)

| # | 项 | 完成? |
|---|----|------|
| 1 | SQL 清理脚本执行成功 (无 FK 报错) | ☐ |
| 2 | OSS 附件清理 | ☐ |
| 3 | Redis 缓存清理 | ☐ |
| 4 | 黄金种子 5 项验证通过 | ☐ |
| 5 | AI 对话历史已清 (含客户可能输入的敏感词) | ☐ |
| 6 | 下次演示 seed 脚本可执行 | ☐ |

---

## 89.8 合规注意

- **客户数据不留**: demo 中客户可能输入真实信息 (客户名 / 电话 / 地址), AI 对话里也可能有. **必须清**.
- **多租户环境**: 本手册只清 `factory_id = 'F001'`. 其他工厂数据绝对不动.
- **生产库禁用**: 以上 SQL 只在演示库跑. 生产库操作走专用 DBA 流程.
