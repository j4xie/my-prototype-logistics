-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_21_001__aps_adaptive_scheduling.sql
-- Conversion date: 2026-01-26 18:49:02
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- APS 自适应排产优化数据库迁移脚本
-- 文件: V2026_01_21_001__aps_adaptive_scheduling.sql
-- 创建时间: 2026-01-21
-- 描述: 支持效率跟踪、概率预测、策略权重调整和SOP AI Agent规则
-- =====================================================

-- ============================================
-- 辅助存储过程 - 安全添加列
-- ============================================

DROP PROCEDURE IF EXISTS add_column_if_not_exists_v2026;

DELIMITER //

CREATE PROCEDURE add_column_if_not_exists_v2026(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition VARCHAR(500)
)
BEGIN
    DECLARE v_column_exists INT DEFAULT 0;
    DECLARE v_table_exists INT DEFAULT 0;

    -- 检查表是否存在
    SELECT COUNT(*) INTO v_table_exists
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name;

    IF v_table_exists > 0 THEN
        -- 检查列是否存在
        SELECT COUNT(*) INTO v_column_exists
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table_name
          AND COLUMN_NAME = p_column_name;

        IF v_column_exists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_column_definition);
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END //

DELIMITER ;

-- ============================================
-- 1. 创建或修改 aps_schedule_task 表
-- ============================================

-- 1.1 如果表不存在则创建基础表
CREATE TABLE IF NOT EXISTS aps_schedule_task (
    id VARCHAR(36) PRIMARY KEY,
    task_no VARCHAR(50) NOT NULL COMMENT '任务编号',
    schedule_batch_no VARCHAR(50) NOT NULL COMMENT '排程批次号',
    order_id VARCHAR(36) COMMENT '关联订单',
    order_no VARCHAR(50) COMMENT '订单号',
    task_type VARCHAR(20) DEFAULT 'production' COMMENT 'production/changeover/maintenance/break',

    -- 产品信息
    product_id VARCHAR(36),
    product_name VARCHAR(100),
    product_spec VARCHAR(100),
    product_category VARCHAR(50),
    planned_qty DECIMAL(12,2) DEFAULT 0,
    completed_qty DECIMAL(12,2) DEFAULT 0,

    -- 时间安排
    planned_start TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '计划开始',
    planned_end TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '计划结束',
    actual_start TIMESTAMP WITH TIME ZONE COMMENT '实际开始',
    actual_end TIMESTAMP WITH TIME ZONE COMMENT '实际结束',
    planned_duration INT COMMENT '计划时长(分钟)',
    actual_duration INT COMMENT '实际时长',
    is_cross_day SMALLINT DEFAULT 0 COMMENT '是否跨天',

    -- 资源分配
    line_id VARCHAR(36) NOT NULL COMMENT '产线ID',
    line_name VARCHAR(100) COMMENT '产线名称',
    equipment_id VARCHAR(36) COMMENT '设备ID',
    mold_id VARCHAR(36) COMMENT '模具ID',
    worker_ids VARCHAR(500) COMMENT '人员ID列表',
    worker_count INT DEFAULT 0 COMMENT '人员数量',

    -- 换型信息
    previous_order_id VARCHAR(36) COMMENT '前置订单',
    changeover_minutes INT DEFAULT 0 COMMENT '换型时间',
    requires_cleaning SMALLINT DEFAULT 0,

    -- 约束满足
    meets_time_window SMALLINT DEFAULT 1 COMMENT '满足时间窗口',
    delivery_gap_minutes INT DEFAULT 0 COMMENT '与交期差距',
    meets_material_constraint SMALLINT DEFAULT 1 COMMENT '满足物料约束',

    -- 状态
    status VARCHAR(20) DEFAULT 'planned' COMMENT 'planned/confirmed/in_progress/paused/completed/cancelled',
    sequence_in_line INT COMMENT '产线内顺序',
    progress_percent INT DEFAULT 0 COMMENT '进度%',

    -- 混批
    is_mix_batch SMALLINT DEFAULT 0,
    mix_batch_order_ids VARCHAR(500) COMMENT '混批订单ID列表',

    -- 元数据
    is_simulated SMALLINT DEFAULT 0,
    remark VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    INDEX idx_task_no (task_no),
    INDEX idx_schedule_batch (schedule_batch_no),
    INDEX idx_line_id (line_id),
    INDEX idx_planned_start (planned_start),
    INDEX idx_status (status)
);

-- 1.2 为 aps_schedule_task 表添加自适应排产新字段

