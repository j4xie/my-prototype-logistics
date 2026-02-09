package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 维度实体 DTO
 *
 * 用于表示从自然语言查询中识别出的维度实体，
 * 包含匹配文本、维度类型、描述、数据库字段和位置信息。
 *
 * 使用示例：
 * - 查询 "按部门统计销售额" -> DimensionEntity(text="按部门", dimensionType="department", dbField="department_id")
 * - 查询 "分区域分析" -> DimensionEntity(text="分区域", dimensionType="region", dbField="region_id")
 * - 查询 "每月趋势" -> DimensionEntity(text="每月", dimensionType="time", granularity="month")
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DimensionEntity {

    /**
     * 匹配的原始文本
     * 从用户查询中提取的维度相关文本片段
     * 例如："按部门"、"分区域"、"每月"
     */
    private String text;

    /**
     * 维度类型
     * department: 部门维度
     * region: 区域维度
     * product: 产品维度
     * person: 人员维度
     * time: 时间维度
     * customer: 客户维度
     * channel: 渠道维度
     */
    private String dimensionType;

    /**
     * 维度描述
     * 例如："部门维度"、"区域维度"、"时间维度"
     */
    private String description;

    /**
     * 对应数据库字段
     * 用于SQL查询的GROUP BY字段
     * 例如："department_id"、"region_id"、"date"
     */
    private String dbField;

    /**
     * 时间粒度（仅对时间维度有效）
     * day: 按日
     * week: 按周
     * month: 按月
     * quarter: 按季度
     * year: 按年
     */
    private String granularity;

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
     * 精确匹配为 1.0，模糊匹配为较低值
     */
    @Builder.Default
    private double confidence = 1.0;

    // ==================== 便捷构造方法 ====================

    /**
     * 创建部门维度实体
     *
     * @param text 匹配文本
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DimensionEntity
     */
    public static DimensionEntity department(String text, int startIndex, int endIndex) {
        return DimensionEntity.builder()
                .text(text)
                .dimensionType("department")
                .description("部门维度")
                .dbField("department_id")
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建区域维度实体
     *
     * @param text 匹配文本
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DimensionEntity
     */
    public static DimensionEntity region(String text, int startIndex, int endIndex) {
        return DimensionEntity.builder()
                .text(text)
                .dimensionType("region")
                .description("区域维度")
                .dbField("region_id")
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建产品维度实体
     *
     * @param text 匹配文本
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DimensionEntity
     */
    public static DimensionEntity product(String text, int startIndex, int endIndex) {
        return DimensionEntity.builder()
                .text(text)
                .dimensionType("product")
                .description("产品维度")
                .dbField("product_id")
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建人员维度实体
     *
     * @param text 匹配文本
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DimensionEntity
     */
    public static DimensionEntity person(String text, int startIndex, int endIndex) {
        return DimensionEntity.builder()
                .text(text)
                .dimensionType("person")
                .description("人员维度")
                .dbField("user_id")
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建时间维度实体
     *
     * @param text 匹配文本
     * @param granularity 时间粒度
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DimensionEntity
     */
    public static DimensionEntity time(String text, String granularity, int startIndex, int endIndex) {
        return DimensionEntity.builder()
                .text(text)
                .dimensionType("time")
                .description("时间维度")
                .dbField("date")
                .granularity(granularity)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建客户维度实体
     *
     * @param text 匹配文本
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DimensionEntity
     */
    public static DimensionEntity customer(String text, int startIndex, int endIndex) {
        return DimensionEntity.builder()
                .text(text)
                .dimensionType("customer")
                .description("客户维度")
                .dbField("customer_id")
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
                .build();
    }

    /**
     * 创建渠道维度实体
     *
     * @param text 匹配文本
     * @param startIndex 起始位置
     * @param endIndex 结束位置
     * @return DimensionEntity
     */
    public static DimensionEntity channel(String text, int startIndex, int endIndex) {
        return DimensionEntity.builder()
                .text(text)
                .dimensionType("channel")
                .description("渠道维度")
                .dbField("channel_id")
                .startIndex(startIndex)
                .endIndex(endIndex)
                .confidence(1.0)
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
     * 判断是否为部门维度
     *
     * @return true 如果是部门维度
     */
    public boolean isDepartment() {
        return "department".equals(dimensionType);
    }

    /**
     * 判断是否为区域维度
     *
     * @return true 如果是区域维度
     */
    public boolean isRegion() {
        return "region".equals(dimensionType);
    }

    /**
     * 判断是否为产品维度
     *
     * @return true 如果是产品维度
     */
    public boolean isProduct() {
        return "product".equals(dimensionType);
    }

    /**
     * 判断是否为人员维度
     *
     * @return true 如果是人员维度
     */
    public boolean isPerson() {
        return "person".equals(dimensionType);
    }

    /**
     * 判断是否为时间维度
     *
     * @return true 如果是时间维度
     */
    public boolean isTime() {
        return "time".equals(dimensionType);
    }

    /**
     * 判断是否为客户维度
     *
     * @return true 如果是客户维度
     */
    public boolean isCustomer() {
        return "customer".equals(dimensionType);
    }

    /**
     * 判断是否为渠道维度
     *
     * @return true 如果是渠道维度
     */
    public boolean isChannel() {
        return "channel".equals(dimensionType);
    }

    /**
     * 判断实体是否有效
     *
     * @return true 如果包含必要信息
     */
    public boolean isValid() {
        return text != null && !text.isEmpty()
                && dimensionType != null && !dimensionType.isEmpty()
                && dbField != null && !dbField.isEmpty()
                && startIndex >= 0
                && endIndex > startIndex;
    }

    /**
     * 判断是否有时间粒度
     *
     * @return true 如果是时间维度且有粒度信息
     */
    public boolean hasGranularity() {
        return isTime() && granularity != null && !granularity.isEmpty();
    }
}
