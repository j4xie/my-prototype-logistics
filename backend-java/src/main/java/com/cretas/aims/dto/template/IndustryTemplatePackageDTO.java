package com.cretas.aims.dto.template;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 行业模板包DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IndustryTemplatePackageDTO {

    private String id;

    /**
     * 行业代码
     */
    private String industryCode;

    /**
     * 行业中文名
     */
    private String industryName;

    /**
     * 行业模板描述
     */
    private String description;

    /**
     * 模板配置 (已解析的JSON)
     */
    private Map<String, Object> templates;

    /**
     * 模板版本
     */
    private Integer version;

    /**
     * 是否为默认模板
     */
    private Boolean isDefault;

    /**
     * 包含的实体类型列表
     */
    private java.util.List<String> entityTypes;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;
}
