-- agg_discount — monthly discount rollup promoted from ad-hoc query.
-- v1 Phase B cleanup per session Apr 22 2026.
--
-- Rationale
-- ---------
-- queries.discount_breakdown was computing per-request GROUP BY over
-- fact_pos_discount × fact_pos_transaction (~19K × ~140K JOIN rows for
-- qhj). That's fast enough for v1 scale (~10ms) but doesn't scale to
-- multi-tenant, multi-year datasets. Materializing the monthly rollup
-- matches the pattern already set by agg_daily/product/channel and
-- makes the query a 4-row point lookup.
--
-- Grain
-- -----
-- Same as agg_product (monthly): PK (factory_id, discount_id, month).
-- `month` MUST be first-of-month (DATE_TRUNC('month',...)::DATE).
--
-- Future queries.discount_breakdown reads agg_discount directly;
-- materializer populates via INSERT...SELECT...GROUP BY fired by
-- UploadCompleteTrigger (and other triggers).

CREATE TABLE IF NOT EXISTS agg_discount (
    factory_id   VARCHAR(50) NOT NULL,
    discount_id  BIGINT NOT NULL,
    month        DATE NOT NULL,
    amount       NUMERIC(18,2),
    bill_count   INT,
    version      BIGINT NOT NULL DEFAULT 1,
    computed_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, discount_id, month),
    CONSTRAINT fk_agg_discount_discount FOREIGN KEY (discount_id)
        REFERENCES dim_discount (discount_id) ON DELETE CASCADE,
    CONSTRAINT chk_agg_discount_month_is_first_of_month
        CHECK (month = DATE_TRUNC('month', month)::DATE)
);
ALTER TABLE agg_discount ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_discount FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agg_discount;
CREATE POLICY tenant_isolation ON agg_discount FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
-- Hot path: "top discounts this month" — amount desc within (factory, month).
CREATE INDEX IF NOT EXISTS idx_agg_discount_factory_month_amount
    ON agg_discount (factory_id, month, amount DESC);
