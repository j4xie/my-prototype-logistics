package com.cretas.aims.dto.blueprint;

import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 应用蓝图请求DTO
 */
@Data
public class ApplyBlueprintRequest {

    @NotBlank(message = "工厂ID不能为空")
    private String factoryId;

    /**
     * 应用人用户ID
     */
    private Long appliedBy;

    /**
     * 是否预览模式（dry-run）
     */
    private Boolean preview = false;
}
