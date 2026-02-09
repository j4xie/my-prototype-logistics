package com.cretas.aims.dto.blueprint;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 蓝图版本DTO
 *
 * Sprint 3 任务: S3-7 蓝图版本管理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "蓝图版本信息")
public class BlueprintVersionDTO {

    @Schema(description = "版本记录ID")
    private String id;

    @Schema(description = "蓝图ID")
    private String blueprintId;

    @Schema(description = "蓝图名称")
    private String blueprintName;

    @Schema(description = "版本号")
    private Integer version;

    @Schema(description = "变更类型: CREATE, UPDATE, PUBLISH, DEPRECATE")
    private String changeType;

    @Schema(description = "变更说明")
    private String changeDescription;

    @Schema(description = "是否为发布版本")
    private Boolean isPublished;

    @Schema(description = "发布时间")
    private LocalDateTime publishedAt;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "创建人ID")
    private Long createdBy;

    @Schema(description = "变更内容摘要")
    private VersionChangeSummary changeSummary;

    /**
     * 版本变更摘要
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VersionChangeSummary {

        @Schema(description = "新增的表单模板数")
        private Integer addedFormTemplates;

        @Schema(description = "修改的表单模板数")
        private Integer modifiedFormTemplates;

        @Schema(description = "删除的表单模板数")
        private Integer removedFormTemplates;

        @Schema(description = "新增的规则模板数")
        private Integer addedRuleTemplates;

        @Schema(description = "修改的规则模板数")
        private Integer modifiedRuleTemplates;

        @Schema(description = "删除的规则模板数")
        private Integer removedRuleTemplates;

        @Schema(description = "新增的产品类型模板数")
        private Integer addedProductTypes;

        @Schema(description = "修改的产品类型模板数")
        private Integer modifiedProductTypes;

        @Schema(description = "删除的产品类型模板数")
        private Integer removedProductTypes;

        @Schema(description = "配置变更列表")
        private java.util.List<String> configChanges;
    }
}
