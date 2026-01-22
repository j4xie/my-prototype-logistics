package com.cretas.aims.service.executor.impl;

import com.cretas.aims.dto.ai.ToolCallDTO;
import com.cretas.aims.dto.ai.ToolResultDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.executor.ToolExecutionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 工具执行服务实现
 *
 * 负责 Tool Chain 的执行，包括：
 * - 工具调用
 * - 工具链编排
 * - 结果聚合
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ToolExecutionServiceImpl implements ToolExecutionService {

    private final ApplicationContext applicationContext;
    private final ObjectMapper objectMapper;

    // 工具执行缓存
    private final Map<String, Object> toolCache = new ConcurrentHashMap<>();

    @Override
    public ToolResultDTO executeTool(String factoryId, ToolCallDTO toolCall) {
        if (toolCall == null || toolCall.getToolName() == null) {
            return ToolResultDTO.error("工具调用参数无效");
        }

        try {
            String toolName = toolCall.getToolName();
            Map<String, Object> parameters = toolCall.getParameters();

            log.info("Executing tool: {} with parameters: {}", toolName, parameters);

            // 查找工具处理器
            Object handler = findToolHandler(toolName);
            if (handler == null) {
                return ToolResultDTO.error("未找到工具处理器: " + toolName);
            }

            // 执行工具
            Object result = invokeToolMethod(handler, toolName, factoryId, parameters);

            return ToolResultDTO.success(result);
        } catch (Exception e) {
            log.error("Tool execution failed: {}", e.getMessage(), e);
            return ToolResultDTO.error("工具执行失败: " + e.getMessage());
        }
    }

    @Override
    public List<ToolResultDTO> executeToolChain(String factoryId, List<ToolCallDTO> toolCalls) {
        List<ToolResultDTO> results = new ArrayList<>();

        for (ToolCallDTO toolCall : toolCalls) {
            ToolResultDTO result = executeTool(factoryId, toolCall);
            results.add(result);

            // 如果工具执行失败且是关键工具，中断执行
            if (!result.isSuccess() && toolCall.isCritical()) {
                log.warn("Critical tool failed, aborting chain: {}", toolCall.getToolName());
                break;
            }
        }

        return results;
    }

    @Override
    public CompletableFuture<List<ToolResultDTO>> executeToolChainAsync(String factoryId, List<ToolCallDTO> toolCalls) {
        return CompletableFuture.supplyAsync(() -> executeToolChain(factoryId, toolCalls));
    }

    @Override
    public List<ToolResultDTO> executeToolsInParallel(String factoryId, List<ToolCallDTO> toolCalls) {
        List<CompletableFuture<ToolResultDTO>> futures = toolCalls.stream()
                .map(toolCall -> CompletableFuture.supplyAsync(() -> executeTool(factoryId, toolCall)))
                .toList();

        return futures.stream()
                .map(CompletableFuture::join)
                .toList();
    }

    @Override
    public Object aggregateToolResults(List<ToolResultDTO> results) {
        // 聚合成功的结果
        List<Object> successResults = results.stream()
                .filter(ToolResultDTO::isSuccess)
                .map(ToolResultDTO::getData)
                .toList();

        if (successResults.size() == 1) {
            return successResults.get(0);
        }

        return Map.of(
                "results", successResults,
                "totalCount", results.size(),
                "successCount", successResults.size()
        );
    }

    @Override
    public boolean isToolAvailable(String toolName) {
        return findToolHandler(toolName) != null;
    }

    @Override
    public List<String> getAvailableTools() {
        // 返回所有可用的工具名称
        return List.of(
                "queryMaterialBatch",
                "queryProductionPlan",
                "queryEquipmentStatus",
                "queryWorkerAssignment",
                "generateReport",
                "sendNotification",
                "updateSchedule",
                "calculateProbability"
        );
    }

    /**
     * 查找工具处理器
     */
    private Object findToolHandler(String toolName) {
        try {
            // 尝试从 Spring 上下文获取处理器
            String handlerBeanName = toolName + "Handler";
            if (applicationContext.containsBean(handlerBeanName)) {
                return applicationContext.getBean(handlerBeanName);
            }

            // 尝试通过工具名称映射获取
            String serviceBeanName = mapToolToService(toolName);
            if (serviceBeanName != null && applicationContext.containsBean(serviceBeanName)) {
                return applicationContext.getBean(serviceBeanName);
            }

            return null;
        } catch (Exception e) {
            log.warn("Failed to find tool handler for: {}", toolName);
            return null;
        }
    }

    /**
     * 工具名称到服务的映射
     */
    private String mapToolToService(String toolName) {
        return switch (toolName) {
            case "queryMaterialBatch" -> "materialBatchService";
            case "queryProductionPlan" -> "productionPlanService";
            case "queryEquipmentStatus" -> "equipmentService";
            case "queryWorkerAssignment" -> "schedulingService";
            case "generateReport" -> "reportService";
            case "sendNotification" -> "notificationService";
            case "updateSchedule" -> "schedulingService";
            case "calculateProbability" -> "schedulingService";
            default -> null;
        };
    }

    /**
     * 调用工具方法
     */
    private Object invokeToolMethod(Object handler, String toolName, String factoryId, Map<String, Object> parameters) {
        try {
            // 尝试调用 execute 方法
            Method executeMethod = findExecuteMethod(handler.getClass(), toolName);
            if (executeMethod != null) {
                return executeMethod.invoke(handler, factoryId, parameters);
            }

            // 尝试直接调用工具名称对应的方法
            Method toolMethod = findToolMethod(handler.getClass(), toolName);
            if (toolMethod != null) {
                return toolMethod.invoke(handler, factoryId, parameters);
            }

            throw new RuntimeException("未找到工具执行方法: " + toolName);
        } catch (Exception e) {
            throw new RuntimeException("工具方法调用失败: " + e.getMessage(), e);
        }
    }

    private Method findExecuteMethod(Class<?> clazz, String toolName) {
        try {
            return clazz.getMethod("execute", String.class, Map.class);
        } catch (NoSuchMethodException e) {
            return null;
        }
    }

    private Method findToolMethod(Class<?> clazz, String toolName) {
        for (Method method : clazz.getMethods()) {
            if (method.getName().equalsIgnoreCase(toolName)) {
                return method;
            }
        }
        return null;
    }
}
