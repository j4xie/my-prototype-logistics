-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_31_2__system_enums.sql
-- Conversion date: 2026-01-26 18:46:32
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- 系统枚举配置表
-- 将硬编码Java枚举迁移到数据库配置
-- V2025_12_31_2
-- =====================================================

-- 创建 system_enums 表
CREATE TABLE IF NOT EXISTS system_enums (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL DEFAULT '*' COMMENT '工厂ID (*表示全局)',
    enum_group VARCHAR(50) NOT NULL COMMENT '枚举组',
    enum_code VARCHAR(50) NOT NULL COMMENT '枚举代码',
    enum_label VARCHAR(100) NOT NULL COMMENT '显示标签',
    enum_description VARCHAR(200) COMMENT '枚举描述',
    enum_value VARCHAR(100) COMMENT '附加值',
    sort_order INT DEFAULT 0 COMMENT '排序',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    is_system BOOLEAN DEFAULT TRUE COMMENT '是否系统内置',
    metadata JSON COMMENT '扩展元数据',
    parent_code VARCHAR(50) COMMENT '父枚举代码',
    icon VARCHAR(50) COMMENT '图标',
    color VARCHAR(20) COMMENT '颜色代码',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    UNIQUE KEY uk_factory_group_code (factory_id, enum_group, enum_code),
    INDEX idx_enum_factory_group (factory_id, enum_group),
    INDEX idx_enum_group (enum_group),
    INDEX idx_enum_is_active (is_active)
)
;

-- =====================================================
-- 1. PROCESSING_STAGE - 加工环节类型 (24个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, metadata) VALUES
-- 前处理环节
('enum-ps-001', '*', 'PROCESSING_STAGE', 'RECEIVING', '接收', '原料接收验收', 1, '{"category": "前处理"}'),
('enum-ps-002', '*', 'PROCESSING_STAGE', 'THAWING', '解冻', '半解冻处理', 2, '{"category": "前处理"}'),
('enum-ps-003', '*', 'PROCESSING_STAGE', 'TRIMMING', '修整', '去尾/修整处理', 3, '{"category": "前处理"}'),
-- 主加工环节
('enum-ps-004', '*', 'PROCESSING_STAGE', 'SLICING', '切片', '机械切片', 10, '{"category": "主加工"}'),
('enum-ps-005', '*', 'PROCESSING_STAGE', 'DICING', '切丁', '切丁处理', 11, '{"category": "主加工"}'),
('enum-ps-006', '*', 'PROCESSING_STAGE', 'MINCING', '绞碎', '绞碎处理', 12, '{"category": "主加工"}'),
-- 清洗环节
('enum-ps-007', '*', 'PROCESSING_STAGE', 'WASHING', '清洗', '清洗处理', 20, '{"category": "清洗"}'),
('enum-ps-008', '*', 'PROCESSING_STAGE', 'DRAINING', '沥干', '沥干处理', 21, '{"category": "清洗"}'),
-- 调味环节
('enum-ps-009', '*', 'PROCESSING_STAGE', 'MARINATING', '腌制', '腌制/上浆', 30, '{"category": "调味"}'),
('enum-ps-010', '*', 'PROCESSING_STAGE', 'SEASONING', '调味', '调味处理', 31, '{"category": "调味"}'),
-- 热处理环节
('enum-ps-011', '*', 'PROCESSING_STAGE', 'COOKING', '烹饪', '烹饪/蒸煮', 40, '{"category": "热处理"}'),
('enum-ps-012', '*', 'PROCESSING_STAGE', 'FRYING', '油炸', '油炸处理', 41, '{"category": "热处理"}'),
('enum-ps-013', '*', 'PROCESSING_STAGE', 'BAKING', '烘烤', '烘烤处理', 42, '{"category": "热处理"}'),
('enum-ps-014', '*', 'PROCESSING_STAGE', 'STEAMING', '蒸制', '蒸制处理', 43, '{"category": "热处理"}'),
-- 冷处理环节
('enum-ps-015', '*', 'PROCESSING_STAGE', 'COOLING', '冷却', '冷却处理', 50, '{"category": "冷处理"}'),
('enum-ps-016', '*', 'PROCESSING_STAGE', 'FREEZING', '速冻', 'IQF速冻', 51, '{"category": "冷处理"}'),
('enum-ps-017', '*', 'PROCESSING_STAGE', 'CHILLING', '冷藏', '冷藏处理', 52, '{"category": "冷处理"}'),
-- 包装环节
('enum-ps-018', '*', 'PROCESSING_STAGE', 'PACKAGING', '包装', '成品包装', 60, '{"category": "包装"}'),
('enum-ps-019', '*', 'PROCESSING_STAGE', 'LABELING', '贴标', '标签打印', 61, '{"category": "包装"}'),
('enum-ps-020', '*', 'PROCESSING_STAGE', 'BOXING', '装箱', '装箱处理', 62, '{"category": "包装"}'),
-- 质检环节
('enum-ps-021', '*', 'PROCESSING_STAGE', 'QUALITY_CHECK', '品控', '品控检查', 70, '{"category": "质检"}'),
('enum-ps-022', '*', 'PROCESSING_STAGE', 'METAL_DETECTION', '金属检测', '金属探测', 71, '{"category": "质检"}'),
('enum-ps-023', '*', 'PROCESSING_STAGE', 'WEIGHT_CHECK', '称重检测', '重量检测', 72, '{"category": "质检"}'),
-- 其他环节
('enum-ps-024', '*', 'PROCESSING_STAGE', 'CLEANING', '清洁', '设备清洁', 80, '{"category": "其他"}'),
('enum-ps-025', '*', 'PROCESSING_STAGE', 'LINE_CHANGE', '换线', '产线切换', 81, '{"category": "其他"}'),
('enum-ps-026', '*', 'PROCESSING_STAGE', 'OTHER', '其他', '其他环节', 99, '{"category": "其他"}');

