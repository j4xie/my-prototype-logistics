-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_27__add_role_hierarchy_fields.sql
-- Conversion date: 2026-01-26 18:45:50
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- 角色层级系统重构迁移脚本
-- 版本: V2025_12_27
-- 描述: 添加用户角色层级相关字段，支持14角色双平台系统
-- ============================================================

-- 添加新字段到 users 表
ALTER TABLE users
ADD COLUMN IF NOT EXISTS level INT DEFAULT 99 COMMENT '权限级别 (0最高, 99最低)',
ADD COLUMN IF NOT EXISTS platform_type VARCHAR(20) DEFAULT 'web,mobile' COMMENT '支持的平台: web, mobile, web,mobile',
ADD COLUMN IF NOT EXISTS reports_to BIGINT NULL COMMENT '汇报对象用户ID',
ADD COLUMN IF NOT EXISTS secondary_reports_to BIGINT NULL COMMENT '质检员双重汇报 (质量经理ID)';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_users_reports_to ON users(reports_to);

-- 迁移现有数据的权限级别
-- Level 0: 工厂超级管理员
UPDATE users SET level = 0 WHERE role_code = 'factory_super_admin' AND level IS NULL;

-- Level 10: 职能部门经理
UPDATE users SET level = 10 WHERE role_code IN (
    'hr_admin',
    'procurement_manager',
    'sales_manager',
    'production_manager',
    'warehouse_manager',
    'equipment_admin',
    'quality_manager',
    'finance_manager',
    'permission_admin'
) AND level IS NULL;

-- Level 15: 部门管理员 (向后兼容)
UPDATE users SET level = 15 WHERE role_code = 'department_admin' AND level IS NULL;

-- Level 20: 车间主任
UPDATE users SET level = 20 WHERE role_code = 'workshop_supervisor' AND level IS NULL;

-- Level 30: 一线员工
UPDATE users SET level = 30 WHERE role_code IN (
    'quality_inspector',
    'operator',
    'warehouse_worker'
) AND level IS NULL;

-- Level 50: 查看者
UPDATE users SET level = 50 WHERE role_code = 'viewer' AND level IS NULL;

-- Level 99: 未激活
UPDATE users SET level = 99 WHERE role_code = 'unactivated' AND level IS NULL;
UPDATE users SET level = 99 WHERE role_code IS NULL AND level IS NULL;

-- 所有用户默认支持双平台
UPDATE users SET platform_type = 'web,mobile' WHERE platform_type IS NULL;

-- ============================================================
-- 角色映射表 (用于快速查询角色信息)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_definitions (
    id SERIAL PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL UNIQUE COMMENT '角色代码',
    display_name VARCHAR(50) NOT NULL COMMENT '显示名称',
    description VARCHAR(200) COMMENT '角色描述',
    level INT NOT NULL DEFAULT 99 COMMENT '权限级别',
    department VARCHAR(50) COMMENT '所属部门',
    is_deprecated BOOLEAN DEFAULT FALSE COMMENT '是否已废弃',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 插入角色定义数据
INSERT INTO role_definitions (role_code, display_name, description, level, department, is_deprecated) VALUES
('factory_super_admin', '工厂总监', '拥有工厂所有权限', 0, 'all', FALSE),
('hr_admin', 'HR管理员', '人事管理、考勤、薪资', 10, 'hr', FALSE),
('procurement_manager', '采购主管', '供应商、采购、成本', 10, 'procurement', FALSE),
('sales_manager', '销售主管', '客户、订单、出货', 10, 'sales', FALSE),
('production_manager', '生产经理', '车间统管、生产计划', 10, 'production', FALSE),
('warehouse_manager', '仓储主管', '库存、出入库、盘点', 10, 'warehouse', FALSE),
('equipment_admin', '设备管理员', '设备维护、保养、告警', 10, 'equipment', FALSE),
('quality_manager', '质量经理', '质量体系、质检审核', 10, 'quality', FALSE),
('finance_manager', '财务主管', '成本核算、费用、报表', 10, 'finance', FALSE),
('workshop_supervisor', '车间主任', '车间日常、人员调度', 20, 'workshop', FALSE),
('quality_inspector', '质检员', '执行质检、提交报告', 30, 'quality', FALSE),
('operator', '操作员', '生产执行、打卡记录', 30, 'production', FALSE),
('warehouse_worker', '仓库员', '出入库操作、盘点', 30, 'warehouse', FALSE),
('permission_admin', '权限管理员', '管理用户权限和角色', 10, 'system', TRUE),
('department_admin', '部门管理员', '管理部门相关业务', 15, 'department', TRUE),
('viewer', '查看者', '只读访问', 50, 'none', FALSE),
('unactivated', '未激活', '账户未激活', 99, 'none', FALSE)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    description = VALUES(description),
    level = VALUES(level),
    department = VALUES(department),
    is_deprecated = VALUES(is_deprecated);

-- ============================================================
-- 权限矩阵表 (存储模块与角色的权限关系)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL COMMENT '角色代码',
    module VARCHAR(50) NOT NULL COMMENT '功能模块',
    permission_type ENUM('none', 'read', 'write', 'read_write') DEFAULT 'none' COMMENT '权限类型',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_module (role_code, module)
);

