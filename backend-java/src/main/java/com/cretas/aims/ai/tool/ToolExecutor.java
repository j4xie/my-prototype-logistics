package com.cretas.aims.ai.tool;

import com.cretas.aims.ai.dto.ToolCall;

import java.util.Map;

/**
 * Tool 执行器接口
 *
 * 负责执行 LLM 调用的工具，类似于 IntentHandler 的角色。
 * 每个工具实现此接口以处理特定的 Function Calling 请求。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
public interface ToolExecutor {

    /**
     * 获取工具名称（必须与 Tool Definition 中的 name 一致）
     *
     * @return 工具名称，如 "create_new_intent"
     */
    String getToolName();

    /**
     * 获取工具描述（用于生成 Tool Definition）
     *
     * @return 工具描述，LLM 根据此描述判断何时调用
     */
    String getDescription();

    /**
     * 获取工具参数定义（JSON Schema 格式）
     *
     * @return 参数定义，用于生成 Tool Definition
     * @example
     * {
     *   "type": "object",
     *   "properties": {
     *     "intent_code": {"type": "string", "description": "意图代码"},
     *     "intent_name": {"type": "string", "description": "意图名称"}
     *   },
     *   "required": ["intent_code", "intent_name"]
     * }
     */
    Map<String, Object> getParametersSchema();

    /**
     * 执行工具调用
     *
     * @param toolCall LLM 返回的工具调用对象（包含参数 JSON）
     * @param context 执行上下文（工厂ID、用户ID等）
     * @return 执行结果（JSON 字符串），将作为 tool_call_result 返回给 LLM
     * @throws Exception 执行失败时抛出异常
     */
    String execute(ToolCall toolCall, Map<String, Object> context) throws Exception;

    /**
     * 工具是否启用
     *
     * @return true 表示可用，false 表示禁用
     */
    default boolean isEnabled() {
        return true;
    }

    /**
     * 工具是否需要特殊权限
     *
     * @return true 表示需要权限校验
     */
    default boolean requiresPermission() {
        return false;
    }

    /**
     * 检查用户角色是否有权限使用此工具
     *
     * @param userRole 用户角色
     * @return true 表示有权限
     */
    default boolean hasPermission(String userRole) {
        return true;
    }
}