-- =====================================================
-- 2. FACTORY_USER_ROLE - 工厂用户角色 (16个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, metadata) VALUES
-- Level 0: 最高管理层
('enum-fur-001', '*', 'FACTORY_USER_ROLE', 'factory_super_admin', '工厂总监', '拥有工厂所有权限', 1, '{"level": 0, "department": "all", "permissionPrefix": "*"}'),
-- Level 10: 职能部门经理
('enum-fur-002', '*', 'FACTORY_USER_ROLE', 'hr_admin', 'HR管理员', '人事管理、考勤、薪资', 10, '{"level": 10, "department": "hr", "permissionPrefix": "hr"}'),
('enum-fur-003', '*', 'FACTORY_USER_ROLE', 'procurement_manager', '采购主管', '供应商、采购、成本', 11, '{"level": 10, "department": "procurement", "permissionPrefix": "procurement"}'),
('enum-fur-004', '*', 'FACTORY_USER_ROLE', 'sales_manager', '销售主管', '客户、订单、出货', 12, '{"level": 10, "department": "sales", "permissionPrefix": "sales"}'),
('enum-fur-005', '*', 'FACTORY_USER_ROLE', 'dispatcher', '调度', '生产调度、数据分析、趋势监控', 13, '{"level": 10, "department": "dispatch", "permissionPrefix": "production"}'),
('enum-fur-006', '*', 'FACTORY_USER_ROLE', 'warehouse_manager', '仓储主管', '库存、出入库、盘点', 14, '{"level": 10, "department": "warehouse", "permissionPrefix": "warehouse"}'),
('enum-fur-007', '*', 'FACTORY_USER_ROLE', 'equipment_admin', '设备管理员', '设备维护、保养、告警', 15, '{"level": 10, "department": "equipment", "permissionPrefix": "equipment"}'),
('enum-fur-008', '*', 'FACTORY_USER_ROLE', 'quality_manager', '质量经理', '质量体系、质检审核', 16, '{"level": 10, "department": "quality", "permissionPrefix": "quality"}'),
('enum-fur-009', '*', 'FACTORY_USER_ROLE', 'finance_manager', '财务主管', '成本核算、费用、报表', 17, '{"level": 10, "department": "finance", "permissionPrefix": "finance"}'),
-- Level 20: 车间管理层
('enum-fur-010', '*', 'FACTORY_USER_ROLE', 'workshop_supervisor', '车间主任', '车间日常、人员调度', 20, '{"level": 20, "department": "workshop", "permissionPrefix": "production"}'),
-- Level 30: 一线员工
('enum-fur-011', '*', 'FACTORY_USER_ROLE', 'quality_inspector', '质检员', '执行质检、提交报告', 30, '{"level": 30, "department": "quality", "permissionPrefix": "quality"}'),
('enum-fur-012', '*', 'FACTORY_USER_ROLE', 'operator', '操作员', '生产执行、打卡记录', 31, '{"level": 30, "department": "production", "permissionPrefix": "production"}'),
('enum-fur-013', '*', 'FACTORY_USER_ROLE', 'warehouse_worker', '仓库员', '出入库操作、盘点', 32, '{"level": 30, "department": "warehouse", "permissionPrefix": "warehouse"}'),
-- 特殊角色
('enum-fur-014', '*', 'FACTORY_USER_ROLE', 'viewer', '查看者', '只读访问', 50, '{"level": 50, "department": "none", "permissionPrefix": "view"}'),
('enum-fur-015', '*', 'FACTORY_USER_ROLE', 'unactivated', '未激活', '账户未激活', 99, '{"level": 99, "department": "none", "permissionPrefix": "none"}');

