package com.cretas.aims.ai.tool;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 工具执行管理器
 *
 * 负责管理 LLM Function Calling 的完整流程：
 * 1. 注册可用工具
 * 2. 调用 LLM 获取工具调用请求
 * 3. 执行工具并获取结果
 * 4. 将结果返回给 LLM
 * 5. 获取最终答案
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ToolExecutionManager {

    private final DashScopeClient dashScopeClient;
    private final List<ToolExecutor> toolExecutors;

    /**
     * 执行带工具调用的对话
     *
     * @param systemPrompt 系统提示词
     * @param userInput    用户输入
     * @param context      执行上下文（工厂ID、用户ID等）
     * @param maxIterations 最大迭代次数（防止无限循环）
     * @return 最终答案
     */
    public String executeWithTools(
            String systemPrompt,
            String userInput,
            Map<String, Object> context,
            int maxIterations) {

        // 构建可用工具列表
        List<Tool> availableTools = buildAvailableTools(context);

        if (availableTools.isEmpty()) {
            log.warn("没有可用的工具，退化为普通对话");
            return dashScopeClient.chat(systemPrompt, userInput);
        }

        // 初始化对话历史
        List<ChatMessage> conversationHistory = new ArrayList<>();
        conversationHistory.add(ChatMessage.system(systemPrompt));
        conversationHistory.add(ChatMessage.user(userInput));

        // 迭代执行
        int iteration = 0;
        while (iteration < maxIterations) {
            iteration++;
            log.info("工具调用迭代 {}/{}", iteration, maxIterations);

            // 调用 LLM
            ChatCompletionResponse response = dashScopeClient.chatCompletionWithTools(
                    conversationHistory,
                    availableTools,
                    "auto"
            );

            if (response.hasError()) {
                log.error("LLM 调用失败: {}", response.getErrorMessage());
                // 脱敏处理：不暴露具体 LLM 错误信息
                return "抱歉，AI 服务暂时不可用，请稍后重试";
            }

            // 检查是否需要调用工具
            if (!dashScopeClient.hasToolCalls(response)) {
                // 没有工具调用，返回最终答案
                String finalAnswer = response.getContent();
                log.info("获得最终答案（迭代 {}）: {}", iteration, finalAnswer);
                return finalAnswer;
            }

            // 处理工具调用
            List<ToolCall> toolCalls = dashScopeClient.getAllToolCalls(response);
            log.info("LLM 请求调用 {} 个工具", toolCalls.size());

            // 将 LLM 的工具调用请求添加到历史记录
            conversationHistory.add(ChatMessage.assistant(null, toolCalls));

            // 执行每个工具调用
            for (ToolCall toolCall : toolCalls) {
                String functionName = toolCall.getFunction().getName();
                String arguments = toolCall.getFunction().getArguments();

                log.info("执行工具: {} 参数: {}", functionName, arguments);

                try {
                    // 查找并执行工具
                    String result = executeToolByName(functionName, toolCall, context);

                    // 将工具结果添加到历史记录
                    conversationHistory.add(ChatMessage.tool(result, toolCall.getId()));

                    log.info("工具执行成功: {} 结果: {}", functionName, result);
                } catch (Exception e) {
                    log.error("工具执行失败: {}", functionName, e);

                    // 脱敏处理：不暴露具体异常信息给 LLM
                    // 只返回通用错误消息，避免敏感信息通过 LLM 传递给用户
                    String sanitizedMessage = sanitizeExceptionMessage(e);
                    String errorResult = String.format(
                            "{\"success\": false, \"error\": \"%s\"}",
                            sanitizedMessage
                    );
                    conversationHistory.add(ChatMessage.tool(errorResult, toolCall.getId()));
                }
            }

            // 继续下一轮迭代，让 LLM 处理工具结果
        }

        log.warn("达到最大迭代次数 {}，强制结束", maxIterations);
        return "抱歉，处理超时，请简化您的请求或重试。";
    }

    /**
     * 构建可用工具列表
     *
     * @param context 执行上下文
     * @return 可用工具定义列表
     */
    private List<Tool> buildAvailableTools(Map<String, Object> context) {
        String userRole = (String) context.getOrDefault("userRole", "guest");

        return toolExecutors.stream()
                .filter(ToolExecutor::isEnabled)
                .filter(executor -> {
                    if (executor.requiresPermission()) {
                        return executor.hasPermission(userRole);
                    }
                    return true;
                })
                .map(executor -> Tool.of(
                        executor.getToolName(),
                        executor.getDescription(),
                        executor.getParametersSchema()
                ))
                .collect(Collectors.toList());
    }

    /**
     * 根据工具名称执行工具
     *
     * @param toolName 工具名称
     * @param toolCall 工具调用对象
     * @param context  执行上下文
     * @return 执行结果
     */
    private String executeToolByName(
            String toolName,
            ToolCall toolCall,
            Map<String, Object> context) throws Exception {

        ToolExecutor executor = toolExecutors.stream()
                .filter(e -> e.getToolName().equals(toolName))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("未找到工具: " + toolName));

        return executor.execute(toolCall, context);
    }

    /**
     * 简化调用：使用默认配置
     *
     * @param systemPrompt 系统提示词
     * @param userInput    用户输入
     * @param factoryId    工厂ID
     * @return 最终答案
     */
    public String execute(String systemPrompt, String userInput, String factoryId) {
        Map<String, Object> context = new HashMap<>();
        context.put("factoryId", factoryId);
        return executeWithTools(systemPrompt, userInput, context, 5);
    }

    /**
     * 脱敏异常消息
     * 将敏感的异常信息转换为用户友好的消息
     *
     * @param e 异常
     * @return 脱敏后的消息
     */
    private String sanitizeExceptionMessage(Exception e) {
        String message = e.getMessage();
        String exceptionType = e.getClass().getSimpleName();

        // 数据库相关异常
        if (exceptionType.contains("SQL") || exceptionType.contains("Data") ||
            exceptionType.contains("Hibernate") || exceptionType.contains("JPA") ||
            exceptionType.contains("Persistence")) {
            return "数据操作失败，请稍后重试";
        }

        // 网络相关异常
        if (exceptionType.contains("Connect") || exceptionType.contains("Timeout") ||
            exceptionType.contains("Socket") || exceptionType.contains("IO")) {
            return "服务连接失败，请稍后重试";
        }

        // 空指针和类型异常
        if (exceptionType.contains("NullPointer") || exceptionType.contains("ClassCast") ||
            exceptionType.contains("IndexOutOfBounds")) {
            return "系统处理异常，请稍后重试";
        }

        // 业务异常可以返回消息（但需要检查是否安全）
        if (exceptionType.contains("Business") || exceptionType.contains("Validation") ||
            exceptionType.contains("IllegalArgument") || exceptionType.contains("IllegalState")) {
            if (message != null && isSafeMessage(message)) {
                return message;
            }
        }

        // 默认返回通用消息
        return "操作执行失败，请稍后重试";
    }

    /**
     * 判断消息是否安全（不包含敏感信息）
     */
    private boolean isSafeMessage(String message) {
        if (message == null || message.isEmpty()) {
            return false;
        }
        String lowerMsg = message.toLowerCase();
        return !lowerMsg.contains("exception") &&
               !lowerMsg.contains("sql") &&
               !lowerMsg.contains("jdbc") &&
               !lowerMsg.contains("hibernate") &&
               !lowerMsg.contains("connection") &&
               !lowerMsg.contains("localhost") &&
               !lowerMsg.contains("127.0.0.1") &&
               !lowerMsg.contains(".java:") &&
               !lowerMsg.contains("at com.") &&
               !lowerMsg.contains("at org.") &&
               !lowerMsg.contains("null pointer") &&
               !lowerMsg.contains("stack trace");
    }
}
