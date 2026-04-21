-- Silver fact tables — transactional grain.
-- Week 2 Day 2 of Unified Data Layer v1 spec (§2.2).
--
-- v1.1 scope ships FOUR fact tables:
--   fact_pos_transaction  — one row per bill × store (qhj 4169 bills)
--   fact_pos_item         — one row per bill line (combo parser output, many per bill)
--   fact_pos_payment      — EAV sub-fact of transaction, 0..N rows per bill
--   fact_pos_discount     — EAV sub-fact of transaction, 0..N rows per bill
--
-- Deferred to v1.3: fact_review (needs 点评 scrape source),
-- fact_production_batch (migrate from existing Java production_batches),
-- fact_purchase_order_item (shape TBD, from supply chain module).
--
-- All four tables:
--   - BIGSERIAL surrogate id  (even EAV tables — consistency; some tooling
--     assumes every row has a primary key and it costs ~8 bytes/row)
--   - factory_id NOT NULL + ENABLE + FORCE RLS with tenant_isolation policy
--   - Indexes per spec §2.2
--   - FKs to parent transaction are ON DELETE CASCADE (item/payment/discount
--     are meaningless without their bill)
--   - FKs to dim tables are ON DELETE SET NULL for nullable FKs
--     (product_id), RESTRICT for NOT NULL FKs (store_id on transaction)


-- ── fact_pos_transaction (bill grain) ──────────────────────────────
CREATE TABLE IF NOT EXISTS fact_pos_transaction (
    id               BIGSERIAL PRIMARY KEY,
    factory_id       VARCHAR(50) NOT NULL,
    upload_id        BIGINT,               -- loose link to upload tracking
    source_type      VARCHAR(20) NOT NULL, -- 'excel' | 'meituan_api' | ...
    source_bill_no   VARCHAR(100) NOT NULL,
    store_id         BIGINT NOT NULL,
    staff_id         BIGINT,
    date             DATE NOT NULL,
    time             TIMESTAMP,
    -- bill-level aggregates (per audit F1 — measure columns live at bill grain)
    gross_amount     NUMERIC(18,2),
    discount_amount  NUMERIC(18,2),
    tax_amount       NUMERIC(18,2),
    net_amount       NUMERIC(18,2),
    actual_receive   NUMERIC(18,2),
    customer_count   INT,
    avg_per_capita   NUMERIC(18,2),
    table_no         VARCHAR(50),
    order_type       VARCHAR(50),          -- 堂食 / 外卖 / 自提 / ...
    channel_origin   VARCHAR(50),          -- 美团 / 抖音 / 自点 / ...
    item_count       INT,
    has_discount     BOOLEAN,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    -- Prevent duplicate bill imports: (factory, source, store, bill_no) is the
    -- natural key. Same bill_no across different sources is allowed
    -- (Excel + API may both see same bill — we want them deduped by store).
    CONSTRAINT uq_fact_pos_txn UNIQUE (factory_id, source_type, store_id, source_bill_no),
    CONSTRAINT fk_fact_pos_txn_store FOREIGN KEY (store_id)
        REFERENCES dim_store (store_id) ON DELETE RESTRICT,
    CONSTRAINT fk_fact_pos_txn_staff FOREIGN KEY (staff_id)
        REFERENCES dim_staff (staff_id) ON DELETE SET NULL
);
ALTER TABLE fact_pos_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_pos_transaction FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_pos_transaction;
CREATE POLICY tenant_isolation ON fact_pos_transaction FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
DROP TRIGGER IF EXISTS trg_fact_pos_txn_touch ON fact_pos_transaction;
CREATE TRIGGER trg_fact_pos_txn_touch BEFORE UPDATE ON fact_pos_transaction
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
-- Hot path A: "daily sales by store" — agg_daily materializer.
CREATE INDEX IF NOT EXISTS idx_fact_pos_txn_factory_date_store
    ON fact_pos_transaction (factory_id, date, store_id);
-- Hot path B: "store trajectory over time" — store detail page.
CREATE INDEX IF NOT EXISTS idx_fact_pos_txn_factory_store_date
    ON fact_pos_transaction (factory_id, store_id, date);
-- Hot path C: upload rollback ("delete everything from upload 1234").
CREATE INDEX IF NOT EXISTS idx_fact_pos_txn_upload
    ON fact_pos_transaction (upload_id)
    WHERE upload_id IS NOT NULL;


