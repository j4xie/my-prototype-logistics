package com.cretas.aims.dto.blueprint;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 版本升级结果
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
@Schema(description = "版本升级结果")
public class VersionUpgradeResult {

    @Schema(description = "是否成功")
    private Boolean success;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "原版本")
    private Integer fromVersion;

    @Schema(description = "目标版本")
    private Integer toVersion;

    @Schema(description = "升级时间")
    private LocalDateTime upgradedAt;

    @Schema(description = "升级详情")
    private List<UpgradeDetail> details;

    @Schema(description = "警告信息")
    private List<String> warnings;

    @Schema(description = "错误信息")
    private List<String> errors;

    @Schema(description = "摘要")
    private String summary;

    /**
     * 升级详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpgradeDetail {

        @Schema(description = "组件类型: FORM_TEMPLATE, RULE, PRODUCT_TYPE, DEPARTMENT, CONFIG")
        private String componentType;

        @Schema(description = "组件名称")
        private String componentName;

        @Schema(description = "操作: ADDED, UPDATED, REMOVED, SKIPPED")
        private String action;

        @Schema(description = "备注")
        private String note;
    }
}
