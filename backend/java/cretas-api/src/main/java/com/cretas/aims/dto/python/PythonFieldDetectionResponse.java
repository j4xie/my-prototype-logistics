package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Python 字段检测响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonFieldDetectionResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 错误消息 (失败时)
     */
    private String message;

    /**
     * 检测到的字段列表
     */
    private List<DetectedField> fields;

    /**
     * 数据质量评分 (0-100)
     */
    private Integer dataQualityScore;

    /**
     * 检测方法 (rule_based, llm_assisted)
     */
    private String detectionMethod;

    /**
     * 处理时间 (毫秒)
     */
    private Long processingTimeMs;

    /**
     * 检测到的字段
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DetectedField {

        /**
         * 原始字段名
         */
        private String originalName;

        /**
         * 标准化字段名
         */
        private String normalizedName;

        /**
         * 数据类型 (string, number, date, boolean, currency, percentage)
         */
        private String dataType;

        /**
         * 语义类型 (time, dimension, metric, identifier)
         */
        private String semanticType;

        /**
         * 推荐的图表角色 (category, value, series, time)
         */
        private String chartRole;

        /**
         * 置信度 (0-1)
         */
        private Double confidence;

        /**
         * 格式模式 (如日期格式)
         */
        private String formatPattern;

        /**
         * 是否为空值较多
         */
        private Boolean hasHighNullRate;

        /**
         * 空值率
         */
        private Double nullRate;

        /**
         * 建议的处理方式
         */
        private String suggestedHandling;
    }
}
