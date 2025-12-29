package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 规则解析响应
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIRuleParseResponse {

    /**
     * 是否成功
     */
    private Boolean success;

    /**
     * 生成的规则名称
     */
    private String ruleName;

    /**
     * 规则描述
     */
    private String ruleDescription;

    /**
     * 生成的 DRL 规则内容
     */
    private String drlContent;

    /**
     * 推荐的规则组
     */
    private String ruleGroup;

    /**
     * 推荐的优先级 (0-100)
     */
    private Integer priority;

    /**
     * 涉及的实体类型列表
     */
    private List<String> entityTypes;

    /**
     * AI 解释
     */
    private String aiExplanation;

    /**
     * 建议
     */
    private List<String> suggestions;

    /**
     * 消息
     */
    private String message;
}
