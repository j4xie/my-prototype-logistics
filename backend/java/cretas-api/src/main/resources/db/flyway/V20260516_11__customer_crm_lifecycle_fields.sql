-- Sprint 4 W2 S-CRM-FULL-1: Customer 客户生命周期 / 战略价值 / 渠道归因 / 接洽时间
--
-- 新增 4 列:
--   customer_status   VARCHAR(30)  — 11 阶段销售漏斗 + 存续状态 (CustomerStatus enum)
--   importance        VARCHAR(20)  — VIP/IMPORTANT/NORMAL/LOW 战略分级 (CustomerImportance enum)
--   source            VARCHAR(30)  — 11 渠道来源归因 (CustomerSource enum)
--   last_contacted_at TIMESTAMP    — 最近接洽时间 (沉睡客户识别 + 跟进提醒)
--
-- 全部 nullable — 老数据不强制回填, UI 显示 "未分类" 状态。
-- 索引覆盖典型查询场景: factory_id + customer_status + importance (列表 filter)。

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS customer_status   VARCHAR(30),
    ADD COLUMN IF NOT EXISTS importance        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS source            VARCHAR(30),
    ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP;

-- 列表 filter 索引: WHERE factory_id = ? AND (customer_status = ? OR importance = ?)
CREATE INDEX IF NOT EXISTS idx_customer_status      ON customers (factory_id, customer_status);
CREATE INDEX IF NOT EXISTS idx_customer_importance  ON customers (factory_id, importance);
CREATE INDEX IF NOT EXISTS idx_customer_source      ON customers (factory_id, source);

-- 沉睡客户查询: WHERE factory_id = ? AND last_contacted_at < NOW() - INTERVAL 'N days'
CREATE INDEX IF NOT EXISTS idx_customer_last_contacted ON customers (factory_id, last_contacted_at);

COMMENT ON COLUMN customers.customer_status   IS '客户生命周期状态 (CustomerStatus enum)';
COMMENT ON COLUMN customers.importance        IS '客户重要程度 (CustomerImportance enum: VIP/IMPORTANT/NORMAL/LOW)';
COMMENT ON COLUMN customers.source            IS '客户来源渠道 (CustomerSource enum)';
COMMENT ON COLUMN customers.last_contacted_at IS '最近一次接洽时间 — 沉睡客户识别 + 跟进提醒';
