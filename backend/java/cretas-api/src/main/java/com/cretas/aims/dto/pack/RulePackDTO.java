package com.cretas.aims.dto.pack;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 规则包DTO
 *
 * 用于批量导出/导入 Drools 规则
 * Sprint 3 任务:
 * - S3-4: 规则包导出
 * - S3-5: 规则包导入
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "规则包")
public class RulePackDTO {

    /**
     * 包ID
     */
    @Schema(description = "包ID", example = "RPACK-A1B2C3D4")
    private String packId;

    /**
     * 包名称
     */
    @Schema(description = "包名称", example = "水产加工厂标准规则包")
    private String packName;

    /**
     * 包描述
     */
    @Schema(description = "包描述")
    private String description;

    /**
     * 来源工厂ID
     */
    @Schema(description = "来源工厂ID")
    private String sourceFactoryId;

    /**
     * 版本号
     */
    @Schema(description = "版本号", example = "1.0.0")
    private String version;

    /**
     * 行业类型
     */
    @Schema(description = "行业类型", example = "SEAFOOD_PROCESSING")
    private String industryType;

    /**
     * 导出时间
     */
    @Schema(description = "导出时间")
    private LocalDateTime exportedAt;

    /**
     * 导出人ID
     */
    @Schema(description = "导出人ID")
    private Long exportedBy;

    /**
     * 规则列表
     */
    @Schema(description = "规则列表")
    private List<RuleItemDTO> rules;

    /**
     * 规则项DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "规则项")
    public static class RuleItemDTO {

        /**
         * 原始规则ID
         */
        @Schema(description = "原始规则ID")
        private String originalId;

        /**
         * 规则组
         */
        @Schema(description = "规则组", example = "validation")
        private String ruleGroup;

        /**
         * 规则名称
         */
        @Schema(description = "规则名称")
        private String ruleName;

        /**
         * 规则描述
         */
        @Schema(description = "规则描述")
        private String ruleDescription;

        /**
         * DRL规则内容
         */
        @Schema(description = "DRL规则内容")
        private String ruleContent;

        /**
         * 决策表内容 (Base64编码)
         */
        @Schema(description = "决策表内容(Base64)")
        private String decisionTableBase64;

        /**
         * 决策表类型
         */
        @Schema(description = "决策表类型", example = "XLSX")
        private String decisionTableType;

        /**
         * 版本号
         */
        @Schema(description = "版本号")
        private Integer version;

        /**
         * 优先级
         */
        @Schema(description = "优先级")
        private Integer priority;

        /**
         * 是否启用
         */
        @Schema(description = "是否启用")
        private Boolean enabled;
    }
}