-- 实际执行信息
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'actual_efficiency', "DECIMAL(10,2) COMMENT '实际效率(件/小时)'");
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'plan_efficiency', "DECIMAL(10,2) COMMENT '计划效率(件/小时)'");
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'efficiency_variance', "DECIMAL(5,2) COMMENT '效率偏差%'");

-- 预测信息
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'predicted_end', "TIMESTAMP WITH TIME ZONE COMMENT '预测完成时间'");
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'completion_probability', "DECIMAL(5,4) COMMENT '完成概率(0-1)'");
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'risk_level', "VARCHAR(20) DEFAULT 'low' COMMENT '风险等级(low/medium/high/critical)'");

-- 动态调整记录
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'adjustment_count', "INT DEFAULT 0 COMMENT '调整次数'");
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'last_adjustment_time', "TIMESTAMP WITH TIME ZONE COMMENT '最后调整时间'");
CALL add_column_if_not_exists_v2026('aps_schedule_task', 'adjustment_reason', "VARCHAR(200) COMMENT '调整原因'");

-- ============================================
-- 2. 创建效率历史记录表 aps_efficiency_history
-- ============================================

CREATE TABLE IF NOT EXISTS aps_efficiency_history (
    id VARCHAR(36) PRIMARY KEY,
    line_id VARCHAR(36) NOT NULL COMMENT '产线ID',
    task_id VARCHAR(36) COMMENT '任务ID',
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '记录时间',
    actual_output DECIMAL(10,2) COMMENT '实际产出',
    expected_output DECIMAL(10,2) COMMENT '预期产出',
    efficiency_ratio DECIMAL(5,4) COMMENT '效率比率',
    worker_count INT COMMENT '当时工人数',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_line_time (line_id, recorded_at)
);

-- ============================================
-- 3. 创建策略权重历史表 aps_weight_history
-- ============================================

CREATE TABLE IF NOT EXISTS aps_weight_history (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    adjusted_at TIMESTAMP WITH TIME ZONE NOT NULL COMMENT '调整时间',
    weights_before JSON COMMENT '调整前权重',
    weights_after JSON COMMENT '调整后权重',
    trigger_reason VARCHAR(200) COMMENT '触发原因',
    performance_metrics JSON COMMENT '当时性能指标',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory_time (factory_id, adjusted_at)
);

-- ============================================
-- 4. 创建 AI Agent 规则配置表 ai_agent_rules
-- ============================================

CREATE TABLE IF NOT EXISTS ai_agent_rules (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) DEFAULT 'DEFAULT' COMMENT '工厂ID，DEFAULT为通用',
    trigger_type VARCHAR(50) NOT NULL COMMENT '触发类型: SOP_UPLOAD/SKU_CREATE/MANUAL',
    trigger_entity VARCHAR(50) COMMENT '触发实体: SOP/SKU/ORDER',
    rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
    rule_description TEXT COMMENT '规则描述',
    tool_chain_config JSON NOT NULL COMMENT '工具链配置',
    use_llm_selection BOOLEAN DEFAULT FALSE COMMENT '是否用LLM动态选择工具',
    llm_selection_prompt TEXT COMMENT 'LLM选择工具的Prompt',
    condition_expression VARCHAR(500) COMMENT '条件表达式，如: ${sopType} == "PRODUCTION"',
    priority INT DEFAULT 100 COMMENT '优先级，数字越小越优先',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    INDEX idx_trigger (trigger_type, trigger_entity),
    INDEX idx_factory_active (factory_id, is_active)
);

-- ============================================
-- 5. 创建 SKU 复杂度表 sku_complexity
-- ============================================

CREATE TABLE IF NOT EXISTS sku_complexity (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    sku_code VARCHAR(50) NOT NULL COMMENT 'SKU编码',
    complexity_level INT NOT NULL COMMENT '复杂度等级 1-5',
    min_skill_required INT DEFAULT 1 COMMENT '最低技能要求',
    source_type VARCHAR(20) DEFAULT 'MANUAL' COMMENT 'MANUAL/AI_SOP/AI_LEARNED',
    source_sop_id VARCHAR(36) COMMENT '来源SOP ID',
    analysis_reason TEXT COMMENT 'AI分析理由',
    step_count INT COMMENT 'SOP步骤数',
    avg_step_time_minutes INT COMMENT '平均步骤耗时',
    quality_check_count INT COMMENT '质检点数量',
    special_equipment_required BOOLEAN DEFAULT FALSE COMMENT '是否需要特殊设备',
    analyzed_at TIMESTAMP WITH TIME ZONE COMMENT 'AI分析时间',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE KEY uk_factory_sku (factory_id, sku_code)
);

