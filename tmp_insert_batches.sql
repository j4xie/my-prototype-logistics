SET client_encoding TO 'UTF8';

INSERT INTO production_batches (batch_number, status, factory_id, product_name, product_type_id, planned_quantity, quantity, actual_quantity, good_quantity, defect_quantity, start_time, supervisor_name, unit, created_at, updated_at)
VALUES
('PB20260210001', 'IN_PROGRESS', 'F001', E'\u9EC4\u91D1\u867E\u6392', 'PT002', 600, 600, 320, 310, 10, NOW() - INTERVAL '2 hours', 'workshop_sup1', 'kg', NOW(), NOW()),
('PB20260210002', 'IN_PROGRESS', 'F001', E'\u9999\u9165\u9C7C\u67F3', 'PT003', 450, 450, 180, 175, 5, NOW() - INTERVAL '1 hour', 'workshop_sup1', 'kg', NOW(), NOW()),
('PB20260211001', 'IN_PROGRESS', 'F001', E'\u849C\u84C9\u6247\u8D1D', 'PT001', 300, 300, 0, 0, 0, NOW() - INTERVAL '30 minutes', 'workshop_sup1', 'kg', NOW(), NOW());
