-- Test BOM conversion data for E2E flow verification
INSERT INTO material_product_conversions (id, factory_id, material_type_id, product_type_id, conversion_rate, wastage_rate, standard_usage, is_active, notes, created_at, updated_at)
VALUES
  ('conv-test-001', 'F001', 'RMT-F001-004', 'PT-F001-003', 0.80, 5.00, 1.25, true, 'squid->squid ring test', NOW(), NOW()),
  ('conv-test-002', 'F001', 'RMT-F001-001', 'PT-F001-001', 0.75, 3.00, 1.33, true, 'hairtail->hairtail fillet test', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Verify
SELECT id, material_type_id, product_type_id, conversion_rate, wastage_rate FROM material_product_conversions WHERE factory_id='F001';
