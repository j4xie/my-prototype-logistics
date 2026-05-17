-- ============================================================================
-- Sprint4-H: Register 4 quality AI Tool intents.
-- ============================================================================
-- Pairs with 4 @Component Tools under ai/tool/impl/quality/:
--   quality_defect_record   → QualityDefectRecordTool   (WRITE, sensitivity LOW)
--   quality_defect_query    → QualityDefectQueryTool    (READ,  sensitivity LOW)
--   quality_return_create   → QualityReturnCreateTool   (WRITE, sensitivity MEDIUM)
--   quality_return_query    → QualityReturnQueryTool    (READ,  sensitivity LOW)
--
-- Pattern mirrors V20260516_07__work_process_intents.sql.
-- Priority 80 = proven baseline.
-- ============================================================================

INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, tool_name,
    sensitivity_level, keywords, description, priority, is_active,
    created_at, updated_at
)
VALUES
(
    gen_random_uuid(),
    'QUALITY_DEFECT_RECORD',
    '登记质检不良',
    'QUALITY',
    'quality_defect_record',
    'LOW',
    '["登记不良","记录不良","质检不良记录","录入不良","不合格登记","新增不良","加一条不良","不良品登记"]',
    'Sprint4-H Q-PROCESS-1: 登记一条工序质检不良记录, 关联质检 ID + 缺陷类型 + 数量, 进入 OPEN 状态等待分派.',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'QUALITY_DEFECT_QUERY',
    '查询质检不良',
    'QUALITY',
    'quality_defect_query',
    'LOW',
    '["查询不良","不良列表","待处理不良","OPEN 不良","按类型查不良","不良统计","不良趋势","历史不良"]',
    'Sprint4-H Q-PROCESS-1: 查询工序质检不良列表, 支持按状态(OPEN/IN_PROGRESS/CLOSED)/缺陷类型过滤, 分页.',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'QUALITY_RETURN_CREATE',
    '创建质检退回单',
    'QUALITY',
    'quality_return_create',
    'MEDIUM',
    '["退回供应商","退回委外","质检退回单","创建退回","退回采购","退回加工厂","开退回单","不合格退回","返厂"]',
    'Sprint4-H Q-RETURN-1: 创建质检退回单 (上游退回, 供应商或委外加工厂). 区分客户销售退货 (后者走 sales_returns).',
    80, true, NOW(), NOW()
),
(
    gen_random_uuid(),
    'QUALITY_RETURN_QUERY',
    '查询质检退回单',
    'QUALITY',
    'quality_return_query',
    'LOW',
    '["退回单列表","查询退回","已发出退回","待确认退回","退回供应商记录","退回委外记录","退回历史"]',
    'Sprint4-H Q-RETURN-1: 查询质检退回单列表, 按状态(DRAFT/CONFIRMED/SHIPPED)/目标类型(SUPPLIER/SUBCONTRACT)过滤.',
    80, true, NOW(), NOW()
)
ON CONFLICT (intent_code) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    intent_name = EXCLUDED.intent_name,
    intent_category = EXCLUDED.intent_category,
    sensitivity_level = EXCLUDED.sensitivity_level,
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