-- ============================================
-- 6. 插入默认 AI Agent 规则
-- ============================================

-- 使用 INSERT IGNORE 避免重复插入
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO ai_agent_rules (
    id,
    factory_id,
    trigger_type,
    trigger_entity,
    rule_name,
    rule_description,
    tool_chain_config,
    priority
) VALUES (
    UUID(),
    'DEFAULT',
    'SOP_UPLOAD',
    'SOP',
    'SOP上传自动分析复杂度',
    '当上传SOP文档时，自动解析并分析SKU复杂度，更新排产参数',
    JSON_OBJECT(
        'executionOrder', 'SEQUENTIAL',
        'tools', JSON_ARRAY(
            JSON_OBJECT('toolName', 'sop_parse_document', 'order', 1, 'outputKey', 'parsedSop'),
            JSON_OBJECT('toolName', 'sop_analyze_complexity', 'order', 2, 'outputKey', 'analysis'),
            JSON_OBJECT('toolName', 'sku_update_complexity', 'order', 3)
        )
    ),
    100
);

-- 额外规则: SKU创建时自动查找关联SOP
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO ai_agent_rules (
    id,
    factory_id,
    trigger_type,
    trigger_entity,
    rule_name,
    rule_description,
    tool_chain_config,
    use_llm_selection,
    priority
) VALUES (
    UUID(),
    'DEFAULT',
    'SKU_CREATE',
    'SKU',
    'SKU创建时自动分析',
    '当创建新SKU时，自动查找关联的SOP并分析复杂度',
    JSON_OBJECT(
        'executionOrder', 'SEQUENTIAL',
        'tools', JSON_ARRAY(
            JSON_OBJECT('toolName', 'sop_search_by_sku', 'order', 1, 'outputKey', 'sopList'),
            JSON_OBJECT('toolName', 'sop_analyze_complexity', 'order', 2, 'outputKey', 'analysis', 'condition', '${sopList.length} > 0'),
            JSON_OBJECT('toolName', 'sku_update_complexity', 'order', 3, 'condition', '${analysis.success}')
        )
    ),
    FALSE,
    200
);

-- 手动触发规则: 批量重新分析
-- TODO: Add ON CONFLICT DO NOTHING clause
INSERT INTO ai_agent_rules (
    id,
    factory_id,
    trigger_type,
    trigger_entity,
    rule_name,
    rule_description,
    tool_chain_config,
    use_llm_selection,
    llm_selection_prompt,
    priority
) VALUES (
    UUID(),
    'DEFAULT',
    'MANUAL',
    'SKU',
    '批量SKU复杂度重新分析',
    '手动触发批量重新分析所有SKU的复杂度',
    JSON_OBJECT(
        'executionOrder', 'PARALLEL',
        'batchSize', 10,
        'tools', JSON_ARRAY(
            JSON_OBJECT('toolName', 'sku_list_all', 'order', 1, 'outputKey', 'skuList'),
            JSON_OBJECT('toolName', 'sop_analyze_complexity_batch', 'order', 2, 'inputKey', 'skuList')
        )
    ),
    TRUE,
    '根据当前工厂的SKU数量和SOP覆盖率，决定是使用全量分析还是增量分析。如果超过100个SKU且SOP覆盖率<50%，建议使用增量分析。',
    500
);

-- ============================================
-- 7. 插入示例 SKU 复杂度数据
-- ============================================

INSERT INTO sku_complexity (
    id, factory_id, sku_code, complexity_level, min_skill_required,
    source_type, step_count, avg_step_time_minutes, quality_check_count
) VALUES
    (UUID(), 'F001', 'SKU001', 2, 1, 'MANUAL', 5, 3, 1),
    (UUID(), 'F001', 'SKU002', 4, 3, 'MANUAL', 12, 5, 3),
    (UUID(), 'F001', 'SKU003', 5, 4, 'MANUAL', 18, 8, 5),
    (UUID(), 'F001', 'SKU004', 3, 2, 'MANUAL', 8, 4, 2),
    (UUID(), 'F001', 'SKU005', 2, 1, 'MANUAL', 4, 2, 1)
ON DUPLICATE KEY UPDATE
    complexity_level = VALUES(complexity_level),
    updated_at = NOW();

-- ============================================
-- 清理存储过程
-- ============================================

DROP PROCEDURE IF EXISTS add_column_if_not_exists_v2026;

-- ============================================
-- 结束
-- ============================================
