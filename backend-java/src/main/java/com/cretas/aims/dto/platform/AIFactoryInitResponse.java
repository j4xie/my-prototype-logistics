package com.cretas.aims.dto.platform;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * AI 工厂初始化响应
 *
 * 包含 AI 生成的所有表单模板和业务数据建议
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIFactoryInitResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 识别的行业代码
     */
    private String industryCode;

    /**
     * 行业名称
     */
    private String industryName;

    /**
     * 生成的表单 Schema 列表
     */
    private List<EntitySchemaDTO> schemas;

    /**
     * 建议的业务数据
     */
    private SuggestedBusinessDataDTO suggestedData;

    /**
     * AI 生成的总结说明
     */
    private String aiSummary;

    /**
     * 消息
     */
    private String message;

    /**
     * 单个实体类型的 Schema 定义
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EntitySchemaDTO {
        /**
         * 实体类型 (MATERIAL_BATCH, QUALITY_CHECK, etc.)
         */
        private String entityType;

        /**
         * 实体名称 (原材料批次, 质检记录, etc.)
         */
        private String entityName;

        /**
         * 描述
         */
        private String description;

        /**
         * Formily 格式的字段列表
         */
        private List<Map<String, Object>> fields;
    }

    /**
     * 建议的业务数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SuggestedBusinessDataDTO {
        /**
         * 建议的产品类型
         */
        private List<Map<String, Object>> productTypes;

        /**
         * 建议的原料类型
         */
        private List<Map<String, Object>> materialTypes;

        /**
         * 建议的转换率配置
         */
        private List<Map<String, Object>> conversionRates;
    }
}