-- 插入权限矩阵数据 (基于计划中的权限矩阵)
-- factory_super_admin: 所有模块 RW
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('factory_super_admin', 'dashboard', 'read_write'),
('factory_super_admin', 'production', 'read_write'),
('factory_super_admin', 'warehouse', 'read_write'),
('factory_super_admin', 'quality', 'read_write'),
('factory_super_admin', 'procurement', 'read_write'),
('factory_super_admin', 'sales', 'read_write'),
('factory_super_admin', 'hr', 'read_write'),
('factory_super_admin', 'equipment', 'read_write'),
('factory_super_admin', 'system', 'read_write')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- production_manager
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('production_manager', 'dashboard', 'read_write'),
('production_manager', 'production', 'read_write'),
('production_manager', 'warehouse', 'read'),
('production_manager', 'quality', 'read'),
('production_manager', 'procurement', 'read'),
('production_manager', 'hr', 'read'),
('production_manager', 'equipment', 'read'),
('production_manager', 'system', 'read')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- quality_manager
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('quality_manager', 'dashboard', 'read'),
('quality_manager', 'production', 'read'),
('quality_manager', 'quality', 'read_write')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- workshop_supervisor
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('workshop_supervisor', 'dashboard', 'read'),
('workshop_supervisor', 'production', 'read_write'),
('workshop_supervisor', 'warehouse', 'read'),
('workshop_supervisor', 'quality', 'write'),
('workshop_supervisor', 'hr', 'read'),
('workshop_supervisor', 'equipment', 'read')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- quality_inspector
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('quality_inspector', 'dashboard', 'read'),
('quality_inspector', 'production', 'read'),
('quality_inspector', 'quality', 'write')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- operator
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('operator', 'dashboard', 'read'),
('operator', 'production', 'write')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- warehouse_manager
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('warehouse_manager', 'dashboard', 'read_write'),
('warehouse_manager', 'warehouse', 'read_write'),
('warehouse_manager', 'production', 'read')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- warehouse_worker
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('warehouse_worker', 'dashboard', 'read'),
('warehouse_worker', 'warehouse', 'write')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- hr_admin
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('hr_admin', 'dashboard', 'read'),
('hr_admin', 'hr', 'read_write')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- equipment_admin
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('equipment_admin', 'dashboard', 'read'),
('equipment_admin', 'equipment', 'read_write')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- procurement_manager
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('procurement_manager', 'dashboard', 'read'),
('procurement_manager', 'procurement', 'read_write'),
('procurement_manager', 'warehouse', 'read')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- sales_manager
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('sales_manager', 'dashboard', 'read'),
('sales_manager', 'sales', 'read_write'),
('sales_manager', 'warehouse', 'read')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- finance_manager
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('finance_manager', 'dashboard', 'read'),
('finance_manager', 'finance', 'read_write'),
('finance_manager', 'production', 'read'),
('finance_manager', 'procurement', 'read'),
('finance_manager', 'sales', 'read')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- viewer: 只读所有模块
INSERT INTO role_permissions (role_code, module, permission_type) VALUES
('viewer', 'dashboard', 'read'),
('viewer', 'production', 'read'),
('viewer', 'warehouse', 'read'),
('viewer', 'quality', 'read'),
('viewer', 'procurement', 'read'),
('viewer', 'sales', 'read'),
('viewer', 'hr', 'read'),
('viewer', 'equipment', 'read')
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);
