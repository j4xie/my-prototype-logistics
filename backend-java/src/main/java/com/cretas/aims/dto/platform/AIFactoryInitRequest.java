package com.cretas.aims.dto.platform;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

/**
 * AI 工厂初始化请求
 *
 * 平台管理员使用自然语言描述工厂，AI 生成完整配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Data
public class AIFactoryInitRequest {

    /**
     * 工厂描述 (自然语言)
     *
     * 示例:
     * "这是一个水产品加工厂，主要生产带鱼罐头，需要原料入库、生产、质检、出货全流程"
     */
    @NotBlank(message = "工厂描述不能为空")
    @Size(min = 10, max = 2000, message = "工厂描述长度应在10-2000字符之间")
    private String factoryDescription;

    /**
     * 行业提示 (可选)
     *
     * 可选值: seafood_processing, prepared_food, meat_processing, dairy_processing, etc.
     */
    private String industryHint;

    /**
     * 工厂名称 (可选，用于上下文)
     */
    private String factoryName;

    /**
     * 是否包含业务数据建议
     *
     * 如果为 true，AI 会同时生成产品类型、原料类型等建议
     */
    private Boolean includeBusinessData = true;
}
