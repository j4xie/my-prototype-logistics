package com.cretas.aims.entity.smartbi.enums;

/**
 * 推荐类型枚举
 *
 * 用于分类 SmartBI 系统生成的各类智能建议：
 * - 销售提升：提高销售额的策略建议
 * - 成本优化：降低成本的方法建议
 * - 客户维护：客户关系管理建议
 * - 产品聚焦：产品策略调整建议
 * - 区域拓展：市场扩展建议
 * - 催收提醒：应收账款催收建议
 * - 激励方案：人员激励建议
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum RecommendationType {

    /**
     * 销售提升
     * 用于提高销售额、订单量的策略建议
     */
    SALES_IMPROVEMENT("销售提升", "sales", 1),

    /**
     * 成本优化
     * 用于降低成本、提高利润率的方法建议
     */
    COST_REDUCTION("成本优化", "cost", 2),

    /**
     * 客户维护
     * 用于客户关系维护、防流失的建议
     */
    CUSTOMER_RETENTION("客户维护", "customer", 3),

    /**
     * 产品聚焦
     * 用于产品策略调整、产品线优化的建议
     */
    PRODUCT_FOCUS("产品聚焦", "product", 4),

    /**
     * 区域拓展
     * 用于市场扩展、区域开发的建议
     */
    REGION_EXPANSION("区域拓展", "region", 5),

    /**
     * 催收提醒
     * 用于应收账款催收、风险控制的建议
     */
    COLLECTION_ALERT("催收提醒", "collection", 6),

    /**
     * 激励方案
     * 用于人员激励、绩效管理的建议
     */
    INCENTIVE_PLAN("激励方案", "incentive", 7),

    /**
     * 运营优化
     * 用于日常运营流程优化的建议
     */
    OPERATION_OPTIMIZATION("运营优化", "operation", 8),

    /**
     * 风险预警
     * 用于业务风险识别和预警的建议
     */
    RISK_WARNING("风险预警", "risk", 9);

    /**
     * 类型名称
     */
    private final String displayName;

    /**
     * 类型代码
     */
    private final String code;

    /**
     * 默认优先级
     */
    private final int defaultPriority;

    RecommendationType(String displayName, String code, int defaultPriority) {
        this.displayName = displayName;
        this.code = code;
        this.defaultPriority = defaultPriority;
    }

    /**
     * 获取类型显示名称
     *
     * @return 显示名称
     */
    public String getDisplayName() {
        return displayName;
    }

    /**
     * 获取类型代码
     *
     * @return 类型代码
     */
    public String getCode() {
        return code;
    }

    /**
     * 获取默认优先级
     *
     * @return 默认优先级（1-9，数值越小优先级越高）
     */
    public int getDefaultPriority() {
        return defaultPriority;
    }

    /**
     * 根据类型代码获取推荐类型
     *
     * @param code 类型代码
     * @return 对应的推荐类型，未找到时返回 null
     */
    public static RecommendationType fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (RecommendationType type : values()) {
            if (type.code.equalsIgnoreCase(code)) {
                return type;
            }
        }
        return null;
    }

    /**
     * 判断是否为销售相关类型
     *
     * @return 如果是销售相关则返回 true
     */
    public boolean isSalesRelated() {
        return this == SALES_IMPROVEMENT || this == CUSTOMER_RETENTION ||
               this == PRODUCT_FOCUS || this == REGION_EXPANSION;
    }

    /**
     * 判断是否为财务相关类型
     *
     * @return 如果是财务相关则返回 true
     */
    public boolean isFinanceRelated() {
        return this == COST_REDUCTION || this == COLLECTION_ALERT || this == RISK_WARNING;
    }

    /**
     * 判断是否为人员相关类型
     *
     * @return 如果是人员相关则返回 true
     */
    public boolean isHrRelated() {
        return this == INCENTIVE_PLAN;
    }
}
