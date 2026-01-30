package com.cretas.aims.dto.blueprint;

import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 从工厂生成蓝图请求DTO
 */
@Data
public class GenerateBlueprintFromFactoryRequest {

    @NotBlank(message = "工厂ID不能为空")
    private String factoryId;

    @NotBlank(message = "蓝图名称不能为空")
    private String blueprintName;

    private String description;

    private String industryType;

    /**
     * 是否包含表单模板
     */
    private Boolean includeFormTemplates = true;

    /**
     * 是否包含规则配置
     */
    private Boolean includeRules = true;

    /**
     * 是否包含产品类型
     */
    private Boolean includeProductTypes = true;

    /**
     * 是否包含部门结构
     */
    private Boolean includeDepartments = true;
}
