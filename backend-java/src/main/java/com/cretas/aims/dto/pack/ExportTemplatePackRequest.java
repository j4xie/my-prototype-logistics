package com.cretas.aims.dto.pack;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import java.util.List;

/**
 * 导出表单模板包请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "导出表单模板包请求")
public class ExportTemplatePackRequest {

    /**
     * 工厂ID (必填)
     */
    @NotBlank(message = "工厂ID不能为空")
    @Schema(description = "工厂ID", required = true)
    private String factoryId;

    /**
     * 包名称 (必填)
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
     * 行业类型
     */
    @Schema(description = "行业类型")
    private String industryType;

    /**
     * 要导出的模板ID列表
     * 为空时导出所有激活的模板
     */
    @Schema(description = "要导出的模板ID列表，为空时导出所有激活的模板")
    private List<String> templateIds;

    /**
     * 要导出的实体类型列表
     * 过滤条件，为空时不限制
     */
    @Schema(description = "要导出的实体类型列表，为空时不限制")
    private List<String> entityTypes;
}
