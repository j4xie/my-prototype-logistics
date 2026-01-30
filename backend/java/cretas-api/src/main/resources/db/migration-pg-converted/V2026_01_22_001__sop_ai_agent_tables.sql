-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_22_001__sop_ai_agent_tables.sql
-- Conversion date: 2026-01-26 18:49:19
-- WARNING: This file requires manual review!
-- ============================================

-- =====================================================
-- SOP AI Agent 数据库迁移脚本
-- 文件: V2026_01_22_001__sop_ai_agent_tables.sql
-- 创建时间: 2026-01-22
-- 描述: 创建 SOP AI Agent 相关表，并修复表结构
-- =====================================================

-- ============================================
-- 1. 创建 smart_bi_sku_complexity 表
-- 用于存储 SKU 复杂度分析结果
-- ============================================

CREATE TABLE IF NOT EXISTS smart_bi_sku_complexity (
    id VARCHAR(36) PRIMARY KEY,

    -- 关联信息
    factory_id VARCHAR(32) NOT NULL COMMENT '工厂ID',
    sku_code VARCHAR(64) NOT NULL COMMENT 'SKU编码',
    sku_name VARCHAR(128) COMMENT 'SKU名称',

    -- 复杂度信息
    complexity_level INT NOT NULL COMMENT '复杂度等级 1-5',
    source_type VARCHAR(20) DEFAULT 'MANUAL' COMMENT '来源类型: AI_SOP/MANUAL/HISTORY',
    analysis_reason TEXT COMMENT '分析原因/说明',
    sop_config_id VARCHAR(36) COMMENT '关联的SOP配置ID',
    analysis_detail_json JSON COMMENT '分析详情JSON',

    -- 详细分析数据
    step_count INT COMMENT '工序步骤数',
    skill_required INT COMMENT '技能要求等级 1-5',
    quality_check_count INT COMMENT '质检点数量',
    special_equipment BOOLEAN DEFAULT FALSE COMMENT '是否需要特殊设备',
    estimated_minutes INT COMMENT '预估工时（分钟）',

    -- 分析元数据
    analyzed_at TIMESTAMP WITH TIME ZONE COMMENT '分析时间',
    analyzed_by VARCHAR(50) COMMENT '分析者',

    -- BaseEntity 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    -- 索引
    INDEX idx_sku_complexity_factory (factory_id),
    INDEX idx_sku_complexity_sku (sku_code),
    INDEX idx_sku_complexity_level (complexity_level),
    INDEX idx_sku_complexity_source (source_type),
    UNIQUE KEY uk_sku_complexity_factory_sku (factory_id, sku_code)
);

-- ============================================
-- 2. 插入默认 SOP 分析规则（如果不存在）
-- 注意: ai_agent_rules 表的 deleted_at 字段已在
-- V2026_01_22__aps_adaptive_optimization.sql 中添加
-- ============================================

INSERT INTO ai_agent_rules (
    id,
    factory_id,
    trigger_type,
    trigger_entity,
    rule_name,
    rule_description,
    tool_chain_config,
    priority,
    is_active,
    created_at
)
SELECT
    UUID(),
    'DEFAULT',
    'SOP_UPLOAD',
    'SOP',
    'SOP文档上传自动分析',
    '当上传SOP文档时，自动解析文档内容，分析SKU复杂度，并更新排产参数',
    JSON_OBJECT(
        'tools', JSON_ARRAY(
            JSON_OBJECT(
                'toolName', 'sop_parse_document',
                'paramsMapping', JSON_OBJECT('fileUrl', '#{fileUrl}'),
                'outputKey', 'parseResult'
            ),
            JSON_OBJECT(
                'toolName', 'sop_analyze_complexity',
                'paramsMapping', JSON_OBJECT(
                    'sopContent', '#{parseResult.data.content}',
                    'steps', '#{parseResult.data.steps}'
                ),
                'outputKey', 'complexityResult'
            ),
            JSON_OBJECT(
                'toolName', 'sku_update_complexity',
                'paramsMapping', JSON_OBJECT(
                    'skuCode', '#{skuCode}',
                    'complexity', '#{complexityResult.data.level}',
                    'reason', '#{complexityResult.data.reason}',
                    'stepCount', '#{complexityResult.data.stepCount}',
                    'skillRequired', '#{complexityResult.data.skillRequired}',
                    'qualityCheckCount', '#{complexityResult.data.qualityCheckCount}',
                    'specialEquipment', '#{complexityResult.data.specialEquipment}',
                    'estimatedMinutes', '#{complexityResult.data.estimatedMinutes}'
                ),
                'outputKey', 'updateResult'
            )
        )
    ),
    50,
    TRUE,
    NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM ai_agent_rules
    WHERE trigger_type = 'SOP_UPLOAD'
    AND rule_name = 'SOP文档上传自动分析'
);

-- ============================================
-- 3. 插入示例 SKU 复杂度数据
-- ============================================

INSERT INTO smart_bi_sku_complexity (
    id, factory_id, sku_code, sku_name, complexity_level,
    source_type, step_count, skill_required, quality_check_count,
    special_equipment, estimated_minutes, analyzed_at, analyzed_by
)
SELECT
    UUID(), 'F001', 'SKU-DEMO-001', '示例产品A', 2,
    'MANUAL', 5, 1, 1, FALSE, 30, NOW(), 'SYSTEM'
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_sku_complexity
    WHERE factory_id = 'F001' AND sku_code = 'SKU-DEMO-001'
);

INSERT INTO smart_bi_sku_complexity (
    id, factory_id, sku_code, sku_name, complexity_level,
    source_type, step_count, skill_required, quality_check_count,
    special_equipment, estimated_minutes, analyzed_at, analyzed_by
)
SELECT
    UUID(), 'F001', 'SKU-DEMO-002', '示例产品B', 4,
    'MANUAL', 12, 3, 3, TRUE, 75, NOW(), 'SYSTEM'
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_sku_complexity
    WHERE factory_id = 'F001' AND sku_code = 'SKU-DEMO-002'
);

-- ============================================
-- 结束
-- ============================================
