-- =====================================================
-- SmartBI Incentive Rules Configuration Table
-- =====================================================
-- Provides dynamic multi-level incentive rule management
-- Supports percentage-based and fixed-amount rewards
-- Allows factory-specific rule overrides
-- =====================================================

CREATE TABLE IF NOT EXISTS smart_bi_incentive_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',

    -- Rule identification
    rule_code VARCHAR(64) NOT NULL COMMENT '规则代码 (e.g., SALES_TARGET, QUALITY_SCORE)',
    rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
    level_name VARCHAR(32) NOT NULL COMMENT '等级名称 (e.g., 铜牌, 银牌, 金牌, 钻石)',

    -- Value range for matching
    min_value DECIMAL(15,4) NOT NULL COMMENT '最小值 (含)',
    max_value DECIMAL(15,4) NULL COMMENT '最大值 (不含), NULL=无上限',

    -- Reward configuration
    reward_rate DECIMAL(5,4) NULL COMMENT '奖励比例 (e.g., 0.01=1%, 0.05=5%)',
    reward_amount DECIMAL(15,2) NULL COMMENT '固定奖励金额',

    -- Metadata
    description VARCHAR(255) NULL COMMENT '规则描述',
    factory_id VARCHAR(32) NULL COMMENT '工厂ID (NULL=全局规则)',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',

    -- Audit fields (BaseEntity)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME NULL COMMENT '软删除时间',

    -- Indexes
    INDEX idx_rule_code (rule_code),
    INDEX idx_factory_id (factory_id),
    INDEX idx_rule_active (rule_code, is_active),
    INDEX idx_sort_order (rule_code, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI激励规则配置表';

-- =====================================================
-- Initial Data: Sales Target Incentive Rules (销售目标达成激励)
-- =====================================================
-- Based on target completion percentage:
-- - Bronze (铜牌): 80-100% completion -> 1% bonus
-- - Silver (银牌): 100-120% completion -> 2% bonus
-- - Gold (金牌): 120-150% completion -> 3% bonus
-- - Diamond (钻石): 150%+ completion -> 5% bonus
-- =====================================================

INSERT INTO smart_bi_incentive_rules
(rule_code, rule_name, level_name, min_value, max_value, reward_rate, description, sort_order)
VALUES
('SALES_TARGET', '销售目标达成激励', '铜牌', 80.00, 100.00, 0.0100, '达成80%-100%目标，获得销售额1%奖励', 1),
('SALES_TARGET', '销售目标达成激励', '银牌', 100.00, 120.00, 0.0200, '达成100%-120%目标，获得销售额2%奖励', 2),
('SALES_TARGET', '销售目标达成激励', '金牌', 120.00, 150.00, 0.0300, '达成120%-150%目标，获得销售额3%奖励', 3),
('SALES_TARGET', '销售目标达成激励', '钻石', 150.00, NULL, 0.0500, '超额完成150%以上目标，获得销售额5%奖励', 4);

-- =====================================================
-- Initial Data: Quality Score Incentive Rules (质量评分激励)
-- =====================================================
-- Based on quality inspection pass rate:
-- - Bronze (铜牌): 85-90% pass rate -> 500 CNY bonus
-- - Silver (银牌): 90-95% pass rate -> 1000 CNY bonus
-- - Gold (金牌): 95-98% pass rate -> 2000 CNY bonus
-- - Diamond (钻石): 98%+ pass rate -> 5000 CNY bonus
-- =====================================================

INSERT INTO smart_bi_incentive_rules
(rule_code, rule_name, level_name, min_value, max_value, reward_amount, description, sort_order)
VALUES
('QUALITY_SCORE', '质量评分激励', '铜牌', 85.00, 90.00, 500.00, '质检合格率85%-90%，奖励500元', 1),
('QUALITY_SCORE', '质量评分激励', '银牌', 90.00, 95.00, 1000.00, '质检合格率90%-95%，奖励1000元', 2),
('QUALITY_SCORE', '质量评分激励', '金牌', 95.00, 98.00, 2000.00, '质检合格率95%-98%，奖励2000元', 3),
('QUALITY_SCORE', '质量评分激励', '钻石', 98.00, NULL, 5000.00, '质检合格率98%以上，奖励5000元', 4);

-- =====================================================
-- Initial Data: Production Efficiency Incentive Rules (生产效率激励)
-- =====================================================
-- Based on production efficiency percentage:
-- - Bronze (铜牌): 90-100% efficiency -> 0.5% bonus
-- - Silver (银牌): 100-110% efficiency -> 1% bonus
-- - Gold (金牌): 110-125% efficiency -> 1.5% bonus
-- - Diamond (钻石): 125%+ efficiency -> 2% bonus
-- =====================================================

INSERT INTO smart_bi_incentive_rules
(rule_code, rule_name, level_name, min_value, max_value, reward_rate, description, sort_order)
VALUES
('PRODUCTION_EFFICIENCY', '生产效率激励', '铜牌', 90.00, 100.00, 0.0050, '生产效率90%-100%，获得产值0.5%奖励', 1),
('PRODUCTION_EFFICIENCY', '生产效率激励', '银牌', 100.00, 110.00, 0.0100, '生产效率100%-110%，获得产值1%奖励', 2),
('PRODUCTION_EFFICIENCY', '生产效率激励', '金牌', 110.00, 125.00, 0.0150, '生产效率110%-125%，获得产值1.5%奖励', 3),
('PRODUCTION_EFFICIENCY', '生产效率激励', '钻石', 125.00, NULL, 0.0200, '生产效率超过125%，获得产值2%奖励', 4);

-- =====================================================
-- Initial Data: Cost Reduction Incentive Rules (成本节约激励)
-- =====================================================
-- Based on cost reduction percentage:
-- - Bronze (铜牌): 3-5% reduction -> 10% of savings as bonus
-- - Silver (银牌): 5-8% reduction -> 15% of savings as bonus
-- - Gold (金牌): 8-12% reduction -> 20% of savings as bonus
-- - Diamond (钻石): 12%+ reduction -> 25% of savings as bonus
-- =====================================================

INSERT INTO smart_bi_incentive_rules
(rule_code, rule_name, level_name, min_value, max_value, reward_rate, description, sort_order)
VALUES
('COST_REDUCTION', '成本节约激励', '铜牌', 3.00, 5.00, 0.1000, '成本节约3%-5%，获得节约额10%奖励', 1),
('COST_REDUCTION', '成本节约激励', '银牌', 5.00, 8.00, 0.1500, '成本节约5%-8%，获得节约额15%奖励', 2),
('COST_REDUCTION', '成本节约激励', '金牌', 8.00, 12.00, 0.2000, '成本节约8%-12%，获得节约额20%奖励', 3),
('COST_REDUCTION', '成本节约激励', '钻石', 12.00, NULL, 0.2500, '成本节约超过12%，获得节约额25%奖励', 4);

-- =====================================================
-- Initial Data: Attendance Rate Incentive Rules (出勤率激励)
-- =====================================================
-- Based on monthly attendance rate:
-- - Bronze (铜牌): 95-97% attendance -> 100 CNY bonus
-- - Silver (银牌): 97-99% attendance -> 200 CNY bonus
-- - Gold (金牌): 99-100% attendance -> 500 CNY bonus
-- - Diamond (钻石): 100% attendance -> 1000 CNY bonus
-- =====================================================

INSERT INTO smart_bi_incentive_rules
(rule_code, rule_name, level_name, min_value, max_value, reward_amount, description, sort_order)
VALUES
('ATTENDANCE_RATE', '出勤率激励', '铜牌', 95.00, 97.00, 100.00, '月出勤率95%-97%，奖励100元', 1),
('ATTENDANCE_RATE', '出勤率激励', '银牌', 97.00, 99.00, 200.00, '月出勤率97%-99%，奖励200元', 2),
('ATTENDANCE_RATE', '出勤率激励', '金牌', 99.00, 100.00, 500.00, '月出勤率99%-100%，奖励500元', 3),
('ATTENDANCE_RATE', '出勤率激励', '钻石', 100.00, NULL, 1000.00, '月出勤率100%全勤，奖励1000元', 4);
