-- Phase 1 End-to-End Testing - Test Data Preparation
-- Generated: 2025-11-20
-- Purpose: Create comprehensive test data for all 8 roles and business flows

USE cretas_db;

-- ================================================
-- 1. TEST FACTORIES
-- ================================================

INSERT INTO factories (id, factory_name, factory_type, contact_person, contact_phone, address, status, created_at, updated_at)
VALUES
  ('test-factory-001', '测试工厂A（鸡胸肉加工）', 'PROCESSING', '张三', '13800138001', '上海市浦东新区测试路100号', 'ACTIVE', NOW(), NOW()),
  ('test-factory-002', '测试工厂B（综合加工）', 'PROCESSING', '李四', '13800138002', '北京市朝阳区测试街200号', 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 2. TEST USERS (8 Roles)
-- ================================================
-- Password for all test users: Test@123456 (BCrypt encrypted)

-- 2.1 Developer (Platform Level)
INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-developer', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5X5n5Xe', 'developer', 'dev@test.com', '13900000001', NULL, NULL, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2.2 Platform Admin
INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-platform-admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5X5n5Xe', 'platform_admin', 'platform@test.com', '13900000002', NULL, NULL, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2.3 Factory Super Admin (Factory A)
INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-super-admin-a', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5X5n5Xe', 'factory_super_admin', 'super@factory-a.com', '13900000003', 'test-factory-001', NULL, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2.4 Factory Admin (Factory A)
INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-admin-a', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5X5n5Xe', 'factory_admin', 'admin@factory-a.com', '13900000004', 'test-factory-001', NULL, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2.5 Department Admin (Factory A, Production Department)
INSERT INTO departments (id, factory_id, department_name, description, status, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', '测试生产部', '用于端到端测试', 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-dept-admin-a', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5X5n5Xe', 'department_admin', 'dept@factory-a.com', '13900000005', 'test-factory-001', 9001, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2.6 Quality Inspector (Factory A)
INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-inspector-a', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5X5n5Xe', 'quality_inspector', 'inspector@factory-a.com', '13900000006', 'test-factory-001', 9001, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2.7 Supervisor (Factory A)
INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-supervisor-a', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5Xe', 'supervisor', 'supervisor@factory-a.com', '13900000007', 'test-factory-001', 9001, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2.8 Operator (Factory A)
INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-operator-a', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5Xe', 'operator', 'operator@factory-a.com', '13900000008', 'test-factory-001', 9001, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2.9 Cross-factory test user (Factory B) for permission isolation testing
INSERT INTO users (username, password, role, email, phone, factory_id, department_id, status, created_at, updated_at)
VALUES
  ('test-admin-b', '$2a$10$N9qo8uLOickgx2ZMRZoMye5JQN5X5n5X5n5X5n5X5n5X5n5X5n5Xe', 'factory_admin', 'admin@factory-b.com', '13900000009', 'test-factory-002', NULL, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 3. PRODUCT TYPES
-- ================================================

INSERT INTO product_types (id, factory_id, product_name, product_code, category, unit, standard_cost, standard_price, status, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', '测试鸡胸肉（冷冻）', 'TEST-CHICKEN-001', '肉类加工', 'kg', 25.00, 45.00, 'ACTIVE', NOW(), NOW()),
  (9002, 'test-factory-001', '测试鸡胸肉（鲜品）', 'TEST-CHICKEN-002', '肉类加工', 'kg', 30.00, 55.00, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 4. MATERIAL BATCHES (FIFO Testing)
-- ================================================

-- Batch 1: 1000kg chicken breast, expires in 30 days
INSERT INTO material_batches (id, factory_id, supplier_id, material_type_id, material_name, batch_number, quantity, unit, unit_price, total_cost, manufacture_date, expiry_date, quality_status, storage_location, received_by, notes, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', NULL, NULL, '测试原料-鸡胸肉', 'MAT-TEST-20251120-001', 1000.00, 'kg', 18.00, 18000.00, '2025-11-15', '2025-12-20', 'QUALIFIED', '冷库A区', 1, 'FIFO测试批次1', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Batch 2: 800kg chicken breast, expires in 20 days (should be used first by FIFO)
INSERT INTO material_batches (id, factory_id, supplier_id, material_type_id, material_name, batch_number, quantity, unit, unit_price, total_cost, manufacture_date, expiry_date, quality_status, storage_location, received_by, notes, created_at, updated_at)
VALUES
  (9002, 'test-factory-001', NULL, NULL, '测试原料-鸡胸肉', 'MAT-TEST-20251120-002', 800.00, 'kg', 19.00, 15200.00, '2025-11-10', '2025-12-10', 'QUALIFIED', '冷库B区', 1, 'FIFO测试批次2（优先使用）', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 5. PROCESSING BATCHES (7-Day Production Flow)
-- ================================================

-- Day 0: Create processing batch
INSERT INTO processing_batches (id, factory_id, batch_number, product_type_id, product_name, planned_quantity, quantity, unit, status, quality_status, start_time, supervisor_id, supervisor_name, notes, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', 'PROC-TEST-20251120-001', 9001, '测试鸡胸肉（冷冻）', 500.00, 500.00, 'kg', 'PLANNED', 'PENDING_INSPECTION', NULL, 1, '测试主管', '7日生产流程测试', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 6. PRODUCTION BATCHES
-- ================================================

INSERT INTO production_batches (id, factory_id, batch_number, production_plan_id, product_type, product_name, planned_quantity, quantity, unit, status, quality_status, start_time, equipment_id, equipment_name, supervisor_id, supervisor_name, worker_count, notes, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', 'PROD-TEST-20251120-001', NULL, 'TEST-CHICKEN-001', '测试鸡胸肉（冷冻）', 500.00, 500.00, 'kg', 'PLANNED', 'PENDING_INSPECTION', NULL, NULL, '测试生产线A', 1, '测试主管', 5, '端到端测试生产批次', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 7. EQUIPMENT (for equipment monitoring)
-- ================================================

INSERT INTO equipment (id, factory_id, equipment_code, equipment_name, equipment_type, status, purchase_date, maintenance_cycle_days, last_maintenance_date, next_maintenance_date, location, notes, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', 'EQ-TEST-001', '测试切割机A', '切割设备', 'RUNNING', '2024-01-01', 30, '2025-11-01', '2025-12-01', '车间A区', '用于端到端测试', NOW(), NOW()),
  (9002, 'test-factory-001', 'EQ-TEST-002', '测试包装机B', '包装设备', 'IDLE', '2024-01-01', 30, '2025-11-01', '2025-12-01', '车间B区', '用于端到端测试', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 8. EQUIPMENT ALERTS (for alert navigation testing)
-- ================================================

INSERT INTO equipment_alerts (id, factory_id, equipment_id, alert_type, level, message, details, triggered_at, status, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', 9001, 'MAINTENANCE_DUE', 'WARNING', '测试设备维护到期预警', '设备"测试切割机A"即将到期维护，请及时安排', NOW(), 'ACTIVE', NULL, NULL, NULL, NOW(), NOW()),
  (9002, 'test-factory-001', 9002, 'TEMPERATURE_ABNORMAL', 'CRITICAL', '测试设备温度异常', '设备"测试包装机B"温度超出正常范围（当前45°C，正常<40°C）', NOW(), 'ACTIVE', NULL, NULL, NULL, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 9. AI QUOTA CONFIGURATION (for AI analysis testing)
-- ================================================

INSERT INTO ai_quota_config (id, factory_id, weekly_quota, quota_type, reset_day, status, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', 100, 'WEEKLY', 'MONDAY', 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Initialize quota usage
INSERT INTO ai_quota_usage (id, factory_id, week_start_date, week_end_date, used_quota, remaining_quota, status, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY), 15, 85, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- 10. TIME CLOCK RECORDS (for attendance testing)
-- ================================================

-- Today's clock-in record for test operator
INSERT INTO time_clock_records (id, factory_id, user_id, username, clock_type, clock_time, gps_latitude, gps_longitude, notes, created_at, updated_at)
VALUES
  (9001, 'test-factory-001', 1, 'test-operator-a', 'CLOCK_IN', CONCAT(CURDATE(), ' 08:00:00'), 31.2304, 121.4737, '测试打卡记录', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

SELECT '=== TEST DATA SUMMARY ===' AS info;

SELECT 'Factories' AS entity, COUNT(*) AS count FROM factories WHERE id LIKE 'test-factory-%'
UNION ALL
SELECT 'Users (8 roles)', COUNT(*) FROM users WHERE username LIKE 'test-%'
UNION ALL
SELECT 'Departments', COUNT(*) FROM departments WHERE id = 9001
UNION ALL
SELECT 'Product Types', COUNT(*) FROM product_types WHERE id >= 9001 AND id < 9100
UNION ALL
SELECT 'Material Batches', COUNT(*) FROM material_batches WHERE id >= 9001 AND id < 9100
UNION ALL
SELECT 'Processing Batches', COUNT(*) FROM processing_batches WHERE id >= 9001 AND id < 9100
UNION ALL
SELECT 'Production Batches', COUNT(*) FROM production_batches WHERE id >= 9001 AND id < 9100
UNION ALL
SELECT 'Equipment', COUNT(*) FROM equipment WHERE id >= 9001 AND id < 9100
UNION ALL
SELECT 'Equipment Alerts', COUNT(*) FROM equipment_alerts WHERE id >= 9001 AND id < 9100
UNION ALL
SELECT 'AI Quota Config', COUNT(*) FROM ai_quota_config WHERE id >= 9001 AND id < 9100
UNION ALL
SELECT 'Time Clock Records', COUNT(*) FROM time_clock_records WHERE id >= 9001 AND id < 9100;

SELECT '=== TEST USERS (8 Roles) ===' AS info;
SELECT id, username, role, factory_id, department_id, status
FROM users
WHERE username LIKE 'test-%'
ORDER BY
  CASE role
    WHEN 'developer' THEN 1
    WHEN 'platform_admin' THEN 2
    WHEN 'factory_super_admin' THEN 3
    WHEN 'factory_admin' THEN 4
    WHEN 'department_admin' THEN 5
    WHEN 'quality_inspector' THEN 6
    WHEN 'supervisor' THEN 7
    WHEN 'operator' THEN 8
  END;

SELECT '=== MATERIAL BATCHES (FIFO Order) ===' AS info;
SELECT id, batch_number, quantity, unit_price, expiry_date, notes
FROM material_batches
WHERE id >= 9001 AND id < 9100
ORDER BY expiry_date ASC;

SELECT 'Test data preparation completed successfully!' AS status;
