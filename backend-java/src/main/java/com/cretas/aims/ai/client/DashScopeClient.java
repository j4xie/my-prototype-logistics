package com.cretas.aims.ai.client;

import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.config.DashScopeConfig;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * DashScope API 核心客户端
 *
 * 使用 OkHttp 直接调用阿里云 DashScope API (OpenAI 兼容格式)
 * 支持：
 * - 普通对话
 * - 思考模式 (Thinking Mode)
 * - 流式响应
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Slf4j
@Component
public class DashScopeClient {

    private final DashScopeConfig config;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    public DashScopeClient(
            DashScopeConfig config,
            @Qualifier("aiServiceHttpClient") OkHttpClient httpClient,
            ObjectMapper objectMapper) {
        this.config = config;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    /**
     * 同步调用 Chat Completion
     *
     * @param request 请求体
     * @return 响应
     */
    public ChatCompletionResponse chatCompletion(ChatCompletionRequest request) {
        if (!config.isAvailable()) {
            log.warn("DashScope API 未配置或未启用");
            return createErrorResponse("DashScope API 未配置");
        }

        // 填充默认值
        if (request.getModel() == null) {
            request.setModel(config.getModel());
        }
        if (request.getMaxTokens() == null) {
            request.setMaxTokens(config.getMaxTokens());
        }
        if (request.getTemperature() == null) {
            request.setTemperature(config.getTemperature());
        }

        try {
            String jsonBody = objectMapper.writeValueAsString(request);
            log.debug("DashScope request: {}", jsonBody);

            Request httpRequest = new Request.Builder()
                    .url(config.getChatCompletionsUrl())
                    .addHeader("Authorization", "Bearer " + config.getApiKey())
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(jsonBody, JSON))
                    .build();

            // 根据是否思考模式调整超时
            OkHttpClient client = httpClient;
            if (request.getExtraBody() != null && Boolean.TRUE.equals(request.getExtraBody().getEnableThinking())) {
                client = httpClient.newBuilder()
                        .readTimeout(config.getThinkingTimeout(), TimeUnit.SECONDS)
                        .build();
            }

            try (Response response = client.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";
                log.debug("DashScope response: {}", responseBody);

                if (!response.isSuccessful()) {
                    log.error("DashScope API error: {} - {}", response.code(), responseBody);
                    return createErrorResponse("API 调用失败: " + response.code());
                }

                return objectMapper.readValue(responseBody, ChatCompletionResponse.class);
            }
        } catch (JsonProcessingException e) {
            log.error("JSON 序列化失败", e);
            return createErrorResponse("请求序列化失败: " + e.getMessage());
        } catch (IOException e) {
            log.error("DashScope API 调用失败", e);
            return createErrorResponse("网络请求失败: " + e.getMessage());
        }
    }

    /**
     * 简单对话调用
     *
     * @param systemPrompt 系统提示词
     * @param userInput    用户输入
     * @return 响应内容
     */
    public String chat(String systemPrompt, String userInput) {
        ChatCompletionRequest request = ChatCompletionRequest.simple(
                config.getModel(),
                systemPrompt,
                userInput
        );
        request.setMaxTokens(config.getMaxTokens());
        request.setTemperature(config.getTemperature());

        ChatCompletionResponse response = chatCompletion(request);
        if (response.hasError()) {
            throw new RuntimeException("DashScope API 错误: " + response.getErrorMessage());
        }
        return response.getContent();
    }

    /**
     * 低温度对话 (用于需要精确输出的场景)
     */
    public String chatLowTemp(String systemPrompt, String userInput) {
        ChatCompletionRequest request = ChatCompletionRequest.simple(
                config.getModel(),
                systemPrompt,
                userInput
        );
        request.setMaxTokens(config.getMaxTokens());
        request.setTemperature(config.getLowTemperature());

        ChatCompletionResponse response = chatCompletion(request);
        if (response.hasError()) {
            throw new RuntimeException("DashScope API 错误: " + response.getErrorMessage());
        }
        return response.getContent();
    }

