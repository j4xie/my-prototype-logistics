package com.cretas.aims.ai.client;

import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
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
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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

        // DashScope 要求 enable_thinking 在顶级参数，忽略 extra_body 内的
        if (request.getEnableThinking() == null && request.getExtraBody() != null
                && request.getExtraBody().getEnableThinking() != null) {
            request.setEnableThinking(request.getExtraBody().getEnableThinking());
        }

        String jsonBody;
        try {
            jsonBody = objectMapper.writeValueAsString(request);
            log.debug("DashScope request: {}", jsonBody);
        } catch (JsonProcessingException e) {
            log.error("JSON 序列化失败", e);
            return createErrorResponse("请求序列化失败: " + e.getMessage());
        }

        Request httpRequest = new Request.Builder()
                .url(config.getChatCompletionsUrl())
                .addHeader("Authorization", "Bearer " + config.getApiKey())
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(jsonBody, JSON))
                .build();

        // 根据是否思考模式调整超时
        OkHttpClient client = httpClient;
        if (Boolean.TRUE.equals(request.getEnableThinking())) {
            client = httpClient.newBuilder()
                    .readTimeout(config.getThinkingTimeout(), TimeUnit.SECONDS)
                    .build();
        }

        int maxRetries = 3;
        long[] backoffMs = {1000, 2000, 4000};

        for (int attempt = 0; attempt < maxRetries; attempt++) {
            try (Response response = client.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";
                log.debug("DashScope response: {}", responseBody);

                if (response.isSuccessful()) {
                    return objectMapper.readValue(responseBody, ChatCompletionResponse.class);
                }

                // 4xx: 客户端错误，不重试
                if (response.code() >= 400 && response.code() < 500) {
                    log.error("DashScope API client error (no retry): {} - {}", response.code(), responseBody);
                    return createErrorResponse("API 调用失败: " + response.code());
                }

                // 5xx: 服务端错误，重试
                if (attempt < maxRetries - 1) {
                    log.warn("DashScope API 5xx error, retrying ({}/{}): {} - {}",
                            attempt + 1, maxRetries, response.code(), responseBody);
                    Thread.sleep(backoffMs[attempt]);
                } else {
                    log.error("DashScope API error after {} retries: {} - {}", maxRetries, response.code(), responseBody);
                    return createErrorResponse("API 调用失败: " + response.code());
                }
            } catch (IOException e) {
                if (attempt < maxRetries - 1) {
                    log.warn("DashScope API IOException, retrying ({}/{}): {}",
                            attempt + 1, maxRetries, e.getMessage());
                    try {
                        Thread.sleep(backoffMs[attempt]);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return createErrorResponse("重试被中断");
                    }
                } else {
                    log.error("DashScope API 调用失败 (重试{}次后)", maxRetries, e);
                    return createErrorResponse("网络请求失败: " + e.getMessage());
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return createErrorResponse("重试被中断");
            }
        }

        return createErrorResponse("重试耗尽");
    }

    private static final ChatCompletionRequest.ExtraBody THINKING_OFF =
            ChatCompletionRequest.ExtraBody.builder().enableThinking(false).build();

    /**
     * 简单对话调用（默认关闭 thinking 模式）
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
        if (request.getExtraBody() == null) {
            request.setExtraBody(THINKING_OFF);
        }

        ChatCompletionResponse response = chatCompletion(request);
        if (response.hasError()) {
            throw new RuntimeException("DashScope API 错误: " + response.getErrorMessage());
        }
        return response.getContent();
    }

    /**
     * 快速模型对话调用（使用 fastModel，关闭 thinking）
     * 适用于延迟敏感但精度要求较低的场景（如多轮对话意图澄清）
     */
    public String chatFast(String systemPrompt, String userInput) {
        ChatCompletionRequest request = ChatCompletionRequest.simple(
                config.getFastModel(),
                systemPrompt,
                userInput
        );
        request.setMaxTokens(500);
        request.setTemperature(config.getTemperature());
        request.setExtraBody(THINKING_OFF);

        ChatCompletionResponse response = chatCompletion(request);
        if (response.hasError()) {
            throw new RuntimeException("DashScope API 错误: " + response.getErrorMessage());
        }
        return response.getContent();
    }

    /**
     * 低温度对话 (用于需要精确输出的场景，默认关闭 thinking)
     */
    public String chatLowTemp(String systemPrompt, String userInput) {
        ChatCompletionRequest request = ChatCompletionRequest.simple(
                config.getModel(),
                systemPrompt,
                userInput
        );
        request.setMaxTokens(config.getMaxTokens());
        request.setTemperature(config.getLowTemperature());
        if (request.getExtraBody() == null) {
            request.setExtraBody(THINKING_OFF);
        }

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
     * 流式调用 — 通过回调逐 token 推送
     *
     * @param request    请求体 (会强制设 stream=true)
     * @param onToken    每个 content delta 的回调
     * @param onComplete 流结束时回调（携带 usage 信息）
     */
    public void chatCompletionStream(ChatCompletionRequest request,
                                     Consumer<String> onToken,
                                     Consumer<ChatCompletionResponse> onComplete) {
        if (!config.isAvailable()) {
            throw new RuntimeException("DashScope API 未配置");
        }

        request.setStream(true);

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

        // DashScope 要求 enable_thinking 在顶级参数
        if (request.getEnableThinking() == null && request.getExtraBody() != null
                && request.getExtraBody().getEnableThinking() != null) {
            request.setEnableThinking(request.getExtraBody().getEnableThinking());
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
                    .readTimeout(120, TimeUnit.SECONDS)
                    .build();

            try (Response response = client.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "";
                    log.error("DashScope stream error: {} - {}", response.code(), errorBody);
                    throw new RuntimeException("API 调用失败: " + response.code());
                }

                ChatCompletionResponse.Usage lastUsage = null;
                String finishReason = null;
                StringBuilder fullContent = new StringBuilder();

                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.body().byteStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (!line.startsWith("data: ")) {
                            continue;
                        }
                        String data = line.substring(6);
                        if ("[DONE]".equals(data)) {
                            break;
                        }
                        try {
                            ChatCompletionResponse chunk = objectMapper.readValue(data, ChatCompletionResponse.class);
                            if (chunk.getUsage() != null) {
                                lastUsage = chunk.getUsage();
                            }
                            if (chunk.getChoices() != null && !chunk.getChoices().isEmpty()) {
                                ChatCompletionResponse.Choice c = chunk.getChoices().get(0);
                                if (c.getFinishReason() != null) {
                                    finishReason = c.getFinishReason();
                                }
                                ChatCompletionResponse.Message delta = c.getDelta();
                                if (delta != null && delta.getContent() != null) {
                                    fullContent.append(delta.getContent());
                                    onToken.accept(delta.getContent());
                                }
                            }
                        } catch (JsonProcessingException e) {
                            log.trace("Skip non-JSON line: {}", data);
                        }
                    }
                }

                // Build final response with full accumulated content
                ChatCompletionResponse result = new ChatCompletionResponse();
                result.setUsage(lastUsage);
                ChatCompletionResponse.Message msg = new ChatCompletionResponse.Message();
                msg.setRole("assistant");
                msg.setContent(fullContent.toString());
                ChatCompletionResponse.Choice choice = new ChatCompletionResponse.Choice();
                choice.setIndex(0);
                choice.setMessage(msg);
                choice.setFinishReason(finishReason != null ? finishReason : "stop");
                result.setChoices(List.of(choice));

                onComplete.accept(result);
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("DashScope stream 调用失败", e);
            throw new RuntimeException("流式请求失败: " + e.getMessage(), e);
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

    // ── Thinking 模式自动检测 ──

    private static final Set<String> SIMPLE_INDICATORS = new HashSet<>(Arrays.asList(
            "你好", "您好", "谢谢", "再见", "是什么", "几号", "多少",
            "帮我", "查一下", "告诉我", "在哪", "怎么样", "好的"
    ));

    private static final Set<String> COMPLEX_KEYWORDS = new HashSet<>(Arrays.asList(
            "分析", "对比", "为什么", "建议", "优化", "预测", "评估",
            "趋势", "原因", "策略", "规划", "诊断", "改进", "深入",
            "analyze", "compare", "optimiz", "diagnos", "evaluat", "predict",
            "strateg", "tradeoff", "trade-off", "suggest", "recommend", "why "
    ));

    /**
     * 根据用户输入自动判断是否需要启用 thinking 模式。
     * 纯关键词匹配，无 LLM 调用。
     *
     * @param userInput 用户原始输入
     * @return true = 需要 thinking (复杂分析), false = 不需要 (简单查询)
     */
    public static boolean shouldEnableThinking(String userInput) {
        if (userInput == null || userInput.isBlank()) {
            return false;
        }
        String text = userInput.trim();
        String lower = text.toLowerCase();

        // 1. 先统计复杂关键词命中数 — 优先级最高，不受长度限制
        int complexCount = 0;
        for (String keyword : COMPLEX_KEYWORDS) {
            if (lower.contains(keyword)) {
                complexCount++;
                if (complexCount >= 3) {
                    return true;
                }
            }
        }

        // 2. 极短查询且无复杂关键词 → 不需要
        if (text.length() < 6) {
            return false;
        }

        // 3. 包含简单寒暄指标 → 不需要
        for (String indicator : SIMPLE_INDICATORS) {
            if (text.contains(indicator)) {
                return false;
            }
        }

        // 4. 长查询 → 需要
        if (text.length() > 80) {
            return true;
        }

        return false;
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

    /**
     * 带工具调用的对话 (OpenAI Function Calling)
     *
     * @param messages   消息列表
     * @param tools      可用工具列表
     * @param toolChoice 工具选择策略 ("auto", "none", 或指定工具)
     * @return 响应 (可能包含 tool_calls)
     */
    public ChatCompletionResponse chatCompletionWithTools(
            List<ChatMessage> messages,
            List<Tool> tools,
            String toolChoice) {

        if (!config.isAvailable()) {
            log.warn("DashScope API 未配置或未启用");
            return createErrorResponse("DashScope API 未配置");
        }

        // 构建请求（Function Calling 不需要 thinking）
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model(config.getModel())
                .messages(messages)
                .maxTokens(config.getMaxTokens())
                .temperature(config.getLowTemperature())
                .tools(tools)
                .toolChoice(toolChoice)
                .extraBody(THINKING_OFF)
                .build();

        return chatCompletion(request);
    }

    /**
     * 带工具调用的简单对话
     *
     * @param systemPrompt 系统提示词
     * @param userInput    用户输入
     * @param tools        可用工具列表
     * @return 响应 (可能包含 tool_calls)
     */
    public ChatCompletionResponse chatWithTools(
            String systemPrompt,
            String userInput,
            List<Tool> tools) {

        List<ChatMessage> messages = List.of(
                ChatMessage.system(systemPrompt),
                ChatMessage.user(userInput)
        );

        return chatCompletionWithTools(messages, tools, "auto");
    }

    /**
     * 检查响应是否包含工具调用
     *
     * @param response API 响应
     * @return 是否包含工具调用
     */
    public boolean hasToolCalls(ChatCompletionResponse response) {
        if (response == null || response.getChoices() == null || response.getChoices().isEmpty()) {
            return false;
        }

        ChatCompletionResponse.Message message = response.getChoices().get(0).getMessage();
        return message != null && message.getToolCalls() != null && !message.getToolCalls().isEmpty();
    }

    /**
     * 获取第一个工具调用
     *
     * @param response API 响应
     * @return 第一个工具调用，如果没有则返回 null
     */
    public ToolCall getFirstToolCall(ChatCompletionResponse response) {
        if (!hasToolCalls(response)) {
            return null;
        }

        return response.getChoices().get(0).getMessage().getToolCalls().get(0);
    }

    /**
     * 获取所有工具调用
     *
     * @param response API 响应
     * @return 工具调用列表，如果没有则返回空列表
     */
    public List<ToolCall> getAllToolCalls(ChatCompletionResponse response) {
        if (!hasToolCalls(response)) {
            return List.of();
        }

        return response.getChoices().get(0).getMessage().getToolCalls();
    }
}
