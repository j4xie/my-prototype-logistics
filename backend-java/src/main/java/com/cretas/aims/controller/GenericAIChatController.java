package com.cretas.aims.controller;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.dto.ai.GenericChatRequest;
import com.cretas.aims.dto.ai.GenericChatResponse;
import com.cretas.aims.dto.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 通用 AI Chat Controller
 *
 * 提供通用的 AI 对话能力，用于：
 * - SKU 配置语音交互
 * - 其他需要 AI 对话的场景
 *
 * 路径: /api/mobile/ai/chat
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/ai")
@Tag(name = "通用 AI Chat", description = "通用 AI 对话接口，支持多轮对话")
@Validated
public class GenericAIChatController {

    @Autowired
    private DashScopeClient dashScopeClient;

    @Value("${ai.chat.default-model:qwen-plus}")
    private String defaultModel;

    /**
     * 通用 AI Chat 接口
     *
     * 接收消息列表，返回 AI 回复
     */
    @PostMapping("/chat")
    @Operation(summary = "通用 AI Chat",
               description = "发送消息列表给 AI，获取回复。支持多轮对话和自定义参数。")
    public ApiResponse<GenericChatResponse> chat(
            @RequestBody GenericChatRequest request) {

        log.info("通用 AI Chat 请求: messages={}, temperature={}, maxTokens={}",
                request.getMessages() != null ? request.getMessages().size() : 0,
                request.getTemperature(),
                request.getMaxTokens());

        try {
            // 转换消息格式
            List<ChatMessage> chatMessages = convertMessages(request.getMessages());

            // 构建 ChatCompletionRequest
            String model = request.getModel() != null ? request.getModel() : defaultModel;

            ChatCompletionRequest aiRequest = ChatCompletionRequest.builder()
                    .model(model)
                    .messages(chatMessages)
                    .temperature(request.getTemperature() != null ? request.getTemperature() : 0.7)
                    .maxTokens(request.getMaxTokens() != null ? request.getMaxTokens() : 2000)
                    .build();

            // 调用 DashScope API
            ChatCompletionResponse aiResponse = dashScopeClient.chatCompletion(aiRequest);

            // 提取响应内容
            String content = extractContent(aiResponse);
            Integer tokensUsed = extractTokensUsed(aiResponse);
            String finishReason = extractFinishReason(aiResponse);

            log.info("AI Chat 响应成功: model={}, tokensUsed={}, finishReason={}",
                    model, tokensUsed, finishReason);

            GenericChatResponse response = GenericChatResponse.builder()
                    .content(content)
                    .tokensUsed(tokensUsed)
                    .model(model)
                    .finishReason(finishReason)
                    .build();

            return ApiResponse.success(response);

        } catch (Exception e) {
            log.error("AI Chat 失败: {}", e.getMessage(), e);
            return ApiResponse.error("AI 服务暂时不可用: " + e.getMessage());
        }
    }

    /**
     * 转换消息格式
     */
    private List<ChatMessage> convertMessages(List<GenericChatRequest.Message> messages) {
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("消息列表不能为空");
        }

        return messages.stream()
                .map(msg -> {
                    switch (msg.getRole().toLowerCase()) {
                        case "system":
                            return ChatMessage.system(msg.getContent());
                        case "user":
                            return ChatMessage.user(msg.getContent());
                        case "assistant":
                            return ChatMessage.assistant(msg.getContent());
                        default:
                            throw new IllegalArgumentException("不支持的角色: " + msg.getRole());
                    }
                })
                .collect(Collectors.toList());
    }

    /**
     * 提取响应内容
     */
    private String extractContent(ChatCompletionResponse response) {
        if (response != null) {
            // 优先使用 getContent() 方法（已处理普通和流式响应）
            String content = response.getContent();
            return content != null ? content : "";
        }
        return "";
    }

    /**
     * 提取使用的 Token 数
     */
    private Integer extractTokensUsed(ChatCompletionResponse response) {
        if (response != null && response.getUsage() != null) {
            return response.getUsage().getTotalTokens();
        }
        return null;
    }

    /**
     * 提取完成原因
     */
    private String extractFinishReason(ChatCompletionResponse response) {
        if (response != null &&
            response.getChoices() != null &&
            !response.getChoices().isEmpty()) {
            return response.getChoices().get(0).getFinishReason();
        }
        return null;
    }
}