-- =====================================================
-- 3. QUALITY_STATUS - 质量状态 (9个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color, metadata) VALUES
('enum-qs-001', '*', 'QUALITY_STATUS', 'PENDING_INSPECTION', '待质检', '批次已完成生产，等待质量检验', 1, '#FFA500', '{"isFinal": false}'),
('enum-qs-002', '*', 'QUALITY_STATUS', 'INSPECTING', '质检中', '正在进行质量检验', 2, '#1E90FF', '{"isFinal": false}'),
('enum-qs-003', '*', 'QUALITY_STATUS', 'PASSED', '已通过', '质量检验合格', 3, '#32CD32', '{"isFinal": true, "isPassed": true}'),
('enum-qs-004', '*', 'QUALITY_STATUS', 'FAILED', '未通过', '质量检验不合格', 4, '#FF4500', '{"isFinal": false, "isPassed": false}'),
('enum-qs-005', '*', 'QUALITY_STATUS', 'PARTIAL_PASS', '部分通过', '部分产品合格', 5, '#FFD700', '{"isFinal": false, "isPassed": true}'),
('enum-qs-006', '*', 'QUALITY_STATUS', 'REWORK_REQUIRED', '需返工', '需要返工修复', 6, '#FF6347', '{"isFinal": false, "needsRework": true}'),
('enum-qs-007', '*', 'QUALITY_STATUS', 'REWORKING', '返工中', '正在进行返工处理', 7, '#9370DB', '{"isFinal": false, "needsRework": true}'),
('enum-qs-008', '*', 'QUALITY_STATUS', 'REWORK_COMPLETED', '返工完成', '返工处理已完成', 8, '#20B2AA', '{"isFinal": true}'),
('enum-qs-009', '*', 'QUALITY_STATUS', 'SCRAPPED', '已报废', '已报废处理', 9, '#808080', '{"isFinal": true}');

-- =====================================================
-- 4. MATERIAL_BATCH_STATUS - 原材料批次状态 (10个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color) VALUES
('enum-mbs-001', '*', 'MATERIAL_BATCH_STATUS', 'IN_STOCK', '库存中', '批次在库存中', 1, '#2196F3'),
('enum-mbs-002', '*', 'MATERIAL_BATCH_STATUS', 'AVAILABLE', '可用', '批次可以正常使用', 2, '#4CAF50'),
('enum-mbs-003', '*', 'MATERIAL_BATCH_STATUS', 'FRESH', '鲜品', '新鲜原材料批次', 3, '#8BC34A'),
('enum-mbs-004', '*', 'MATERIAL_BATCH_STATUS', 'FROZEN', '冻品', '已冻结原材料批次', 4, '#00BCD4'),
('enum-mbs-005', '*', 'MATERIAL_BATCH_STATUS', 'DEPLETED', '已耗尽', '批次已全部预留或消耗', 5, '#9E9E9E'),
('enum-mbs-006', '*', 'MATERIAL_BATCH_STATUS', 'USED_UP', '已用完', '批次已全部消耗', 6, '#607D8B'),
('enum-mbs-007', '*', 'MATERIAL_BATCH_STATUS', 'EXPIRED', '已过期', '批次已超过保质期', 7, '#F44336'),
('enum-mbs-008', '*', 'MATERIAL_BATCH_STATUS', 'INSPECTING', '质检中', '批次正在质量检验', 8, '#FF9800'),
('enum-mbs-009', '*', 'MATERIAL_BATCH_STATUS', 'SCRAPPED', '已报废', '批次已报废处理', 9, '#795548'),
('enum-mbs-010', '*', 'MATERIAL_BATCH_STATUS', 'RESERVED', '已预留', '批次已被预留', 10, '#9C27B0');

