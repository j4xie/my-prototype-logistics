package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 字段映射响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonFieldMappingResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 错误消息 (失败时)
     */
    private String message;

    /**
     * 字段映射列表
     */
    private List<FieldMapping> mappings;

    /**
     * 未映射的字段
     */
    private List<String> unmappedFields;

    /**
     * 映射统计
     */
    private MappingStats stats;

    /**
     * LLM 推理说明
     */
    private String reasoning;

    /**
     * 处理时间 (毫秒)
     */
    private Long processingTimeMs;

    /**
     * 字段映射
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldMapping {

        /**
         * 原始字段名
         */
        private String sourceField;

        /**
         * 目标字段名
         */
        private String targetField;

        /**
         * 置信度 (0-1)
         */
        private Double confidence;

        /**
         * 映射原因
         */
        private String reason;

        /**
         * 是否需要数据转换
         */
        private Boolean requiresTransformation;

        /**
         * 转换表达式 (如需要转换)
         */
        private String transformExpression;

        /**
         * 推荐的图表角色
         */
        private String chartRole;

        /**
         * 图表角色置信度
         */
        private Double chartRoleConfidence;
    }

    /**
     * 映射统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MappingStats {

        /**
         * 总字段数
         */
        private Integer totalFields;

        /**
         * 已映射字段数
         */
        private Integer mappedFields;

        /**
         * 高置信度映射数 (>0.8)
         */
        private Integer highConfidenceMappings;

        /**
         * 低置信度映射数 (<0.5)
         */
        private Integer lowConfidenceMappings;

        /**
         * 需要转换的字段数
         */
        private Integer fieldsRequiringTransformation;

        /**
         * 平均置信度
         */
        private Double averageConfidence;
    }
}
