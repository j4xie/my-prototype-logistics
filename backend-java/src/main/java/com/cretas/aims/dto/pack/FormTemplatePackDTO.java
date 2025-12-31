package com.cretas.aims.dto.pack;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 表单模板包数据传输对象
 *
 * 用于批量导出/导入表单模板
 * Sprint 3 任务:
 * - S3-2: 模板包导出
 * - S3-3: 模板包导入
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "表单模板包")
public class FormTemplatePackDTO {

    /**
     * 包ID (导出时生成)
     */
    @Schema(description = "包ID")
    private String packId;

    /**
     * 包名称
     */
    @Schema(description = "包名称")
    private String packName;

    /**
     * 包描述
     */
    @Schema(description = "包描述")
    private String description;

    /**
     * 导出来源工厂ID
     */
    @Schema(description = "来源工厂ID")
    private String sourceFactoryId;

    /**
     * 包版本号
     */
    @Schema(description = "包版本号")
    private String version;

    /**
     * 行业类型
     */
    @Schema(description = "行业类型: SEAFOOD_PROCESSING, MEAT_PROCESSING, GENERAL_FOOD")
    private String industryType;

    /**
     * 导出时间
     */
    @Schema(description = "导出时间")
    private LocalDateTime exportedAt;

    /**
     * 导出用户ID
     */
    @Schema(description = "导出用户ID")
    private Long exportedBy;

    /**
     * 表单模板列表
     */
    @Schema(description = "表单模板列表")
    private List<FormTemplateItemDTO> templates;

    /**
     * 表单模板项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FormTemplateItemDTO {

        /**
         * 原始模板ID
         */
        @Schema(description = "原始模板ID")
        private String originalId;

        /**
         * 模板名称
         */
        @Schema(description = "模板名称")
        private String name;

        /**
         * 实体类型
         */
        @Schema(description = "实体类型: QUALITY_CHECK, MATERIAL_BATCH, PROCESSING_BATCH, SHIPMENT")
        private String entityType;

        /**
         * Formily Schema JSON
         */
        @Schema(description = "Formily Schema JSON")
        private String schemaJson;

        /**
         * UI Schema JSON (可选)
         */
        @Schema(description = "UI Schema JSON")
        private String uiSchemaJson;

        /**
         * 模板描述
         */
        @Schema(description = "模板描述")
        private String description;

        /**
         * 模板版本
         */
        @Schema(description = "模板版本")
        private Integer version;
    }
}