-- =====================================================
-- 5. PRODUCTION_PLAN_STATUS - 生产计划状态 (6个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color, metadata) VALUES
('enum-pps-001', '*', 'PRODUCTION_PLAN_STATUS', 'PLANNED', '已计划', '计划已创建', 1, '#2196F3', '{"isFinal": false}'),
('enum-pps-002', '*', 'PRODUCTION_PLAN_STATUS', 'PENDING', '待处理', '计划已创建，等待开始', 2, '#FF9800', '{"isFinal": false}'),
('enum-pps-003', '*', 'PRODUCTION_PLAN_STATUS', 'IN_PROGRESS', '进行中', '生产正在进行', 3, '#4CAF50', '{"isFinal": false}'),
('enum-pps-004', '*', 'PRODUCTION_PLAN_STATUS', 'COMPLETED', '已完成', '生产已完成', 4, '#8BC34A', '{"isFinal": true}'),
('enum-pps-005', '*', 'PRODUCTION_PLAN_STATUS', 'CANCELLED', '已取消', '计划已取消', 5, '#F44336', '{"isFinal": true}'),
('enum-pps-006', '*', 'PRODUCTION_PLAN_STATUS', 'PAUSED', '暂停', '生产暂时停止', 6, '#9E9E9E', '{"isFinal": false}');

-- =====================================================
-- 6. PRODUCTION_BATCH_STATUS - 生产批次状态 (7个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color) VALUES
('enum-pbs-001', '*', 'PRODUCTION_BATCH_STATUS', 'PLANNED', '计划中', '生产批次已计划', 1, '#2196F3'),
('enum-pbs-002', '*', 'PRODUCTION_BATCH_STATUS', 'IN_PRODUCTION', '生产中', '正在生产', 2, '#4CAF50'),
('enum-pbs-003', '*', 'PRODUCTION_BATCH_STATUS', 'PAUSED', '已暂停', '生产暂停', 3, '#FF9800'),
('enum-pbs-004', '*', 'PRODUCTION_BATCH_STATUS', 'COMPLETED', '已完成', '生产完成', 4, '#8BC34A'),
('enum-pbs-005', '*', 'PRODUCTION_BATCH_STATUS', 'CANCELLED', '已取消', '生产取消', 5, '#F44336'),
('enum-pbs-006', '*', 'PRODUCTION_BATCH_STATUS', 'PENDING', '待处理', '等待开始', 6, '#9E9E9E'),
('enum-pbs-007', '*', 'PRODUCTION_BATCH_STATUS', 'IN_PROGRESS', '进行中', '生产进行中', 7, '#4CAF50');

-- =====================================================
-- 7. EQUIPMENT_STATUS - 设备状态 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color) VALUES
('enum-es-001', '*', 'EQUIPMENT_STATUS', 'RUNNING', '运行中', '设备正常运行', 1, '#4CAF50'),
('enum-es-002', '*', 'EQUIPMENT_STATUS', 'IDLE', '空闲', '设备空闲待用', 2, '#2196F3'),
('enum-es-003', '*', 'EQUIPMENT_STATUS', 'MAINTENANCE', '维护中', '设备正在维护', 3, '#FF9800'),
('enum-es-004', '*', 'EQUIPMENT_STATUS', 'FAULT', '故障', '设备故障', 4, '#F44336'),
('enum-es-005', '*', 'EQUIPMENT_STATUS', 'OFFLINE', '离线', '设备离线', 5, '#9E9E9E');

-- =====================================================
-- 8. ALERT_LEVEL - 告警级别 (3个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color) VALUES
('enum-al-001', '*', 'ALERT_LEVEL', 'CRITICAL', '严重', '严重告警', 1, '#F44336'),
('enum-al-002', '*', 'ALERT_LEVEL', 'WARNING', '警告', '警告告警', 2, '#FF9800'),
('enum-al-003', '*', 'ALERT_LEVEL', 'INFO', '提示', '信息提示', 3, '#2196F3');

