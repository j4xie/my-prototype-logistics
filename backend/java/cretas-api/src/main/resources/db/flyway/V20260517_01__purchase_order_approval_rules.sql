-- Sprint2-J P-FIN-1: 采购订单财务审核规则表 (可配置阈值)
--
-- 背景: Sprint 1 已铺好 PurchaseOrderStatus 状态机 + financeApproveOrder/financeRejectOrder/
-- submitForFinanceReview 方法 + priceAlert flag, 但
-- (1) 三价标红阈值是硬编码常量 PRICE_ALERT_THRESHOLD = 10% (PurchaseServiceImpl:104)
-- (2) approveOrder 只设 APPROVED, 不自动评估 → 财务审核必须手动 submitForFinanceReview
--
-- 本次:
-- (a) 引入 purchase_order_approval_rules 表 per-factory 可配置阈值
-- (b) buildPriceComparison 改从规则查阈值 (兜底 10%)
-- (c) approveOrder 末尾评估规则: 有 priceAlert OR 总金额>阈值 → 自动调 submitForFinanceReview

CREATE TABLE IF NOT EXISTS purchase_order_approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id VARCHAR(191) NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    price_variance_threshold DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    amount_threshold DECIMAL(18, 2),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    CONSTRAINT uk_poar_factory_name UNIQUE (factory_id, rule_name)
);

CREATE INDEX IF NOT EXISTS idx_poar_factory_enabled
    ON purchase_order_approval_rules(factory_id, enabled)
    WHERE deleted_at IS NULL;

-- 为每家工厂播种默认规则 (10% 价格偏差 + 10万元总金额)
INSERT INTO purchase_order_approval_rules
    (factory_id, rule_name, price_variance_threshold, amount_threshold, enabled)
SELECT DISTINCT id, '默认审核规则', 10.00, 100000.00, true
FROM factories
WHERE deleted_at IS NULL
ON CONFLICT (factory_id, rule_name) DO NOTHING;
