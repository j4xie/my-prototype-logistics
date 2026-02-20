package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 字段映射请求 DTO (LLM 辅助)
 *
 * 使用 LLM 将原始字段映射到标准业务字段
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonFieldMappingRequest {

    /**
     * 原始表头列表
     */
    private List<String> headers;

    /**
     * 数据类型 (finance, sales, production, procurement, quality, inventory)
     */
    private String dataType;

    /**
     * 样本数据 (用于上下文理解)
     */
    private List<Map<String, Object>> sampleData;

    /**
     * 目标字段列表 (可选，用于指导映射)
     */
    private List<TargetField> targetFields;

    /**
     * 语言 (zh, en)
     */
    @Builder.Default
    private String language = "zh";

    /**
     * 是否强制映射所有字段
     */
    @Builder.Default
    private Boolean forceMapAll = false;

    /**
     * 目标字段定义
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TargetField {

        /**
         * 标准字段名
         */
        private String name;

        /**
         * 字段描述
         */
        private String description;

        /**
         * 数据类型
         */
        private String dataType;

        /**
         * 是否必须
         */
        private Boolean required;

        /**
         * 别名列表 (用于模糊匹配)
         */
        private List<String> aliases;
    }
}
