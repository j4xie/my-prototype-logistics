-- Backfill business_links rows for vouchers shipped before #720 fix.
--
-- Background: Sprint 3 Track-E voucher listeners did not call
-- LinkArrayService.link() — vouchers were saved without a corresponding
-- business_links row. Fix in VoucherServiceImpl.createFromBusiness wires
-- the hook for new vouchers; this script backfills the historical gap.
--
-- Idempotent: WHERE NOT EXISTS guards against double-insert, so re-running
-- is safe. Also obeys the (owner_type, owner_id, target_type, target_id)
-- unique constraint via the same predicate.
--
-- VoucherType → linkType mapping (mirror VoucherServiceImpl.mapLinkType):
--   SALES_RECEIPT, RETURN          → sale
--   PURCHASE_PAYMENT, INVENTORY_TRANSFER → stock
--   WAGE, EXPENSE, DEPRECATION     → free
--
-- Run on prod via:
--   ssh root@47.100.235.168 "PGPASSWORD=$DB_PASSWORD psql -h localhost \
--       -U cretas_user -d cretas_prod_db -f /tmp/backfill-voucher-links.sql"

INSERT INTO business_links (
    id,
    factory_id,
    owner_type,
    owner_id,
    link_type,
    target_type,
    target_id,
    description,
    linked_by,
    linked_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid()::text,
    v.factory_id,
    'VOUCHER',
    v.id,
    CASE v.voucher_type
        WHEN 'SALES_RECEIPT'      THEN 'sale'
        WHEN 'RETURN'             THEN 'sale'
        WHEN 'PURCHASE_PAYMENT'   THEN 'stock'
        WHEN 'INVENTORY_TRANSFER' THEN 'stock'
        WHEN 'WAGE'               THEN 'free'
        WHEN 'EXPENSE'            THEN 'free'
        WHEN 'DEPRECATION'        THEN 'free'
        ELSE 'free'
    END,
    v.source_business_type,
    v.source_business_id,
    '凭证自动生成 by ' || v.voucher_number || ' (backfill 2026-05-16 #720)',
    NULL,
    COALESCE(v.created_at, NOW()),
    COALESCE(v.created_at, NOW()),
    NOW()
FROM vouchers v
WHERE v.deleted_at IS NULL
  AND v.source_business_type IS NOT NULL
  AND v.source_business_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM business_links bl
      WHERE bl.owner_type  = 'VOUCHER'
        AND bl.owner_id    = v.id
        AND bl.target_type = v.source_business_type
        AND bl.target_id   = v.source_business_id
  );

-- Verify counts after run:
--   SELECT factory_id, COUNT(*) FROM business_links
--   WHERE owner_type = 'VOUCHER' GROUP BY factory_id ORDER BY 1;
