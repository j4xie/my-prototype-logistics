package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 分析上下文
 *
 * 包含执行分析所需的所有上下文信息。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisContext {

    /**
     * 原始用户输入
     */
    private String userInput;

    /**
     * 分析主题
     */
    private AnalysisTopic topic;

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 用户角色
     */
    private String userRole;

    /**
     * 会话ID
     */
    private String sessionId;

    /**
     * 附加参数
     */
    private Map<String, Object> parameters;

    /**
     * 是否启用深度思考
     */
    private Boolean enableThinking;

    /**
     * 思考预算
     */
    private Integer thinkingBudget;
}
