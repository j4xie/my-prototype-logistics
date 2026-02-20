package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 字段映射结果 DTO
 * 用于表示 Excel 列与标准字段的映射关系
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FieldMappingResult {

    /**
     * 原始列名（Excel中的列名）
     */
    private String originalColumn;

    /**
     * 列索引（从0开始）
     */
    private Integer columnIndex;

    /**
     * 映射的标准字段名（如：order_date, salesperson_name等）
     */
    private String standardField;

    /**
     * 标准字段的中文名称
     */
    private String standardFieldLabel;

    /**
     * 数据类型: DATE, NUMERIC, CATEGORICAL, ID, TEXT
     */
    private String dataType;

    /**
     * 子类型: AMOUNT, PERCENTAGE, QUANTITY (仅 NUMERIC 类型)
     */
    private String subType;

    /**
     * 置信度 (0-100)
     */
    private Double confidence;

    /**
     * 映射来源
     * EXACT_MATCH - 精确匹配同义词表
     * SYNONYM_MATCH - 同义词匹配
     * AI_SEMANTIC - AI语义识别
     * FEATURE_INFER - 特征推断
     * MANUAL - 用户手动映射
     */
    private MappingSource mappingSource;

    /**
     * 是否需要用户确认
     * 当置信度低于70%或无法自动映射时为true
     */
    private Boolean requiresConfirmation;

    /**
     * 推荐的候选标准字段（当需要确认时提供）
     */
    private List<CandidateField> candidateFields;

    /**
     * 该字段是否必填
     */
    private Boolean isRequired;

    /**
     * 唯一值列表 (仅 CATEGORICAL 类型)
     */
    private List<String> uniqueValues;

    /**
     * 数据特征信息（便于用户确认时参考）
     */
    private DataFeatureResult dataFeature;

    /**
     * 映射来源枚举
     */
    public enum MappingSource {
        EXACT_MATCH,
        SYNONYM_MATCH,
        AI_SEMANTIC,
        FEATURE_INFER,
        MANUAL
    }

    /**
     * 候选字段
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CandidateField {
        /**
         * 标准字段名
         */
        private String fieldName;

        /**
         * 中文名称
         */
        private String label;

        /**
         * 匹配分数（0-100）
         */
        private Double score;

        /**
         * 匹配理由
         */
        private String reason;
    }
}
