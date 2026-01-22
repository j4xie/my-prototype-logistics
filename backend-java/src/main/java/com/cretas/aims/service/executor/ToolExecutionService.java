package com.cretas.aims.service.executor;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.ToolRouterService;

import java.util.Map;

/**
 * Tool 执行服务接口
 *
 * 负责 Tool Chain 执行，包括：
 * - 静态工具执行（预绑定）
 * - 动态工具选择和执行（向量检索 + LLM 精选）
 * - 参数提取（LLM Tool Calling）
 * - Handler 回退执行
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface ToolExecutionService {

    /**
     * 使用 Tool 执行意图
     */
    IntentExecuteResponse executeWithTool(ToolExecutor tool, String factoryId,
                                           IntentExecuteRequest request,
                                           AIIntentConfig intent,
                                           Long userId, String userRole,
                                           IntentMatchResult matchResult);

    /**
     * Handler 回退执行
     */
    IntentExecuteResponse executeWithHandlerFallback(String factoryId,
                                                      IntentExecuteRequest request,
                                                      AIIntentConfig intent,
                                                      Long userId, String userRole);

    /**
     * 动态工具选择执行
     */
    IntentExecuteResponse executeWithDynamicToolSelection(String factoryId,
                                                           IntentExecuteRequest request,
                                                           AIIntentConfig intent,
                                                           IntentMatchResult matchResult,
                                                           Long userId, String userRole);

    /**
     * 使用 LLM Tool Calling 从用户输入中提取参数
     */
    Map<String, Object> extractParametersWithLLM(String userInput, ToolExecutor tool,
                                                  Map<String, Object> existingParams);

    /**
     * 解析 Tool 执行结果为 IntentExecuteResponse
     */
    IntentExecuteResponse parseToolResultToResponse(String resultJson, AIIntentConfig intent);
}
