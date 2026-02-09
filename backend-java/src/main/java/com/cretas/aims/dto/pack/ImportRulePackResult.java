package com.cretas.aims.dto.pack;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 导入规则包结果
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "导入规则包结果")
public class ImportRulePackResult {

    /**
     * 是否成功
     */
    @Schema(description = "是否成功")
    private Boolean success;

    /**
     * 是否为预览模式
     */
    @Schema(description = "是否为预览模式")
    private Boolean isPreview;

    /**
     * 目标工厂ID
     */
    @Schema(description = "目标工厂ID")
    private String targetFactoryId;

    /**
     * 包ID
     */
    @Schema(description = "来源包ID")
    private String packId;

    /**
     * 包名称
     */
    @Schema(description = "包名称")
    private String packName;

    /**
     * 导入时间
     */
    @Schema(description = "导入时间")
    private LocalDateTime importedAt;

    /**
     * 导入的规则数量
     */
    @Schema(description = "成功导入的规则数量")
    private Integer importedCount;

    /**
     * 跳过的规则数量
     */
    @Schema(description = "跳过的规则数量")
    private Integer skippedCount;

    /**
     * 覆盖的规则数量
     */
    @Schema(description = "覆盖的规则数量")
    private Integer overwrittenCount;

    /**
     * 失败的规则数量
     */
    @Schema(description = "失败的规则数量")
    private Integer failedCount;

    /**
     * 导入详情
     */
    @Schema(description = "导入详情")
    @Builder.Default
    private List<ImportItemDetail> details = new ArrayList<>();

    /**
     * 错误信息
     */
    @Schema(description = "错误信息")
    @Builder.Default
    private List<String> errors = new ArrayList<>();

    /**
     * 摘要信息
     */
    @Schema(description = "摘要信息")
    private String summary;

    /**
     * 添加详情
     */
    public void addDetail(ImportItemDetail detail) {
        if (this.details == null) {
            this.details = new ArrayList<>();
        }
        this.details.add(detail);
    }

    /**
     * 添加错误
     */
    public void addError(String error) {
        if (this.errors == null) {
            this.errors = new ArrayList<>();
        }
        this.errors.add(error);
    }

    /**
     * 导入项详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportItemDetail {

        /**
         * 原始规则ID
         */
        @Schema(description = "原始规则ID")
        private String originalId;

        /**
         * 规则组
         */
        @Schema(description = "规则组")
        private String ruleGroup;

        /**
         * 规则名称
         */
        @Schema(description = "规则名称")
        private String ruleName;

        /**
         * 导入状态
         */
        @Schema(description = "导入状态: IMPORTED, SKIPPED, OVERWRITTEN, FAILED")
        private ImportStatus status;

        /**
         * 新规则ID (导入成功时)
         */
        @Schema(description = "新规则ID")
        private String newRuleId;

        /**
         * 备注
         */
        @Schema(description = "备注")
        private String note;
    }

    /**
     * 导入状态枚举
     */
    public enum ImportStatus {
        /**
         * 成功导入
         */
        IMPORTED,

        /**
         * 跳过 (已存在)
         */
        SKIPPED,

        /**
         * 已覆盖
         */
        OVERWRITTEN,

        /**
         * 导入失败
         */
        FAILED
    }
}
