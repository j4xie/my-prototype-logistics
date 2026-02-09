-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_21_05__metric_formulas.sql
-- Conversion date: 2026-01-26 18:49:10
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================================
-- SmartBI 指标公式配置表
--
-- 支持动态配置指标计算公式，无需修改代码即可调整计算逻辑
-- 使用 SpEL (Spring Expression Language) 解析和计算公式
--
-- 公式类型：
--   SIMPLE  - 简单字段映射，直接使用基础字段值
--   DERIVED - 派生指标，基于其他指标计算
--   CUSTOM  - 自定义公式，使用 SpEL 表达式计算
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-21
-- ============================================================================

-- 创建指标公式配置表
CREATE TABLE IF NOT EXISTS smart_bi_metric_formulas (
    id BIGSERIAL PRIMARY KEY COMMENT '主键ID',

    -- 指标基本信息
    metric_code VARCHAR(64) NOT NULL COMMENT '指标代码（唯一标识）',
    metric_name VARCHAR(128) NOT NULL COMMENT '指标名称（用于显示）',

    -- 公式配置
    formula_type VARCHAR(32) NOT NULL COMMENT '公式类型: SIMPLE/DERIVED/CUSTOM',
    base_field VARCHAR(64) COMMENT '基础字段名（SIMPLE 类型使用）',
    formula_expression TEXT COMMENT '公式表达式（SpEL 语法，变量用 # 前缀）',

    -- 聚合与格式化
    aggregation VARCHAR(32) DEFAULT 'SUM' COMMENT '聚合方式: SUM/AVG/COUNT/COUNT_DISTINCT/MAX/MIN',
    unit VARCHAR(32) COMMENT '单位: 元, %, 个 等',
    format_pattern VARCHAR(32) COMMENT '格式化模式: #,##0.00, 0.00% 等',

    -- 描述信息
    description VARCHAR(255) COMMENT '指标描述',

    -- 工厂配置
    factory_id VARCHAR(32) COMMENT '工厂ID，null 表示全局配置',

    -- 状态
    is_active BOOLEAN DEFAULT TRUE NOT NULL COMMENT '是否启用',

    -- 审计字段 (继承 BaseEntity)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE NULL COMMENT '软删除时间',

    -- 唯一约束：同一工厂下指标代码唯一
    CONSTRAINT uk_metric_factory UNIQUE (metric_code, factory_id),

    -- 索引
    INDEX idx_metric_code (metric_code),
    INDEX idx_metric_factory (factory_id),
    INDEX idx_metric_active (is_active),
    INDEX idx_metric_type (formula_type)
)
;

-- ============================================================================
-- 初始化数据：常用指标公式
-- ============================================================================

-- 1. 销售相关指标
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, base_field, formula_expression, aggregation, unit, format_pattern, description)
VALUES
-- 销售额（简单字段映射）
('sales_amount', '销售额', 'SIMPLE', 'salesAmount', NULL, 'SUM', '元', '#,##0.00', '销售总金额'),

-- 订单数（简单字段映射）
('order_count', '订单数', 'SIMPLE', 'orderCount', NULL, 'COUNT', '个', '#,##0', '订单总数量'),

-- 客单价（派生指标）
('avg_order_value', '客单价', 'DERIVED', NULL, '#salesAmount / #orderCount', 'AVG', '元', '#,##0.00', '平均每单金额 = 销售额 / 订单数'),

-- 毛利额（简单字段映射）
('gross_profit', '毛利额', 'SIMPLE', 'grossProfit', NULL, 'SUM', '元', '#,##0.00', '毛利总额'),

-- 毛利率（派生指标）
('gross_margin_rate', '毛利率', 'DERIVED', NULL, '#grossProfit / #salesAmount * 100', 'AVG', '%', '0.00', '毛利率 = 毛利额 / 销售额 * 100');

-- 2. 增长率相关指标
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, base_field, formula_expression, aggregation, unit, format_pattern, description)
VALUES
-- 同比增长率
('yoy_growth_rate', '同比增长率', 'CUSTOM', NULL, '(#currentValue - #lastYearValue) / #lastYearValue * 100', NULL, '%', '+0.00;-0.00', '同比增长率 = (本期 - 去年同期) / 去年同期 * 100'),

-- 环比增长率
('mom_growth_rate', '环比增长率', 'CUSTOM', NULL, '(#currentValue - #lastPeriodValue) / #lastPeriodValue * 100', NULL, '%', '+0.00;-0.00', '环比增长率 = (本期 - 上期) / 上期 * 100');

