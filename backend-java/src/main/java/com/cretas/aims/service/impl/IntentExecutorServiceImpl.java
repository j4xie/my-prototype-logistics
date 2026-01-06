package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.cache.SemanticCacheHit;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentSemantics;
import com.cretas.aims.dto.intent.IntentValidationFact;
import com.cretas.aims.dto.intent.ValidationResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.exception.LlmSchemaValidationException;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.IntentExecutorService;
import com.cretas.aims.service.IntentSemanticsParser;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.cretas.aims.service.RuleEngineService;
import com.cretas.aims.service.SemanticCacheService;
import com.cretas.aims.service.handler.IntentHandler;
import com.cretas.aims.util.ErrorSanitizer;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AI意图执行服务实现
 *
 * 负责编排意图识别、权限校验和处理器路由
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Service
public class IntentExecutorServiceImpl implements IntentExecutorService {

    private final AIIntentService aiIntentService;
    private final List<IntentHandler> handlers;
    private final IntentSemanticsParser semanticsParser;
    private final SemanticCacheService semanticCacheService;
    private final RuleEngineService ruleEngineService;
    private final LlmIntentFallbackClient llmFallbackClient;
    private final ObjectMapper objectMapper;

    // 处理器映射表: category -> handler
    private final Map<String, IntentHandler> handlerMap = new HashMap<>();

    // SSE 异步执行器
    private final ExecutorService sseExecutor = Executors.newCachedThreadPool();

    // SSE 超时时间 (2分钟)
    private static final long SSE_TIMEOUT_MS = 120_000L;

    @Autowired
    public IntentExecutorServiceImpl(AIIntentService aiIntentService,
                                     List<IntentHandler> handlers,
                                     IntentSemanticsParser semanticsParser,
                                     SemanticCacheService semanticCacheService,
                                     RuleEngineService ruleEngineService,
                                     @Lazy LlmIntentFallbackClient llmFallbackClient,
                                     ObjectMapper objectMapper) {
        this.aiIntentService = aiIntentService;
        this.handlers = handlers;
        this.semanticsParser = semanticsParser;
        this.semanticCacheService = semanticCacheService;
        this.ruleEngineService = ruleEngineService;
        this.llmFallbackClient = llmFallbackClient;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        // 初始化处理器映射
        for (IntentHandler handler : handlers) {
            String category = handler.getSupportedCategory();
            handlerMap.put(category, handler);
            log.info("注册意图处理器: category={}, handler={}", category, handler.getClass().getSimpleName());
        }
        log.info("意图执行器初始化完成，共注册 {} 个处理器", handlerMap.size());
    }

    @PreDestroy
    public void destroy() {
        log.info("关闭 SSE 执行器线程池...");
        sseExecutor.shutdown();
    }

