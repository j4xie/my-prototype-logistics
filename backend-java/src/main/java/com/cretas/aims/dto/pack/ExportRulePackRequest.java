package com.cretas.aims.dto.pack;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import java.util.List;

/**
 * 导出规则包请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "导出规则包请求")
public class ExportRulePackRequest {

    /**
     * 工厂ID
     */
    @NotBlank(message = "工厂ID不能为空")
    @Schema(description = "工厂ID", required = true)
    private String factoryId;

    /**
     * 包名称
     */
    @NotBlank(message = "包名称不能为空")
    @Schema(description = "包名称", required = true)
    private String packName;

    /**
     * 包描述
     */
    @Schema(description = "包描述")
    private String description;

    /**
     * 要导出的规则ID列表 (可选，为空则导出全部)
     */
    @Schema(description = "要导出的规则ID列表")
    private List<String> ruleIds;

    /**
     * 要导出的规则组列表 (可选)
     */
    @Schema(description = "要导出的规则组列表", example = "[\"validation\", \"workflow\"]")
    private List<String> ruleGroups;

    /**
     * 是否仅导出启用的规则
     */
    @Schema(description = "是否仅导出启用的规则", defaultValue = "true")
    @Builder.Default
    private Boolean enabledOnly = true;

    /**
     * 行业类型
     */
    @Schema(description = "行业类型")
    private String industryType;

    /**
     * 导出人ID
     */
    @Schema(description = "导出人ID")
    private Long exportedBy;
}
