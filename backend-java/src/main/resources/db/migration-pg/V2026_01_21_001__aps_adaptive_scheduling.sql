-- =====================================================
-- APS 自适应排产优化数据库迁移脚本 (PostgreSQL 版本)
-- 文件: V2026_01_21_001__aps_adaptive_scheduling.sql
-- 创建时间: 2026-01-21
-- 描述: 支持效率跟踪、概率预测、策略权重调整和SOP AI Agent规则
-- Converted from MySQL to PostgreSQL
-- =====================================================

-- ============================================
-- 辅助函数 - 安全添加列
-- ============================================

DROP FUNCTION IF EXISTS add_column_if_not_exists_v2026(VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION add_column_if_not_exists_v2026(
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
-- 1. 创建或修改 aps_schedule_task 表
-- ============================================

-- 1.1 如果表不存在则创建基础表
CREATE TABLE IF NOT EXISTS aps_schedule_task (
    id VARCHAR(36) PRIMARY KEY,
    task_no VARCHAR(50) NOT NULL,
    schedule_batch_no VARCHAR(50) NOT NULL,
    order_id VARCHAR(36),
    order_no VARCHAR(50),
    task_type VARCHAR(20) DEFAULT 'production',

    -- 产品信息
    product_id VARCHAR(36),
    product_name VARCHAR(100),
    product_spec VARCHAR(100),
    product_category VARCHAR(50),
    planned_qty DECIMAL(12,2) DEFAULT 0,
    completed_qty DECIMAL(12,2) DEFAULT 0,

    -- 时间安排
    planned_start TIMESTAMP NOT NULL,
    planned_end TIMESTAMP NOT NULL,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    planned_duration INT,
    actual_duration INT,
    is_cross_day SMALLINT DEFAULT 0,

    -- 资源分配
    line_id VARCHAR(36) NOT NULL,
    line_name VARCHAR(100),
    equipment_id VARCHAR(36),
    mold_id VARCHAR(36),
    worker_ids VARCHAR(500),
    worker_count INT DEFAULT 0,

    -- 换型信息
    previous_order_id VARCHAR(36),
    changeover_minutes INT DEFAULT 0,
    requires_cleaning SMALLINT DEFAULT 0,

    -- 约束满足
    meets_time_window SMALLINT DEFAULT 1,
    delivery_gap_minutes INT DEFAULT 0,
    meets_material_constraint SMALLINT DEFAULT 1,

    -- 状态
    status VARCHAR(20) DEFAULT 'planned',
    sequence_in_line INT,
    progress_percent INT DEFAULT 0,

    -- 混批
    is_mix_batch SMALLINT DEFAULT 0,
    mix_batch_order_ids VARCHAR(500),

    -- 元数据
    is_simulated SMALLINT DEFAULT 0,
    remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

COMMENT ON TABLE aps_schedule_task IS 'APS排程任务表';
COMMENT ON COLUMN aps_schedule_task.task_no IS '任务编号';
COMMENT ON COLUMN aps_schedule_task.schedule_batch_no IS '排程批次号';
COMMENT ON COLUMN aps_schedule_task.task_type IS 'production/changeover/maintenance/break';
COMMENT ON COLUMN aps_schedule_task.planned_start IS '计划开始';
COMMENT ON COLUMN aps_schedule_task.planned_end IS '计划结束';
COMMENT ON COLUMN aps_schedule_task.actual_start IS '实际开始';
COMMENT ON COLUMN aps_schedule_task.actual_end IS '实际结束';
COMMENT ON COLUMN aps_schedule_task.planned_duration IS '计划时长(分钟)';
COMMENT ON COLUMN aps_schedule_task.actual_duration IS '实际时长';
COMMENT ON COLUMN aps_schedule_task.is_cross_day IS '是否跨天';
COMMENT ON COLUMN aps_schedule_task.line_id IS '产线ID';
COMMENT ON COLUMN aps_schedule_task.line_name IS '产线名称';
COMMENT ON COLUMN aps_schedule_task.equipment_id IS '设备ID';
COMMENT ON COLUMN aps_schedule_task.mold_id IS '模具ID';
COMMENT ON COLUMN aps_schedule_task.worker_ids IS '人员ID列表';
COMMENT ON COLUMN aps_schedule_task.worker_count IS '人员数量';
COMMENT ON COLUMN aps_schedule_task.previous_order_id IS '前置订单';
COMMENT ON COLUMN aps_schedule_task.changeover_minutes IS '换型时间';
COMMENT ON COLUMN aps_schedule_task.meets_time_window IS '满足时间窗口';
COMMENT ON COLUMN aps_schedule_task.delivery_gap_minutes IS '与交期差距';
COMMENT ON COLUMN aps_schedule_task.meets_material_constraint IS '满足物料约束';
COMMENT ON COLUMN aps_schedule_task.status IS 'planned/confirmed/in_progress/paused/completed/cancelled';
COMMENT ON COLUMN aps_schedule_task.sequence_in_line IS '产线内顺序';
COMMENT ON COLUMN aps_schedule_task.progress_percent IS '进度%';
COMMENT ON COLUMN aps_schedule_task.mix_batch_order_ids IS '混批订单ID列表';

CREATE INDEX IF NOT EXISTS idx_aps_task_no ON aps_schedule_task(task_no);
CREATE INDEX IF NOT EXISTS idx_aps_schedule_batch ON aps_schedule_task(schedule_batch_no);
CREATE INDEX IF NOT EXISTS idx_aps_line_id ON aps_schedule_task(line_id);
CREATE INDEX IF NOT EXISTS idx_aps_planned_start ON aps_schedule_task(planned_start);
CREATE INDEX IF NOT EXISTS idx_aps_status ON aps_schedule_task(status);

-- 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_aps_schedule_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aps_schedule_task_updated_at ON aps_schedule_task;
CREATE TRIGGER trg_aps_schedule_task_updated_at
    BEFORE UPDATE ON aps_schedule_task
    FOR EACH ROW
    EXECUTE FUNCTION update_aps_schedule_task_updated_at();

-- 1.2 为 aps_schedule_task 表添加自适应排产新字段

-- 实际执行信息
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'actual_efficiency', 'DECIMAL(10,2)');
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'plan_efficiency', 'DECIMAL(10,2)');
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'efficiency_variance', 'DECIMAL(5,2)');

