package com.cretas.aims.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * OpenAI 兼容的 Chat Completion 请求
 * 支持 DashScope 思考模式
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatCompletionRequest {

    /**
     * 模型名称
     * 文本: qwen-plus, qwen-turbo, qwen-max
     * 视觉: qwen2.5-vl-3b-instruct, qwen-vl-plus
     */
    private String model;

    /**
     * 消息列表
     */
    private List<ChatMessage> messages;

    /**
     * 最大 Token 数
     */
    @JsonProperty("max_tokens")
    private Integer maxTokens;

    /**
     * 温度参数 (0.0-2.0)
     */
    private Double temperature;

    /**
     * Top P 采样
     */
    @JsonProperty("top_p")
    private Double topP;

    /**
     * 是否流式响应
     */
    private Boolean stream;

    /**
     * 停止词
     */
    private List<String> stop;

    /**
     * 扩展参数 (DashScope 思考模式)
     */
    @JsonProperty("extra_body")
    private ExtraBody extraBody;

    /**
     * DashScope 扩展参数
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExtraBody {
        /**
         * 是否启用思考模式
         */
        @JsonProperty("enable_thinking")
        private Boolean enableThinking;

        /**
         * 思考预算 (10-100)
         * 数值越大，思考越深入
         */
        @JsonProperty("thinking_budget")
        private Integer thinkingBudget;
    }

    /**
     * 创建简单请求
     */
    public static ChatCompletionRequest simple(String model, String systemPrompt, String userInput) {
        return ChatCompletionRequest.builder()
                .model(model)
                .messages(List.of(
                        ChatMessage.system(systemPrompt),
                        ChatMessage.user(userInput)
                ))
                .build();
    }

    /**
     * 创建带思考模式的请求
     */
    public static ChatCompletionRequest withThinking(
            String model,
            String systemPrompt,
            String userInput,
            int thinkingBudget) {
        return ChatCompletionRequest.builder()
                .model(model)
                .messages(List.of(
                        ChatMessage.system(systemPrompt),
                        ChatMessage.user(userInput)
                ))
                .stream(true)  // 思考模式需要流式
                .extraBody(ExtraBody.builder()
                        .enableThinking(true)
                        .thinkingBudget(thinkingBudget)
                        .build())
                .build();
    }

    /**
     * 创建视觉识别请求
     */
    public static ChatCompletionRequest vision(
            String model,
            String prompt,
            String imageBase64) {
        return ChatCompletionRequest.builder()
                .model(model)
                .messages(List.of(
                        ChatMessage.userWithImage(prompt, imageBase64)
                ))
                .build();
    }
}
