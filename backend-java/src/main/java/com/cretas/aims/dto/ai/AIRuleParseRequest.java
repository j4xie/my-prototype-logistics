package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import java.util.Map;

/**
 * AI 规则解析请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIRuleParseRequest {

    /**
     * 用户自然语言描述
     * 例如: "库存低于500kg时通知采购"
     */
    @NotBlank(message = "用户输入不能为空")
    private String userInput;

    /**
     * 规则组 (可选)
     * validation, workflow, costing, quality, alert
     */
    private String ruleGroup;

    /**
     * 实体类型 (可选)
     * MaterialBatch, ProcessingBatch, QualityInspection, etc.
     */
    private String entityType;

    /**
     * 工厂ID (可选)
     */
    private String factoryId;

    /**
     * 上下文信息 (可选)
     */
    private Map<String, Object> context;
}
