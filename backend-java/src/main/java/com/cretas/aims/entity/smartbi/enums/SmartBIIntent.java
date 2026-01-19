package com.cretas.aims.entity.smartbi.enums;

/**
 * SmartBI 意图枚举
 *
 * 定义系统支持的所有业务意图类型：
 * - 查询类：销售、财务、部门、区域等数据查询
 * - 对比类：时期、部门、区域对比分析
 * - 下钻类：数据细节下钻
 * - 预测类：趋势预测分析
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum SmartBIIntent {

    // ==================== 销售查询类 ====================

    /**
     * 销售概览 - 查看整体销售情况
     * 触发词：销售情况、销售概览、销售总览、卖了多少、营收情况
     */
    QUERY_SALES_OVERVIEW("sales_overview", "销售概览", "QUERY"),

    /**
     * 销售排名 - 查看销售排名数据
     * 触发词：销售排名、销售TOP、卖得最好、销量第一
     */
    QUERY_SALES_RANKING("sales_ranking", "销售排名", "QUERY"),

    /**
     * 销售趋势 - 查看销售趋势变化
     * 触发词：销售趋势、销售走势、销量变化、增长趋势
     */
    QUERY_SALES_TREND("sales_trend", "销售趋势", "QUERY"),

    /**
     * 部门业绩 - 查看部门业绩表现
     * 触发词：部门业绩、部门表现、各部门销售、团队业绩
     */
    QUERY_DEPARTMENT_PERFORMANCE("dept_performance", "部门业绩", "QUERY"),

    /**
     * 区域分析 - 查看区域销售分布
     * 触发词：区域分析、区域销售、各地区销量、地区分布
     */
    QUERY_REGION_ANALYSIS("region_analysis", "区域分析", "QUERY"),

    // ==================== 财务查询类 ====================

    /**
     * 财务概览 - 查看财务整体情况
     * 触发词：财务概览、财务情况、财务报表、收支情况
     */
    QUERY_FINANCE_OVERVIEW("finance_overview", "财务概览", "QUERY"),

    /**
     * 利润分析 - 查看利润相关数据
     * 触发词：利润分析、利润率、毛利、净利润
     */
    QUERY_PROFIT_ANALYSIS("profit_analysis", "利润分析", "QUERY"),

    /**
     * 成本分析 - 查看成本相关数据
     * 触发词：成本分析、成本构成、费用分析、成本占比
     */
    QUERY_COST_ANALYSIS("cost_analysis", "成本分析", "QUERY"),

    /**
     * 应收账款 - 查看应收账款情况
     * 触发词：应收账款、欠款、账期、回款情况
     */
    QUERY_RECEIVABLE("receivable", "应收账款", "QUERY"),

    // ==================== 产品查询类 ====================

    /**
     * 产品分析 - 查看产品相关数据
     * 触发词：产品分析、产品销量、产品表现、哪个产品
     */
    QUERY_PRODUCT_ANALYSIS("product_analysis", "产品分析", "QUERY"),

    /**
     * 库存查询 - 查看库存相关数据
     * 触发词：库存情况、库存量、存货、库存分析
     */
    QUERY_INVENTORY("inventory", "库存查询", "QUERY"),

    // ==================== 生产查询类 ====================

    /**
     * OEE 概览 - 查看设备综合效率
     * 触发词：OEE、设备效率、综合效率、产线效率
     */
    QUERY_OEE_OVERVIEW("oee_overview", "OEE概览", "QUERY"),

    /**
     * 生产效率 - 查看生产效率数据
     * 触发词：生产效率、产能、产量、生产情况
     */
    QUERY_PRODUCTION_EFFICIENCY("production_efficiency", "生产效率", "QUERY"),

    /**
     * 设备利用率 - 查看设备使用情况
     * 触发词：设备利用率、设备使用、开机率、运行时长
     */
    QUERY_EQUIPMENT_UTILIZATION("equipment_utilization", "设备利用率", "QUERY"),

    // ==================== 质量查询类 ====================

    /**
     * 质量汇总 - 查看质量整体情况
     * 触发词：质量情况、质量概览、合格率、质量分析
     */
    QUERY_QUALITY_SUMMARY("quality_summary", "质量汇总", "QUERY"),

    /**
     * 缺陷分析 - 查看缺陷类型和分布
     * 触发词：缺陷分析、不良品、缺陷率、质量问题
     */
    QUERY_DEFECT_ANALYSIS("defect_analysis", "缺陷分析", "QUERY"),

    /**
     * 返工成本 - 查看返工和报废成本
     * 触发词：返工成本、返工率、报废、质量损失
     */
    QUERY_REWORK_COST("rework_cost", "返工成本", "QUERY"),

    // ==================== 库存查询类 ====================

    /**
     * 库存健康 - 查看库存健康状况
     * 触发词：库存健康、库存状况、库存分析、库存情况
     */
    QUERY_INVENTORY_HEALTH("inventory_health", "库存健康", "QUERY"),

    /**
     * 过期风险 - 查看库存过期预警
     * 触发词：过期风险、即将过期、效期预警、保质期
     */
    QUERY_EXPIRY_RISK("expiry_risk", "过期风险", "QUERY"),

    /**
     * 损耗分析 - 查看库存损耗情况
     * 触发词：损耗分析、库存损失、报损、损耗率
     */
    QUERY_LOSS_ANALYSIS("loss_analysis", "损耗分析", "QUERY"),

    // ==================== 销售深化类 ====================

    /**
     * 销售漏斗 - 查看销售转化漏斗
     * 触发词：销售漏斗、转化率、销售管道、成交漏斗
     */
    QUERY_SALES_FUNNEL("sales_funnel", "销售漏斗", "QUERY"),

    /**
     * 客户RFM - 查看客户RFM分群
     * 触发词：RFM、客户分群、客户价值、客户分析
     */
    QUERY_CUSTOMER_RFM("customer_rfm", "客户RFM", "QUERY"),

    /**
     * 产品ABC - 查看产品ABC分类
     * 触发词：ABC分析、产品分类、产品贡献、二八法则
     */
    QUERY_PRODUCT_ABC("product_abc", "产品ABC", "QUERY"),

    // ==================== 采购查询类 ====================

    /**
     * 采购概览 - 查看采购整体情况
     * 触发词：采购情况、采购概览、采购分析、进货情况
     */
    QUERY_PROCUREMENT_OVERVIEW("procurement_overview", "采购概览", "QUERY"),

    /**
     * 供应商评估 - 查看供应商表现
     * 触发词：供应商评估、供应商表现、供应商排名、供应商分析
     */
    QUERY_SUPPLIER_EVALUATION("supplier_evaluation", "供应商评估", "QUERY"),

    /**
     * 采购成本 - 查看采购成本分析
     * 触发词：采购成本、进货成本、采购价格、成本趋势
     */
    QUERY_PURCHASE_COST("purchase_cost", "采购成本", "QUERY"),

    // ==================== 财务深化类 ====================

    /**
     * 现金流 - 查看现金流分析
     * 触发词：现金流、资金流向、资金情况、现金情况
     */
    QUERY_CASH_FLOW("cash_flow", "现金流", "QUERY"),

    /**
     * 财务比率 - 查看财务比率分析
     * 触发词：财务比率、财务指标、ROE、ROA、流动比率
     */
    QUERY_FINANCIAL_RATIOS("financial_ratios", "财务比率", "QUERY"),

    // ==================== 对比类 ====================

    /**
     * 时期对比 - 对比不同时间段的数据
     * 触发词：环比、同比、对比、去年同期、上个月
     */
    COMPARE_PERIOD("compare_period", "时期对比", "COMPARE"),

    /**
     * 部门对比 - 对比不同部门的数据
     * 触发词：部门对比、部门比较、哪个部门、团队PK
     */
    COMPARE_DEPARTMENT("compare_dept", "部门对比", "COMPARE"),

    /**
     * 区域对比 - 对比不同区域的数据
     * 触发词：区域对比、地区比较、哪个区域、城市对比
     */
    COMPARE_REGION("compare_region", "区域对比", "COMPARE"),

    // ==================== 下钻类 ====================

    /**
     * 数据下钻 - 查看数据细节
     * 触发词：详情、明细、下钻、展开、具体看看
     */
    DRILL_DOWN("drill_down", "数据下钻", "DRILL"),

    // ==================== 预测类 ====================

    /**
     * 预测分析 - 预测未来趋势
     * 触发词：预测、预估、预计、会怎样、下个月会
     */
    FORECAST("forecast", "预测分析", "FORECAST"),

    // ==================== 聚合类 ====================

    /**
     * 汇总统计 - 聚合统计查询
     * 触发词：汇总、总计、合计、一共、总共
     */
    AGGREGATE_SUMMARY("aggregate_summary", "汇总统计", "AGGREGATE"),

    // ==================== 系统类 ====================

    /**
     * 未知意图 - 无法识别的意图
     */
    UNKNOWN("unknown", "未知意图", "UNKNOWN");

    // ==================== 枚举属性 ====================

    /**
     * 意图代码（唯一标识）
     */
    private final String code;

    /**
     * 意图名称（中文显示）
     */
    private final String name;

    /**
     * 意图分类
     */
    private final String category;

    // ==================== 构造函数 ====================

    SmartBIIntent(String code, String name, String category) {
        this.code = code;
        this.name = name;
        this.category = category;
    }

    // ==================== Getter 方法 ====================

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getCategory() {
        return category;
    }

    // ==================== 静态方法 ====================

    /**
     * 根据代码获取意图枚举
     *
     * @param code 意图代码
     * @return 对应的意图枚举，未找到返回 UNKNOWN
     */
    public static SmartBIIntent fromCode(String code) {
        if (code == null || code.isEmpty()) {
            return UNKNOWN;
        }
        for (SmartBIIntent intent : values()) {
            if (intent.code.equalsIgnoreCase(code)) {
                return intent;
            }
        }
        return UNKNOWN;
    }

    /**
     * 判断是否为查询类意图
     *
     * @return 是否为查询类
     */
    public boolean isQueryIntent() {
        return "QUERY".equals(this.category);
    }

    /**
     * 判断是否为对比类意图
     *
     * @return 是否为对比类
     */
    public boolean isCompareIntent() {
        return "COMPARE".equals(this.category);
    }

    /**
     * 判断是否为下钻类意图
     *
     * @return 是否为下钻类
     */
    public boolean isDrillIntent() {
        return "DRILL".equals(this.category);
    }

    /**
     * 判断是否为预测类意图
     *
     * @return 是否为预测类
     */
    public boolean isForecastIntent() {
        return "FORECAST".equals(this.category);
    }

    /**
     * 判断是否为有效意图（非 UNKNOWN）
     *
     * @return 是否为有效意图
     */
    public boolean isValid() {
        return this != UNKNOWN;
    }
}