    /**
     * 带思考模式的对话
     *
     * @param systemPrompt   系统提示词
     * @param userInput      用户输入
     * @param thinkingBudget 思考预算 (10-100)
     * @return 响应 (包含思考过程)
     */
    public ChatCompletionResponse chatWithThinking(String systemPrompt, String userInput, int thinkingBudget) {
        if (!config.isThinkingEnabled()) {
            log.warn("思考模式未启用，使用普通对话");
            return chatCompletion(ChatCompletionRequest.simple(config.getModel(), systemPrompt, userInput));
        }

        // 思考模式需要流式处理
        ChatCompletionRequest request = ChatCompletionRequest.withThinking(
                config.getModel(),
                systemPrompt,
                userInput,
                thinkingBudget
        );
        request.setMaxTokens(config.getMaxTokens());
        request.setTemperature(config.getLowTemperature());

        return chatCompletionStreaming(request);
    }

    /**
     * 流式调用并收集完整响应
     */
    private ChatCompletionResponse chatCompletionStreaming(ChatCompletionRequest request) {
        if (!config.isAvailable()) {
            return createErrorResponse("DashScope API 未配置");
        }

        try {
            String jsonBody = objectMapper.writeValueAsString(request);

            Request httpRequest = new Request.Builder()
                    .url(config.getChatCompletionsUrl())
                    .addHeader("Authorization", "Bearer " + config.getApiKey())
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(jsonBody, JSON))
                    .build();

            OkHttpClient client = httpClient.newBuilder()
                    .readTimeout(config.getThinkingTimeout(), TimeUnit.SECONDS)
                    .build();

            try (Response response = client.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "";
                    log.error("DashScope streaming error: {} - {}", response.code(), errorBody);
                    return createErrorResponse("API 调用失败: " + response.code());
                }

                // 收集流式响应
                StringBuilder content = new StringBuilder();
                StringBuilder reasoning = new StringBuilder();

                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.body().byteStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.startsWith("data: ")) {
                            String data = line.substring(6);
                            if ("[DONE]".equals(data)) {
                                break;
                            }
                            try {
                                ChatCompletionResponse chunk = objectMapper.readValue(data, ChatCompletionResponse.class);
                                if (chunk.getChoices() != null && !chunk.getChoices().isEmpty()) {
                                    ChatCompletionResponse.Message delta = chunk.getChoices().get(0).getDelta();
                                    if (delta != null) {
                                        if (delta.getContent() != null) {
                                            content.append(delta.getContent());
                                        }
                                        if (delta.getReasoningContent() != null) {
                                            reasoning.append(delta.getReasoningContent());
                                        }
                                    }
                                }
                            } catch (JsonProcessingException e) {
                                log.trace("Skip non-JSON line: {}", data);
                            }
                        }
                    }
                }

                // 构建完整响应
                ChatCompletionResponse result = new ChatCompletionResponse();
                ChatCompletionResponse.Message message = new ChatCompletionResponse.Message();
                message.setRole("assistant");
                message.setContent(content.toString());
                if (reasoning.length() > 0) {
                    message.setReasoningContent(reasoning.toString());
                }

                ChatCompletionResponse.Choice choice = new ChatCompletionResponse.Choice();
                choice.setIndex(0);
                choice.setMessage(message);
                choice.setFinishReason("stop");

                result.setChoices(List.of(choice));
                return result;
            }
        } catch (Exception e) {
            log.error("DashScope streaming 调用失败", e);
            return createErrorResponse("流式请求失败: " + e.getMessage());
        }
    }

    /**
     * 意图分类专用方法
     *
     * @param systemPrompt 分类提示词
     * @param userInput    用户输入
     * @return JSON 格式的分类结果
     */
    public String classifyIntent(String systemPrompt, String userInput) {
        // 使用低温度确保输出稳定
        return chatLowTemp(systemPrompt, userInput);
    }

    /**
     * 创建错误响应
     */
    private ChatCompletionResponse createErrorResponse(String message) {
        ChatCompletionResponse response = new ChatCompletionResponse();
        ChatCompletionResponse.Error error = new ChatCompletionResponse.Error();
        error.setMessage(message);
        error.setType("client_error");
        response.setError(error);
        return response;
    }

    /**
     * 检查服务是否可用
     */
    public boolean isAvailable() {
        return config.isAvailable();
    }
}
