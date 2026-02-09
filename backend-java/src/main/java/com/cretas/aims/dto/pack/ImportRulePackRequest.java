package com.cretas.aims.dto.pack;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 导入规则包请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "导入规则包请求")
public class ImportRulePackRequest {

    /**
     * 目标工厂ID
     */
    @NotBlank(message = "目标工厂ID不能为空")
    @Schema(description = "目标工厂ID", required = true)
    private String targetFactoryId;

    /**
     * 规则包数据
     */
    @NotNull(message = "规则包不能为空")
    @Schema(description = "规则包数据", required = true)
    private RulePackDTO pack;

    /**
     * 冲突处理策略
     */
    @Schema(description = "冲突处理策略", defaultValue = "SKIP")
    @Builder.Default
    private ConflictStrategy conflictStrategy = ConflictStrategy.SKIP;

    /**
     * 导入人ID
     */
    @Schema(description = "导入人ID")
    private Long importedBy;

    /**
     * 是否为预览模式
     */
    @Schema(description = "是否为预览模式", defaultValue = "false")
    @Builder.Default
    private Boolean preview = false;

    /**
     * 是否启用导入的规则
     */
    @Schema(description = "是否启用导入的规则", defaultValue = "true")
    @Builder.Default
    private Boolean enableImported = true;

    /**
     * 冲突处理策略枚举
     */
    public enum ConflictStrategy {
        /**
         * 跳过 - 保留现有规则
         */
        SKIP,

        /**
         * 覆盖 - 用导入规则覆盖现有规则
         */
        OVERWRITE,

        /**
         * 重命名 - 为导入规则生成新名称
         */
        RENAME
    }
}
