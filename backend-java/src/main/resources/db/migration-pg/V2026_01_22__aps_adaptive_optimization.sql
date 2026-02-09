-- =====================================================
-- APS 自适应优化 - BaseEntity 字段补全 (PostgreSQL 版本)
-- 文件: V2026_01_22__aps_adaptive_optimization.sql
-- 创建时间: 2026-01-22
-- 描述: 为 APS 相关表添加 BaseEntity 所需的 updated_at 和 deleted_at 字段
-- Converted from MySQL to PostgreSQL
-- =====================================================

-- ============================================
-- 辅助函数 - 安全添加列
-- ============================================

DROP FUNCTION IF EXISTS add_column_if_not_exists_v20260122(VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION add_column_if_not_exists_v20260122(
    p_table_name VARCHAR(64),
    p_column_name VARCHAR(64),
    p_column_definition VARCHAR(500)
)
RETURNS void AS $$
DECLARE
    v_column_exists INT;
    v_table_exists INT;
BEGIN
    -- 检查表是否存在
    SELECT COUNT(*) INTO v_table_exists
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = p_table_name;

    IF v_table_exists > 0 THEN
        -- 检查列是否存在
        SELECT COUNT(*) INTO v_column_exists
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = p_table_name
          AND column_name = p_column_name;

        IF v_column_exists = 0 THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', p_table_name, p_column_name, p_column_definition);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. 为 aps_efficiency_history 表添加缺失的 BaseEntity 字段
-- ============================================

SELECT add_column_if_not_exists_v20260122('aps_efficiency_history', 'updated_at',
    'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

SELECT add_column_if_not_exists_v20260122('aps_efficiency_history', 'deleted_at',
    'TIMESTAMP NULL');

-- 添加注释
DO $$
BEGIN
    COMMENT ON COLUMN aps_efficiency_history.updated_at IS '更新时间';
    COMMENT ON COLUMN aps_efficiency_history.deleted_at IS '软删除时间';
EXCEPTION WHEN undefined_table THEN
    NULL; -- 表不存在时忽略
END $$;

-- 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_aps_efficiency_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trg_aps_efficiency_history_updated_at ON aps_efficiency_history;
    CREATE TRIGGER trg_aps_efficiency_history_updated_at
        BEFORE UPDATE ON aps_efficiency_history
        FOR EACH ROW
        EXECUTE FUNCTION update_aps_efficiency_history_updated_at();
EXCEPTION WHEN undefined_table THEN
    NULL; -- 表不存在时忽略
END $$;

-- ============================================
-- 2. 为 aps_weight_history 表添加缺失的 BaseEntity 字段
-- ============================================

SELECT add_column_if_not_exists_v20260122('aps_weight_history', 'updated_at',
    'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

SELECT add_column_if_not_exists_v20260122('aps_weight_history', 'deleted_at',
    'TIMESTAMP NULL');

-- 添加注释
DO $$
BEGIN
    COMMENT ON COLUMN aps_weight_history.updated_at IS '更新时间';
    COMMENT ON COLUMN aps_weight_history.deleted_at IS '软删除时间';
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- 创建触发器
CREATE OR REPLACE FUNCTION update_aps_weight_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trg_aps_weight_history_updated_at ON aps_weight_history;
    CREATE TRIGGER trg_aps_weight_history_updated_at
        BEFORE UPDATE ON aps_weight_history
        FOR EACH ROW
        EXECUTE FUNCTION update_aps_weight_history_updated_at();
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ============================================
-- 3. 为 sku_complexity 表添加缺失的 deleted_at 字段
-- ============================================

SELECT add_column_if_not_exists_v20260122('sku_complexity', 'deleted_at',
    'TIMESTAMP NULL');

DO $$
BEGIN
    COMMENT ON COLUMN sku_complexity.deleted_at IS '软删除时间';
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ============================================
-- 4. 为 ai_agent_rules 表添加缺失的 BaseEntity 字段 (如果表存在)
-- ============================================

SELECT add_column_if_not_exists_v20260122('ai_agent_rules', 'deleted_at',
    'TIMESTAMP NULL');

DO $$
BEGIN
    COMMENT ON COLUMN ai_agent_rules.deleted_at IS '软删除时间';
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ============================================
-- 5. 为 aps_prediction_model_weights 表添加缺失的 deleted_at 字段 (如果表存在)
-- ============================================

SELECT add_column_if_not_exists_v20260122('aps_prediction_model_weights', 'deleted_at',
    'TIMESTAMP NULL');

DO $$
BEGIN
    COMMENT ON COLUMN aps_prediction_model_weights.deleted_at IS '软删除时间';
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ============================================
-- 清理函数
-- ============================================

DROP FUNCTION IF EXISTS add_column_if_not_exists_v20260122(VARCHAR, VARCHAR, VARCHAR);

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