-- ── fact_pos_item (bill × product line grain) ──────────────────────
-- One bill usually has 3-15 items. qhj 4169 bills × ~12 avg = ~50K rows
-- per factory per month. Parser extracts each from the raw combo string
-- "#宫保鸡丁#_1份*58+#米饭#_2份*3+..." — 'source_item_raw' keeps the
-- original per-line substring so parse failures are reviewable.
CREATE TABLE IF NOT EXISTS fact_pos_item (
    id               BIGSERIAL PRIMARY KEY,
    transaction_id   BIGINT NOT NULL,
    factory_id       VARCHAR(50) NOT NULL,
    product_id       BIGINT,             -- NULL = parser miss (source_item_raw has the blob)
    qty              NUMERIC(18,3),
    unit_price       NUMERIC(18,2),
    amount           NUMERIC(18,2),
    source_item_raw  TEXT,               -- raw substring, always populated
    created_at       TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_fact_pos_item_txn FOREIGN KEY (transaction_id)
        REFERENCES fact_pos_transaction (id) ON DELETE CASCADE,
    CONSTRAINT fk_fact_pos_item_product FOREIGN KEY (product_id)
        REFERENCES dim_product (product_id) ON DELETE SET NULL
);
ALTER TABLE fact_pos_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_pos_item FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_pos_item;
CREATE POLICY tenant_isolation ON fact_pos_item FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
-- Per-product revenue rollup.
CREATE INDEX IF NOT EXISTS idx_fact_pos_item_factory_product_amount
    ON fact_pos_item (factory_id, product_id, amount);
-- Delete cascade helper.
CREATE INDEX IF NOT EXISTS idx_fact_pos_item_txn
    ON fact_pos_item (transaction_id);
-- Parser-miss audit queue.
CREATE INDEX IF NOT EXISTS idx_fact_pos_item_unresolved
    ON fact_pos_item (factory_id, created_at DESC)
    WHERE product_id IS NULL;


-- ── fact_pos_payment (EAV) ─────────────────────────────────────────
-- One bill pays via 1..N channels. 美团团购 + 现金补差, 抖音券+支付宝, etc.
CREATE TABLE IF NOT EXISTS fact_pos_payment (
    id               BIGSERIAL PRIMARY KEY,
    transaction_id   BIGINT NOT NULL,
    factory_id       VARCHAR(50) NOT NULL,
    channel_id       BIGINT NOT NULL,
    amount           NUMERIC(18,2),
    created_at       TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_fact_pos_payment_txn FOREIGN KEY (transaction_id)
        REFERENCES fact_pos_transaction (id) ON DELETE CASCADE,
    CONSTRAINT fk_fact_pos_payment_channel FOREIGN KEY (channel_id)
        REFERENCES dim_payment_channel (channel_id) ON DELETE RESTRICT
);
ALTER TABLE fact_pos_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_pos_payment FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_pos_payment;
CREATE POLICY tenant_isolation ON fact_pos_payment FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
CREATE INDEX IF NOT EXISTS idx_fact_pos_payment_channel_amount
    ON fact_pos_payment (factory_id, channel_id, amount);
CREATE INDEX IF NOT EXISTS idx_fact_pos_payment_txn
    ON fact_pos_payment (transaction_id);


-- ── fact_pos_discount (EAV) ────────────────────────────────────────
-- One bill can apply 0..N discounts: 代金券, 会员折扣, 满减, etc.
CREATE TABLE IF NOT EXISTS fact_pos_discount (
    id               BIGSERIAL PRIMARY KEY,
    transaction_id   BIGINT NOT NULL,
    factory_id       VARCHAR(50) NOT NULL,
    discount_id      BIGINT NOT NULL,
    quantity         INT,
    amount           NUMERIC(18,2),
    created_at       TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_fact_pos_discount_txn FOREIGN KEY (transaction_id)
        REFERENCES fact_pos_transaction (id) ON DELETE CASCADE,
    CONSTRAINT fk_fact_pos_discount_dim FOREIGN KEY (discount_id)
        REFERENCES dim_discount (discount_id) ON DELETE RESTRICT
);
ALTER TABLE fact_pos_discount ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_pos_discount FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_pos_discount;
CREATE POLICY tenant_isolation ON fact_pos_discount FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
CREATE INDEX IF NOT EXISTS idx_fact_pos_discount_disc_amount
    ON fact_pos_discount (factory_id, discount_id, amount);
CREATE INDEX IF NOT EXISTS idx_fact_pos_discount_txn
    ON fact_pos_discount (transaction_id);
