package com.cretas.aims.entity.smartbi.enums;

/**
 * 预测算法枚举
 *
 * 定义 SmartBI 预测服务支持的统计预测算法。
 * 每种算法适用于不同的数据特征和预测需求。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public enum ForecastAlgorithm {

    /**
     * 移动平均法
     * 适用于无明显趋势的平稳数据，通过计算最近N个周期的平均值进行预测。
     * 优点：简单易懂，抗噪声能力强
     * 缺点：对趋势变化反应迟缓
     */
    MOVING_AVERAGE("移动平均", "适用于平稳数据，计算最近周期的平均值"),

    /**
     * 线性趋势法
     * 适用于有明显上升或下降趋势的数据，通过线性回归拟合趋势线进行预测。
     * 优点：能捕捉线性趋势
     * 缺点：不适合非线性或周期性数据
     */
    LINEAR_TREND("线性趋势", "适用于有趋势的数据，基于线性回归进行预测"),

    /**
     * 指数平滑法
     * 适用于有趋势但趋势可能变化的数据，对近期数据赋予更高权重。
     * 优点：对近期变化更敏感
     * 缺点：需要合理选择平滑系数
     */
    EXPONENTIAL_SMOOTHING("指数平滑", "适用于趋势可能变化的数据，近期数据权重更高"),

    /**
     * 自动选择
     * 系统根据数据特征自动选择最合适的预测算法。
     * 综合评估数据的趋势性、平稳性、周期性后选择最优算法。
     */
    AUTO("自动选择", "系统根据数据特征自动选择最佳算法");

    private final String displayName;
    private final String description;

    ForecastAlgorithm(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
