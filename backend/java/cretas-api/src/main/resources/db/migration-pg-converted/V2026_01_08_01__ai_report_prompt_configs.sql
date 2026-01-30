-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_08_01__ai_report_prompt_configs.sql
-- Conversion date: 2026-01-26 18:47:52
-- WARNING: This file requires manual review!
-- ============================================

-- AI报告提示词配置表
-- 用于配置化管理不同类型报告的AI提示词模板
-- @since 2026-01-08

CREATE TABLE IF NOT EXISTS ai_report_prompt_configs (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NULL COMMENT '工厂ID，NULL表示全局默认配置',
    report_type VARCHAR(20) NOT NULL COMMENT '报告类型: daily/weekly/monthly/quarterly/yearly',
    config_name VARCHAR(100) NULL COMMENT '配置名称',
    prompt_template TEXT NOT NULL COMMENT '提示词模板，支持变量: {startDate}, {endDate}, {factoryName}',
    analysis_directions JSON NULL COMMENT '分析方向列表',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    priority INT DEFAULT 0 COMMENT '优先级，数值越高优先级越高',
    description VARCHAR(500) NULL COMMENT '配置描述',
    max_tokens INT DEFAULT 4000 COMMENT '最大响应token数',
    temperature DOUBLE PRECISION DEFAULT 0.7 COMMENT 'AI温度参数 (0.0-2.0)',
    created_by VARCHAR(50) NULL COMMENT '创建者',
    updated_by VARCHAR(50) NULL COMMENT '最后修改者',
    metadata JSON NULL COMMENT '扩展元数据',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    INDEX idx_report_prompt_factory_type (factory_id, report_type),
    INDEX idx_report_prompt_active (is_active),
    INDEX idx_report_prompt_priority (priority)
)
;

-- 插入默认的日报配置（基于制造业最佳实践）
INSERT INTO ai_report_prompt_configs (id, factory_id, report_type, config_name, prompt_template, analysis_directions, is_active, priority, description, created_by)
VALUES (
    UUID(),
    NULL,  -- 全局默认
    'daily',
    '日报默认模板',
    '请基于以上数据，生成一份简洁专业的日度运营报告。

**分析框架**：
1. **生产概况** - OEE（设备综合效率）、产量完成率、周期时间
2. **质量指标** - 首次合格率、缺陷率、质检通过率
3. **成本分析** - 单位成本、人工/原料/能耗占比
4. **设备状态** - 停机时间、维护需求、设备利用率
5. **关键预警** - 需要立即关注的问题
6. **明日建议** - 可执行的改进建议

**输出要求**：
- 使用数据驱动的分析方式
- 对比目标值和行业基准
- 突出异常波动和改进机会
- 提供可操作的具体建议',
    '["OEE分析", "质量合格率", "单位成本", "产能利用率", "设备状态", "关键预警"]',
    TRUE,
    10,
    '基于制造业最佳实践的日报模板，包含OEE、质量、成本、设备等核心KPI',
    'system'
);

-- 插入默认的周报配置
INSERT INTO ai_report_prompt_configs (id, factory_id, report_type, config_name, prompt_template, analysis_directions, is_active, priority, description, created_by)
VALUES (
    UUID(),
    NULL,
    'weekly',
    '周报默认模板',
    '请基于本周数据，生成一份深度的周度运营分析报告。

**核心维度**：
1. **生产效率趋势** - 周产量对比、OEE趋势、瓶颈分析
2. **质量控制** - 周合格率趋势、不良品分类、根因分析
3. **成本管理** - 周成本构成、成本波动分析、改进机会
4. **库存周转** - 原材料周转率、成品库存、呆滞风险
5. **人员效率** - 人均产出、工时利用率、培训需求
6. **设备可靠性** - MTBF、MTTR、预防性维护完成率
7. **周计划回顾** - 计划达成率、偏差原因、下周计划

**分析要求**：
- 环比和同比分析
- 识别改进趋势和恶化趋势
- 提供量化的改进建议
- 列出TOP3待解决问题',
    '["生产效率", "质量趋势", "成本波动", "库存周转", "人员效率", "设备可靠性"]',
    TRUE,
    10,
    '深度周报模板，包含趋势分析和根因分析',
    'system'
);

-- 插入默认的月报配置
INSERT INTO ai_report_prompt_configs (id, factory_id, report_type, config_name, prompt_template, analysis_directions, is_active, priority, description, created_by)
VALUES (
    UUID(),
    NULL,
    'monthly',
    '月报默认模板',
    '请基于本月数据，生成一份战略性的月度运营报告。

**战略分析维度**：
1. **生产绩效总览** - 月度KPI达成、对比目标、行业对标
2. **质量管理成效** - 月合格率、客户投诉、质量成本
3. **成本控制** - 月度成本结构、节约机会、投资回报
4. **供应链表现** - 供应商绩效、交付准时率、库存健康度
5. **设备资产管理** - 设备OEE、维护成本、资产利用率
6. **安全与合规** - 安全事故、HACCP合规、追溯审计
7. **人力资源** - 人均产值、技能矩阵、人员稳定性
8. **改进项目** - 持续改进项目进度、效益跟踪

**输出格式**：
- 执行摘要（关键发现）
- 详细分析（按维度）
- 改进计划（PDCA）
- 风险提示
- 下月重点',
    '["KPI达成", "质量成本", "成本优化", "供应链", "设备OEE", "安全合规", "人力效率"]',
    TRUE,
    10,
    '战略性月报模板，适用于管理层决策',
    'system'
);
