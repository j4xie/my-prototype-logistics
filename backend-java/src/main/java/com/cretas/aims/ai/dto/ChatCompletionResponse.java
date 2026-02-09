package com.cretas.aims.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * OpenAI 兼容的 Chat Completion 响应
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatCompletionResponse {

    private String id;

    private String object;

    private Long created;

    private String model;

    private List<Choice> choices;

    private Usage usage;

    /**
     * 错误信息 (请求失败时)
     */
    private Error error;

    /**
     * 获取第一个响应内容
     */
    public String getContent() {
        if (choices != null && !choices.isEmpty()) {
            Choice first = choices.get(0);
            if (first.getMessage() != null) {
                return first.getMessage().getContent();
            }
            // 流式响应
            if (first.getDelta() != null) {
                return first.getDelta().getContent();
            }
        }
        return null;
    }

    /**
     * 检查是否有错误
     */
    public boolean hasError() {
        return error != null;
    }

    /**
     * 获取错误信息
     */
    public String getErrorMessage() {
        return error != null ? error.getMessage() : null;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Choice {
        private Integer index;

        private Message message;

        /**
         * 流式响应增量
         */
        private Message delta;

        @JsonProperty("finish_reason")
        private String finishReason;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Message {
        private String role;
        private String content;

        /**
         * 思考过程 (思考模式)
         */
        @JsonProperty("reasoning_content")
        private String reasoningContent;

        /**
         * 工具调用列表 (OpenAI Function Calling)
         * 当 LLM 决定调用工具时返回
         */
        @JsonProperty("tool_calls")
        private List<ToolCall> toolCalls;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Usage {
        @JsonProperty("prompt_tokens")
        private Integer promptTokens;

        @JsonProperty("completion_tokens")
        private Integer completionTokens;

        @JsonProperty("total_tokens")
        private Integer totalTokens;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Error {
        private String message;
        private String type;
        private String param;
        private String code;
    }
}
