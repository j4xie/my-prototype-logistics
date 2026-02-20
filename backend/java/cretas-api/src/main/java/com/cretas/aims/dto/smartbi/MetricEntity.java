package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 指标实体 DTO
 *
 * 用于表示从自然语言查询中识别出的业务指标实体，
 * 包含匹配文本、标准化名称、指标类别、单位和聚合方式等信息。
 *
 * 使用示例：
 * - 查询 "华东地区销售额" → MetricEntity(text="销售额", normalizedName="销售额", category="sales")
 * - 查询 "去年营收情况" → MetricEntity(text="营收", normalizedName="销售额", category="sales")
 * - 查询 "各省份的利润占比" → MetricEntity(text="利润", normalizedName="利润", category="finance")
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricEntity {

    /**
     * 匹配的原始文本
     * 从用户查询中提取的指标相关文本片段
     * 例如："销售额"、"营收"、"利润"
     */
    private String text;

    /**
     * 标准化名称
     * 统一规范后的指标名称，用于数据库查询和数据匹配
     * 例如："营收" → "销售额"，"净利润" → "利润"
     */
    private String normalizedName;

    /**
     * 指标类别
     * sales: 销售类指标
     * finance: 财务类指标
     * comparison: 对比类指标
     * analysis: 分析类指标
     * customer: 客户类指标
     */
    private String category;

    /**
     * 单位
     * 指标的计量单位，例如："元"、"件"、"%"、"单"、"人"
     */
    private String unit;

    /**
     * 聚合方式
     * SUM: 求和
     * AVG: 平均
     * COUNT: 计数
     * CALC: 计算（如同比、环比等复合指标）
     */
    private String aggregation;

    /**
     * 在原始查询文本中的起始位置（包含）
     * 用于文本高亮和定位
     */
    private int startIndex;

    /**
     * 在原始查询文本中的结束位置（不包含）
     * 用于文本高亮和定位
     */
    private int endIndex;

    /**
     * 匹配置信度 (0.0 - 1.0)
     * 精确匹配为 1.0，别名匹配为 0.9
     */
    @Builder.Default
    private double confidence = 1.0;

    /**
     * 是否通过别名匹配
     */
    @Builder.Default
    private boolean matchedByAlias = false;

    /**
     * 匹配到的别名（如果 matchedByAlias 为 true）
     */
    private String matchedAlias;

    // ==================== 便捷构造方法 ====================

    /**
     * 创建指标实体（精确匹配）
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param category 指标类别
     * @param unit 单位
     * @param aggregation 聚合方式
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return MetricEntity
     */
    public static MetricEntity of(String text, String normalizedName, String category,
                                   String unit, String aggregation, int startIndex, int endIndex) {
        return MetricEntity.builder()
                .text(text)
                .normalizedName(normalizedName)
                .category(category)
                .unit(unit)
                .aggregation(aggregation)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建指标实体（别名匹配）
     *
     * @param text 匹配文本
     * @param normalizedName 标准化名称
     * @param category 指标类别
     * @param unit 单位
     * @param aggregation 聚合方式
     * @param alias 匹配到的别名
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return MetricEntity
     */
    public static MetricEntity ofAlias(String text, String normalizedName, String category,
                                        String unit, String aggregation, String alias,
                                        int startIndex, int endIndex) {
        return MetricEntity.builder()
                .text(text)
                .normalizedName(normalizedName)
                .category(category)
                .unit(unit)
                .aggregation(aggregation)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .matchedByAlias(true)
                .matchedAlias(alias)
                .confidence(0.9)
                .build();
    }

    // ==================== 工具方法 ====================

    /**
     * 获取匹配文本的长度
     *
     * @return 文本长度
     */
    public int getTextLength() {
        return text != null ? text.length() : 0;
    }

    /**
     * 判断是否为销售类指标
     *
     * @return true 如果是销售类指标
     */
    public boolean isSalesMetric() {
        return "sales".equals(category);
    }

    /**
     * 判断是否为财务类指标
     *
     * @return true 如果是财务类指标
     */
    public boolean isFinanceMetric() {
        return "finance".equals(category);
    }

    /**
     * 判断是否为对比类指标
     *
     * @return true 如果是对比类指标
     */
    public boolean isComparisonMetric() {
        return "comparison".equals(category);
    }

    /**
     * 判断是否为分析类指标
     *
     * @return true 如果是分析类指标
     */
    public boolean isAnalysisMetric() {
        return "analysis".equals(category);
    }

    /**
     * 判断是否为客户类指标
     *
     * @return true 如果是客户类指标
     */
    public boolean isCustomerMetric() {
        return "customer".equals(category);
    }

    /**
     * 判断是否为求和类型聚合
     *
     * @return true 如果是SUM聚合
     */
    public boolean isSumAggregation() {
        return "SUM".equals(aggregation);
    }

    /**
     * 判断是否为平均类型聚合
     *
     * @return true 如果是AVG聚合
     */
    public boolean isAvgAggregation() {
        return "AVG".equals(aggregation);
    }

    /**
     * 判断是否为计数类型聚合
     *
     * @return true 如果是COUNT聚合
     */
    public boolean isCountAggregation() {
        return "COUNT".equals(aggregation);
    }

    /**
     * 判断是否为计算类型（复合指标）
     *
     * @return true 如果是CALC聚合
     */
    public boolean isCalcAggregation() {
        return "CALC".equals(aggregation);
    }

    /**
     * 判断实体是否有效
     *
     * @return true 如果包含必要信息
     */
    public boolean isValid() {
        return text != null && !text.isEmpty()
                && normalizedName != null && !normalizedName.isEmpty()
                && category != null && !category.isEmpty()
                && startIndex >= 0
                && endIndex > startIndex;
    }

    /**
     * 获取指标类别的中文描述
     *
     * @return 类别中文名
     */
    public String getCategoryDisplayName() {
        if (category == null) {
            return "未知类别";
        }
        switch (category) {
            case "sales":
                return "销售类指标";
            case "finance":
                return "财务类指标";
            case "comparison":
                return "对比类指标";
            case "analysis":
                return "分析类指标";
            case "customer":
                return "客户类指标";
            default:
                return category;
        }
    }
}
