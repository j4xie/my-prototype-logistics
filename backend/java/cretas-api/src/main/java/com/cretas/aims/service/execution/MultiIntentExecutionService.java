package com.cretas.aims.service.execution;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.service.AIIntentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.stream.Collectors;

/**
 * 多意图执行服务
 *
 * 负责复合意图识别、子请求拆分、并行 / 串行执行、
 * 结果合并、用户确认流程。
 */
@Slf4j
@Service
public class MultiIntentExecutionService {

    private final AIIntentService aiIntentService;
    private final IntentExecutionOrchestrator orchestrator;
    private final SseStreamingService sseStreamingService;

    @Value("${cretas.ai.multi-intent.enabled:true}")
    private boolean multiIntentEnabled;

    public MultiIntentExecutionService(@Lazy AIIntentService aiIntentService,
                                       @Lazy IntentExecutionOrchestrator orchestrator,
                                       SseStreamingService sseStreamingService) {
        this.aiIntentService = aiIntentService;
        this.orchestrator = orchestrator;
        this.sseStreamingService = sseStreamingService;
    }

    // ==================== 公开方法 ====================

    /**
     * 执行多意图请求（公共方法）
     */
    public IntentExecuteResponse executeMultiIntent(String factoryId, IntentExecuteRequest request,
                                                     Long userId, String userRole) {
        log.info("执行多意图识别: factoryId={}, userInput='{}'",
                factoryId,
                request.getUserInput() != null && request.getUserInput().length() > 50 ?
                        request.getUserInput().substring(0, 50) + "..." : request.getUserInput());

        if (!multiIntentEnabled) {
            log.info("多意图功能已禁用，回退到单意图执行");
            return orchestrator.execute(factoryId, request, userId, userRole);
        }

        String userInput = request.getUserInput();
        if (userInput == null || userInput.trim().isEmpty()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("FAILED")
                    .message("用户输入不能为空")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 1. 调用多意图识别
        MultiIntentResult multiResult;
        try {
            multiResult = aiIntentService.recognizeMultiIntent(userInput, factoryId);
        } catch (Exception e) {
            log.error("多意图识别失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return orchestrator.execute(factoryId, request, userId, userRole);
        }

        // 2. 回退判断
        if (multiResult == null || !multiResult.isMultiIntent()
                || multiResult.getIntents() == null || multiResult.getIntents().isEmpty()) {
            log.info("非多意图请求，回退到单意图执行");
            return orchestrator.execute(factoryId, request, userId, userRole);
        }

        log.info("识别到多意图: intentCount={}, strategy={}, confidence={}",
                multiResult.getIntents().size(),
                multiResult.getExecutionStrategy(),
                multiResult.getOverallConfidence());

        // 3. 检查是否需要用户确认
        if (multiResult.requiresUserConfirmation()) {
            log.info("多意图需要用户确认: strategy={}, confidence={}",
                    multiResult.getExecutionStrategy(), multiResult.getOverallConfidence());
            return buildMultiIntentUserConfirmationResponse(multiResult, factoryId);
        }

        // 4. 根据执行策略执行
        MultiIntentResult.ExecutionStrategy strategy = multiResult.getExecutionStrategy();
        List<IntentExecuteResponse> results;

        try {
            if (strategy == MultiIntentResult.ExecutionStrategy.PARALLEL) {
                results = executeMultiIntentParallel(multiResult, request, factoryId, userId, userRole);
            } else {
                results = executeMultiIntentSequential(multiResult, request, factoryId, userId, userRole);
            }
        } catch (Exception e) {
            log.error("多意图执行失败: strategy={}, error={}", strategy, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .status("FAILED")
                    .message("多意图执行失败: " + e.getMessage())
                    .multiIntentResult(true)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 5. 合并执行结果
        return mergeMultiIntentExecutionResults(results, multiResult);
    }

    /**
     * 从 IntentMatchResult 执行多意图（内部路径）
     */
    public IntentExecuteResponse executeMultiIntentFromMatchResult(IntentExecuteRequest request,
                                                                    IntentMatchResult intentResult,
                                                                    String factoryId,
                                                                    Long userId,
                                                                    String userRole) {
        List<IntentMatchResult.IntentMatch> intents = intentResult.getAdditionalIntents();
        if (intents == null || intents.isEmpty()) {
            return executeSingleIntent(request, intentResult, factoryId, userId, userRole);
        }

        MultiIntentResult.ExecutionStrategy strategy = intentResult.getExecutionStrategy();
        if (strategy == MultiIntentResult.ExecutionStrategy.USER_CONFIRM
            || intentResult.getConfidence() < 0.7) {
            return buildMultiIntentConfirmationResponse(intentResult);
        }

        List<IntentExecuteResponse> results;

        if (strategy == MultiIntentResult.ExecutionStrategy.PARALLEL) {
            results = intents.parallelStream()
                .map(intent -> executeSingleIntentByCode(request, intent.getIntentCode(),
                        intent.getExtractedParams(), factoryId, userId, userRole))
                .collect(Collectors.toList());
        } else {
            results = new ArrayList<>();
            for (IntentMatchResult.IntentMatch intent : intents) {
                IntentExecuteResponse result = executeSingleIntentByCode(
                    request, intent.getIntentCode(), intent.getExtractedParams(),
                    factoryId, userId, userRole);
                results.add(result);
            }
        }

        return mergeMultiIntentResultsFromMatchResult(results, intentResult);
    }

    // ==================== 内部方法 ====================

    private IntentExecuteResponse executeSingleIntent(IntentExecuteRequest request,
                                                       IntentMatchResult intentResult,
                                                       String factoryId,
                                                       Long userId,
                                                       String userRole) {
        if (intentResult.getBestMatch() != null) {
            request.setIntentCode(intentResult.getBestMatch().getIntentCode());
            return orchestrator.executeWithExplicitIntent(factoryId, request, userId, userRole);
        }
        return IntentExecuteResponse.builder()
                .status("FAILED")
                .message("无法识别意图")
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse executeSingleIntentByCode(IntentExecuteRequest request,
                                                             String intentCode,
                                                             Map<String, Object> extractedParams,
                                                             String factoryId,
                                                             Long userId,
                                                             String userRole) {
        IntentExecuteRequest subRequest = IntentExecuteRequest.builder()
                .userInput(request.getUserInput())
                .intentCode(intentCode)
                .context(extractedParams != null ? extractedParams : request.getContext())
                .sessionId(request.getSessionId())
                .previewOnly(request.getPreviewOnly())
                .forceExecute(true)
                .build();

        return orchestrator.executeWithExplicitIntent(factoryId, subRequest, userId, userRole);
    }

    private List<IntentExecuteResponse> executeMultiIntentParallel(MultiIntentResult multiResult,
                                                                     IntentExecuteRequest originalRequest,
                                                                     String factoryId,
                                                                     Long userId,
                                                                     String userRole) {
        log.info("并行执行 {} 个意图", multiResult.getIntents().size());
        ExecutorService executor = sseStreamingService.getSseExecutor();

        List<CompletableFuture<IntentExecuteResponse>> futures = multiResult.getIntents().stream()
                .map(intent -> CompletableFuture.supplyAsync(() ->
                        executeSingleIntentFromMultiResult(intent, originalRequest, factoryId, userId, userRole),
                        executor
                ))
                .collect(Collectors.toList());

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        return futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList());
    }

    private List<IntentExecuteResponse> executeMultiIntentSequential(MultiIntentResult multiResult,
                                                                       IntentExecuteRequest originalRequest,
                                                                       String factoryId,
                                                                       Long userId,
                                                                       String userRole) {
        log.info("串行执行 {} 个意图", multiResult.getIntents().size());

        List<MultiIntentResult.SingleIntentMatch> sortedIntents = multiResult.getIntents().stream()
                .sorted((a, b) -> Integer.compare(a.getExecutionOrder(), b.getExecutionOrder()))
                .collect(Collectors.toList());

        List<IntentExecuteResponse> results = new ArrayList<>();
        for (MultiIntentResult.SingleIntentMatch intent : sortedIntents) {
            IntentExecuteResponse result = executeSingleIntentFromMultiResult(
                    intent, originalRequest, factoryId, userId, userRole);
            results.add(result);

            if ("FAILED".equals(result.getStatus())) {
                log.warn("意图执行失败，继续执行下一个: intentCode={}", intent.getIntentCode());
            }
        }
        return results;
    }

    private IntentExecuteResponse executeSingleIntentFromMultiResult(MultiIntentResult.SingleIntentMatch intent,
                                                                       IntentExecuteRequest originalRequest,
                                                                       String factoryId,
                                                                       Long userId,
                                                                       String userRole) {
        log.debug("执行单个意图: intentCode={}, order={}", intent.getIntentCode(), intent.getExecutionOrder());

        Map<String, Object> context = new HashMap<>();
        if (originalRequest.getContext() != null) {
            context.putAll(originalRequest.getContext());
        }
        if (intent.getExtractedParams() != null) {
            context.putAll(intent.getExtractedParams());
        }

        IntentExecuteRequest subRequest = IntentExecuteRequest.builder()
                .userInput(originalRequest.getUserInput())
                .intentCode(intent.getIntentCode())
                .context(context)
                .sessionId(originalRequest.getSessionId())
                .previewOnly(originalRequest.getPreviewOnly())
                .forceExecute(true)
                .build();

        return orchestrator.executeWithExplicitIntent(factoryId, subRequest, userId, userRole);
    }

    // ==================== 响应构建 ====================

    private IntentExecuteResponse buildMultiIntentUserConfirmationResponse(MultiIntentResult multiResult,
                                                                             String factoryId) {
        List<IntentExecuteResponse.SuggestedAction> actions = new ArrayList<>();

        for (MultiIntentResult.SingleIntentMatch intent : multiResult.getIntents()) {
            Map<String, Object> params = new HashMap<>();
            params.put("intentCode", intent.getIntentCode());
            params.put("forceExecute", true);
            if (intent.getExtractedParams() != null) {
                params.putAll(intent.getExtractedParams());
            }

            actions.add(IntentExecuteResponse.SuggestedAction.builder()
                    .actionCode(intent.getIntentCode())
                    .actionName(intent.getIntentName())
                    .description(String.format("置信度: %.0f%% - %s",
                            intent.getConfidence() * 100,
                            intent.getReasoning() != null ? intent.getReasoning() : ""))
                    .endpoint("/api/mobile/" + factoryId + "/ai-intents/execute")
                    .parameters(params)
                    .build());
        }

        Map<String, Object> allParams = new HashMap<>();
        allParams.put("executeAll", true);
        allParams.put("intents", multiResult.getIntents().stream()
                .map(MultiIntentResult.SingleIntentMatch::getIntentCode)
                .collect(Collectors.toList()));

        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("EXECUTE_ALL")
                .actionName("全部执行")
                .description("依次执行所有识别到的意图")
                .endpoint("/api/mobile/" + factoryId + "/ai-intents/execute-multi")
                .parameters(allParams)
                .build());

        String message = multiResult.getReasoning() != null ?
                multiResult.getReasoning() :
                String.format("检测到 %d 个意图，请确认要执行的操作", multiResult.getIntents().size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .status("NEED_CONFIRMATION")
                .message(message)
                .suggestedActions(actions)
                .multiIntentResult(true)
                .metadata(Map.of(
                        "multiIntent", true,
                        "intentCount", multiResult.getIntents().size(),
                        "executionStrategy", multiResult.getExecutionStrategy().name(),
                        "overallConfidence", multiResult.getOverallConfidence(),
                        "requiresConfirmation", true
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse buildMultiIntentConfirmationResponse(IntentMatchResult intentResult) {
        List<IntentExecuteResponse.SuggestedAction> actions = new ArrayList<>();

        if (intentResult.getBestMatch() != null) {
            actions.add(IntentExecuteResponse.SuggestedAction.builder()
                    .actionCode(intentResult.getBestMatch().getIntentCode())
                    .actionName(intentResult.getBestMatch().getIntentName())
                    .description("执行: " + intentResult.getBestMatch().getDescription())
                    .build());
        }

        if (intentResult.getAdditionalIntents() != null) {
            for (IntentMatchResult.IntentMatch intent : intentResult.getAdditionalIntents()) {
                actions.add(IntentExecuteResponse.SuggestedAction.builder()
                        .actionCode(intent.getIntentCode())
                        .actionName(intent.getIntentName())
                        .description(intent.getReasoning())
                        .build());
            }
        }

        return IntentExecuteResponse.builder()
                .status("NEED_CONFIRMATION")
                .message("检测到多个意图，请确认要执行的操作")
                .suggestedActions(actions)
                .metadata(Map.of(
                        "multiIntent", true,
                        "intentCount", actions.size(),
                        "confidence", intentResult.getConfidence()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse mergeMultiIntentExecutionResults(List<IntentExecuteResponse> results,
                                                                     MultiIntentResult multiResult) {
        if (results == null || results.isEmpty()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .status("FAILED")
                    .message("没有意图被执行")
                    .multiIntentResult(true)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        long successCount = results.stream()
                .filter(r -> "SUCCESS".equals(r.getStatus()) || "COMPLETED".equals(r.getStatus()))
                .count();
        long failedCount = results.stream()
                .filter(r -> "FAILED".equals(r.getStatus()))
                .count();

        Map<String, Object> mergedData = new HashMap<>();
        List<Map<String, Object>> intentResults = new ArrayList<>();

        for (int i = 0; i < results.size(); i++) {
            IntentExecuteResponse result = results.get(i);
            Map<String, Object> intentResultMap = new HashMap<>();
            intentResultMap.put("intentCode", result.getIntentCode());
            intentResultMap.put("intentName", result.getIntentName());
            intentResultMap.put("status", result.getStatus());
            intentResultMap.put("message", result.getMessage());
            intentResultMap.put("data", result.getResultData());

            if (i < multiResult.getIntents().size()) {
                MultiIntentResult.SingleIntentMatch originalIntent = multiResult.getIntents().get(i);
                intentResultMap.put("confidence", originalIntent.getConfidence());
                intentResultMap.put("executionOrder", originalIntent.getExecutionOrder());
            }
            intentResults.add(intentResultMap);
        }
        mergedData.put("intentResults", intentResults);

        String summary = results.stream()
                .map(IntentExecuteResponse::getMessage)
                .filter(msg -> msg != null && !msg.isEmpty())
                .collect(Collectors.joining("; "));

        String overallStatus;
        if (successCount == results.size()) {
            overallStatus = "COMPLETED";
        } else if (failedCount == results.size()) {
            overallStatus = "FAILED";
        } else {
            overallStatus = "PARTIAL_SUCCESS";
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .status(overallStatus)
                .message(summary.isEmpty() ?
                        String.format("多意图执行完成: %d 成功, %d 失败", successCount, failedCount) :
                        summary)
                .resultData(mergedData)
                .multiIntentResult(true)
                .metadata(Map.of(
                        "multiIntent", true,
                        "intentCount", results.size(),
                        "successCount", successCount,
                        "failedCount", failedCount,
                        "executionStrategy", multiResult.getExecutionStrategy().name()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse mergeMultiIntentResultsFromMatchResult(List<IntentExecuteResponse> results,
                                                                          IntentMatchResult intentResult) {
        boolean allSuccess = results.stream()
                .allMatch(r -> "COMPLETED".equals(r.getStatus()) || "SUCCESS".equals(r.getStatus()));

        Map<String, Object> mergedData = new java.util.LinkedHashMap<>();
        List<IntentMatchResult.IntentMatch> intents = intentResult.getAdditionalIntents();

        for (int i = 0; i < results.size() && i < (intents != null ? intents.size() : 0); i++) {
            IntentExecuteResponse result = results.get(i);
            String intentCode = intents.get(i).getIntentCode();
            mergedData.put(intentCode, result.getResultData());
        }

        String summary = results.stream()
                .map(IntentExecuteResponse::getMessage)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.joining("; "));

        return IntentExecuteResponse.builder()
                .status(allSuccess ? "COMPLETED" : "PARTIAL_SUCCESS")
                .message(summary.isEmpty() ? "多意图执行完成" : summary)
                .resultData(mergedData)
                .multiIntentResult(true)
                .metadata(Map.of(
                        "multiIntent", true,
                        "intentCount", results.size()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }
}
