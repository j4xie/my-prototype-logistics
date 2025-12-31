package com.cretas.aims.dto.blueprint;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.Map;

/**
 * 创建蓝图请求DTO
 */
@Data
public class CreateBlueprintRequest {

    @NotBlank(message = "蓝图名称不能为空")
    private String name;

    private String description;

    private String industryType;

    /**
     * 默认配置JSON
     */
    private Map<String, Object> defaultConfig;

    /**
     * 表单模板配置
     */
    private Object formTemplates;

    /**
     * 规则模板配置
     */
    private Object ruleTemplates;

    /**
     * 产品类型模板
     */
    private Object productTypeTemplates;

    /**
     * 部门模板
     */
    private Object departmentTemplates;

    @NotNull(message = "isActive不能为空")
    private Boolean isActive = true;
}
