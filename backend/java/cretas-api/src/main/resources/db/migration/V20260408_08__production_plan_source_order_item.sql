-- P0-12: 生产计划关联到销售订单行 (而非订单主表)
-- 客户原话 4216s: "关联销售订单产品 / 客户名称自动带出来"
-- sourceOrderId 保留 (向后兼容), sourceOrderItemId 新增作为细化粒度

ALTER TABLE production_plans
  ADD COLUMN IF NOT EXISTS source_order_item_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_production_plans_source_item
  ON production_plans(factory_id, source_order_item_id);
