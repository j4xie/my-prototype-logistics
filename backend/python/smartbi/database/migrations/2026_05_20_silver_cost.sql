-- Silver cost layer — material/labor/overhead/other cost lines.
-- v1 Phase B (cost foundation) per spec §5.
--
-- Context
-- -------
-- qhj 2025 POS exports don't carry cost data — costs come from accounting
-- system exports or manual entry. This migration creates the receiving
-- schema so that when that data arrives (smartbi customer onboarding
-- includes an accounting data source), Silver normalizer has a home
-- for it. Gold query `finance_summary` will later add a cost + gross_profit
-- section once this table has rows.
--
-- Grain
-- -----
-- fact_cost_line is **transaction-optional**: most cost entries are
-- period-scoped (月度人工 / 月租金) not per-bill. transaction_id NULL
-- means period-grain; `date` is the period's representative date
-- (typically month-first). Non-NULL transaction_id means per-bill cost
-- (rare — reserved for future per-order COGS tracking).
--
-- Cost type
-- ---------
-- Enumerated in check constraint: material / labor / overhead / other.
-- Keeping this narrow so P&L aggregation stays clean. Sub-category
-- detail goes in dim_cost_category.

-- dim_cost_category ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dim_cost_category (
    category_id  BIGSERIAL PRIMARY KEY,
    factory_id   VARCHAR(50) NOT NULL,
    name         VARCHAR(200) NOT NULL,         -- "食材-主料" / "人工-正式员工" / "租金"
    cost_type    VARCHAR(20) NOT NULL,          -- material / labor / overhead / other
    is_fixed     BOOLEAN NOT NULL DEFAULT FALSE,-- true for rent/salaries, false for variable
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_dim_cost_category_factory_name UNIQUE (factory_id, name),
    CONSTRAINT chk_dim_cost_category_type CHECK (
        cost_type IN ('material', 'labor', 'overhead', 'other')
    )
);
ALTER TABLE dim_cost_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_cost_category FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dim_cost_category;
CREATE POLICY tenant_isolation ON dim_cost_category FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_dim_cost_category_touch ON dim_cost_category;
CREATE TRIGGER trg_dim_cost_category_touch BEFORE UPDATE ON dim_cost_category
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();


-- fact_cost_line ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fact_cost_line (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    upload_id       BIGINT,
    source_type     VARCHAR(20) NOT NULL,        -- 'accounting_import' | 'excel' | ...
    transaction_id  BIGINT,                      -- NULL = period-scoped (most common)
    category_id     BIGINT NOT NULL,
    date            DATE NOT NULL,
    amount          NUMERIC(18,2) NOT NULL,
    note            VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_fact_cost_line_txn FOREIGN KEY (transaction_id)
        REFERENCES fact_pos_transaction (id) ON DELETE SET NULL,
    CONSTRAINT fk_fact_cost_line_category FOREIGN KEY (category_id)
        REFERENCES dim_cost_category (category_id) ON DELETE RESTRICT
);
ALTER TABLE fact_cost_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_cost_line FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_cost_line;
CREATE POLICY tenant_isolation ON fact_cost_line FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- Hot paths — cost type summary for a date range, and category rollup:
CREATE INDEX IF NOT EXISTS idx_fact_cost_line_factory_date
    ON fact_cost_line (factory_id, date);
CREATE INDEX IF NOT EXISTS idx_fact_cost_line_category
    ON fact_cost_line (factory_id, category_id, date);
-- Upload rollback:
CREATE INDEX IF NOT EXISTS idx_fact_cost_line_upload
    ON fact_cost_line (upload_id)
    WHERE upload_id IS NOT NULL;