    @Override
    public IntentExecuteResponse execute(String factoryId, IntentExecuteRequest request,
                                         Long userId, String userRole) {

        log.info("执行意图: factoryId={}, userInput={}, intentCode={}, userId={}, role={}",
                factoryId,
                request.getUserInput() != null && request.getUserInput().length() > 50 ?
                        request.getUserInput().substring(0, 50) + "..." : request.getUserInput(),
                request.getIntentCode(),
                userId, userRole);

        // 0. 检查是否显式指定了意图代码 (跳过识别)
        if (request.getIntentCode() != null && !request.getIntentCode().isEmpty()) {
            return executeWithExplicitIntent(factoryId, request, userId, userRole);
        }

        // 0.5. 查询语义缓存 (提升响应速度)
        String userInput = request.getUserInput();
        if (userInput != null && !userInput.isEmpty()) {
            try {
                SemanticCacheHit cacheHit = semanticCacheService.queryCache(factoryId, userInput);
                if (cacheHit.isHit()) {
                    log.info("语义缓存命中: factoryId={}, hitType={}, latencyMs={}",
                            factoryId, cacheHit.getHitType(), cacheHit.getLatencyMs());

                    // 如果有完整执行结果，直接返回
                    if (cacheHit.hasExecutionResult()) {
                        IntentExecuteResponse cachedResponse = deserializeExecutionResult(cacheHit.getExecutionResult());
                        if (cachedResponse != null) {
                            cachedResponse.setFromCache(true);
                            cachedResponse.setCacheHitType(cacheHit.getHitType() != null ? cacheHit.getHitType().name() : null);
                            return cachedResponse;
                        }
                    }

                    // 如果只有意图识别结果，跳过识别阶段，直接使用缓存的意图
                    IntentMatchResult cachedMatch = deserializeIntentResult(cacheHit.getIntentResult());
                    if (cachedMatch != null && cachedMatch.hasMatch()) {
                        AIIntentConfig cachedIntent = cachedMatch.getBestMatch();
                        log.debug("从缓存获取意图识别结果: intentCode={}", cachedIntent.getIntentCode());
                        // 设置缓存命中标记到 context
                        if (request.getContext() == null) {
                            request.setContext(new HashMap<>());
                        }
                        request.getContext().put("__cacheHit", true);
                        request.getContext().put("__cacheHitType", cacheHit.getHitType() != null ? cacheHit.getHitType().name() : "SEMANTIC");
                    }
                }
            } catch (Exception e) {
                log.warn("语义缓存查询失败，继续正常流程: {}", e.getMessage());
            }
        }

        // 1. 识别意图 (使用带 LLM Fallback 的方法)
        // 包含 LLM Schema 验证异常处理 (R3: 校验失败不执行，反问用户)
        IntentMatchResult matchResult;
        try {
            matchResult = aiIntentService.recognizeIntentWithConfidence(
                    request.getUserInput(), factoryId, 3);
        } catch (LlmSchemaValidationException e) {
            // LLM Schema 校验失败 → 不执行，反问用户确认
            log.warn("LLM Schema 验证失败: type={}, message={}, userInput='{}'",
                    e.getFailureType(), e.getMessage(),
                    request.getUserInput() != null && request.getUserInput().length() > 30 ?
                            request.getUserInput().substring(0, 30) + "..." : request.getUserInput());

            return buildValidationFailureResponse(factoryId, request.getUserInput(), e);
        }

        // 2. 检查是否需要二次确认（低置信度或有歧义）
        if (matchResult.hasMatch() && Boolean.TRUE.equals(matchResult.getRequiresConfirmation())
                && !Boolean.TRUE.equals(request.getForceExecute())) {
            AIIntentConfig matchedIntent = matchResult.getBestMatch();
            log.info("需要二次确认: intentCode={}, confidence={}, isStrongSignal={}",
                    matchedIntent.getIntentCode(), matchResult.getConfidence(), matchResult.getIsStrongSignal());

            // 构建候选意图列表供用户选择
            List<IntentExecuteResponse.SuggestedAction> candidateActions = buildCandidateActions(matchResult, factoryId);

            String clarificationMessage = matchResult.getClarificationQuestion();
            if (clarificationMessage == null || clarificationMessage.isEmpty()) {
                clarificationMessage = "您的请求可能匹配多个操作，请确认您想要执行的操作：";
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(matchedIntent.getIntentCode())
                    .intentName(matchedIntent.getIntentName())
                    .intentCategory(matchedIntent.getIntentCategory())
                    .status("NEED_CLARIFICATION")
                    .message(clarificationMessage)
                    .confidence(matchResult.getConfidence())
                    .matchMethod(matchResult.getMatchMethod() != null ? matchResult.getMatchMethod().name() : null)
                    .suggestedActions(candidateActions)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 3. 处理无匹配但有候选意图的情况（弱信号）
        if (!matchResult.hasMatch()) {
            // 检查是否有候选意图可供选择
            if (matchResult.getTopCandidates() != null && !matchResult.getTopCandidates().isEmpty()) {
                log.info("弱信号匹配，提供候选选择: userInput={}, candidateCount={}",
                        request.getUserInput(), matchResult.getTopCandidates().size());

                List<IntentExecuteResponse.SuggestedAction> candidateActions = buildCandidateActions(matchResult, factoryId);

                return IntentExecuteResponse.builder()
                        .intentRecognized(false)
                        .status("NEED_CLARIFICATION")
                        .message("我不太确定您想执行什么操作，请从以下选项中选择或更详细地描述您的需求：")
                        .suggestedActions(candidateActions)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            log.info("未识别到意图 (规则+LLM均未匹配): userInput={}", request.getUserInput());
            // 即使没有候选意图，也返回 NEED_CLARIFICATION 状态，提供常用操作建议
            List<IntentExecuteResponse.SuggestedAction> defaultSuggestions = buildDefaultSuggestions(factoryId);
            return IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("NEED_CLARIFICATION")
                    .message("我没有理解您的意图，请从以下常用操作中选择，或更详细地描述您的需求：")
                    .executedAt(LocalDateTime.now())
                    .suggestedActions(defaultSuggestions)
                    .build();
        }

        AIIntentConfig intent = matchResult.getBestMatch();
        log.info("识别到意图: code={}, category={}, sensitivity={}, matchMethod={}, confidence={}",
                intent.getIntentCode(), intent.getIntentCategory(), intent.getSensitivityLevel(),
                matchResult.getMatchMethod(), matchResult.getConfidence());

        // 2. 权限检查
        if (!aiIntentService.hasPermission(intent.getIntentCode(), userRole)) {
            log.warn("权限不足: intentCode={}, userRole={}", intent.getIntentCode(), userRole);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .sensitivityLevel(intent.getSensitivityLevel())
                    .status("NO_PERMISSION")
                    .message("您没有权限执行此操作。需要角色: " + intent.getRequiredRoles())
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 3. 审批检查
        if (intent.needsApproval() && !Boolean.TRUE.equals(request.getForceExecute())) {
            log.info("需要审批: intentCode={}", intent.getIntentCode());
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .sensitivityLevel(intent.getSensitivityLevel())
                    .status("PENDING_APPROVAL")
                    .message("此操作需要审批，已提交审批请求")
                    .requiresApproval(true)
                    .approvalChainId(intent.getApprovalChainId())
                    // TODO: 创建审批请求并返回ID
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // ====== DROOLS GATEWAY: 意图级业务规则验证 ======
        ValidationResult validationResult = validateWithDrools(factoryId, intent, request, userId, userRole);
        if (!validationResult.isValid()) {
            log.warn("Drools规则验证失败: intentCode={}, violations={}",
                    intent.getIntentCode(), validationResult.getViolations().size());
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .status("VALIDATION_FAILED")
                    .message("业务规则验证未通过: " + validationResult.getViolationsSummary())
                    .validationViolations(validationResult.getViolations())
                    .recommendations(validationResult.getRecommendations())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
        log.debug("Drools规则验证通过: intentCode={}", intent.getIntentCode());

        // 4. 路由到处理器
        String category = intent.getIntentCategory();
        IntentHandler handler = handlerMap.get(category);

        if (handler == null) {
            log.warn("未找到处理器: category={}", category);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(category)
                    .status("FAILED")
                    .message("暂不支持此类型的意图执行: " + category)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 5. 预览模式
        if (Boolean.TRUE.equals(request.getPreviewOnly())) {
            return handler.preview(factoryId, request, intent, userId, userRole);
        }

        // 6. 执行 - 优先使用语义模式
        IntentExecuteResponse response = executeWithHandler(handler, factoryId, request, intent, userId, userRole);

        // 6.5. 检查是否需要更多信息，生成澄清问题
        if ("NEED_MORE_INFO".equals(response.getStatus())) {
            response = enrichWithClarificationQuestions(response, request, intent, factoryId);
        }

        // 7. 处理缓存：标记缓存命中和写入新结果
        processResponseCaching(factoryId, request, matchResult, response);

        return response;
    }

    /**
     * 使用Handler执行意图（支持语义模式）
     */
    private IntentExecuteResponse executeWithHandler(IntentHandler handler, String factoryId,
                                                      IntentExecuteRequest request,
                                                      AIIntentConfig intent,
                                                      Long userId, String userRole) {
        // 检查Handler是否支持语义模式
        if (handler.supportsSemanticsMode()) {
            try {
                // 解析语义
                IntentSemantics semantics = semanticsParser.parse(request, intent, factoryId);
                log.debug("使用语义模式执行: intent={}, semanticPath={}",
                        intent.getIntentCode(), semantics.getSemanticPath());
                return handler.handleWithSemantics(factoryId, semantics, intent, userId, userRole);
            } catch (Exception e) {
                log.warn("语义模式执行失败，回退到传统模式: intent={}, error={}",
                        intent.getIntentCode(), e.getMessage());
                // 回退到传统模式
            }
        }

        // 传统模式
        return handler.handle(factoryId, request, intent, userId, userRole);
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         Long userId, String userRole) {
        // 强制设置预览模式
        request.setPreviewOnly(true);
        return execute(factoryId, request, userId, userRole);
    }

    @Override
    public IntentExecuteResponse confirm(String factoryId, String confirmToken,
                                         Long userId, String userRole) {
        // TODO: 从缓存中获取预览数据，执行确认操作
        log.info("确认执行: factoryId={}, confirmToken={}", factoryId, confirmToken);

        return IntentExecuteResponse.builder()
                .status("FAILED")
                .message("确认功能暂未实现，请直接执行")
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * SSE 流式执行意图
     *
     * 提供实时进度反馈，包括：
     * - start: 开始处理
     * - cache_hit / cache_miss: 语义缓存命中/未命中
     * - intent_recognized: 意图识别完成
     * - executing: 开始执行
     * - result: 执行结果
     * - complete: 完成
     * - error: 错误
     *
     * @param factoryId 工厂ID
     * @param request   请求
     * @param userId    用户ID
     * @param userRole  用户角色
     * @return SseEmitter 流式响应
     */
    @Override
    public SseEmitter executeStream(String factoryId, IntentExecuteRequest request,
                                     Long userId, String userRole) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);

        // 设置回调
        emitter.onCompletion(() -> log.debug("SSE connection completed: factoryId={}", factoryId));
        emitter.onTimeout(() -> log.warn("SSE connection timeout: factoryId={}", factoryId));
        emitter.onError(e -> log.error("SSE connection error: factoryId={}", factoryId, e));

        // 异步执行
        sseExecutor.execute(() -> executeStreamAsync(emitter, factoryId, request, userId, userRole));

        return emitter;
    }

    /**
     * 异步执行流式意图处理
     */
    private void executeStreamAsync(SseEmitter emitter, String factoryId,
                                     IntentExecuteRequest request, Long userId, String userRole) {
        try {
            long startTime = System.currentTimeMillis();

            // 1. 开始事件
            sendSseEvent(emitter, "start", Map.of(
                    "message", "开始处理...",
                    "timestamp", LocalDateTime.now().toString()
            ));

            String userInput = request.getUserInput();

            // 2. 查询语义缓存
            SemanticCacheHit cacheHit = semanticCacheService.queryCache(factoryId, userInput);

            if (cacheHit.isHit()) {
                // 缓存命中
                sendSseEvent(emitter, "cache_hit", Map.of(
                        "hitType", cacheHit.getHitType(),
                        "similarity", cacheHit.getSimilarity() != null ? cacheHit.getSimilarity() : 1.0,
                        "latencyMs", cacheHit.getLatencyMs()
                ));

                // 如果有执行结果，直接返回
                if (cacheHit.hasExecutionResult()) {
                    // 解析缓存的执行结果
                    IntentExecuteResponse cachedResponse = deserializeExecutionResult(
                            cacheHit.getExecutionResult());

                    if (cachedResponse != null) {
                        sendSseEvent(emitter, "result", cachedResponse);
                        sendSseEvent(emitter, "complete", Map.of(
                                "status", "SUCCESS",
                                "cacheHit", true,
                                "totalLatencyMs", System.currentTimeMillis() - startTime
                        ));
                        emitter.complete();
                        return;
                    }
                }

                // 缓存中只有意图识别结果，需要执行
                IntentMatchResult cachedMatch = deserializeIntentResult(cacheHit.getIntentResult());
                if (cachedMatch != null && cachedMatch.hasMatch()) {
                    sendSseEvent(emitter, "intent_recognized", Map.of(
                            "intentCode", cachedMatch.getBestMatch().getIntentCode(),
                            "intentName", cachedMatch.getBestMatch().getIntentName(),
                            "confidence", cachedMatch.getConfidence(),
                            "matchMethod", "CACHE"
                    ));

                    // 执行意图
                    executeAndStreamResult(emitter, factoryId, request, cachedMatch.getBestMatch(),
                            userId, userRole, startTime, cachedMatch);
                    return;
                }
            }

            // 3. 缓存未命中
            sendSseEvent(emitter, "cache_miss", Map.of(
                    "latencyMs", cacheHit.getLatencyMs()
            ));

            // 4. 意图识别
            sendSseEvent(emitter, "progress", Map.of(
                    "stage", "intent_recognition",
                    "message", "正在识别意图..."
            ));

            IntentMatchResult matchResult;
            try {
                matchResult = aiIntentService.recognizeIntentWithConfidence(userInput, factoryId, 3);
            } catch (LlmSchemaValidationException e) {
                // 验证失败
                IntentExecuteResponse validationFailureResponse = buildValidationFailureResponse(
                        factoryId, userInput, e);
                sendSseEvent(emitter, "result", validationFailureResponse);
                sendSseEvent(emitter, "complete", Map.of(
                        "status", "VALIDATION_FAILED",
                        "cacheHit", false,
                        "totalLatencyMs", System.currentTimeMillis() - startTime
                ));
                emitter.complete();
                return;
            }

            // 5. 处理识别结果
            if (!matchResult.hasMatch()) {
                // 未识别到意图
                IntentExecuteResponse noMatchResponse = buildNoMatchResponse(matchResult, factoryId);
                sendSseEvent(emitter, "result", noMatchResponse);
                sendSseEvent(emitter, "complete", Map.of(
                        "status", "NO_MATCH",
                        "cacheHit", false,
                        "totalLatencyMs", System.currentTimeMillis() - startTime
                ));
                emitter.complete();
                return;
            }

            AIIntentConfig intent = matchResult.getBestMatch();
            sendSseEvent(emitter, "intent_recognized", Map.of(
                    "intentCode", intent.getIntentCode(),
                    "intentName", intent.getIntentName(),
                    "intentCategory", intent.getIntentCategory(),
                    "confidence", matchResult.getConfidence(),
                    "matchMethod", matchResult.getMatchMethod() != null ? matchResult.getMatchMethod().name() : "UNKNOWN"
            ));

            // 6. 需要确认的情况
            if (Boolean.TRUE.equals(matchResult.getRequiresConfirmation())
                    && !Boolean.TRUE.equals(request.getForceExecute())) {
                IntentExecuteResponse clarificationResponse = buildClarificationResponse(matchResult, factoryId);
                sendSseEvent(emitter, "result", clarificationResponse);
                sendSseEvent(emitter, "complete", Map.of(
                        "status", "NEED_CLARIFICATION",
                        "cacheHit", false,
                        "totalLatencyMs", System.currentTimeMillis() - startTime
                ));
                emitter.complete();
                return;
            }

            // 7. 执行意图
            executeAndStreamResult(emitter, factoryId, request, intent, userId, userRole, startTime, matchResult);

        } catch (Exception e) {
            log.error("SSE 执行失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            try {
                // 使用脱敏后的错误信息返回给前端
                sendSseEvent(emitter, "error", Map.of(
                        "message", ErrorSanitizer.sanitize(e),
                        "type", ErrorSanitizer.getSafeTypeName(e)
                ));
            } catch (Exception ignored) {
            }
            emitter.completeWithError(e);
        }
    }

    /**
     * 执行意图并流式返回结果
     */
    private void executeAndStreamResult(SseEmitter emitter, String factoryId,
                                          IntentExecuteRequest request, AIIntentConfig intent,
                                          Long userId, String userRole, long startTime,
                                          IntentMatchResult matchResult) throws IOException {
        // 权限检查
        if (!aiIntentService.hasPermission(intent.getIntentCode(), userRole)) {
            IntentExecuteResponse noPermissionResponse = IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .status("NO_PERMISSION")
                    .message("您没有权限执行此操作。需要角色: " + intent.getRequiredRoles())
                    .executedAt(LocalDateTime.now())
                    .build();
            sendSseEvent(emitter, "result", noPermissionResponse);
            sendSseEvent(emitter, "complete", Map.of(
                    "status", "NO_PERMISSION",
                    "totalLatencyMs", System.currentTimeMillis() - startTime
            ));
            emitter.complete();
            return;
        }

        // 审批检查
        if (intent.needsApproval() && !Boolean.TRUE.equals(request.getForceExecute())) {
            IntentExecuteResponse approvalResponse = IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .status("PENDING_APPROVAL")
                    .message("此操作需要审批，已提交审批请求")
                    .requiresApproval(true)
                    .executedAt(LocalDateTime.now())
                    .build();
            sendSseEvent(emitter, "result", approvalResponse);
            sendSseEvent(emitter, "complete", Map.of(
                    "status", "PENDING_APPROVAL",
                    "totalLatencyMs", System.currentTimeMillis() - startTime
            ));
            emitter.complete();
            return;
        }

        // 发送执行中事件
        sendSseEvent(emitter, "executing", Map.of(
                "intentCode", intent.getIntentCode(),
                "intentName", intent.getIntentName()
        ));

        // 路由到处理器执行
        String category = intent.getIntentCategory();
        IntentHandler handler = handlerMap.get(category);

        IntentExecuteResponse response;
        if (handler == null) {
            response = IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .status("FAILED")
                    .message("暂不支持此类型的意图执行: " + category)
                    .executedAt(LocalDateTime.now())
                    .build();
        } else {
            response = executeWithHandler(handler, factoryId, request, intent, userId, userRole);
        }

        // 发送结果
        sendSseEvent(emitter, "result", response);

        // 缓存结果 (仅成功执行的结果)
        if ("COMPLETED".equals(response.getStatus())) {
            try {
                semanticCacheService.cacheResult(factoryId, request.getUserInput(), matchResult, response);
                log.debug("已缓存意图执行结果: factoryId={}, userInput={}", factoryId, request.getUserInput());
            } catch (Exception e) {
                log.warn("缓存执行结果失败: {}", e.getMessage());
            }
        }

        // 完成
        sendSseEvent(emitter, "complete", Map.of(
                "status", response.getStatus(),
                "cacheHit", false,
                "totalLatencyMs", System.currentTimeMillis() - startTime
        ));
        emitter.complete();
    }

    /**
     * 发送 SSE 事件
     */
    private void sendSseEvent(SseEmitter emitter, String eventName, Object data) throws IOException {
        try {
            String json = objectMapper.writeValueAsString(data);
            emitter.send(SseEmitter.event()
                    .name(eventName)
                    .data(json));
        } catch (JsonProcessingException e) {
            log.warn("序列化 SSE 事件数据失败: {}", e.getMessage());
            throw new IOException("Failed to serialize SSE event data", e);
        }
    }

    /**
     * 反序列化缓存的执行结果
     */
    private IntentExecuteResponse deserializeExecutionResult(String json) {
        if (json == null || json.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, IntentExecuteResponse.class);
        } catch (JsonProcessingException e) {
            log.warn("反序列化执行结果失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 反序列化缓存的意图识别结果
     */
    private IntentMatchResult deserializeIntentResult(String json) {
        if (json == null || json.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, IntentMatchResult.class);
        } catch (JsonProcessingException e) {
            log.warn("反序列化意图结果失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 构建无匹配响应
     */
    private IntentExecuteResponse buildNoMatchResponse(IntentMatchResult matchResult, String factoryId) {
        if (matchResult.getTopCandidates() != null && !matchResult.getTopCandidates().isEmpty()) {
            List<IntentExecuteResponse.SuggestedAction> candidateActions = buildCandidateActions(matchResult, factoryId);
            return IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("NEED_CLARIFICATION")
                    .message("我不太确定您想执行什么操作，请从以下选项中选择或更详细地描述您的需求：")
                    .suggestedActions(candidateActions)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        List<IntentExecuteResponse.SuggestedAction> defaultSuggestions = buildDefaultSuggestions(factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(false)
                .status("NEED_CLARIFICATION")
                .message("我没有理解您的意图，请从以下常用操作中选择，或更详细地描述您的需求：")
                .suggestedActions(defaultSuggestions)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 构建需要澄清的响应
     */
    private IntentExecuteResponse buildClarificationResponse(IntentMatchResult matchResult, String factoryId) {
        AIIntentConfig matchedIntent = matchResult.getBestMatch();
        List<IntentExecuteResponse.SuggestedAction> candidateActions = buildCandidateActions(matchResult, factoryId);

        String clarificationMessage = matchResult.getClarificationQuestion();
        if (clarificationMessage == null || clarificationMessage.isEmpty()) {
            clarificationMessage = "您的请求可能匹配多个操作，请确认您想要执行的操作：";
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(matchedIntent.getIntentCode())
                .intentName(matchedIntent.getIntentName())
                .intentCategory(matchedIntent.getIntentCategory())
                .status("NEED_CLARIFICATION")
                .message(clarificationMessage)
                .confidence(matchResult.getConfidence())
                .matchMethod(matchResult.getMatchMethod() != null ? matchResult.getMatchMethod().name() : null)
                .suggestedActions(candidateActions)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 构建候选意图的建议操作列表
     */
    private List<IntentExecuteResponse.SuggestedAction> buildCandidateActions(
            IntentMatchResult matchResult, String factoryId) {

        List<IntentExecuteResponse.SuggestedAction> actions = new java.util.ArrayList<>();

        // 添加候选意图作为可选操作
        if (matchResult.getTopCandidates() != null) {
            for (IntentMatchResult.CandidateIntent candidate : matchResult.getTopCandidates()) {
                // 最多显示3个候选
                if (actions.size() >= 3) break;

                Map<String, Object> params = new HashMap<>();
                params.put("intentCode", candidate.getIntentCode());
                params.put("forceExecute", true);

                actions.add(IntentExecuteResponse.SuggestedAction.builder()
                        .actionCode("SELECT_INTENT")
                        .actionName(candidate.getIntentName())
                        .description(candidate.getDescription() != null ? candidate.getDescription() :
                                String.format("置信度: %.0f%%", candidate.getConfidence() * 100))
                        .endpoint("/api/mobile/" + factoryId + "/ai-intents/execute")
                        .parameters(params)
                        .build());
            }
        }

        // 添加重新描述选项
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("REPHRASE")
                .actionName("重新描述")
                .description("请更详细地描述您想要执行的操作")
                .build());

        // 添加查看所有意图选项
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("SHOW_INTENTS")
                .actionName("查看所有可用操作")
                .description("查看系统支持的所有意图类型")
                .endpoint("/api/mobile/" + factoryId + "/ai-intents")
                .build());

        return actions;
    }

    /**
     * 构建默认的常用操作建议列表
     * 当规则和LLM都无法识别意图时，提供常用操作供用户选择
     */
    private List<IntentExecuteResponse.SuggestedAction> buildDefaultSuggestions(String factoryId) {
        List<IntentExecuteResponse.SuggestedAction> actions = new java.util.ArrayList<>();

        // 常用查询操作
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("MATERIAL_BATCH_QUERY")
                .actionName("查询原料库存")
                .description("查看原材料批次的库存情况")
                .endpoint("/api/mobile/" + factoryId + "/material-batches")
                .build());

        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("PROCESSING_BATCH_LIST")
                .actionName("查询生产批次")
                .description("查看当前的生产批次列表")
                .endpoint("/api/mobile/" + factoryId + "/processing/batches")
                .build());

        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("QUALITY_CHECK_LIST")
                .actionName("质检任务")
                .description("查看待处理的质检任务")
                .endpoint("/api/mobile/" + factoryId + "/quality-checks")
                .build());

        // 添加重新描述选项
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("REPHRASE")
                .actionName("重新描述")
                .description("请更详细地描述您想要执行的操作")
                .build());

        // 添加查看所有意图选项
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("SHOW_INTENTS")
                .actionName("查看所有可用操作")
                .description("查看系统支持的所有意图类型")
                .endpoint("/api/mobile/" + factoryId + "/ai-intents")
                .build());

        return actions;
    }

    /**
     * 使用显式指定的意图代码执行 (跳过意图识别)
     */
    private IntentExecuteResponse executeWithExplicitIntent(String factoryId, IntentExecuteRequest request,
                                                            Long userId, String userRole) {
        String intentCode = request.getIntentCode();
        log.info("使用显式意图代码执行: intentCode={}, factoryId={}", intentCode, factoryId);

        // 1. 根据意图代码查找配置
        Optional<AIIntentConfig> intentOpt = aiIntentService.getIntentByCode(factoryId, intentCode);
        if (intentOpt.isEmpty()) {
            log.warn("未找到意图配置: intentCode={}", intentCode);
            return IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("FAILED")
                    .message("未找到意图配置: " + intentCode)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        AIIntentConfig intent = intentOpt.get();
        log.info("找到意图配置: code={}, category={}, name={}",
                intent.getIntentCode(), intent.getIntentCategory(), intent.getIntentName());

        // 2. 权限检查
        if (!aiIntentService.hasPermission(intent.getIntentCode(), userRole)) {
            log.warn("权限不足: intentCode={}, userRole={}", intent.getIntentCode(), userRole);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .sensitivityLevel(intent.getSensitivityLevel())
                    .status("NO_PERMISSION")
                    .message("您没有权限执行此操作。需要角色: " + intent.getRequiredRoles())
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 3. 审批检查
        if (intent.needsApproval() && !Boolean.TRUE.equals(request.getForceExecute())) {
            log.info("需要审批: intentCode={}", intent.getIntentCode());
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .sensitivityLevel(intent.getSensitivityLevel())
                    .status("PENDING_APPROVAL")
                    .message("此操作需要审批，已提交审批请求")
                    .requiresApproval(true)
                    .approvalChainId(intent.getApprovalChainId())
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 4. 路由到处理器
        String category = intent.getIntentCategory();
        IntentHandler handler = handlerMap.get(category);

        if (handler == null) {
            log.warn("未找到处理器: category={}", category);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(category)
                    .status("FAILED")
                    .message("暂不支持此类型的意图执行: " + category)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 5. 预览模式
        if (Boolean.TRUE.equals(request.getPreviewOnly())) {
            return handler.preview(factoryId, request, intent, userId, userRole);
        }

        // 6. 执行 - 优先使用语义模式
        log.info("显式意图执行: intentCode={}, handler={}", intentCode, handler.getClass().getSimpleName());
        return executeWithHandler(handler, factoryId, request, intent, userId, userRole);
    }

    /**
     * 构建 LLM Schema 验证失败的响应
     *
     * 当 LLM 返回的响应不符合预期 Schema 时：
     * 1. 不执行任何意图
     * 2. 返回 VALIDATION_FAILED 状态
     * 3. 提供用户可选的操作（重新描述、查看常用操作、联系管理员）
     *
     * 符合 R3 要求: 校验失败不执行，反问用户 double check
     */
    private IntentExecuteResponse buildValidationFailureResponse(String factoryId, String userInput,
                                                                   LlmSchemaValidationException e) {
        // 构建用户友好的错误消息
        String clarificationMessage = buildValidationFailureMessage(userInput, e);

        // 构建建议操作
        List<IntentExecuteResponse.SuggestedAction> suggestedActions = new java.util.ArrayList<>();

        // 1. 重新描述选项
        suggestedActions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("REPHRASE")
                .actionName("重新描述您的需求")
                .description("请尝试用不同的方式描述您想要执行的操作")
                .build());

        // 2. 查看常用操作
        suggestedActions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("SHOW_INTENTS")
                .actionName("从常用操作中选择")
                .description("查看系统支持的所有意图类型")
                .endpoint("/api/mobile/" + factoryId + "/ai-intents")
                .build());

        // 3. 联系管理员（仅当验证失败类型严重时）
        if (e.getFailureType() == LlmSchemaValidationException.ValidationFailureType.PARSE_ERROR
                || e.getFailureType() == LlmSchemaValidationException.ValidationFailureType.BUSINESS_RULE_VIOLATION) {
            suggestedActions.add(IntentExecuteResponse.SuggestedAction.builder()
                    .actionCode("CONTACT_ADMIN")
                    .actionName("联系管理员")
                    .description("如果问题持续，请联系系统管理员")
                    .build());
        }

        // 构建元数据用于调试和监控
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("validationFailureType", e.getFailureType().name());
        metadata.put("validationMessage", e.getMessage());
        metadata.put("requiresDoubleCheck", true);
        if (userInput != null) {
            metadata.put("originalInput", userInput.length() > 100 ?
                    userInput.substring(0, 100) + "..." : userInput);
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(false)
                .status("VALIDATION_FAILED")
                .message(clarificationMessage)
                .suggestedActions(suggestedActions)
                .metadata(metadata)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Drools Gateway: 意图级业务规则验证
     *
     * @param factoryId 工厂ID
     * @param intent    意图配置
     * @param request   执行请求
     * @param userId    用户ID
     * @param userRole  用户角色
     * @return 验证结果
     */
    private ValidationResult validateWithDrools(String factoryId, AIIntentConfig intent,
                                                 IntentExecuteRequest request,
                                                 Long userId, String userRole) {
        try {
            // 构建意图验证事实对象
            IntentValidationFact fact = IntentValidationFact.builder()
                    .intentCategory(intent.getIntentCategory())
                    .operation(extractOperationType(intent))
                    .timestamp(LocalDateTime.now())
                    .recentOperationCount(0) // TODO: 从操作频率统计获取
                    .targetFactoryId(factoryId)
                    .currentFactoryId(factoryId)
                    .userRole(userRole)
                    .forceExecute(Boolean.TRUE.equals(request.getForceExecute()))
                    .batchSize(extractBatchSize(request))
                    .userId(userId)
                    .username(extractUsername(request))
                    .intentCode(intent.getIntentCode())
                    .entityType(extractEntityType(request))
                    .entityId(extractEntityId(request))
                    .build();

            // 调用 RuleEngineService 执行规则验证
            ValidationResult result = ruleEngineService.executeRulesWithAudit(
                    factoryId,
                    "intentValidation",  // 规则组
                    "INTENT",            // 实体类型
                    intent.getIntentCode(), // 实体ID (使用意图代码)
                    userId,              // 执行者ID
                    extractUsername(request), // 执行者名称
                    userRole,            // 执行者角色
                    fact                 // Drools 事实对象
            );

            log.debug("Drools规则验证完成: intentCode={}, valid={}, violations={}, firedRules={}",
                    intent.getIntentCode(), result.isValid(), result.getViolations().size(),
                    result.getFiredRules());

            return result;
        } catch (Exception e) {
            log.error("Drools规则验证异常: intentCode={}, error={}",
                    intent.getIntentCode(), e.getMessage(), e);
            // 验证异常时返回通过，避免阻塞业务（可根据需求调整为验证失败）
            return ValidationResult.builder()
                    .valid(true)
                    .build();
        }
    }

    /**
     * 从意图配置中提取操作类型
     */
    private String extractOperationType(AIIntentConfig intent) {
        String code = intent.getIntentCode();
        if (code.contains("CREATE") || code.contains("ADD")) return "CREATE";
        if (code.contains("UPDATE") || code.contains("MODIFY")) return "UPDATE";
        if (code.contains("DELETE") || code.contains("REMOVE")) return "DELETE";
        if (code.contains("QUERY") || code.contains("LIST") || code.contains("VIEW")) return "QUERY";
        if (code.contains("BATCH")) return "BATCH_UPDATE";
        return "QUERY"; // 默认为查询类型
    }

    /**
     * 从请求中提取批量操作的记录数
     */
    private int extractBatchSize(IntentExecuteRequest request) {
        if (request.getContext() == null) return 1;
        Object batchSize = request.getContext().get("batchSize");
        if (batchSize instanceof Integer) return (Integer) batchSize;
        if (batchSize instanceof String) {
            try {
                return Integer.parseInt((String) batchSize);
            } catch (NumberFormatException e) {
                return 1;
            }
        }
        return 1;
    }

    /**
     * 从请求中提取用户名
     */
    private String extractUsername(IntentExecuteRequest request) {
        if (request.getContext() == null) return "unknown";
        Object username = request.getContext().get("username");
        return username != null ? username.toString() : "unknown";
    }

    /**
     * 从请求中提取实体类型
     */
    private String extractEntityType(IntentExecuteRequest request) {
        if (request.getContext() == null) return null;
        Object entityType = request.getContext().get("entityType");
        return entityType != null ? entityType.toString() : null;
    }

    /**
     * 从请求中提取实体ID
     */
    private String extractEntityId(IntentExecuteRequest request) {
        if (request.getContext() == null) return null;
        Object entityId = request.getContext().get("entityId");
        return entityId != null ? entityId.toString() : null;
    }

    /**
     * 处理响应缓存：设置缓存命中标记 + 写入新缓存
     */
    private void processResponseCaching(String factoryId, IntentExecuteRequest request,
                                          IntentMatchResult matchResult, IntentExecuteResponse response) {
        try {
            // 1. 从 context 中读取缓存命中标记
            if (request.getContext() != null) {
                Object cacheHit = request.getContext().get("__cacheHit");
                if (Boolean.TRUE.equals(cacheHit)) {
                    response.setFromCache(true);
                    Object hitType = request.getContext().get("__cacheHitType");
                    response.setCacheHitType(hitType != null ? hitType.toString() : "SEMANTIC");
                    // 清理内部标记
                    request.getContext().remove("__cacheHit");
                    request.getContext().remove("__cacheHitType");
                    log.debug("从缓存命中执行完成: status={}", response.getStatus());
                    return; // 缓存命中的结果不需要再次写入
                }
            }

            // 2. 仅对成功执行的结果写入缓存
            if ("COMPLETED".equals(response.getStatus()) && request.getUserInput() != null) {
                semanticCacheService.cacheResult(factoryId, request.getUserInput(), matchResult, response);
                log.debug("已缓存意图执行结果: factoryId={}, intentCode={}",
                        factoryId, response.getIntentCode());
            }
        } catch (Exception e) {
            log.warn("处理响应缓存失败: {}", e.getMessage());
        }
    }

    /**
     * 构建验证失败的用户友好消息
     */
    private String buildValidationFailureMessage(String userInput, LlmSchemaValidationException e) {
        String truncatedInput = userInput != null && userInput.length() > 30 ?
                userInput.substring(0, 30) + "..." : userInput;

        switch (e.getFailureType()) {
            case PARSE_ERROR:
                return String.format("AI 无法正确理解您的请求「%s」，请重新描述您的需求。", truncatedInput);

            case UNKNOWN_INTENT_CODE:
                return String.format("AI 识别的操作类型无法执行，请从常用操作中选择或更详细地描述您的需求。");

            case INVALID_CONFIDENCE:
                return String.format("AI 对您的请求「%s」理解不够确定，请更详细地描述您想要执行的操作。", truncatedInput);

            case MISSING_REQUIRED_FIELD:
                return String.format("AI 无法完整理解您的请求，请补充更多信息或从常用操作中选择。");

            case BUSINESS_RULE_VIOLATION:
                return String.format("您的请求「%s」不符合业务规则，请联系管理员或重新描述。", truncatedInput);

            case UNKNOWN:
            default:
                return String.format("AI 无法准确理解您的意图「%s」，请重新描述或从常用操作中选择。", truncatedInput);
        }
    }

    /**
     * 为 NEED_MORE_INFO 响应添加澄清问题
     *
     * 当 Handler 返回 NEED_MORE_INFO 状态时，此方法会：
     * 1. 从硬编码的消息中提取缺失参数名称（括号内的内容）
     * 2. 调用 LLM 生成更友好、更具体的澄清问题
     * 3. 将生成的问题列表添加到响应中
     *
     * @param response 原始响应（包含硬编码的缺失参数消息）
     * @param request 原始请求
     * @param intent 意图配置
     * @param factoryId 工厂ID
     * @return 增强后的响应（包含 clarificationQuestions 字段）
     */
    private IntentExecuteResponse enrichWithClarificationQuestions(
            IntentExecuteResponse response,
            IntentExecuteRequest request,
            AIIntentConfig intent,
            String factoryId) {

        try {
            // 1. 从消息中提取缺失参数
            List<String> missingParams = parseMissingParameters(response.getMessage());

            if (missingParams.isEmpty()) {
                log.debug("No parameters found in NEED_MORE_INFO message, skipping clarification enrichment");
                return response;
            }

            log.info("Generating clarification questions for {} missing parameters: {}",
                    missingParams.size(), missingParams);

            // 2. 生成澄清问题
            List<String> clarificationQuestions = generateClarificationQuestionsForMissingParams(
                    missingParams,
                    request.getUserInput(),
                    intent,
                    factoryId
            );

            // 3. 构建增强的响应
            return IntentExecuteResponse.builder()
                    .intentRecognized(response.getIntentRecognized())
                    .intentCode(response.getIntentCode())
                    .intentName(response.getIntentName())
                    .intentCategory(response.getIntentCategory())
                    .status(response.getStatus())
                    .message("需要更多信息来完成此操作")
                    .clarificationQuestions(clarificationQuestions)
                    .executedAt(response.getExecutedAt())
                    .build();

        } catch (Exception e) {
            log.error("Failed to enrich clarification questions: intentCode={}, error={}",
                    intent.getIntentCode(), e.getMessage(), e);
            // 异常情况下返回原始响应（保留硬编码消息）
            return response;
        }
    }

    /**
     * 从硬编码消息中提取缺失参数名称
     *
     * 解析格式如 "请提供批次ID (batchId) 和使用数量 (quantity)" 的消息，
     * 提取括号中的参数名称。
     *
     * 示例：
     * - 输入: "请提供批次ID (batchId) 和使用数量 (quantity)"
     * - 输出: ["batchId", "quantity"]
     *
     * @param message 包含参数名称的消息
     * @return 提取的参数名称列表
     */
    private List<String> parseMissingParameters(String message) {
        List<String> params = new ArrayList<>();

        if (message == null || message.isEmpty()) {
            return params;
        }

        // 使用正则表达式提取所有括号中的内容
        Pattern pattern = Pattern.compile("\\(([^)]+)\\)");
        Matcher matcher = pattern.matcher(message);

        while (matcher.find()) {
            String param = matcher.group(1).trim();
            if (!param.isEmpty()) {
                params.add(param);
            }
        }

        log.debug("Extracted {} parameters from message: {}", params.size(), params);
        return params;
    }

    /**
     * 为缺失参数生成澄清问题
     *
     * 当前实现为简化版本，使用规则生成问题。
     * 未来可以集成 LLM 生成更自然的问题。
     *
     * @param missingParams 缺失的参数名称列表
     * @param userInput 用户原始输入
     * @param intent 意图配置
     * @param factoryId 工厂ID
     * @return 澄清问题列表
     */
    private List<String> generateClarificationQuestionsForMissingParams(
            List<String> missingParams,
            String userInput,
            AIIntentConfig intent,
            String factoryId) {

        List<String> questions = new ArrayList<>();

        // 为每个缺失参数生成一个问题
        for (String param : missingParams) {
            String question = generateQuestionForParameter(param, intent);
            questions.add(question);
        }

        // 如果有多个参数，添加一个总结性问题
        if (missingParams.size() > 1) {
            questions.add("请提供以上所有必需信息，以便我能够帮您完成操作。");
        }

        return questions;
    }

    /**
     * 为单个参数生成澄清问题
     *
     * 根据参数名称和意图上下文，生成用户友好的问题。
     *
     * @param paramName 参数名称
     * @param intent 意图配置
     * @return 生成的问题
     */
    private String generateQuestionForParameter(String paramName, AIIntentConfig intent) {
        // 参数名称到友好问题的映射
        String lowerParam = paramName.toLowerCase();

        // 批次相关
        if (lowerParam.contains("batchid")) {
            return "请问您要操作哪个批次？请提供批次ID或批次号。";
        } else if (lowerParam.contains("batchnumber")) {
            return "请问批次号是多少？";
        }

        // 数量相关
        else if (lowerParam.contains("quantity")) {
            return "请问数量是多少？";
        } else if (lowerParam.contains("newquantity")) {
            return "请问要调整到多少数量？";
        }

        // ID相关
        else if (lowerParam.contains("materialtypeid")) {
            return "请问是哪种原材料？请提供原材料类型ID。";
        } else if (lowerParam.contains("productid")) {
            return "请问是哪个产品？请提供产品ID。";
        } else if (lowerParam.contains("customerid")) {
            return "请问是哪个客户？请提供客户ID或客户名称。";
        } else if (lowerParam.contains("shipmentid")) {
            return "请问是哪个出货记录？请提供出货记录ID。";
        }

        // 日期相关
        else if (lowerParam.contains("startdate")) {
            return "请问查询的起始日期是？格式：yyyy-MM-dd";
        } else if (lowerParam.contains("enddate")) {
            return "请问查询的结束日期是？格式：yyyy-MM-dd";
        } else if (lowerParam.contains("date")) {
            return "请问日期是？格式：yyyy-MM-dd";
        }

        // 原因/备注
        else if (lowerParam.contains("reason")) {
            return "请说明操作原因。";
        } else if (lowerParam.contains("note") || lowerParam.contains("remark")) {
            return "请提供备注信息。";
        }

        // 状态
        else if (lowerParam.contains("status")) {
            return "请问要设置为什么状态？";
        }

        // 通用处理
        else {
            // 将驼峰命名转换为更友好的显示
            String friendlyName = convertCamelCaseToFriendly(paramName);
            return String.format("请提供 %s。", friendlyName);
        }
    }

    /**
     * 将驼峰命名转换为友好的显示名称
     *
     * 例如：
     * - batchId -> 批次ID
     * - materialTypeId -> 原材料类型ID
     *
     * @param camelCase 驼峰命名的参数名
     * @return 友好的显示名称
     */
    private String convertCamelCaseToFriendly(String camelCase) {
        if (camelCase == null || camelCase.isEmpty()) {
            return "参数";
        }

        // 简单实现：在大写字母前添加空格
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < camelCase.length(); i++) {
            char c = camelCase.charAt(i);
            if (i > 0 && Character.isUpperCase(c)) {
                result.append(' ');
            }
            result.append(c);
        }

        return result.toString();
    }
}
