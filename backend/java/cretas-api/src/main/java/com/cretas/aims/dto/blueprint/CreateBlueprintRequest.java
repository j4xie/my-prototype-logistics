package com.cretas.aims.dto.blueprint;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

/**
 * 创建蓝图请求DTO
 */
@Data
public class CreateBlueprintRequest {

    @NotBlank(message = "蓝图名称不能为空")
    @Size(max = 200, message = "蓝图名称长度不能超过200个字符")
    private String name;

    @Size(max = 5000, message = "描述长度不能超过5000个字符")
    private String description;

    @Size(max = 100, message = "行业类型长度不能超过100个字符")
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