-- =====================================================
-- 9. ALERT_STATUS - 告警状态 (4个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color) VALUES
('enum-as-001', '*', 'ALERT_STATUS', 'ACTIVE', '活动中', '告警未处理', 1, '#F44336'),
('enum-as-002', '*', 'ALERT_STATUS', 'ACKNOWLEDGED', '已确认', '告警已确认', 2, '#FF9800'),
('enum-as-003', '*', 'ALERT_STATUS', 'RESOLVED', '已解决', '告警已解决', 3, '#4CAF50'),
('enum-as-004', '*', 'ALERT_STATUS', 'IGNORED', '已忽略', '告警已忽略', 4, '#9E9E9E');

-- =====================================================
-- 10. PLATFORM_ROLE - 平台角色 (4个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, metadata) VALUES
('enum-pr-001', '*', 'PLATFORM_ROLE', 'super_admin', '超级管理员', '平台最高权限', 1, '{"level": 0}'),
('enum-pr-002', '*', 'PLATFORM_ROLE', 'system_admin', '系统管理员', '系统配置权限', 2, '{"level": 10}'),
('enum-pr-003', '*', 'PLATFORM_ROLE', 'operation_admin', '运营管理员', '运营管理权限', 3, '{"level": 20}'),
('enum-pr-004', '*', 'PLATFORM_ROLE', 'auditor', '审计员', '只读审计权限', 4, '{"level": 30}');

-- =====================================================
-- 11. USER_TYPE - 用户类型 (2个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order) VALUES
('enum-ut-001', '*', 'USER_TYPE', 'PLATFORM', '平台用户', '平台级别用户', 1),
('enum-ut-002', '*', 'USER_TYPE', 'FACTORY', '工厂用户', '工厂级别用户', 2);

-- =====================================================
-- 12. DEPARTMENT - 部门 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order) VALUES
('enum-dept-001', '*', 'DEPARTMENT', 'FARMING', '养殖', '养殖部门', 1),
('enum-dept-002', '*', 'DEPARTMENT', 'PROCESSING', '加工', '加工部门', 2),
('enum-dept-003', '*', 'DEPARTMENT', 'LOGISTICS', '物流', '物流部门', 3),
('enum-dept-004', '*', 'DEPARTMENT', 'QUALITY', '质量', '质量部门', 4),
('enum-dept-005', '*', 'DEPARTMENT', 'MANAGEMENT', '管理', '管理部门', 5);

-- =====================================================
-- 13. STATUS - 通用状态 (4个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color) VALUES
('enum-st-001', '*', 'STATUS', 'ACTIVE', '激活', '账户已激活', 1, '#4CAF50'),
('enum-st-002', '*', 'STATUS', 'INACTIVE', '停用', '账户已停用', 2, '#9E9E9E'),
('enum-st-003', '*', 'STATUS', 'LOCKED', '锁定', '账户已锁定', 3, '#F44336'),
('enum-st-004', '*', 'STATUS', 'PENDING', '待激活', '账户待激活', 4, '#FF9800');

-- =====================================================
-- 14. HIRE_TYPE - 雇用类型 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, metadata) VALUES
('enum-ht-001', '*', 'HIRE_TYPE', 'FULL_TIME', '正式工', '正式员工', 1, '{"isPermanent": true}'),
('enum-ht-002', '*', 'HIRE_TYPE', 'PART_TIME', '兼职', '兼职员工', 2, '{"isPermanent": false}'),
('enum-ht-003', '*', 'HIRE_TYPE', 'DISPATCH', '派遣工', '派遣员工', 3, '{"isPermanent": false}'),
('enum-ht-004', '*', 'HIRE_TYPE', 'INTERN', '实习生', '实习员工', 4, '{"isPermanent": false}'),
('enum-ht-005', '*', 'HIRE_TYPE', 'TEMPORARY', '临时工', '临时员工', 5, '{"isPermanent": false}');

