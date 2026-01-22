package com.cretas.aims.service.executor.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.executor.MultiIntentOrchestrationService;
import com.cretas.aims.service.executor.ResponseBuilderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * 多意图编排服务实现
 *
 * 负责多意图的识别、排序和执行编排
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MultiIntentOrchestrationServiceImpl implements MultiIntentOrchestrationService {

    private final ResponseBuilderService responseBuilderService;

    // 意图依赖关系图
    private static final Map<String, List<String>> INTENT_DEPENDENCIES = Map.of(
            "CREATE_PRODUCTION_PLAN", List.of("QUERY_MATERIAL_STOCK"),
            "ASSIGN_WORKERS", List.of("QUERY_AVAILABLE_WORKERS"),
            "START_PRODUCTION", List.of("QUERY_EQUIPMENT_STATUS", "QUERY_MATERIAL_STOCK")
    );

    // 互斥意图组
    private static final List<Set<String>> MUTEX_INTENT_GROUPS = List.of(
            Set.of("START_PRODUCTION", "STOP_PRODUCTION"),
            Set.of("APPROVE_PLAN", "REJECT_PLAN")
    );

    @Override
    public List<IntentMatchResult> detectMultipleIntents(String factoryId, String userInput,
                                                          Long userId, String userRole) {
        // 这个方法应该由 AIIntentService 调用，这里返回空列表
        // 实际的多意图检测逻辑在 AIIntentServiceImpl 中
        log.debug("Multi-intent detection delegated to AIIntentService");
        return List.of();
    }

    @Override
    public List<IntentMatchResult> sortByExecutionOrder(List<IntentMatchResult> intents) {
        if (intents == null || intents.size() <= 1) {
            return intents;
        }

        // 拓扑排序基于依赖关系
        List<IntentMatchResult> sorted = new ArrayList<>();
        Set<String> processed = new HashSet<>();

        // 先处理没有依赖的意图
        for (IntentMatchResult intent : intents) {
            String intentCode = intent.getBestMatch() != null ?
                    intent.getBestMatch().getIntentCode() : null;
            if (intentCode == null) continue;

            List<String> deps = INTENT_DEPENDENCIES.getOrDefault(intentCode, List.of());
            if (deps.isEmpty() || processed.containsAll(deps)) {
                sorted.add(intent);
                processed.add(intentCode);
            }
        }

        // 处理有依赖的意图
        for (IntentMatchResult intent : intents) {
            String intentCode = intent.getBestMatch() != null ?
                    intent.getBestMatch().getIntentCode() : null;
            if (intentCode != null && !processed.contains(intentCode)) {
                sorted.add(intent);
                processed.add(intentCode);
            }
        }

        return sorted;
    }

    @Override
    public boolean canExecuteInParallel(List<IntentMatchResult> intents) {
        if (intents == null || intents.size() <= 1) {
            return true;
        }

        Set<String> intentCodes = intents.stream()
                .map(i -> i.getBestMatch() != null ? i.getBestMatch().getIntentCode() : null)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // 检查是否有互斥意图
        for (Set<String> mutexGroup : MUTEX_INTENT_GROUPS) {
            long count = intentCodes.stream().filter(mutexGroup::contains).count();
            if (count > 1) {
                log.debug("Found mutex intents in group: {}", mutexGroup);
                return false;
            }
        }

        // 检查是否有依赖关系
        for (String intentCode : intentCodes) {
            List<String> deps = INTENT_DEPENDENCIES.getOrDefault(intentCode, List.of());
            if (!Collections.disjoint(deps, intentCodes)) {
                log.debug("Found dependency between intents: {} depends on {}", intentCode, deps);
                return false;
            }
        }

        return true;
    }

    @Override
    public List<IntentExecuteResponse> executeSequentially(String factoryId,
                                                            List<IntentMatchResult> intents,
                                                            IntentExecutionCallback callback) {
        List<IntentExecuteResponse> responses = new ArrayList<>();

        for (IntentMatchResult intent : intents) {
            try {
                IntentExecuteResponse response = callback.execute(factoryId, intent);
                responses.add(response);

                // 如果执行失败且是关键意图，中断执行
                if (!response.isSuccess() && isRequiredIntent(intent)) {
                    log.warn("Required intent failed, aborting sequence: {}",
                            intent.getBestMatch().getIntentCode());
                    break;
                }
            } catch (Exception e) {
                log.error("Intent execution failed: {}", e.getMessage(), e);
                responses.add(responseBuilderService.buildErrorResponse(
                        intent.getBestMatch(), e.getMessage(), "EXECUTION_ERROR"));
            }
        }

        return responses;
    }

    @Override
    public List<IntentExecuteResponse> executeInParallel(String factoryId,
                                                          List<IntentMatchResult> intents,
                                                          IntentExecutionCallback callback) {
        List<CompletableFuture<IntentExecuteResponse>> futures = intents.stream()
                .map(intent -> CompletableFuture.supplyAsync(() -> {
                    try {
                        return callback.execute(factoryId, intent);
                    } catch (Exception e) {
                        log.error("Parallel intent execution failed: {}", e.getMessage());
                        return responseBuilderService.buildErrorResponse(
                                intent.getBestMatch(), e.getMessage(), "EXECUTION_ERROR");
                    }
                }))
                .toList();

        return futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList());
    }

    @Override
    public IntentExecuteResponse mergeResponses(List<IntentExecuteResponse> responses) {
        return responseBuilderService.buildMultiIntentResponse(responses);
    }

    @Override
    public List<IntentMatchResult> resolveDependencies(List<IntentMatchResult> intents) {
        Set<String> intentCodes = intents.stream()
                .map(i -> i.getBestMatch() != null ? i.getBestMatch().getIntentCode() : null)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // 检查并添加缺失的依赖
        Set<String> missingDeps = new HashSet<>();
        for (String intentCode : intentCodes) {
            List<String> deps = INTENT_DEPENDENCIES.getOrDefault(intentCode, List.of());
            for (String dep : deps) {
                if (!intentCodes.contains(dep)) {
                    missingDeps.add(dep);
                }
            }
        }

        if (!missingDeps.isEmpty()) {
            log.info("Adding missing dependencies: {}", missingDeps);
            // 这里应该自动添加依赖意图，但需要 AIIntentService 的配合
            // 暂时只记录日志
        }

        return sortByExecutionOrder(intents);
    }

    @Override
    public boolean hasMutuallyExclusiveIntents(List<IntentMatchResult> intents) {
        Set<String> intentCodes = intents.stream()
                .map(i -> i.getBestMatch() != null ? i.getBestMatch().getIntentCode() : null)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        for (Set<String> mutexGroup : MUTEX_INTENT_GROUPS) {
            long count = intentCodes.stream().filter(mutexGroup::contains).count();
            if (count > 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * 判断是否为必需意图
     */
    private boolean isRequiredIntent(IntentMatchResult intent) {
        if (intent == null || intent.getBestMatch() == null) {
            return false;
        }

        // 高优先级意图视为必需
        return intent.getBestMatch().getPriority() != null &&
                intent.getBestMatch().getPriority() >= 90;
    }
}
