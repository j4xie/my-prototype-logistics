-- =====================================================
-- APS 自适应优化 - BaseEntity 字段补全
-- 文件: V2026_01_22__aps_adaptive_optimization.sql
-- 创建时间: 2026-01-22
-- 描述: 为 APS 相关表添加 BaseEntity 所需的 updated_at 和 deleted_at 字段
-- =====================================================

-- ============================================
-- 辅助存储过程 - 安全添加列
-- ============================================

DROP PROCEDURE IF EXISTS add_column_if_not_exists_v20260122;

DELIMITER //

CREATE PROCEDURE add_column_if_not_exists_v20260122(
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
-- 1. 为 aps_efficiency_history 表添加缺失的 BaseEntity 字段
-- ============================================

CALL add_column_if_not_exists_v20260122('aps_efficiency_history', 'updated_at',
    "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'");

CALL add_column_if_not_exists_v20260122('aps_efficiency_history', 'deleted_at',
    "DATETIME NULL COMMENT '软删除时间'");

-- ============================================
-- 2. 为 aps_weight_history 表添加缺失的 BaseEntity 字段
-- ============================================

CALL add_column_if_not_exists_v20260122('aps_weight_history', 'updated_at',
    "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'");

CALL add_column_if_not_exists_v20260122('aps_weight_history', 'deleted_at',
    "DATETIME NULL COMMENT '软删除时间'");

-- ============================================
-- 3. 为 sku_complexity 表添加缺失的 deleted_at 字段
-- ============================================

CALL add_column_if_not_exists_v20260122('sku_complexity', 'deleted_at',
    "DATETIME NULL COMMENT '软删除时间'");

-- ============================================
-- 4. 为 ai_agent_rules 表添加缺失的 BaseEntity 字段 (如果表存在)
-- ============================================

CALL add_column_if_not_exists_v20260122('ai_agent_rules', 'deleted_at',
    "DATETIME NULL COMMENT '软删除时间'");

-- ============================================
-- 5. 为 aps_prediction_model_weights 表添加缺失的 deleted_at 字段 (如果表存在)
-- ============================================

CALL add_column_if_not_exists_v20260122('aps_prediction_model_weights', 'deleted_at',
    "DATETIME NULL COMMENT '软删除时间'");

-- ============================================
-- 清理存储过程
-- ============================================

DROP PROCEDURE IF EXISTS add_column_if_not_exists_v20260122;

-- ============================================
-- 验证说明
-- ============================================
-- 此迁移确保以下 APS 自适应优化相关表符合 BaseEntity 规范：
--
-- 1. aps_efficiency_history - 效率历史记录表
--    - 已有: id, line_id, task_id, recorded_at, actual_output, expected_output,
--            efficiency_ratio, worker_count, created_at
--    - 新增: updated_at, deleted_at
--
-- 2. aps_weight_history - 权重调整历史表
--    - 已有: id, factory_id, adjusted_at, weights_before, weights_after,
--            trigger_reason, performance_metrics, created_at
--    - 新增: updated_at, deleted_at
--
-- 3. sku_complexity - SKU复杂度表
--    - 已有: id, factory_id, sku_code, complexity_level, min_skill_required,
--            source_type, source_sop_id, analysis_reason, step_count,
--            avg_step_time_minutes, quality_check_count, special_equipment_required,
--            analyzed_at, created_at, updated_at
--    - 新增: deleted_at
--
-- 4. ai_agent_rules - AI Agent规则配置表
--    - 新增: deleted_at (如果表存在)
--
-- 5. aps_prediction_model_weights - 预测模型权重表
--    - 新增: deleted_at (如果表存在)
-- ============================================
