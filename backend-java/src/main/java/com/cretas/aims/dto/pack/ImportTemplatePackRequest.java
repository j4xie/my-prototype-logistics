package com.cretas.aims.dto.pack;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 导入表单模板包请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "导入表单模板包请求")
public class ImportTemplatePackRequest {

    /**
     * 目标工厂ID (必填)
     */
    @NotBlank(message = "目标工厂ID不能为空")
    @Schema(description = "目标工厂ID", required = true)
    private String targetFactoryId;

    /**
     * 模板包数据 (必填)
     */
    @NotNull(message = "模板包数据不能为空")
    @Schema(description = "模板包数据", required = true)
    private FormTemplatePackDTO pack;

    /**
     * 冲突处理策略
     * SKIP - 跳过已存在的
     * OVERWRITE - 覆盖已存在的
     * RENAME - 重命名导入的
     */
    @Schema(description = "冲突处理策略: SKIP, OVERWRITE, RENAME")
    @Builder.Default
    private ConflictStrategy conflictStrategy = ConflictStrategy.SKIP;

    /**
     * 导入用户ID
     */
    @Schema(description = "导入用户ID")
    private Long importedBy;

    /**
     * 是否为预览模式 (dry-run)
     */
    @Schema(description = "是否为预览模式")
    @Builder.Default
    private Boolean preview = false;

    /**
     * 冲突处理策略枚举
     */
    public enum ConflictStrategy {
        /**
         * 跳过已存在的模板
         */
        SKIP,

        /**
         * 覆盖已存在的模板
         */
        OVERWRITE,

        /**
         * 重命名导入的模板
         */
        RENAME
    }
}
