package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 通用 AI Chat 响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenericChatResponse {

    /**
     * AI 回复内容
     */
    private String content;

    /**
     * 消耗的 Token 数
     */
    private Integer tokensUsed;

    /**
     * 使用的模型
     */
    private String model;

    /**
     * 完成原因 (stop, length, etc.)
     */
    private String finishReason;
}