-- 预测信息
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'predicted_end', 'TIMESTAMP');
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'completion_probability', 'DECIMAL(5,4)');
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'risk_level', 'VARCHAR(20) DEFAULT ''low''');

-- 动态调整记录
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'adjustment_count', 'INT DEFAULT 0');
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'last_adjustment_time', 'TIMESTAMP');
SELECT add_column_if_not_exists_v2026('aps_schedule_task', 'adjustment_reason', 'VARCHAR(200)');

-- 添加注释
DO $$
BEGIN
    COMMENT ON COLUMN aps_schedule_task.actual_efficiency IS '实际效率(件/小时)';
    COMMENT ON COLUMN aps_schedule_task.plan_efficiency IS '计划效率(件/小时)';
    COMMENT ON COLUMN aps_schedule_task.efficiency_variance IS '效率偏差%';
    COMMENT ON COLUMN aps_schedule_task.predicted_end IS '预测完成时间';
    COMMENT ON COLUMN aps_schedule_task.completion_probability IS '完成概率(0-1)';
    COMMENT ON COLUMN aps_schedule_task.risk_level IS '风险等级(low/medium/high/critical)';
    COMMENT ON COLUMN aps_schedule_task.adjustment_count IS '调整次数';
    COMMENT ON COLUMN aps_schedule_task.last_adjustment_time IS '最后调整时间';
    COMMENT ON COLUMN aps_schedule_task.adjustment_reason IS '调整原因';
EXCEPTION WHEN undefined_column THEN
    NULL; -- 忽略列不存在的错误
END $$;

-- ============================================
-- 2. 创建效率历史记录表 aps_efficiency_history
-- ============================================

CREATE TABLE IF NOT EXISTS aps_efficiency_history (
    id VARCHAR(36) PRIMARY KEY,
    line_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36),
    recorded_at TIMESTAMP NOT NULL,
    actual_output DECIMAL(10,2),
    expected_output DECIMAL(10,2),
    efficiency_ratio DECIMAL(5,4),
    worker_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE aps_efficiency_history IS '效率历史记录表';
COMMENT ON COLUMN aps_efficiency_history.line_id IS '产线ID';
COMMENT ON COLUMN aps_efficiency_history.task_id IS '任务ID';
COMMENT ON COLUMN aps_efficiency_history.recorded_at IS '记录时间';
COMMENT ON COLUMN aps_efficiency_history.actual_output IS '实际产出';
COMMENT ON COLUMN aps_efficiency_history.expected_output IS '预期产出';
COMMENT ON COLUMN aps_efficiency_history.efficiency_ratio IS '效率比率';
COMMENT ON COLUMN aps_efficiency_history.worker_count IS '当时工人数';

CREATE INDEX IF NOT EXISTS idx_aps_eff_line_time ON aps_efficiency_history(line_id, recorded_at);

-- ============================================
-- 3. 创建策略权重历史表 aps_weight_history
-- ============================================