-- =====================================================
-- 15. QUALITY_CHECK_CATEGORY - 质检类别 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order) VALUES
('enum-qcc-001', '*', 'QUALITY_CHECK_CATEGORY', 'SENSORY', '感官检测', '外观、气味、口感', 1),
('enum-qcc-002', '*', 'QUALITY_CHECK_CATEGORY', 'PHYSICAL', '物理检测', '重量、尺寸、硬度', 2),
('enum-qcc-003', '*', 'QUALITY_CHECK_CATEGORY', 'CHEMICAL', '化学检测', '成分分析', 3),
('enum-qcc-004', '*', 'QUALITY_CHECK_CATEGORY', 'MICROBIOLOGICAL', '微生物检测', '菌落计数', 4),
('enum-qcc-005', '*', 'QUALITY_CHECK_CATEGORY', 'PACKAGING', '包装检测', '包装完整性', 5);

-- =====================================================
-- 16. QUALITY_SEVERITY - 质检项严重程度 (3个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, enum_value, sort_order, color) VALUES
('enum-qsv-001', '*', 'QUALITY_SEVERITY', 'CRITICAL', '关键项', '关键质量项', '3', 1, '#F44336'),
('enum-qsv-002', '*', 'QUALITY_SEVERITY', 'MAJOR', '主要项', '主要质量项', '2', 2, '#FF9800'),
('enum-qsv-003', '*', 'QUALITY_SEVERITY', 'MINOR', '次要项', '次要质量项', '1', 3, '#2196F3');

-- =====================================================
-- 17. REWORK_TYPE - 返工类型 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order) VALUES
('enum-rwt-001', '*', 'REWORK_TYPE', 'PRODUCTION_REWORK', '生产返工', '生产过程返工', 1),
('enum-rwt-002', '*', 'REWORK_TYPE', 'MATERIAL_REWORK', '原材料返工', '原材料问题返工', 2),
('enum-rwt-003', '*', 'REWORK_TYPE', 'QUALITY_REWORK', '质量返工', '质量问题返工', 3),
('enum-rwt-004', '*', 'REWORK_TYPE', 'PACKAGING_REWORK', '包装返工', '包装问题返工', 4),
('enum-rwt-005', '*', 'REWORK_TYPE', 'SPECIFICATION_REWORK', '规格调整', '规格不符返工', 5);

-- =====================================================
-- 18. REWORK_STATUS - 返工状态 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color) VALUES
('enum-rws-001', '*', 'REWORK_STATUS', 'PENDING', '待返工', '等待返工处理', 1, '#FF9800'),
('enum-rws-002', '*', 'REWORK_STATUS', 'IN_PROGRESS', '返工中', '正在返工', 2, '#2196F3'),
('enum-rws-003', '*', 'REWORK_STATUS', 'COMPLETED', '已完成', '返工完成', 3, '#4CAF50'),
('enum-rws-004', '*', 'REWORK_STATUS', 'FAILED', '返工失败', '返工失败', 4, '#F44336'),
('enum-rws-005', '*', 'REWORK_STATUS', 'CANCELLED', '已取消', '返工取消', 5, '#9E9E9E');

-- =====================================================
-- 19. SAMPLING_STRATEGY - 抽样策略 (6个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order) VALUES
('enum-ss-001', '*', 'SAMPLING_STRATEGY', 'FIRST_ARTICLE', '首件检验', '生产首件检验', 1),
('enum-ss-002', '*', 'SAMPLING_STRATEGY', 'RANDOM', '随机抽样', '随机抽取样品', 2),
('enum-ss-003', '*', 'SAMPLING_STRATEGY', 'BATCH_END', '批次末检验', '批次结束时检验', 3),
('enum-ss-004', '*', 'SAMPLING_STRATEGY', 'FULL', '全检', '全部检验', 4),
('enum-ss-005', '*', 'SAMPLING_STRATEGY', 'TIMED', '定时抽检', '定时抽样检验', 5),
('enum-ss-006', '*', 'SAMPLING_STRATEGY', 'AQL', 'AQL抽样', '接收质量限抽样', 6);

