package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * AI 洞察 DTO
 * 用于表示 AI 生成的分析洞察和建议
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIInsight {

    /**
     * 洞察级别: RED, YELLOW, GREEN, INFO
     */
    private String level;

    /**
     * 洞察类别
     */
    private String category;

    /**
     * 洞察消息
     */
    private String message;

    /**
     * 相关实体
     */
    private String relatedEntity;

    /**
     * 行动建议
     */
    private String actionSuggestion;
}