CREATE TABLE IF NOT EXISTS aps_weight_history (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    adjusted_at TIMESTAMP NOT NULL,
    weights_before JSONB,
    weights_after JSONB,
    trigger_reason VARCHAR(200),
    performance_metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE aps_weight_history IS '策略权重调整历史';
COMMENT ON COLUMN aps_weight_history.factory_id IS '工厂ID';
COMMENT ON COLUMN aps_weight_history.adjusted_at IS '调整时间';
COMMENT ON COLUMN aps_weight_history.weights_before IS '调整前权重';
COMMENT ON COLUMN aps_weight_history.weights_after IS '调整后权重';
COMMENT ON COLUMN aps_weight_history.trigger_reason IS '触发原因';
COMMENT ON COLUMN aps_weight_history.performance_metrics IS '当时性能指标';

CREATE INDEX IF NOT EXISTS idx_aps_wh_factory_time ON aps_weight_history(factory_id, adjusted_at);

-- ============================================
-- 4. 创建 AI Agent 规则配置表 ai_agent_rules
-- ============================================

CREATE TABLE IF NOT EXISTS ai_agent_rules (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) DEFAULT 'DEFAULT',
    trigger_type VARCHAR(50) NOT NULL,
    trigger_entity VARCHAR(50),
    rule_name VARCHAR(100) NOT NULL,
    rule_description TEXT,
    tool_chain_config JSONB NOT NULL,
    use_llm_selection BOOLEAN DEFAULT FALSE,
    llm_selection_prompt TEXT,
    condition_expression VARCHAR(500),
    priority INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

COMMENT ON TABLE ai_agent_rules IS 'AI Agent 规则配置表';
COMMENT ON COLUMN ai_agent_rules.factory_id IS '工厂ID，DEFAULT为通用';
COMMENT ON COLUMN ai_agent_rules.trigger_type IS '触发类型: SOP_UPLOAD/SKU_CREATE/MANUAL';
COMMENT ON COLUMN ai_agent_rules.trigger_entity IS '触发实体: SOP/SKU/ORDER';
COMMENT ON COLUMN ai_agent_rules.rule_name IS '规则名称';
COMMENT ON COLUMN ai_agent_rules.rule_description IS '规则描述';
COMMENT ON COLUMN ai_agent_rules.tool_chain_config IS '工具链配置';
COMMENT ON COLUMN ai_agent_rules.use_llm_selection IS '是否用LLM动态选择工具';
COMMENT ON COLUMN ai_agent_rules.llm_selection_prompt IS 'LLM选择工具的Prompt';
COMMENT ON COLUMN ai_agent_rules.condition_expression IS '条件表达式，如: ${sopType} == "PRODUCTION"';
COMMENT ON COLUMN ai_agent_rules.priority IS '优先级，数字越小越优先';

CREATE INDEX IF NOT EXISTS idx_ai_agent_trigger ON ai_agent_rules(trigger_type, trigger_entity);
CREATE INDEX IF NOT EXISTS idx_ai_agent_factory_active ON ai_agent_rules(factory_id, is_active);

-- 创建触发器
CREATE OR REPLACE FUNCTION update_ai_agent_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_agent_rules_updated_at ON ai_agent_rules;
CREATE TRIGGER trg_ai_agent_rules_updated_at
    BEFORE UPDATE ON ai_agent_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_agent_rules_updated_at();

-- ============================================
-- 5. 创建 SKU 复杂度表 sku_complexity
-- ============================================

CREATE TABLE IF NOT EXISTS sku_complexity (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    sku_code VARCHAR(50) NOT NULL,
    complexity_level INT NOT NULL,
    min_skill_required INT DEFAULT 1,
    source_type VARCHAR(20) DEFAULT 'MANUAL',
    source_sop_id VARCHAR(36),
    analysis_reason TEXT,
    step_count INT,
    avg_step_time_minutes INT,
    quality_check_count INT,
    special_equipment_required BOOLEAN DEFAULT FALSE,
    analyzed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_sku_factory_sku UNIQUE (factory_id, sku_code)
);

COMMENT ON TABLE sku_complexity IS 'SKU复杂度表';
COMMENT ON COLUMN sku_complexity.factory_id IS '工厂ID';
COMMENT ON COLUMN sku_complexity.sku_code IS 'SKU编码';
COMMENT ON COLUMN sku_complexity.complexity_level IS '复杂度等级 1-5';
COMMENT ON COLUMN sku_complexity.min_skill_required IS '最低技能要求';
COMMENT ON COLUMN sku_complexity.source_type IS 'MANUAL/AI_SOP/AI_LEARNED';
COMMENT ON COLUMN sku_complexity.source_sop_id IS '来源SOP ID';
COMMENT ON COLUMN sku_complexity.analysis_reason IS 'AI分析理由';
COMMENT ON COLUMN sku_complexity.step_count IS 'SOP步骤数';
COMMENT ON COLUMN sku_complexity.avg_step_time_minutes IS '平均步骤耗时';
COMMENT ON COLUMN sku_complexity.quality_check_count IS '质检点数量';
COMMENT ON COLUMN sku_complexity.special_equipment_required IS '是否需要特殊设备';
COMMENT ON COLUMN sku_complexity.analyzed_at IS 'AI分析时间';

-- 创建触发器
CREATE OR REPLACE FUNCTION update_sku_complexity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sku_complexity_updated_at ON sku_complexity;
CREATE TRIGGER trg_sku_complexity_updated_at
    BEFORE UPDATE ON sku_complexity
    FOR EACH ROW
    EXECUTE FUNCTION update_sku_complexity_updated_at();

-- ============================================
-- 6. 插入默认 AI Agent 规则
-- ============================================

-- SOP上传自动分析复杂度规则
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
    gen_random_uuid()::VARCHAR(36),
    'DEFAULT',
    'SOP_UPLOAD',
    'SOP',
    'SOP上传自动分析复杂度',
    '当上传SOP文档时，自动解析并分析SKU复杂度，更新排产参数',
    '{"executionOrder": "SEQUENTIAL", "tools": [{"toolName": "sop_parse_document", "order": 1, "outputKey": "parsedSop"}, {"toolName": "sop_analyze_complexity", "order": 2, "outputKey": "analysis"}, {"toolName": "sku_update_complexity", "order": 3}]}'::JSONB,
    100
) ON CONFLICT DO NOTHING;