-- =====================================================
-- 20. PLAN_SOURCE_TYPE - 计划来源类型 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, metadata) VALUES
('enum-pst-001', '*', 'PLAN_SOURCE_TYPE', 'CUSTOMER_ORDER', '客户订单', '客户订单触发', 1, '{"priorityRange": [1, 10]}'),
('enum-pst-002', '*', 'PLAN_SOURCE_TYPE', 'AI_FORECAST', 'AI预测', 'AI预测生成', 2, '{"priorityRange": [11, 20]}'),
('enum-pst-003', '*', 'PLAN_SOURCE_TYPE', 'SAFETY_STOCK', '安全库存', '安全库存补货', 3, '{"priorityRange": [21, 30]}'),
('enum-pst-004', '*', 'PLAN_SOURCE_TYPE', 'MANUAL', '手动创建', '人工手动创建', 4, '{"priorityRange": [31, 40]}'),
('enum-pst-005', '*', 'PLAN_SOURCE_TYPE', 'URGENT_INSERT', '紧急插单', '紧急插入订单', 5, '{"priorityRange": [1, 5]}');

-- =====================================================
-- 21. PRODUCTION_PLAN_TYPE - 计划类型 (2个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order) VALUES
('enum-ppt-001', '*', 'PRODUCTION_PLAN_TYPE', 'FUTURE', '未来生产', '基于未来原材料到货', 1),
('enum-ppt-002', '*', 'PRODUCTION_PLAN_TYPE', 'FROM_INVENTORY', '库存生产', '使用现有库存', 2);

-- =====================================================
-- 22. MIXED_BATCH_TYPE - 混批类型 (2个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order) VALUES
('enum-mbt-001', '*', 'MIXED_BATCH_TYPE', 'SAME_MATERIAL_DIFFERENT_CUSTOMER', '同原料不同客户', '相同原料不同客户混批', 1),
('enum-mbt-002', '*', 'MIXED_BATCH_TYPE', 'SAME_PROCESS_DIFFERENT_PRODUCT', '同工艺不同产品', '相同工艺不同产品混批', 2);

-- =====================================================
-- 23. CHANGE_TYPE - 变更类型 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order) VALUES
('enum-ct-001', '*', 'CHANGE_TYPE', 'CREATE', '创建', '新建记录', 1),
('enum-ct-002', '*', 'CHANGE_TYPE', 'UPDATE', '更新', '更新记录', 2),
('enum-ct-003', '*', 'CHANGE_TYPE', 'DELETE', '删除', '删除记录', 3),
('enum-ct-004', '*', 'CHANGE_TYPE', 'ACTIVATE', '激活', '激活记录', 4),
('enum-ct-005', '*', 'CHANGE_TYPE', 'DEACTIVATE', '停用', '停用记录', 5);

-- =====================================================
-- 24. NOTIFICATION_TYPE - 通知类型 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, color) VALUES
('enum-nt-001', '*', 'NOTIFICATION_TYPE', 'ALERT', '告警', '告警通知', 1, '#F44336'),
('enum-nt-002', '*', 'NOTIFICATION_TYPE', 'INFO', '信息', '信息通知', 2, '#2196F3'),
('enum-nt-003', '*', 'NOTIFICATION_TYPE', 'WARNING', '警告', '警告通知', 3, '#FF9800'),
('enum-nt-004', '*', 'NOTIFICATION_TYPE', 'SUCCESS', '成功', '成功通知', 4, '#4CAF50'),
('enum-nt-005', '*', 'NOTIFICATION_TYPE', 'SYSTEM', '系统', '系统通知', 5, '#9E9E9E');

-- =====================================================
-- 25. WHITELIST_STATUS - 白名单状态 (5个)
-- =====================================================
INSERT INTO system_enums (id, factory_id, enum_group, enum_code, enum_label, enum_description, sort_order, metadata) VALUES
('enum-ws-001', '*', 'WHITELIST_STATUS', 'ACTIVE', '活跃', '白名单有效', 1, '{"code": "A"}'),
('enum-ws-002', '*', 'WHITELIST_STATUS', 'DISABLED', '已禁用', '白名单已禁用', 2, '{"code": "D"}'),
('enum-ws-003', '*', 'WHITELIST_STATUS', 'EXPIRED', '已过期', '白名单已过期', 3, '{"code": "E"}'),
('enum-ws-004', '*', 'WHITELIST_STATUS', 'LIMIT_REACHED', '已达上限', '使用次数已达上限', 4, '{"code": "L"}'),
('enum-ws-005', '*', 'WHITELIST_STATUS', 'DELETED', '已删除', '白名单已删除', 5, '{"code": "X"}');
