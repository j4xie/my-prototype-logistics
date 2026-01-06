package com.cretas.aims.ai.tool;

import com.cretas.aims.ai.dto.ToolCall;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.HashMap;
import java.util.Map;

/**
 * Tool 执行器抽象基类
 *
 * 提供通用工具方法：参数解析、错误处理、日志记录、结果构建。
 * 所有具体的 ToolExecutor 实现应继承此类以获得标准化能力。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Slf4j
public abstract class AbstractTool implements ToolExecutor {

    @Autowired
    protected ObjectMapper objectMapper;

    /**
     * 解析工具调用参数为 Map
     *
     * @param toolCall LLM 返回的工具调用
     * @return 参数 Map
     * @throws IllegalArgumentException 参数解析失败
     */
    protected Map<String, Object> parseArguments(ToolCall toolCall) {
        try {
            String argumentsJson = toolCall.getFunction().getArguments();
            if (argumentsJson == null || argumentsJson.trim().isEmpty()) {
                return new HashMap<>();
            }
            return objectMapper.readValue(argumentsJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("❌ 参数解析失败: toolName={}, arguments={}",
                    toolCall.getFunction().getName(), toolCall.getFunction().getArguments(), e);
            throw new IllegalArgumentException("Invalid tool arguments: " + e.getMessage());
        }
    }

    /**
     * 获取必需参数（不存在则抛异常）
     *
     * @param arguments 参数 Map
     * @param key 参数名
     * @return 参数值
     * @throws IllegalArgumentException 参数不存在
     */
    protected String getRequiredParam(Map<String, Object> arguments, String key) {
        Object value = arguments.get(key);
        if (value == null) {
            throw new IllegalArgumentException("Missing required parameter: " + key);
        }
        return value.toString();
    }

    /**
     * 获取可选参数（不存在返回默认值）
     *
     * @param arguments 参数 Map
     * @param key 参数名
     * @param defaultValue 默认值
     * @return 参数值或默认值
     */
    protected String getOptionalParam(Map<String, Object> arguments, String key, String defaultValue) {
        Object value = arguments.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    /**
     * 构建成功结果 JSON
     *
     * @param data 结果数据
     * @return JSON 字符串
     */
    protected String buildSuccessResult(Object data) {
        try {
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", data);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("❌ 构建结果失败", e);
            return buildErrorResult("Failed to build result: " + e.getMessage());
        }
    }

    /**
     * 构建错误结果 JSON
     *
     * @param message 错误消息
     * @return JSON 字符串
     */
    protected String buildErrorResult(String message) {
        try {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", message);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("❌ 构建错误结果失败", e);
            return "{\"success\":false,\"error\":\"Internal error\"}";
        }
    }

    /**
     * 从上下文获取工厂ID
     *
     * @param context 执行上下文
     * @return 工厂ID
     */
    protected String getFactoryId(Map<String, Object> context) {
        return (String) context.get("factoryId");
    }

    /**
     * 从上下文获取用户ID
     *
     * @param context 执行上下文
     * @return 用户ID
     */
    protected Long getUserId(Map<String, Object> context) {
        Object userId = context.get("userId");
        if (userId instanceof Long) {
            return (Long) userId;
        } else if (userId instanceof Integer) {
            return ((Integer) userId).longValue();
        } else if (userId instanceof String) {
            return Long.parseLong((String) userId);
        }
        return null;
    }

    /**
     * 从上下文获取用户角色
     *
     * @param context 执行上下文
     * @return 用户角色
     */
    protected String getUserRole(Map<String, Object> context) {
        return (String) context.get("userRole");
    }

    /**
     * 记录工具执行开始
     *
     * @param toolCall 工具调用
     * @param context 执行上下文
     */
    protected void logExecutionStart(ToolCall toolCall, Map<String, Object> context) {
        log.info("🔧 开始执行工具: toolName={}, toolCallId={}, factoryId={}, userId={}",
                toolCall.getFunction().getName(),
                toolCall.getId(),
                getFactoryId(context),
                getUserId(context));
    }

    /**
     * 记录工具执行成功
     *
     * @param toolCall 工具调用
     * @param result 执行结果
     */
    protected void logExecutionSuccess(ToolCall toolCall, String result) {
        log.info("✅ 工具执行成功: toolName={}, toolCallId={}, resultLength={}",
                toolCall.getFunction().getName(),
                toolCall.getId(),
                result != null ? result.length() : 0);
    }

    /**
     * 记录工具执行失败
     *
     * @param toolCall 工具调用
     * @param error 异常
     */
    protected void logExecutionFailure(ToolCall toolCall, Exception error) {
        log.error("❌ 工具执行失败: toolName={}, toolCallId={}, error={}",
                toolCall.getFunction().getName(),
                toolCall.getId(),
                error.getMessage(),
                error);
    }

    /**
     * 验证上下文必需字段
     *
     * @param context 执行上下文
     * @throws IllegalArgumentException 缺少必需字段
     */
    protected void validateContext(Map<String, Object> context) {
        if (context == null) {
            throw new IllegalArgumentException("Context cannot be null");
        }
        if (!context.containsKey("factoryId")) {
            throw new IllegalArgumentException("Missing factoryId in context");
        }
        if (!context.containsKey("userId")) {
            throw new IllegalArgumentException("Missing userId in context");
        }
    }

    /**
     * 默认实现：启用所有工具
     */
    @Override
    public boolean isEnabled() {
        return true;
    }

    /**
     * 默认实现：不需要特殊权限
     */
    @Override
    public boolean requiresPermission() {
        return false;
    }

    /**
     * 默认实现：所有角色都有权限
     */
    @Override
    public boolean hasPermission(String userRole) {
        return true;
    }
}
