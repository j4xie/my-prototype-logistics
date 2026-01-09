package com.cretas.aims.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 通用 AI Chat 请求 DTO
 *
 * 用于接收前端的 chat 请求，支持多轮对话
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenericChatRequest {

    /**
     * 消息列表 (多轮对话)
     */
    private List<Message> messages;

    /**
     * 温度参数 (0.0 - 1.0)
     */
    @Builder.Default
    private Double temperature = 0.7;

    /**
     * 最大 Token 数
     */
    @Builder.Default
    @JsonProperty("maxTokens")
    private Integer maxTokens = 2000;

    /**
     * 模型名称 (可选)
     */
    private String model;

    /**
     * 消息结构
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Message {
        /**
         * 角色: system, user, assistant
         */
        private String role;

        /**
         * 消息内容
         */
        private String content;
    }
}
