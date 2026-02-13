-- =============================================
-- Create F006 (六膳门) user accounts
-- Run on server: psql -h localhost -U cretas_user -d cretas_db -f create_f006_users.sql
-- Password hash is BCrypt of "123456"
-- =============================================

-- Check if users already exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE username = 'f006_admin') THEN
    RAISE NOTICE 'f006_admin already exists, skipping all inserts';
    RETURN;
  END IF;

  INSERT INTO users (username, password_hash, factory_id, full_name, phone, email, department, position, role_code, is_active, level, platform_type, created_at, updated_at)
  VALUES
    ('f006_admin',        '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F006', '六膳门管理员',   '16651196431', 'f006_admin@cretas.com',   '管理部',   '工厂管理员', 'factory_super_admin', true, 0,  'web,mobile', NOW(), NOW()),
    ('f006_workshop_sup', '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F006', '六膳门车间主管', NULL,           'f006_workshop@cretas.com', '生产车间', '车间主管',   'workshop_supervisor', true, 10, 'web,mobile', NOW(), NOW()),
    ('f006_worker1',      '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse', 'F006', '六膳门操作员1', NULL,           'f006_worker1@cretas.com',  '生产车间', '操作员',     'operator',           true, 30, 'web,mobile', NOW(), NOW());

  RAISE NOTICE 'Created 3 users for F006';
END $$;

-- Verify
SELECT id, username, full_name, role_code, factory_id, is_active FROM users WHERE factory_id = 'F006' ORDER BY id;
