-- ============================================================
-- SmartBI Alert Thresholds Migration
-- 告警阈值配置表
--
-- 功能：
-- - 支持动态配置各类业务指标的告警阈值
-- - 支持全局配置和工厂级别配置
-- - 工厂级别配置覆盖全局配置
--
-- 阈值类型：
-- - SALES: 销售相关阈值
-- - FINANCE: 财务相关阈值
-- - DEPARTMENT: 部门绩效阈值
-- - PRODUCTION: 生产相关阈值
-- - QUALITY: 质量相关阈值
--
-- @author Cretas Team
-- @version 1.0.0
-- @since 2026-01-21
-- ============================================================

-- 创建告警阈值表
CREATE TABLE IF NOT EXISTS smart_bi_alert_thresholds (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    threshold_type VARCHAR(64) NOT NULL COMMENT '阈值类型: SALES, FINANCE, DEPARTMENT, PRODUCTION, QUALITY',
    metric_code VARCHAR(64) NOT NULL COMMENT '指标代码: SALES_AMOUNT, PROFIT_RATE, ORDER_COUNT 等',
    warning_value DECIMAL(15,4) COMMENT '警告阈值（黄色告警）',
    critical_value DECIMAL(15,4) COMMENT '严重阈值（红色告警）',
    comparison_operator VARCHAR(16) DEFAULT 'GT' COMMENT '比较操作符: GT, LT, GTE, LTE, EQ',
    unit VARCHAR(32) COMMENT '单位: %, 元, 件, 次 等',
    description VARCHAR(255) COMMENT '阈值描述',
    factory_id VARCHAR(32) COMMENT '工厂ID, NULL=全局配置',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME NULL COMMENT '软删除时间',
    UNIQUE KEY uk_type_metric_factory (threshold_type, metric_code, factory_id),
    INDEX idx_threshold_type (threshold_type),
    INDEX idx_threshold_metric (metric_code),
    INDEX idx_threshold_factory (factory_id),
    INDEX idx_threshold_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SmartBI告警阈值配置表';

-- ============================================================
-- 初始数据 - 全局默认阈值配置
-- ============================================================

-- 销售类阈值 (SALES)
INSERT INTO smart_bi_alert_thresholds (threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description)
VALUES
    ('SALES', 'SALES_AMOUNT_DAILY', 50000.0000, 30000.0000, 'LT', '元', '日销售额低于阈值触发告警'),
    ('SALES', 'SALES_AMOUNT_MONTHLY', 1500000.0000, 1000000.0000, 'LT', '元', '月销售额低于阈值触发告警'),
    ('SALES', 'ORDER_COUNT_DAILY', 100.0000, 50.0000, 'LT', '单', '日订单数低于阈值触发告警'),
    ('SALES', 'AVG_ORDER_VALUE', 300.0000, 200.0000, 'LT', '元', '平均客单价低于阈值触发告警'),
    ('SALES', 'SALES_GROWTH_RATE', -5.0000, -10.0000, 'LT', '%', '销售增长率低于阈值触发告警'),
    ('SALES', 'ORDER_CANCEL_RATE', 5.0000, 10.0000, 'GT', '%', '订单取消率高于阈值触发告警'),
    ('SALES', 'RETURN_RATE', 3.0000, 5.0000, 'GT', '%', '退货率高于阈值触发告警');

-- 财务类阈值 (FINANCE)
INSERT INTO smart_bi_alert_thresholds (threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description)
VALUES
    ('FINANCE', 'PROFIT_RATE', 15.0000, 10.0000, 'LT', '%', '利润率低于阈值触发告警'),
    ('FINANCE', 'GROSS_MARGIN', 25.0000, 20.0000, 'LT', '%', '毛利率低于阈值触发告警'),
    ('FINANCE', 'COST_RATIO', 70.0000, 80.0000, 'GT', '%', '成本占比高于阈值触发告警'),
    ('FINANCE', 'OPERATING_EXPENSE_RATIO', 20.0000, 25.0000, 'GT', '%', '运营费用占比高于阈值触发告警'),
    ('FINANCE', 'RECEIVABLE_DAYS', 45.0000, 60.0000, 'GT', '天', '应收账款周转天数高于阈值触发告警'),
    ('FINANCE', 'INVENTORY_TURNOVER', 6.0000, 4.0000, 'LT', '次', '库存周转率低于阈值触发告警');

-- 部门绩效类阈值 (DEPARTMENT)
INSERT INTO smart_bi_alert_thresholds (threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description)
VALUES
    ('DEPARTMENT', 'TASK_COMPLETION_RATE', 90.0000, 80.0000, 'LT', '%', '任务完成率低于阈值触发告警'),
    ('DEPARTMENT', 'BUDGET_USAGE_RATE', 80.0000, 95.0000, 'GT', '%', '预算使用率高于阈值触发告警'),
    ('DEPARTMENT', 'EMPLOYEE_PRODUCTIVITY', 80.0000, 60.0000, 'LT', '%', '员工生产力低于阈值触发告警'),
    ('DEPARTMENT', 'DEPT_SALES_TARGET', 90.0000, 70.0000, 'LT', '%', '部门销售目标完成率低于阈值触发告警');

-- 生产类阈值 (PRODUCTION)
INSERT INTO smart_bi_alert_thresholds (threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description)
VALUES
    ('PRODUCTION', 'PRODUCTION_EFFICIENCY', 85.0000, 70.0000, 'LT', '%', '生产效率低于阈值触发告警'),
    ('PRODUCTION', 'EQUIPMENT_UTILIZATION', 80.0000, 60.0000, 'LT', '%', '设备利用率低于阈值触发告警'),
    ('PRODUCTION', 'DOWNTIME_HOURS', 2.0000, 4.0000, 'GT', '小时', '停机时间高于阈值触发告警'),
    ('PRODUCTION', 'DEFECT_RATE', 2.0000, 5.0000, 'GT', '%', '产品缺陷率高于阈值触发告警'),
    ('PRODUCTION', 'YIELD_RATE', 95.0000, 90.0000, 'LT', '%', '良品率低于阈值触发告警'),
    ('PRODUCTION', 'ON_TIME_DELIVERY', 95.0000, 90.0000, 'LT', '%', '准时交付率低于阈值触发告警');

-- 质量类阈值 (QUALITY)
INSERT INTO smart_bi_alert_thresholds (threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description)
VALUES
    ('QUALITY', 'INSPECTION_PASS_RATE', 98.0000, 95.0000, 'LT', '%', '检验合格率低于阈值触发告警'),
    ('QUALITY', 'CUSTOMER_COMPLAINT_RATE', 1.0000, 2.0000, 'GT', '%', '客户投诉率高于阈值触发告警'),
    ('QUALITY', 'REWORK_RATE', 3.0000, 5.0000, 'GT', '%', '返工率高于阈值触发告警'),
    ('QUALITY', 'SCRAP_RATE', 1.0000, 2.0000, 'GT', '%', '报废率高于阈值触发告警'),
    ('QUALITY', 'FIRST_PASS_YIELD', 95.0000, 90.0000, 'LT', '%', '首次通过率低于阈值触发告警');

-- ============================================================
-- 示例：工厂级别配置（覆盖全局配置）
-- ============================================================

-- F001 工厂的自定义阈值（销售目标更高）
INSERT INTO smart_bi_alert_thresholds (threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, factory_id)
VALUES
    ('SALES', 'SALES_AMOUNT_DAILY', 80000.0000, 50000.0000, 'LT', '元', 'F001工厂日销售额阈值（高于全局）', 'F001'),
    ('SALES', 'ORDER_COUNT_DAILY', 150.0000, 80.0000, 'LT', '单', 'F001工厂日订单数阈值（高于全局）', 'F001');

-- F002 工厂的自定义阈值（生产要求更严格）
INSERT INTO smart_bi_alert_thresholds (threshold_type, metric_code, warning_value, critical_value, comparison_operator, unit, description, factory_id)
VALUES
    ('PRODUCTION', 'YIELD_RATE', 98.0000, 95.0000, 'LT', '%', 'F002工厂良品率阈值（高于全局）', 'F002'),
    ('QUALITY', 'INSPECTION_PASS_RATE', 99.0000, 98.0000, 'LT', '%', 'F002工厂检验合格率阈值（高于全局）', 'F002');