-- SKU创建时自动查找关联SOP规则
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
    gen_random_uuid()::VARCHAR(36),
    'DEFAULT',
    'SKU_CREATE',
    'SKU',
    'SKU创建时自动分析',
    '当创建新SKU时，自动查找关联的SOP并分析复杂度',
    '{"executionOrder": "SEQUENTIAL", "tools": [{"toolName": "sop_search_by_sku", "order": 1, "outputKey": "sopList"}, {"toolName": "sop_analyze_complexity", "order": 2, "outputKey": "analysis", "condition": "${sopList.length} > 0"}, {"toolName": "sku_update_complexity", "order": 3, "condition": "${analysis.success}"}]}'::JSONB,
    FALSE,
    200
) ON CONFLICT DO NOTHING;

-- 批量SKU复杂度重新分析规则
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
    gen_random_uuid()::VARCHAR(36),
    'DEFAULT',
    'MANUAL',
    'SKU',
    '批量SKU复杂度重新分析',
    '手动触发批量重新分析所有SKU的复杂度',
    '{"executionOrder": "PARALLEL", "batchSize": 10, "tools": [{"toolName": "sku_list_all", "order": 1, "outputKey": "skuList"}, {"toolName": "sop_analyze_complexity_batch", "order": 2, "inputKey": "skuList"}]}'::JSONB,
    TRUE,
    '根据当前工厂的SKU数量和SOP覆盖率，决定是使用全量分析还是增量分析。如果超过100个SKU且SOP覆盖率<50%，建议使用增量分析。',
    500
) ON CONFLICT DO NOTHING;

-- ============================================
-- 7. 插入示例 SKU 复杂度数据
-- ============================================

INSERT INTO sku_complexity (
    id, factory_id, sku_code, complexity_level, min_skill_required,
    source_type, step_count, avg_step_time_minutes, quality_check_count
) VALUES
    (gen_random_uuid()::VARCHAR(36), 'F001', 'SKU001', 2, 1, 'MANUAL', 5, 3, 1),
    (gen_random_uuid()::VARCHAR(36), 'F001', 'SKU002', 4, 3, 'MANUAL', 12, 5, 3),
    (gen_random_uuid()::VARCHAR(36), 'F001', 'SKU003', 5, 4, 'MANUAL', 18, 8, 5),
    (gen_random_uuid()::VARCHAR(36), 'F001', 'SKU004', 3, 2, 'MANUAL', 8, 4, 2),
    (gen_random_uuid()::VARCHAR(36), 'F001', 'SKU005', 2, 1, 'MANUAL', 4, 2, 1)
ON CONFLICT (factory_id, sku_code) DO UPDATE SET
    complexity_level = EXCLUDED.complexity_level,
    updated_at = NOW();

-- ============================================
-- 清理函数
-- ============================================

DROP FUNCTION IF EXISTS add_column_if_not_exists_v2026(VARCHAR, VARCHAR, VARCHAR);

-- ============================================
-- 结束
-- ============================================