-- 3. 客户相关指标
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, base_field, formula_expression, aggregation, unit, format_pattern, description)
VALUES
-- 客户数（简单字段映射）
('customer_count', '客户数', 'SIMPLE', 'customerCount', NULL, 'COUNT_DISTINCT', '个', '#,##0', '客户总数'),

-- 新客户数
('new_customer_count', '新客户数', 'SIMPLE', 'newCustomerCount', NULL, 'COUNT', '个', '#,##0', '新增客户数'),

-- 新客占比
('new_customer_rate', '新客占比', 'DERIVED', NULL, '#newCustomerCount / #customerCount * 100', 'AVG', '%', '0.00', '新客占比 = 新客户数 / 客户总数 * 100'),

-- 复购率
('repurchase_rate', '复购率', 'DERIVED', NULL, '#repeatCustomerCount / #customerCount * 100', 'AVG', '%', '0.00', '复购率 = 复购客户数 / 客户总数 * 100');

-- 4. 产品相关指标
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, base_field, formula_expression, aggregation, unit, format_pattern, description)
VALUES
-- 商品数
('product_count', '商品数', 'SIMPLE', 'productCount', NULL, 'COUNT_DISTINCT', '个', '#,##0', '商品总数'),

-- 销量
('sales_quantity', '销量', 'SIMPLE', 'salesQuantity', NULL, 'SUM', '件', '#,##0', '销售数量'),

-- 均价
('avg_price', '均价', 'DERIVED', NULL, '#salesAmount / #salesQuantity', 'AVG', '元', '#,##0.00', '平均单价 = 销售额 / 销量');

-- 5. 库存相关指标
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, base_field, formula_expression, aggregation, unit, format_pattern, description)
VALUES
-- 库存金额
('inventory_value', '库存金额', 'SIMPLE', 'inventoryValue', NULL, 'SUM', '元', '#,##0.00', '库存总金额'),

-- 库存周转率
('inventory_turnover', '库存周转率', 'DERIVED', NULL, '#costOfGoodsSold / (#beginningInventory + #endingInventory) * 2', 'AVG', '次', '0.00', '库存周转率 = 销售成本 / 平均库存'),

-- 库存周转天数
('inventory_days', '库存周转天数', 'DERIVED', NULL, '365 / #inventoryTurnover', 'AVG', '天', '0', '库存周转天数 = 365 / 库存周转率');

-- 6. 财务相关指标
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, base_field, formula_expression, aggregation, unit, format_pattern, description)
VALUES
-- 成本
('cost_amount', '成本', 'SIMPLE', 'costAmount', NULL, 'SUM', '元', '#,##0.00', '成本总额'),

-- 费用
('expense_amount', '费用', 'SIMPLE', 'expenseAmount', NULL, 'SUM', '元', '#,##0.00', '费用总额'),

-- 净利润
('net_profit', '净利润', 'DERIVED', NULL, '#grossProfit - #expenseAmount', 'SUM', '元', '#,##0.00', '净利润 = 毛利 - 费用'),

-- 净利率
('net_margin_rate', '净利率', 'DERIVED', NULL, '#netProfit / #salesAmount * 100', 'AVG', '%', '0.00', '净利率 = 净利润 / 销售额 * 100'),

-- 费用率
('expense_rate', '费用率', 'DERIVED', NULL, '#expenseAmount / #salesAmount * 100', 'AVG', '%', '0.00', '费用率 = 费用 / 销售额 * 100');

-- 7. 运营效率指标
INSERT INTO smart_bi_metric_formulas
(metric_code, metric_name, formula_type, base_field, formula_expression, aggregation, unit, format_pattern, description)
VALUES
-- 人效
('revenue_per_employee', '人效', 'DERIVED', NULL, '#salesAmount / #employeeCount', 'AVG', '元/人', '#,##0.00', '人效 = 销售额 / 员工数'),

-- 坪效
('revenue_per_sqm', '坪效', 'DERIVED', NULL, '#salesAmount / #storeArea', 'AVG', '元/平', '#,##0.00', '坪效 = 销售额 / 店铺面积'),

-- 达成率
('achievement_rate', '达成率', 'DERIVED', NULL, '#actualValue / #targetValue * 100', 'AVG', '%', '0.00', '达成率 = 实际值 / 目标值 * 100');

-- ============================================================================
-- 日志记录
-- ============================================================================
-- 记录迁移完成
SELECT CONCAT('V2026_01_21_05: 指标公式配置表创建完成，共插入 ',
    (SELECT COUNT(*) FROM smart_bi_metric_formulas), ' 条初始数据') AS migration_info;
