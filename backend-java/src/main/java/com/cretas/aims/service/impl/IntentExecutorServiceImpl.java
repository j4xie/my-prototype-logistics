package com.cretas.aims.service.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.config.IntentKnowledgeBase;
import com.cretas.aims.config.IntentKnowledgeBase.QuestionType;
import com.cretas.aims.config.TimeNormalizationRules;
import com.cretas.aims.entity.AIAnalysisResult;
import com.cretas.aims.repository.AIAnalysisResultRepository;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.cache.SemanticCacheHit;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentSemantics;
import com.cretas.aims.dto.intent.IntentValidationFact;
import com.cretas.aims.dto.intent.ValidationResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.conversation.ConversationSession;
import com.cretas.aims.exception.LlmSchemaValidationException;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.ConversationService;
import com.cretas.aims.service.IntentExecutorService;
import com.cretas.aims.service.IntentSemanticsParser;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.cretas.aims.service.RuleEngineService;
import com.cretas.aims.service.SemanticCacheService;
import com.cretas.aims.service.ConversationMemoryService;
import com.cretas.aims.service.ToolRouterService;
import com.cretas.aims.service.ResultValidatorService;
import com.cretas.aims.service.ParameterExtractionLearningService;
import com.cretas.aims.service.AnalysisRouterService;
import com.cretas.aims.service.ComplexityRouter;
import com.cretas.aims.service.AgentOrchestrator;
import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.AnalysisResult;
import com.cretas.aims.dto.ai.AnalysisTopic;
import com.cretas.aims.dto.ai.ProcessingMode;
import com.cretas.aims.service.handler.IntentHandler;
import com.cretas.aims.dto.ai.PreprocessedQuery;
import com.cretas.aims.dto.conversation.ConversationContext;
import com.cretas.aims.dto.conversation.ConversationMessage;
import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.util.ErrorSanitizer;
import com.cretas.aims.service.calibration.ToolCallRedundancyService;
import com.cretas.aims.service.calibration.BehaviorCalibrationService;
import com.cretas.aims.service.calibration.SelfCorrectionService;
import com.cretas.aims.service.calibration.CorrectionAgentService;
import com.cretas.aims.service.calibration.ExternalVerifierService;
import com.cretas.aims.service.calibration.ToolResultValidatorService;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
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
    private final ConversationService conversationService;
    private final ObjectMapper objectMapper;
    private final DashScopeClient dashScopeClient;
    private final DashScopeConfig dashScopeConfig;
    private final IntentKnowledgeBase knowledgeBase;
    private final AIAnalysisResultRepository analysisResultRepository;

    // 新增：对话记忆服务
    private final ConversationMemoryService conversationMemoryService;

    // 新增：工具路由服务
    private final ToolRouterService toolRouterService;

    // 新增：结果验证服务
    private final ResultValidatorService resultValidatorService;

    // 新增：参数提取规则学习服务
    private final ParameterExtractionLearningService parameterExtractionLearningService;

    // 新增：分析路由服务 (v7.0)
    private final AnalysisRouterService analysisRouterService;

    // 新增：复杂度路由服务 (v7.0 Agentic RAG)
    private final ComplexityRouter complexityRouter;

    // 新增：多Agent编排服务 (v7.0 Agentic RAG)
    private final AgentOrchestrator agentOrchestrator;

    // 新增：行为校准服务 (ET-Agent)
    private final ToolCallRedundancyService redundancyService;
    private final BehaviorCalibrationService calibrationService;
    private final SelfCorrectionService selfCorrectionService;

    // 新增：CRITIC-style 纠错 Agent
    private final CorrectionAgentService correctionAgentService;
    private final ExternalVerifierService externalVerifierService;

    // 新增：工具结果验证器（扩展纠错触发条件）
    private final ToolResultValidatorService toolResultValidatorService;

    // 处理器映射表: category -> handler
    private final Map<String, IntentHandler> handlerMap = new HashMap<>();

    // Tool 注册中心（新架构）
    private final ToolRegistry toolRegistry;

    // SSE 异步执行器
    private final ExecutorService sseExecutor = Executors.newCachedThreadPool();

    // SSE 超时时间 (2分钟)
    private static final long SSE_TIMEOUT_MS = 120_000L;

    // 新增：多意图执行开关
    @Value("${cretas.ai.multi-intent.enabled:true}")
    private boolean multiIntentEnabled;

    // 新增：结果验证开关
    @Value("${cretas.ai.validation.enabled:true}")
    private boolean validationEnabled;

    @Autowired
    public IntentExecutorServiceImpl(AIIntentService aiIntentService,
                                     List<IntentHandler> handlers,
                                     IntentSemanticsParser semanticsParser,
                                     SemanticCacheService semanticCacheService,
                                     RuleEngineService ruleEngineService,
                                     @Lazy LlmIntentFallbackClient llmFallbackClient,
                                     ConversationService conversationService,
                                     ObjectMapper objectMapper,
                                     ToolRegistry toolRegistry,
                                     DashScopeClient dashScopeClient,
                                     DashScopeConfig dashScopeConfig,
                                     IntentKnowledgeBase knowledgeBase,
                                     AIAnalysisResultRepository analysisResultRepository,
                                     ConversationMemoryService conversationMemoryService,
                                     ToolRouterService toolRouterService,
                                     ResultValidatorService resultValidatorService,
                                     ParameterExtractionLearningService parameterExtractionLearningService,
                                     AnalysisRouterService analysisRouterService,
                                     ComplexityRouter complexityRouter,
                                     AgentOrchestrator agentOrchestrator,
                                     ToolCallRedundancyService redundancyService,
                                     BehaviorCalibrationService calibrationService,
                                     SelfCorrectionService selfCorrectionService,
                                     CorrectionAgentService correctionAgentService,
                                     ExternalVerifierService externalVerifierService,
                                     ToolResultValidatorService toolResultValidatorService) {
        this.aiIntentService = aiIntentService;
        this.handlers = handlers;
        this.semanticsParser = semanticsParser;
        this.semanticCacheService = semanticCacheService;
        this.ruleEngineService = ruleEngineService;
        this.llmFallbackClient = llmFallbackClient;
        this.conversationService = conversationService;
        this.objectMapper = objectMapper;
        this.toolRegistry = toolRegistry;
        this.dashScopeClient = dashScopeClient;
        this.dashScopeConfig = dashScopeConfig;
        this.knowledgeBase = knowledgeBase;
        this.analysisResultRepository = analysisResultRepository;
        this.conversationMemoryService = conversationMemoryService;
        this.toolRouterService = toolRouterService;
        this.resultValidatorService = resultValidatorService;
        this.parameterExtractionLearningService = parameterExtractionLearningService;
        this.analysisRouterService = analysisRouterService;
        this.complexityRouter = complexityRouter;
        this.agentOrchestrator = agentOrchestrator;
        this.redundancyService = redundancyService;
        this.calibrationService = calibrationService;
        this.selfCorrectionService = selfCorrectionService;
        this.correctionAgentService = correctionAgentService;
        this.externalVerifierService = externalVerifierService;
        this.toolResultValidatorService = toolResultValidatorService;
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

        // 0.3. 检查是否为多轮对话延续
        if (request.getSessionId() != null && !request.getSessionId().isEmpty()) {
            log.info("检测到会话延续: sessionId={}, userInput='{}'",
                    request.getSessionId(),
                    request.getUserInput() != null && request.getUserInput().length() > 30 ?
                            request.getUserInput().substring(0, 30) + "..." : request.getUserInput());

            try {
                ConversationService.ConversationResponse conversationResp =
                        conversationService.continueConversation(request.getSessionId(), request.getUserInput());

                // 会话不存在或已取消 → 继续正常的意图识别流程（支持新建会话场景）
                if (conversationResp == null ||
                    conversationResp.getStatus() == ConversationSession.SessionStatus.CANCELLED) {
                    log.info("会话不存在或已取消，继续正常意图识别: sessionId={}", request.getSessionId());
                    // 继续正常的意图识别流程
                } else if (conversationResp.isCompleted() && conversationResp.getIntentCode() != null) {
                    // 会话成功完成,识别出意图
                    log.info("会话完成,识别到意图: sessionId={}, intentCode={}, confidence={}",
                            request.getSessionId(), conversationResp.getIntentCode(), conversationResp.getConfidence());

                    // 调用 endConversation 触发学习
                    conversationService.endConversation(request.getSessionId(), conversationResp.getIntentCode());

                    // 设置识别到的意图代码,继续正常执行流程
                    request.setIntentCode(conversationResp.getIntentCode());
                    request.setForceExecute(true); // 跳过二次确认

                    // 继续执行 (使用识别到的意图)
                    return executeWithExplicitIntent(factoryId, request, userId, userRole);

                } else {
                    // 会话未完成,返回新的澄清问题
                    log.info("会话继续: sessionId={}, round={}/{}, status={}",
                            conversationResp.getSessionId(),
                            conversationResp.getCurrentRound(),
                            conversationResp.getMaxRounds(),
                            conversationResp.getStatus());

                    // 构建响应 (包含会话信息)
                    IntentExecuteResponse.IntentExecuteResponseBuilder responseBuilder = IntentExecuteResponse.builder()
                            .intentRecognized(false)
                            .status("CONVERSATION_CONTINUE")
                            .message(conversationResp.getMessage())
                            .executedAt(LocalDateTime.now());

                    // 添加会话信息到元数据
                    Map<String, Object> metadata = new HashMap<>();
                    metadata.put("sessionId", conversationResp.getSessionId());
                    metadata.put("currentRound", conversationResp.getCurrentRound());
                    metadata.put("maxRounds", conversationResp.getMaxRounds());
                    metadata.put("status", conversationResp.getStatus() != null ? conversationResp.getStatus().name() : null);

                    // 如果有候选意图,构建建议操作
                    if (conversationResp.getCandidates() != null && !conversationResp.getCandidates().isEmpty()) {
                        List<IntentExecuteResponse.SuggestedAction> candidateActions = new ArrayList<>();
                        for (ConversationService.CandidateInfo candidate : conversationResp.getCandidates()) {
                            Map<String, Object> params = new HashMap<>();
                            params.put("intentCode", candidate.getIntentCode());
                            params.put("sessionId", conversationResp.getSessionId());
                            params.put("forceExecute", true);

                            candidateActions.add(IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("SELECT_INTENT")
                                    .actionName(candidate.getIntentName())
                                    .description(candidate.getDescription() != null ? candidate.getDescription() :
                                            String.format("置信度: %.0f%%", candidate.getConfidence() * 100))
                                    .endpoint("/api/mobile/" + factoryId + "/ai-intents/execute")
                                    .parameters(params)
                                    .build());
                        }
                        metadata.put("candidates", conversationResp.getCandidates());
                        responseBuilder.suggestedActions(candidateActions);
                    }

                    responseBuilder.metadata(metadata);

                    return responseBuilder.build();
                }
            } catch (Exception e) {
                log.error("会话延续失败: sessionId={}, error={}",
                        request.getSessionId(), e.getMessage(), e);
                // 会话延续失败,继续正常的意图识别流程
            }
        }

        // 0.3. 早期问题类型检测 (Layer 0)
        // 在缓存检查之前检测，确保通用问题和闲聊不会被业务意图缓存拦截
        String userInput = request.getUserInput();
        if (userInput != null && !userInput.isEmpty()) {
            QuestionType earlyQuestionType = knowledgeBase.detectQuestionType(userInput);
            log.debug("早期问题类型检测: type={}, userInput='{}'", earlyQuestionType,
                    userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput);

            // 对于通用咨询问题和闲聊，直接跳过缓存，路由到LLM
            if (earlyQuestionType == QuestionType.GENERAL_QUESTION ||
                earlyQuestionType == QuestionType.CONVERSATIONAL) {

                // v7.0新增：检查是否为分析请求 (GENERAL_QUESTION + 业务关键词 + 分析指示词)
                if (earlyQuestionType == QuestionType.GENERAL_QUESTION &&
                    analysisRouterService.isAnalysisRequest(userInput, earlyQuestionType)) {

                    log.info("🔍 检测到分析请求，路由到分析服务: input='{}'",
                            userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput);

                    return executeAnalysisFlow(factoryId, userInput, request, userId, userRole);
                }

                log.info("问题类型为{}，跳过缓存直接路由到LLM: input='{}'", earlyQuestionType,
                        userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput);

                String llmResponse = generateConversationalResponse(factoryId, userInput, earlyQuestionType,
                        request.getEnableThinking(), request.getThinkingBudget());

                return IntentExecuteResponse.builder()
                        .intentRecognized(false)
                        .status("COMPLETED")
                        .message(llmResponse)
                        .executedAt(LocalDateTime.now())
                        .build();
            }
        }

        // 0.5. 查询语义缓存 (提升响应速度) - 仅对操作指令类问题
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

        // 1. 识别意图 (使用带 LLM Fallback 的方法，传递userId和userRole用于Tool Calling)
        // 包含 LLM Schema 验证异常处理 (R3: 校验失败不执行，反问用户)
        // 传递 sessionId 以启用查询预处理（时间归一化、口语标准化、上下文注入）
        IntentMatchResult matchResult;
        try {
            matchResult = aiIntentService.recognizeIntentWithConfidence(
                    request.getUserInput(), factoryId, 3, userId, userRole, request.getSessionId());
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

            // 准备会话元数据（如果存在sessionId）
            Map<String, Object> metadata = new java.util.HashMap<>();
            if (matchResult.getSessionId() != null && !matchResult.getSessionId().isEmpty()) {
                log.info("✅ [同步路径-模糊匹配] 添加sessionId到响应metadata: {}", matchResult.getSessionId());
                metadata.put("sessionId", matchResult.getSessionId());
                metadata.put("needMoreInfo", true);
                if (matchResult.getConversationMessage() != null) {
                    metadata.put("conversationMessage", matchResult.getConversationMessage());
                }
            }

            IntentExecuteResponse.IntentExecuteResponseBuilder builder = IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(matchedIntent.getIntentCode())
                    .intentName(matchedIntent.getIntentName())
                    .intentCategory(matchedIntent.getIntentCategory())
                    .status("NEED_CLARIFICATION")
                    .message(clarificationMessage)
                    .confidence(matchResult.getConfidence())
                    .matchMethod(matchResult.getMatchMethod() != null ? matchResult.getMatchMethod().name() : null)
                    .suggestedActions(candidateActions)
                    .executedAt(LocalDateTime.now());

            if (!metadata.isEmpty()) {
                builder.metadata(metadata);
            }

            return builder.build();
        }

        // 2b. 处理通用咨询问题和闲聊 - 直接路由到LLM对话
        if (matchResult.getQuestionType() == QuestionType.GENERAL_QUESTION ||
            matchResult.getQuestionType() == QuestionType.CONVERSATIONAL) {
            log.info("📋 通用问题/闲聊检测，路由到LLM对话: userInput={}, questionType={}",
                    request.getUserInput(), matchResult.getQuestionType());

            // 调用 LLM 获取对话式回复
            String llmResponse = generateConversationalResponse(factoryId, request.getUserInput(), matchResult.getQuestionType(),
                    request.getEnableThinking(), request.getThinkingBudget());

            return IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("COMPLETED")
                    .message(llmResponse)
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

                // 准备会话元数据（如果存在sessionId）
                Map<String, Object> metadata = new java.util.HashMap<>();
                if (matchResult.getSessionId() != null && !matchResult.getSessionId().isEmpty()) {
                    log.info("✅ [同步路径-候选] 添加sessionId到响应metadata: {}", matchResult.getSessionId());
                    metadata.put("sessionId", matchResult.getSessionId());
                    metadata.put("needMoreInfo", true);
                    if (matchResult.getConversationMessage() != null) {
                        metadata.put("conversationMessage", matchResult.getConversationMessage());
                    }
                }

                IntentExecuteResponse.IntentExecuteResponseBuilder builder = IntentExecuteResponse.builder()
                        .intentRecognized(false)
                        .status("NEED_CLARIFICATION")
                        .message("我不太确定您想执行什么操作，请从以下选项中选择或更详细地描述您的需求：")
                        .suggestedActions(candidateActions)
                        .executedAt(LocalDateTime.now());

                if (!metadata.isEmpty()) {
                    builder.metadata(metadata);
                }

                return builder.build();
            }

            log.info("未识别到意图 (规则+LLM均未匹配): userInput={}", request.getUserInput());
            // 即使没有候选意图，也返回 NEED_CLARIFICATION 状态，提供常用操作建议
            List<IntentExecuteResponse.SuggestedAction> defaultSuggestions = buildDefaultSuggestions(factoryId);

            // 准备会话元数据（如果存在sessionId）
            Map<String, Object> metadata = new java.util.HashMap<>();
            if (matchResult.getSessionId() != null && !matchResult.getSessionId().isEmpty()) {
                log.info("✅ [同步路径] 添加sessionId到响应metadata: {}", matchResult.getSessionId());
                metadata.put("sessionId", matchResult.getSessionId());
                metadata.put("needMoreInfo", true);
                if (matchResult.getConversationMessage() != null) {
                    metadata.put("conversationMessage", matchResult.getConversationMessage());
                }
            }

            // 使用会话消息（如果有），否则使用默认消息
            String message = matchResult.getConversationMessage() != null && !matchResult.getConversationMessage().isEmpty()
                    ? matchResult.getConversationMessage()
                    : "我没有理解您的意图，请从以下常用操作中选择，或更详细地描述您的需求：";

            IntentExecuteResponse.IntentExecuteResponseBuilder builder = IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("NEED_CLARIFICATION")
                    .message(message)
                    .executedAt(LocalDateTime.now())
                    .suggestedActions(defaultSuggestions);

            if (!metadata.isEmpty()) {
                builder.metadata(metadata);
            }

            return builder.build();
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

        // 4. 路由到执行器 - Tool 优先，动态选择，Handler 回退
        String toolName = intent.getToolName();
        IntentExecuteResponse response;

        // 4a. Tool 架构优先（新架构）- 有绑定工具时直接使用
        if (toolName != null && !toolName.isEmpty()) {
            Optional<ToolExecutor> toolOpt = toolRegistry.getExecutor(toolName);
            if (toolOpt.isPresent()) {
                log.info("使用 Tool 执行: intentCode={}, toolName={}", intent.getIntentCode(), toolName);
                response = executeWithTool(toolOpt.get(), factoryId, request, intent, userId, userRole, matchResult);
            } else {
                log.warn("Tool 未找到，回退到 Handler: toolName={}", toolName);
                response = executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
            }
        }
        // 4b. 动态工具选择（模块D）- 无绑定工具时尝试动态选择
        else if (toolRouterService.requiresDynamicSelection(matchResult)) {
            log.info("触发动态工具选择: intentCode={}", intent.getIntentCode());
            response = executeWithDynamicToolSelection(factoryId, request, intent, matchResult, userId, userRole);
        }
        // 4c. Handler 架构回退（旧架构）
        else {
            response = executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
        }

        // 6.5. 检查是否需要更多信息，生成澄清问题并创建对话会话
        if ("NEED_MORE_INFO".equals(response.getStatus())) {
            response = enrichWithClarificationQuestions(response, request, intent, factoryId, userId);
        }

        // 7. 处理缓存：标记缓存命中和写入新结果
        processResponseCaching(factoryId, request, matchResult, response);

        // 8. 更新对话记忆 (实体槽位 + 消息历史)
        if (request.getSessionId() != null && !request.getSessionId().isEmpty()) {
            updateConversationMemory(request.getSessionId(), request, response, matchResult, factoryId, userId);
        }

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

    /**
     * 使用 Tool 执行意图（新架构）
     *
     * 将请求参数封装为 ToolCall 并执行 Tool，
     * 然后将 Tool 执行结果转换为 IntentExecuteResponse。
     */
    private IntentExecuteResponse executeWithTool(ToolExecutor tool, String factoryId,
                                                   IntentExecuteRequest request,
                                                   AIIntentConfig intent,
                                                   Long userId, String userRole,
                                                   IntentMatchResult matchResult) {
        try {
            // 1. 权限检查
            if (tool.requiresPermission() && !tool.hasPermission(userRole)) {
                log.warn("Tool 权限不足: tool={}, userRole={}", tool.getToolName(), userRole);
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intent.getIntentCode())
                        .intentName(intent.getIntentName())
                        .intentCategory(intent.getIntentCategory())
                        .status("PERMISSION_DENIED")
                        .message("您没有权限执行此操作: " + intent.getIntentName())
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            // 2. 构建 ToolCall
            Map<String, Object> params = new HashMap<>();
            if (request.getContext() != null) {
                params.putAll(request.getContext());
            }
            // 添加 userInput 作为参数（优先使用预处理后的查询）
            String userInputToUse = request.getUserInput();
            if (matchResult != null && matchResult.getPreprocessedQuery() != null) {
                PreprocessedQuery pq = matchResult.getPreprocessedQuery();
                if (pq.getFinalQuery() != null && !pq.getFinalQuery().isEmpty()) {
                    userInputToUse = pq.getFinalQuery();
                    log.info("使用预处理后的查询: '{}' -> '{}'", request.getUserInput(), userInputToUse);
                }
            }
            params.put("userInput", userInputToUse);
            params.put("intentCode", intent.getIntentCode());

            // 2.5. 从预处理结果中提取解析的引用（如果有）
            if (matchResult != null && matchResult.getPreprocessedQuery() != null) {
                PreprocessedQuery pq = matchResult.getPreprocessedQuery();
                Map<String, PreprocessedQuery.ResolvedReference> refs = pq.getResolvedReferences();
                if (refs != null && !refs.isEmpty()) {
                    for (Map.Entry<String, PreprocessedQuery.ResolvedReference> entry : refs.entrySet()) {
                        PreprocessedQuery.ResolvedReference ref = entry.getValue();
                        if (ref != null && ref.getEntityType() != null) {
                            switch (ref.getEntityType().toUpperCase()) {
                                case "BATCH":
                                    // 工具参数名为 batchId，使用实体ID（UUID或数字ID）
                                    params.put("batchId", ref.getEntityId());
                                    // 同时传递 batchNumber 以备其他用途
                                    if (ref.getEntityName() != null) {
                                        params.put("batchNumber", ref.getEntityName());
                                    }
                                    log.info("从上下文解析批次: id={}, number={}", ref.getEntityId(), ref.getEntityName());
                                    break;
                                case "SUPPLIER":
                                    params.put("supplierId", ref.getEntityId());
                                    log.info("从上下文解析供应商: {}", ref.getEntityId());
                                    break;
                                case "PRODUCT":
                                    params.put("productId", ref.getEntityId());
                                    log.info("从上下文解析产品: {}", ref.getEntityId());
                                    break;
                            }
                        }
                    }
                }

                // 2.6. 从预处理结果中提取时间范围（如果有）
                if (pq.hasTimeRange()) {
                    TimeNormalizationRules.TimeRange timeRange = pq.getPrimaryTimeRange();
                    if (timeRange != null && timeRange.isValid()) {
                        params.put("startDate", timeRange.getStart().toLocalDate().toString());
                        params.put("endDate", timeRange.getEnd().toLocalDate().toString());
                        log.info("从预处理结果提取时间范围: {} ~ {}", timeRange.getStart(), timeRange.getEnd());
                    }
                }
            }

            // 2.7. 优先使用已学习的规则提取参数（不调用 LLM）
            Map<String, Object> parametersSchema = tool.getParametersSchema();
            @SuppressWarnings("unchecked")
            List<String> requiredParams = parametersSchema != null ?
                    (List<String>) parametersSchema.get("required") : null;

            Map<String, Object> ruleExtractedParams = new HashMap<>();
            if (requiredParams != null && !requiredParams.isEmpty()) {
                // 找出缺失的参数
                List<String> missingParams = requiredParams.stream()
                        .filter(p -> !params.containsKey(p) ||
                                     params.get(p) == null ||
                                     (params.get(p) instanceof String && ((String) params.get(p)).trim().isEmpty()))
                        .collect(Collectors.toList());

                if (!missingParams.isEmpty()) {
                    // 尝试使用学习的规则提取
                    ruleExtractedParams = parameterExtractionLearningService.extractWithLearnedRules(
                            factoryId, intent.getIntentCode(), userInputToUse, missingParams);

                    if (!ruleExtractedParams.isEmpty()) {
                        params.putAll(ruleExtractedParams);
                        log.info("使用学习规则提取参数: {} (无需调用 LLM)", ruleExtractedParams.keySet());
                    }
                }
            }

            // 2.8. 如果规则未能提取所有参数，使用 LLM 提取剩余参数
            Map<String, Object> llmExtractedParams = extractParametersWithLLM(userInputToUse, tool, params);
            if (!llmExtractedParams.isEmpty()) {
                params.putAll(llmExtractedParams);
                log.info("合并 LLM 提取的参数: {}", llmExtractedParams.keySet());

                // 2.9. 从 LLM 提取结果中学习规则（异步）
                try {
                    parameterExtractionLearningService.learnFromLLMExtraction(
                            factoryId, intent.getIntentCode(), userInputToUse, llmExtractedParams);
                } catch (Exception e) {
                    log.warn("参数提取规则学习失败: {}", e.getMessage());
                }
            }

            String argumentsJson = objectMapper.writeValueAsString(params);
            ToolCall toolCall = ToolCall.of(
                    java.util.UUID.randomUUID().toString(),
                    tool.getToolName(),
                    argumentsJson
            );

            // 3. 构建执行上下文
            Map<String, Object> context = new HashMap<>();
            context.put("factoryId", factoryId);
            context.put("userId", userId);
            context.put("userRole", userRole);
            context.put("intentConfig", intent);
            context.put("request", request);

            // 4. 冗余检查 (ET-Agent 行为校准)
            String sessionId = request.getSessionId() != null ? request.getSessionId() : "default";
            if (redundancyService.isRedundant(sessionId, tool.getToolName(), params)) {
                log.info("检测到冗余调用，跳过执行: tool={}, session={}", tool.getToolName(), sessionId);
                // 返回缓存的结果
                Optional<String> cachedResult = redundancyService.getCachedResult(sessionId, tool.getToolName(), params);
                if (cachedResult.isPresent()) {
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intent.getIntentCode())
                            .intentName(intent.getIntentName())
                            .intentCategory(intent.getIntentCategory())
                            .status("SUCCESS")
                            .message("(缓存结果) " + cachedResult.get())
                            .metadata(Map.of("cached", true))
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            }

            // 5. 执行 Tool（带自动重试）
            final int MAX_RETRIES = 3;
            String resultJson = null;
            Exception lastException = null;
            int retryCount = 0;
            long totalExecutionTime = 0;

            for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    log.debug("执行 Tool (尝试 {}/{}): name={}, arguments={}",
                            attempt, MAX_RETRIES, tool.getToolName(), argumentsJson);

                    long startTime = System.currentTimeMillis();
                    resultJson = tool.execute(toolCall, context);
                    long executionTime = System.currentTimeMillis() - startTime;
                    totalExecutionTime += executionTime;

                    // 执行成功，记录并跳出循环
                    try {
                        ToolCallRecord record = ToolCallRecord.builder()
                                .sessionId(sessionId)
                                .factoryId(factoryId)
                                .toolName(tool.getToolName())
                                .toolParameters(argumentsJson)
                                .parametersHash(redundancyService.computeParametersHash(params))
                                .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
                                .executionTimeMs((int) executionTime)
                                .retryCount(attempt - 1)
                                .recovered(attempt > 1)
                                .build();
                        ToolCallRecord savedRecord = redundancyService.recordToolCall(record);
                        if (savedRecord != null && resultJson != null) {
                            String summary = resultJson.length() > 200 ? resultJson.substring(0, 200) + "..." : resultJson;
                            redundancyService.cacheResult(sessionId, tool.getToolName(), params, summary, savedRecord.getId());
                        }
                        if (attempt > 1) {
                            log.info("工具调用在第 {} 次尝试后恢复成功: tool={}", attempt, tool.getToolName());
                        }
                    } catch (Exception recordEx) {
                        log.warn("记录工具调用失败: {}", recordEx.getMessage());
                    }

                    // === 扩展触发条件：结果验证 ===
                    // 即使工具执行成功，也检查结果是否符合用户意图
                    if (resultJson != null && attempt < MAX_RETRIES) {
                        try {
                            ToolResultValidatorService.ValidationResult validationResult =
                                    toolResultValidatorService.validate(
                                            request.getUserInput(),
                                            tool.getToolName(),
                                            params,
                                            resultJson
                                    );

                            if (!validationResult.isValid()) {
                                log.info("结果验证失败: issue={}, description={}, matchScore={}",
                                        validationResult.issue(),
                                        validationResult.issueDescription(),
                                        validationResult.matchScore());

                                // 触发纠错 Agent
                                String pseudoError = String.format(
                                        "[%s] %s",
                                        validationResult.issue(),
                                        validationResult.issueDescription()
                                );

                                // 外部验证
                                ExternalVerifierService.VerificationResult externalVerification = null;
                                try {
                                    externalVerification = externalVerifierService.verifyToolCall(
                                            factoryId, tool.getToolName(), params, pseudoError);
                                } catch (Exception verifyEx) {
                                    log.warn("外部验证失败: {}", verifyEx.getMessage());
                                }

                                // 纠错 Agent 分析
                                CorrectionAgentService.CorrectionResult correctionResult =
                                        correctionAgentService.analyzeAndCorrect(
                                                request.getUserInput(),
                                                tool.getToolName(),
                                                params,
                                                pseudoError,
                                                externalVerification,
                                                attempt
                                        );

                                log.info("纠错 Agent 结果（结果验证触发）: shouldRetry={}, strategy={}, confidence={}",
                                        correctionResult.shouldRetry(),
                                        correctionResult.correctionStrategy(),
                                        correctionResult.confidence());

                                if (correctionResult.shouldRetry() && correctionResult.correctedParams() != null) {
                                    // 使用修正后的参数重试
                                    params.clear();
                                    params.putAll(correctionResult.correctedParams());
                                    params.put("_correctionStrategy", correctionResult.correctionStrategy());
                                    params.put("_retryAttempt", attempt);
                                    params.put("_validationIssue", validationResult.issue().name());

                                    // 重新构建 ToolCall
                                    argumentsJson = objectMapper.writeValueAsString(params);
                                    toolCall = ToolCall.of(
                                            java.util.UUID.randomUUID().toString(),
                                            tool.getToolName(),
                                            argumentsJson
                                    );

                                    log.info("结果验证纠错: 准备第 {} 次重试, strategy={}, hint={}",
                                            attempt + 1,
                                            correctionResult.correctionStrategy(),
                                            validationResult.correctionHint());

                                    // 清空结果，继续重试
                                    resultJson = null;
                                    continue;
                                }
                            }
                        } catch (Exception validationEx) {
                            log.warn("结果验证过程出错: {}", validationEx.getMessage());
                            // 验证出错不影响正常流程
                        }
                    }

                    // 成功，跳出重试循环
                    break;

                } catch (Exception e) {
                    lastException = e;
                    retryCount = attempt;

                    // CRITIC-style 纠错：使用外部验证 + LLM 分析
                    String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                    log.warn("Tool 执行失败 (尝试 {}/{}): tool={}, error={}",
                            attempt, MAX_RETRIES, tool.getToolName(), errorMsg);

                    // Phase 2: 外部验证（CRITIC 核心 - 收集可靠的外部反馈）
                    ExternalVerifierService.VerificationResult verificationResult = null;
                    try {
                        verificationResult = externalVerifierService.verifyToolCall(
                                factoryId, tool.getToolName(), params, errorMsg);
                        log.info("外部验证结果: hasData={}, status={}, suggestion={}",
                                verificationResult.hasData(), verificationResult.dataStatus(), verificationResult.suggestion());
                    } catch (Exception verifyEx) {
                        log.warn("外部验证失败: {}", verifyEx.getMessage());
                    }

                    // Phase 3: 纠错 Agent 分析（CRITIC + Reflexion）
                    CorrectionAgentService.CorrectionResult correctionResult = null;
                    try {
                        correctionResult = correctionAgentService.analyzeAndCorrect(
                                request.getUserInput(),
                                tool.getToolName(),
                                params,
                                errorMsg,
                                verificationResult,
                                attempt
                        );
                        log.info("纠错 Agent 结果: shouldRetry={}, strategy={}, confidence={}",
                                correctionResult.shouldRetry(), correctionResult.correctionStrategy(), correctionResult.confidence());
                    } catch (Exception agentEx) {
                        log.warn("纠错 Agent 调用失败: {}", agentEx.getMessage());
                    }

                    // Phase 4: 根据纠错结果决定是否重试
                    boolean shouldRetry = correctionResult != null && correctionResult.shouldRetry() && attempt < MAX_RETRIES;

                    if (shouldRetry && correctionResult.correctedParams() != null) {
                        // 使用 LLM 修正后的参数重新执行
                        params.clear();
                        params.putAll(correctionResult.correctedParams());
                        params.put("_correctionStrategy", correctionResult.correctionStrategy());
                        params.put("_retryAttempt", attempt);
                        params.put("_confidence", correctionResult.confidence());

                        // 重新构建 ToolCall
                        try {
                            argumentsJson = objectMapper.writeValueAsString(params);
                            toolCall = ToolCall.of(
                                    java.util.UUID.randomUUID().toString(),
                                    tool.getToolName(),
                                    argumentsJson
                            );
                        } catch (JsonProcessingException je) {
                            log.error("重试时参数序列化失败: {}", je.getMessage());
                            break;
                        }

                        log.info("CRITIC 纠错: 准备第 {} 次重试, strategy={}, confidence={}",
                                attempt + 1, correctionResult.correctionStrategy(), correctionResult.confidence());

                        // 记录纠错尝试
                        try {
                            CorrectionRecord.ErrorCategory errorCategory = selfCorrectionService.classifyError(errorMsg, null);
                            selfCorrectionService.createCorrectionRecord(
                                    null, factoryId, sessionId,
                                    errorCategory.name(), errorMsg, correctionResult.errorAnalysis());
                        } catch (Exception recordEx) {
                            log.warn("记录纠错尝试失败: {}", recordEx.getMessage());
                        }
                    } else {
                        // 纠错 Agent 判断不应重试
                        String reason = correctionResult != null ? correctionResult.errorAnalysis() : "纠错 Agent 不可用";
                        log.info("纠错 Agent 判断不重试: {}", reason);
                        break;
                    }
                }
            }

            // 如果所有重试都失败了
            if (resultJson == null && lastException != null) {
                // 记录最终失败
                try {
                    ToolCallRecord failedRecord = ToolCallRecord.builder()
                            .sessionId(sessionId)
                            .factoryId(factoryId)
                            .toolName(tool.getToolName())
                            .toolParameters(argumentsJson)
                            .executionStatus(ToolCallRecord.ExecutionStatus.FAILED)
                            .errorMessage(lastException.getMessage())
                            .retryCount(retryCount)
                            .build();
                    redundancyService.recordToolCall(failedRecord);
                } catch (Exception recordEx) {
                    log.warn("记录失败调用时出错: {}", recordEx.getMessage());
                }

                // 返回失败响应
                String errorMessage = lastException.getMessage() != null ? lastException.getMessage() : lastException.getClass().getSimpleName();
                CorrectionRecord.ErrorCategory errorCategory = selfCorrectionService.classifyError(errorMessage, null);
                CorrectionRecord.CorrectionStrategy strategy = selfCorrectionService.determineStrategy(errorCategory);

                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intent.getIntentCode())
                        .intentName(intent.getIntentName())
                        .intentCategory(intent.getIntentCategory())
                        .status("FAILED")
                        .message("执行失败 (已重试 " + retryCount + " 次): " + ErrorSanitizer.sanitize(lastException))
                        .metadata(Map.of(
                                "errorCategory", errorCategory.name(),
                                "correctionStrategy", strategy.name(),
                                "retryCount", retryCount,
                                "autoRetryExhausted", true
                        ))
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            // 6. 解析 Tool 结果并转换为 IntentExecuteResponse
            IntentExecuteResponse response = parseToolResultToResponse(resultJson, intent);

            // 如果是重试后成功的，添加恢复信息
            if (retryCount > 0 && response != null && "SUCCESS".equals(response.getStatus())) {
                Map<String, Object> metadata = response.getMetadata() != null ?
                        new HashMap<>(response.getMetadata()) : new HashMap<>();
                metadata.put("recoveredAfterRetries", retryCount);
                metadata.put("totalExecutionTimeMs", totalExecutionTime);
                response.setMetadata(metadata);
            }

            return response;

        } catch (JsonProcessingException e) {
            log.error("Tool 参数序列化失败: tool={}, error={}", tool.getToolName(), e.getMessage());
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .status("FAILED")
                    .message("参数处理失败: " + e.getMessage())
                    .executedAt(LocalDateTime.now())
                    .build();
        } catch (Exception e) {
            log.error("Tool 执行失败: tool={}, error={}", tool.getToolName(), e.getMessage(), e);

            // 记录失败的工具调用 (ET-Agent 行为校准)
            String sessionId = request.getSessionId() != null ? request.getSessionId() : "default";
            try {
                ToolCallRecord failedRecord = ToolCallRecord.builder()
                        .sessionId(sessionId)
                        .factoryId(factoryId)
                        .toolName(tool.getToolName())
                        .executionStatus(ToolCallRecord.ExecutionStatus.FAILED)
                        .errorMessage(e.getMessage())
                        .build();
                redundancyService.recordToolCall(failedRecord);
            } catch (Exception recordEx) {
                log.warn("记录失败调用时出错: {}", recordEx.getMessage());
            }

            // 自我纠错分析 (ET-Agent 行为校准)
            String errorMessage = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            CorrectionRecord.ErrorCategory errorCategory = selfCorrectionService.classifyError(errorMessage, null);
            CorrectionRecord.CorrectionStrategy strategy = selfCorrectionService.determineStrategy(errorCategory);

            log.info("错误分类: category={}, strategy={}", errorCategory, strategy);

            // 生成纠错提示（可用于下次重试）
            String correctionPrompt = selfCorrectionService.generateCorrectionPrompt(errorCategory, errorMessage);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .status("FAILED")
                    .message("执行失败: " + ErrorSanitizer.sanitize(e))
                    .metadata(Map.of(
                            "errorCategory", errorCategory.name(),
                            "correctionStrategy", strategy.name(),
                            "correctionHint", correctionPrompt.substring(0, Math.min(200, correctionPrompt.length()))
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 解析 Tool 执行结果为 IntentExecuteResponse
     *
     * Tool 返回的 JSON 格式约定：
     * - success: boolean
     * - data: Object (业务数据)
     * - message: String
     * - needMoreInfo: boolean (可选，表示需要更多参数)
     * - missingParams: List<String> (可选，缺失的参数列表)
     */
    @SuppressWarnings("unchecked")
    private IntentExecuteResponse parseToolResultToResponse(String resultJson, AIIntentConfig intent) {
        try {
            Map<String, Object> result = objectMapper.readValue(resultJson, Map.class);

            Boolean success = (Boolean) result.getOrDefault("success", true);
            Object data = result.get("data");
            String message = (String) result.getOrDefault("message", success ? "执行成功" : "执行失败");
            Boolean needMoreInfo = (Boolean) result.getOrDefault("needMoreInfo", false);

            String status;
            if (Boolean.TRUE.equals(needMoreInfo)) {
                status = "NEED_MORE_INFO";
            } else if (Boolean.TRUE.equals(success)) {
                status = "SUCCESS";
            } else {
                status = "FAILED";
            }

            IntentExecuteResponse.IntentExecuteResponseBuilder builder = IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .status(status)
                    .message(message)
                    .resultData(data)
                    .executedAt(LocalDateTime.now());

            return builder.build();

        } catch (Exception e) {
            log.error("解析 Tool 结果失败: json={}, error={}", resultJson, e.getMessage());
            // 如果解析失败，直接返回原始 JSON 作为 resultData
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .status("SUCCESS")
                    .message("执行完成")
                    .resultData(resultJson)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 使用 LLM Tool Calling 从用户输入中提取参数
     *
     * 当意图匹配成功但缺少必需参数时，调用此方法从自然语言中提取参数。
     *
     * @param userInput 用户输入
     * @param tool 目标工具
     * @param existingParams 已有参数
     * @return 提取的参数 Map
     */
    private Map<String, Object> extractParametersWithLLM(String userInput, ToolExecutor tool,
                                                          Map<String, Object> existingParams) {
        Map<String, Object> extractedParams = new HashMap<>();

        try {
            // 1. 获取工具的参数 schema
            Map<String, Object> parametersSchema = tool.getParametersSchema();
            if (parametersSchema == null || parametersSchema.isEmpty()) {
                log.debug("工具 {} 没有参数 schema，跳过参数提取", tool.getToolName());
                return extractedParams;
            }

            // 2. 从 schema 中获取必需参数列表
            @SuppressWarnings("unchecked")
            List<String> requiredParams = (List<String>) parametersSchema.get("required");
            if (requiredParams == null || requiredParams.isEmpty()) {
                log.debug("工具 {} 没有必需参数，跳过参数提取", tool.getToolName());
                return extractedParams;
            }

            // 3. 检查哪些必需参数缺失
            List<String> missingParams = requiredParams.stream()
                    .filter(p -> !existingParams.containsKey(p) ||
                                 existingParams.get(p) == null ||
                                 (existingParams.get(p) instanceof String &&
                                  ((String) existingParams.get(p)).trim().isEmpty()))
                    .collect(Collectors.toList());

            if (missingParams.isEmpty()) {
                log.debug("工具 {} 所有必需参数已存在，跳过参数提取", tool.getToolName());
                return extractedParams;
            }

            log.info("工具 {} 缺少参数 {}，启动 LLM 参数提取", tool.getToolName(), missingParams);

            // 4. 构建参数提取工具定义
            Tool extractionTool = buildParameterExtractionTool(tool.getToolName(), parametersSchema);

            // 5. 构建提示词
            String systemPrompt = buildParameterExtractionPrompt(tool.getToolName(), tool.getDescription());

            // 6. 调用 LLM 提取参数
            ChatCompletionResponse response = dashScopeClient.chatWithTools(
                    systemPrompt,
                    userInput,
                    List.of(extractionTool)
            );

            // 7. 解析 LLM 返回的工具调用
            if (dashScopeClient.hasToolCalls(response)) {
                ToolCall toolCall = dashScopeClient.getFirstToolCall(response);
                if (toolCall != null && toolCall.getFunction() != null) {
                    String argumentsJson = toolCall.getFunction().getArguments();
                    if (argumentsJson != null && !argumentsJson.isEmpty()) {
                        try {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> args = objectMapper.readValue(argumentsJson, Map.class);
                            // 只提取非空参数
                            for (Map.Entry<String, Object> entry : args.entrySet()) {
                                if (entry.getValue() != null &&
                                    !(entry.getValue() instanceof String && ((String) entry.getValue()).isEmpty())) {
                                    extractedParams.put(entry.getKey(), entry.getValue());
                                }
                            }
                            log.info("LLM 参数提取成功: tool={}, extracted={}", tool.getToolName(), extractedParams.keySet());
                        } catch (JsonProcessingException e) {
                            log.warn("解析 LLM 返回的参数失败: {}", e.getMessage());
                        }
                    }
                }
            } else {
                log.debug("LLM 未返回工具调用，可能输入中没有足够的参数信息");
            }

        } catch (Exception e) {
            log.error("LLM 参数提取异常: tool={}, error={}", tool.getToolName(), e.getMessage(), e);
        }

        return extractedParams;
    }

    /**
     * 构建参数提取工具定义
     */
    private Tool buildParameterExtractionTool(String toolName, Map<String, Object> parametersSchema) {
        return Tool.of(
                "extract_parameters",
                "从用户输入中提取 " + toolName + " 操作所需的参数",
                parametersSchema
        );
    }

    /**
     * 构建参数提取提示词
     */
    private String buildParameterExtractionPrompt(String toolName, String toolDescription) {
        return String.format("""
            你是一个参数提取助手。你的任务是从用户的自然语言输入中提取操作所需的参数。

            当前操作: %s
            操作描述: %s

            请仔细分析用户输入，提取其中包含的参数值。
            - 如果用户明确提供了某个参数的值，请提取它
            - 如果用户没有提供某个参数，不要猜测或编造，直接忽略该参数
            - 参数值应该是用户原文中的信息，不要修改或翻译

            常见的参数表达方式：
            - "用户名xxx" → username: "xxx"
            - "姓名xxx" → realName/fullName: "xxx"
            - "角色为xxx" → role: "xxx"
            - "数量xxx" → quantity: xxx
            - "批次xxx" → batchNumber: "xxx"

            请使用 extract_parameters 工具返回提取的参数。
            """, toolName, toolDescription != null ? toolDescription : "执行业务操作");
    }

    /**
     * Handler 回退执行（旧架构）
     *
     * 当 tool_name 为空或 Tool 未找到时，使用此方法
     */
    private IntentExecuteResponse executeWithHandlerFallback(String factoryId,
                                                              IntentExecuteRequest request,
                                                              AIIntentConfig intent,
                                                              Long userId, String userRole) {
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

        // 预览模式
        if (Boolean.TRUE.equals(request.getPreviewOnly())) {
            return handler.preview(factoryId, request, intent, userId, userRole);
        }

        // 执行 - 优先使用语义模式
        return executeWithHandler(handler, factoryId, request, intent, userId, userRole);
    }

    /**
     * 动态工具选择执行（模块D）
     *
     * 当意图没有绑定工具，且符合动态选择条件时使用此方法：
     * 1. 向量检索候选工具 (Top K)
     * 2. LLM 精选最合适的工具组合
     * 3. 执行工具链（支持并行/串行）
     *
     * @param factoryId   工厂ID
     * @param request     原始请求
     * @param intent      意图配置
     * @param matchResult 意图匹配结果
     * @param userId      用户ID
     * @param userRole    用户角色
     * @return 执行响应
     */
    private IntentExecuteResponse executeWithDynamicToolSelection(String factoryId,
                                                                    IntentExecuteRequest request,
                                                                    AIIntentConfig intent,
                                                                    IntentMatchResult matchResult,
                                                                    Long userId, String userRole) {
        try {
            // 1. 获取用户查询文本（优先使用预处理后的查询）
            String query = request.getUserInput();
            if (matchResult != null && matchResult.getPreprocessedQuery() != null) {
                PreprocessedQuery pq = matchResult.getPreprocessedQuery();
                if (pq.getFinalQuery() != null && !pq.getFinalQuery().isEmpty()) {
                    query = pq.getFinalQuery();
                }
            }

            // 2. 向量检索候选工具
            List<ToolRouterService.ToolCandidate> candidates = toolRouterService.retrieveCandidateTools(query, 10);
            if (candidates.isEmpty()) {
                log.warn("动态工具选择: 未找到候选工具, query={}", query);
                // 回退到 Handler
                return executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
            }

            log.info("动态工具选择: 找到 {} 个候选工具", candidates.size());
            for (ToolRouterService.ToolCandidate c : candidates) {
                log.debug("  - {}: {} (相似度: {})", c.getToolName(), c.getToolDescription(),
                        String.format("%.2f", c.getSimilarity()));
            }

            // 3. LLM 精选工具
            ToolRouterService.SelectedTools selectedTools = toolRouterService.selectTools(query, matchResult, candidates);
            if (selectedTools.getTools() == null || selectedTools.getTools().isEmpty()) {
                log.warn("动态工具选择: LLM 未选中任何工具");
                return executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
            }

            log.info("动态工具选择: LLM 选中 {} 个工具, 执行顺序={}",
                    selectedTools.getTools().size(), selectedTools.getExecutionOrder());
            for (ToolRouterService.SelectedTools.SelectedTool t : selectedTools.getTools()) {
                log.info("  - {}: {}", t.getToolName(), t.getReason());
            }

            // 4. 构建执行上下文
            Map<String, Object> context = new HashMap<>();
            context.put("factoryId", factoryId);
            context.put("userId", userId);
            context.put("userRole", userRole);
            context.put("userInput", query);
            context.put("intentCode", intent.getIntentCode());

            // 添加请求上下文
            if (request.getContext() != null) {
                context.putAll(request.getContext());
            }

            // 添加预处理结果中的解析引用
            if (matchResult != null && matchResult.getPreprocessedQuery() != null) {
                PreprocessedQuery pq = matchResult.getPreprocessedQuery();
                Map<String, PreprocessedQuery.ResolvedReference> refs = pq.getResolvedReferences();
                if (refs != null) {
                    for (Map.Entry<String, PreprocessedQuery.ResolvedReference> entry : refs.entrySet()) {
                        PreprocessedQuery.ResolvedReference ref = entry.getValue();
                        if (ref != null && ref.getEntityType() != null) {
                            String key = ref.getEntityType().toLowerCase() + "Id";
                            context.put(key, ref.getEntityId());
                            if (ref.getEntityName() != null) {
                                context.put(ref.getEntityType().toLowerCase() + "Name", ref.getEntityName());
                            }
                        }
                    }
                }
            }

            // 5. 执行工具链
            Object result = toolRouterService.executeToolChain(selectedTools, context);

            // 6. 转换结果为响应
            return convertDynamicToolResultToResponse(result, intent, selectedTools);

        } catch (Exception e) {
            log.error("动态工具选择执行失败: {}", e.getMessage(), e);
            // 回退到 Handler
            return executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
        }
    }

    /**
     * 将动态工具执行结果转换为标准响应
     */
    @SuppressWarnings("unchecked")
    private IntentExecuteResponse convertDynamicToolResultToResponse(Object result,
                                                                       AIIntentConfig intent,
                                                                       ToolRouterService.SelectedTools selectedTools) {
        try {
            Map<String, Object> resultMap;

            if (result instanceof Map) {
                resultMap = (Map<String, Object>) result;
            } else if (result instanceof String) {
                resultMap = objectMapper.readValue((String) result, Map.class);
            } else {
                resultMap = objectMapper.convertValue(result, Map.class);
            }

            // 检查是否有错误
            boolean hasError = false;
            StringBuilder errorMessages = new StringBuilder();
            Map<String, Object> successData = new HashMap<>();

            for (Map.Entry<String, Object> entry : resultMap.entrySet()) {
                String toolName = entry.getKey();
                Object toolResult = entry.getValue();

                if (toolResult instanceof Map) {
                    Map<String, Object> toolResultMap = (Map<String, Object>) toolResult;
                    if (toolResultMap.containsKey("error")) {
                        hasError = true;
                        errorMessages.append(toolName).append(": ").append(toolResultMap.get("error")).append("; ");
                    } else {
                        successData.put(toolName, toolResult);
                    }
                } else {
                    successData.put(toolName, toolResult);
                }
            }

            String status = hasError ? "PARTIAL_SUCCESS" : "SUCCESS";
            String message = hasError
                    ? "部分工具执行失败: " + errorMessages.toString()
                    : selectedTools.getToolChainDescription();

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .status(status)
                    .message(message)
                    .resultData(successData.size() == 1
                            ? successData.values().iterator().next()
                            : successData)
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("转换动态工具结果失败: {}", e.getMessage());
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .status("FAILED")
                    .message("结果解析失败: " + e.getMessage())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
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
                matchResult = aiIntentService.recognizeIntentWithConfidence(
                        userInput, factoryId, 3, userId, userRole, request.getSessionId());
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

        // 路由到执行器 - Tool 优先，Handler 回退
        String toolName = intent.getToolName();
        IntentExecuteResponse response;

        // Tool 架构优先（新架构）
        if (toolName != null && !toolName.isEmpty()) {
            Optional<ToolExecutor> toolOpt = toolRegistry.getExecutor(toolName);
            if (toolOpt.isPresent()) {
                log.info("[SSE] 使用 Tool 执行: intentCode={}, toolName={}", intent.getIntentCode(), toolName);
                response = executeWithTool(toolOpt.get(), factoryId, request, intent, userId, userRole, matchResult);
            } else {
                log.warn("[SSE] Tool 未找到，回退到 Handler: toolName={}", toolName);
                response = executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
            }
        } else {
            // Handler 架构回退（旧架构）
            response = executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
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
        log.info("🔍 buildNoMatchResponse调用: sessionId={}, conversationMessage={}, hasMatch={}",
                matchResult.getSessionId(), matchResult.getConversationMessage(), matchResult.hasMatch());

        // 准备会话元数据（如果存在）
        Map<String, Object> metadata = new java.util.HashMap<>();
        if (matchResult.getSessionId() != null && !matchResult.getSessionId().isEmpty()) {
            log.info("✅ sessionId不为空，添加到metadata: {}", matchResult.getSessionId());
            metadata.put("sessionId", matchResult.getSessionId());
            metadata.put("needMoreInfo", true);  // 标记需要更多信息
            if (matchResult.getConversationMessage() != null) {
                metadata.put("conversationMessage", matchResult.getConversationMessage());
            }
        } else {
            log.warn("⚠️ sessionId为空或null，无法添加到metadata");
        }

        if (matchResult.getTopCandidates() != null && !matchResult.getTopCandidates().isEmpty()) {
            List<IntentExecuteResponse.SuggestedAction> candidateActions = buildCandidateActions(matchResult, factoryId);
            IntentExecuteResponse.IntentExecuteResponseBuilder builder = IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("NEED_CLARIFICATION")
                    .message("我不太确定您想执行什么操作，请从以下选项中选择或更详细地描述您的需求：")
                    .suggestedActions(candidateActions)
                    .executedAt(LocalDateTime.now());

            if (!metadata.isEmpty()) {
                builder.metadata(metadata);
            }
            return builder.build();
        }

        List<IntentExecuteResponse.SuggestedAction> defaultSuggestions = buildDefaultSuggestions(factoryId);

        // 使用会话消息（如果有），否则使用默认消息
        String message = matchResult.getConversationMessage() != null && !matchResult.getConversationMessage().isEmpty()
                ? matchResult.getConversationMessage()
                : "我没有理解您的意图，请从以下常用操作中选择，或更详细地描述您的需求：";

        IntentExecuteResponse.IntentExecuteResponseBuilder builder = IntentExecuteResponse.builder()
                .intentRecognized(false)
                .status("NEED_CLARIFICATION")
                .message(message)
                .suggestedActions(defaultSuggestions)
                .executedAt(LocalDateTime.now());

        if (!metadata.isEmpty()) {
            builder.metadata(metadata);
        }
        return builder.build();
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

        // 准备会话元数据（如果存在）
        Map<String, Object> metadata = new java.util.HashMap<>();
        if (matchResult.getSessionId() != null && !matchResult.getSessionId().isEmpty()) {
            metadata.put("sessionId", matchResult.getSessionId());
            metadata.put("needMoreInfo", true);
            if (matchResult.getConversationMessage() != null) {
                metadata.put("conversationMessage", matchResult.getConversationMessage());
            }
        }

        IntentExecuteResponse.IntentExecuteResponseBuilder builder = IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(matchedIntent.getIntentCode())
                .intentName(matchedIntent.getIntentName())
                .intentCategory(matchedIntent.getIntentCategory())
                .status("NEED_CLARIFICATION")
                .message(clarificationMessage)
                .confidence(matchResult.getConfidence())
                .matchMethod(matchResult.getMatchMethod() != null ? matchResult.getMatchMethod().name() : null)
                .suggestedActions(candidateActions)
                .executedAt(LocalDateTime.now());

        if (!metadata.isEmpty()) {
            builder.metadata(metadata);
        }
        return builder.build();
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

        // 4. 路由到执行器 - Tool 优先，Handler 回退
        String toolName = intent.getToolName();
        String category = intent.getIntentCategory();
        IntentExecuteResponse response;

        // 5. 预览模式 - 仍使用 Handler（Tool 不支持预览）
        if (Boolean.TRUE.equals(request.getPreviewOnly())) {
            IntentHandler handler = handlerMap.get(category);
            if (handler != null) {
                return handler.preview(factoryId, request, intent, userId, userRole);
            }
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .status("FAILED")
                    .message("预览模式暂不支持此意图类型")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 6. Tool 架构优先（新架构）
        if (toolName != null && !toolName.isEmpty()) {
            Optional<ToolExecutor> toolOpt = toolRegistry.getExecutor(toolName);
            if (toolOpt.isPresent()) {
                log.info("[显式执行] 使用 Tool 执行: intentCode={}, toolName={}", intentCode, toolName);
                // 显式意图执行没有 matchResult（无需预处理参数传递）
                response = executeWithTool(toolOpt.get(), factoryId, request, intent, userId, userRole, null);
            } else {
                log.warn("[显式执行] Tool 未找到，回退到 Handler: toolName={}", toolName);
                response = executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
            }
        } else {
            // Handler 架构回退（旧架构）
            log.info("[显式执行] 使用 Handler: intentCode={}, category={}", intentCode, category);
            response = executeWithHandlerFallback(factoryId, request, intent, userId, userRole);
        }

        // 6.5. 检查是否需要更多信息，生成澄清问题并创建对话会话
        // (与主执行流程保持一致，确保 NEED_MORE_INFO 状态时返回 sessionId)
        if ("NEED_MORE_INFO".equals(response.getStatus())) {
            response = enrichWithClarificationQuestions(response, request, intent, factoryId, userId);
        }

        return response;
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
            String factoryId,
            Long userId) {

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

            // 3. 将缺失参数转换为 RequiredParameter 对象
            List<ConversationService.RequiredParameter> requiredParameters = missingParams.stream()
                    .map(paramName -> ConversationService.RequiredParameter.builder()
                            .name(paramName)
                            .label(getParameterLabel(paramName, intent))
                            .type(getParameterType(paramName, intent))
                            .validationHint(getParameterValidationHint(paramName, intent))
                            .collected(false)
                            .build())
                    .collect(java.util.stream.Collectors.toList());

            // 4. 创建参数收集会话（使用 PARAMETER_COLLECTION 模式）
            String sessionId = null;
            Integer conversationRound = 1;
            Integer maxConversationRounds = 5;

            if (userId != null) {
                try {
                    ConversationService.ConversationResponse conversationResp =
                            conversationService.startParameterCollection(
                                    factoryId,
                                    userId,
                                    intent.getIntentCode(),
                                    intent.getIntentName(),
                                    requiredParameters,
                                    clarificationQuestions
                            );

                    if (conversationResp != null && conversationResp.getSessionId() != null) {
                        sessionId = conversationResp.getSessionId();
                        conversationRound = conversationResp.getCurrentRound();
                        maxConversationRounds = conversationResp.getMaxRounds();
                        log.info("Created PARAMETER_COLLECTION session: sessionId={}, intent={}, params={}",
                                sessionId, intent.getIntentCode(), missingParams);
                    }
                } catch (Exception e) {
                    log.warn("Failed to create parameter collection session: {}", e.getMessage());
                    // 继续返回响应，只是没有sessionId
                }
            }

            // 4. 构建增强的响应（包含会话信息）
            return IntentExecuteResponse.builder()
                    .intentRecognized(response.getIntentRecognized())
                    .intentCode(response.getIntentCode())
                    .intentName(response.getIntentName())
                    .intentCategory(response.getIntentCategory())
                    .status(response.getStatus())
                    .message("需要更多信息来完成此操作")
                    .clarificationQuestions(clarificationQuestions)
                    .sessionId(sessionId)
                    .conversationRound(conversationRound)
                    .maxConversationRounds(maxConversationRounds)
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
     * 获取参数的用户友好标签
     *
     * @param paramName 参数名称
     * @param intent 意图配置
     * @return 用户友好的标签
     */
    private String getParameterLabel(String paramName, AIIntentConfig intent) {
        // 常见参数名称映射
        java.util.Map<String, String> labelMap = java.util.Map.ofEntries(
                java.util.Map.entry("batchId", "批次ID"),
                java.util.Map.entry("batchNumber", "批次号"),
                java.util.Map.entry("quantity", "数量"),
                java.util.Map.entry("materialTypeId", "原材料类型"),
                java.util.Map.entry("productTypeId", "产品类型"),
                java.util.Map.entry("equipmentId", "设备ID"),
                java.util.Map.entry("userId", "用户ID"),
                java.util.Map.entry("date", "日期"),
                java.util.Map.entry("startDate", "开始日期"),
                java.util.Map.entry("endDate", "结束日期"),
                java.util.Map.entry("reason", "原因"),
                java.util.Map.entry("notes", "备注"),
                java.util.Map.entry("status", "状态"),
                java.util.Map.entry("supplierId", "供应商ID"),
                java.util.Map.entry("warehouseId", "仓库ID"),
                java.util.Map.entry("locationId", "库位ID"),
                java.util.Map.entry("weight", "重量"),
                java.util.Map.entry("temperature", "温度"),
                java.util.Map.entry("workstationId", "工位ID")
        );

        String label = labelMap.get(paramName);
        if (label != null) {
            return label;
        }

        // 驼峰转友好名称 (如 batchNumber -> 批次 Number)
        // 简化处理: 返回原名
        return paramName;
    }

    /**
     * 获取参数的数据类型
     *
     * @param paramName 参数名称
     * @param intent 意图配置
     * @return 数据类型 (string, number, date, uuid, etc.)
     */
    private String getParameterType(String paramName, AIIntentConfig intent) {
        // 根据参数名推断类型
        String lowerName = paramName.toLowerCase();

        if (lowerName.endsWith("id")) {
            // 大多数ID是UUID或字符串
            return "string";
        } else if (lowerName.equals("quantity") || lowerName.equals("weight") ||
                   lowerName.equals("amount") || lowerName.equals("temperature") ||
                   lowerName.equals("count")) {
            return "number";
        } else if (lowerName.contains("date") || lowerName.equals("startdate") ||
                   lowerName.equals("enddate")) {
            return "date";
        } else {
            return "string";
        }
    }

    /**
     * 获取参数的验证提示
     *
     * @param paramName 参数名称
     * @param intent 意图配置
     * @return 验证提示信息
     */
    private String getParameterValidationHint(String paramName, AIIntentConfig intent) {
        String lowerName = paramName.toLowerCase();

        if (lowerName.equals("batchid") || lowerName.equals("batchnumber")) {
            return "请输入有效的批次ID或批次号";
        } else if (lowerName.equals("quantity")) {
            return "请输入有效的数量（正整数）";
        } else if (lowerName.equals("materialtypeid")) {
            return "请输入原材料类型ID";
        } else if (lowerName.equals("producttypeid")) {
            return "请输入产品类型ID";
        } else if (lowerName.equals("equipmentid")) {
            return "请输入设备ID";
        } else if (lowerName.contains("date")) {
            return "请输入日期，格式: YYYY-MM-DD";
        } else if (lowerName.equals("weight")) {
            return "请输入重量（数字）";
        } else if (lowerName.equals("temperature")) {
            return "请输入温度值";
        } else {
            return null; // 无特殊验证提示
        }
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

    /**
     * 生成通用对话式回复
     *
     * 用于处理 GENERAL_QUESTION 和 CONVERSATIONAL 类型的问题。
     * 这些问题不是具体的业务操作指令，而是通用咨询或闲聊。
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param questionType 问题类型
     * @param enableThinking 是否启用深度思考模式（仅GENERAL_QUESTION有效）
     * @param thinkingBudget 思考预算Token数（10-100）
     * @return LLM 生成的对话式回复
     */
    private String generateConversationalResponse(String factoryId, String userInput, QuestionType questionType,
                                                   Boolean enableThinking, Integer thinkingBudget) {
        String systemPrompt;

        if (questionType == QuestionType.GENERAL_QUESTION) {
            // 通用咨询问题（如何提高生产效率？降低成本？）
            // 尝试获取预计算的分析报告，为建议提供数据支撑
            String factoryAnalysisContext = getPrecomputedAnalysisContext(factoryId);

            if (factoryAnalysisContext != null && !factoryAnalysisContext.isEmpty()) {
                // 有预计算分析数据 - 提供数据驱动的建议
                systemPrompt = """
                    你是白垩纪食品溯源系统的智能助手。用户正在询问一个关于生产管理、质量控制或成本优化的咨询问题。

                    **重要**: 下面是该工厂的最新运营分析报告，请基于此数据提供针对性建议：

                    ---
                    %s
                    ---

                    请根据以下原则回答：
                    1. **数据驱动**: 结合上述分析报告中的具体数据和问题点给出建议
                    2. **针对性强**: 基于报告中发现的问题提供具体改进措施
                    3. **可操作**: 建议应该是具体可执行的，带有明确的行动步骤
                    4. **量化目标**: 如果可能，给出预期的改进效果
                    5. 回答使用中文，不超过500字

                    注意：你正在为这家具体工厂提供咨询建议，而非通用建议。
                    """.formatted(factoryAnalysisContext);
            } else {
                // 无预计算数据 - 使用通用建议模板
                systemPrompt = """
                    你是白垩纪食品溯源系统的智能助手。用户正在询问一个关于生产管理、质量控制或食品安全的通用咨询问题。

                    请根据以下原则回答：
                    1. 提供专业、实用的建议
                    2. 结合食品加工行业的最佳实践
                    3. 如果问题涉及具体数据查询，建议用户使用系统的具体功能
                    4. 回答简洁明了，不超过300字
                    5. 使用中文回答

                    注意：这不是一个具体的系统操作指令，而是通用知识咨询。
                    """;
            }
        } else {
            // 闲聊类型
            systemPrompt = """
                你是白垩纪食品溯源系统的智能助手。用户发起了一个日常对话。

                请根据以下原则回答：
                1. 友好、亲切地回应
                2. 如果用户打招呼，简单回应并询问是否需要帮助
                3. 适时引导用户使用系统功能
                4. 回答简洁，不超过100字
                5. 使用中文回答
                """;
        }

        try {
            // 判断是否使用深度思考模式
            // 条件: enableThinking=true 且 是咨询类问题(GENERAL_QUESTION)
            boolean useThinkingMode = Boolean.TRUE.equals(enableThinking)
                    && questionType == QuestionType.GENERAL_QUESTION
                    && dashScopeConfig.isThinkingEnabled();

            int budget = (thinkingBudget != null && thinkingBudget >= 10 && thinkingBudget <= 100)
                    ? thinkingBudget : 30;

            log.info("🤖 调用 LLM 生成对话回复: questionType={}, enableThinking={}, thinkingMode={}, budget={}, userInput='{}'",
                    questionType, enableThinking, useThinkingMode, budget,
                    userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput);

            String response;
            if (useThinkingMode) {
                // 深度思考模式 - 适用于咨询类问题
                log.info("🧠 使用深度思考模式生成咨询回复: budget={}", budget);
                ChatCompletionResponse thinkingResponse = dashScopeClient.chatWithThinking(systemPrompt, userInput, budget);
                response = thinkingResponse.getContent();

                if (thinkingResponse.hasError()) {
                    log.warn("深度思考模式返回错误，降级使用普通模式: error={}", thinkingResponse.getError());
                    response = dashScopeClient.chat(systemPrompt, userInput);
                }
            } else {
                // 快速模式 - 适用于闲聊或未开启思考的场景
                response = dashScopeClient.chat(systemPrompt, userInput);
            }

            log.info("✅ LLM 对话回复生成成功: responseLength={}, thinkingMode={}",
                    response != null ? response.length() : 0, useThinkingMode);
            return response;

        } catch (Exception e) {
            log.error("❌ LLM 对话回复生成失败: {}", e.getMessage(), e);

            // 返回友好的错误回复
            if (questionType == QuestionType.GENERAL_QUESTION) {
                return "抱歉，我暂时无法回答您的问题。您可以尝试询问具体的系统操作，如「查询库存」「查看今日考勤」等。";
            } else {
                return "您好！有什么可以帮您的吗？您可以询问库存查询、生产计划、考勤记录等相关问题。";
            }
        }
    }

    /**
     * 执行分析流程 (v7.0新增 - 集成 Agentic RAG)
     *
     * 当检测到用户输入是分析请求时（如"产品状态怎么样"），
     * 调用分析路由服务执行完整的分析流程：
     * 1. 确定分析主题
     * 2. 评估查询复杂度，决定处理模式
     * 3. 根据处理模式选择执行路径:
     *    - FAST/ANALYSIS: 使用 AnalysisRouterService
     *    - MULTI_AGENT/DEEP_REASONING: 使用 AgentOrchestrator 多Agent协作
     * 4. 结合行业知识生成分析报告
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param request 原始请求
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return 分析结果响应
     */
    private IntentExecuteResponse executeAnalysisFlow(String factoryId, String userInput,
                                                       IntentExecuteRequest request,
                                                       Long userId, String userRole) {
        try {
            // 1. 检测分析主题
            AnalysisTopic topic = analysisRouterService.detectAnalysisTopic(userInput);
            log.info("📊 分析主题: topic={}, userInput='{}'", topic,
                    userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput);

            // 2. 构建分析上下文
            AnalysisContext analysisContext = AnalysisContext.builder()
                    .userInput(userInput)
                    .topic(topic)
                    .factoryId(factoryId)
                    .userId(userId)
                    .userRole(userRole)
                    .sessionId(request.getSessionId())
                    .enableThinking(request.getEnableThinking())
                    .thinkingBudget(request.getThinkingBudget())
                    .build();

            // 3. 评估查询复杂度，决定处理模式 (v7.0 Agentic RAG)
            ProcessingMode processingMode = complexityRouter.route(userInput, analysisContext);
            double complexityScore = complexityRouter.estimateComplexity(userInput, analysisContext);
            log.info("🎯 复杂度路由: mode={}, score={}, userInput='{}'",
                    processingMode, String.format("%.2f", complexityScore),
                    userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput);

            // 4. 根据处理模式选择执行路径
            AnalysisResult analysisResult;
            if (processingMode == ProcessingMode.MULTI_AGENT ||
                processingMode == ProcessingMode.DEEP_REASONING) {
                // 复杂查询: 使用多Agent协作 (检索→评估→分析→审核)
                log.info("🤖 启动多Agent协作分析: mode={}", processingMode);
                analysisResult = agentOrchestrator.executeCollaborativeAnalysis(analysisContext);
            } else {
                // 简单/中等查询: 使用单Agent分析路由
                log.info("📝 使用分析路由: mode={}", processingMode);
                analysisResult = analysisRouterService.executeAnalysis(analysisContext);
            }

            // 5. 构建响应
            if (analysisResult.isSuccess()) {
                Map<String, Object> metadata = new HashMap<>();
                metadata.put("analysisTopic", topic.name());
                metadata.put("topicDisplayName", topic.getDisplayName());
                metadata.put("toolsUsed", analysisResult.getToolsUsed());
                metadata.put("processingMode", processingMode.name());
                metadata.put("complexityScore", complexityScore);
                metadata.put("requiresHumanReview", analysisResult.isRequiresHumanReview());

                String status = analysisResult.isRequiresHumanReview()
                        ? "ANALYSIS_PENDING_REVIEW"
                        : "ANALYSIS_COMPLETED";

                return IntentExecuteResponse.builder()
                        .intentRecognized(false)  // 不是业务意图，是分析请求
                        .status(status)
                        .message(analysisResult.getFormattedAnalysis())
                        .metadata(metadata)
                        .executedAt(LocalDateTime.now())
                        .build();
            } else {
                log.warn("分析执行失败: topic={}, mode={}, error={}",
                        topic, processingMode, analysisResult.getErrorMessage());

                // 分析失败时，降级到普通对话回复
                String fallbackResponse = generateConversationalResponse(factoryId, userInput,
                        QuestionType.GENERAL_QUESTION, request.getEnableThinking(), request.getThinkingBudget());

                return IntentExecuteResponse.builder()
                        .intentRecognized(false)
                        .status("COMPLETED")
                        .message(fallbackResponse)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

        } catch (Exception e) {
            log.error("❌ 分析流程执行异常: userInput='{}', error={}", userInput, e.getMessage(), e);

            // 异常时降级到普通对话回复
            String fallbackResponse = generateConversationalResponse(factoryId, userInput,
                    QuestionType.GENERAL_QUESTION, request.getEnableThinking(), request.getThinkingBudget());

            return IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("COMPLETED")
                    .message(fallbackResponse)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 获取工厂的预计算分析上下文
     *
     * 优先级：日报 > 周报 > 月报
     * 仅返回未过期的分析结果
     *
     * @param factoryId 工厂ID
     * @return 分析文本上下文，若无数据返回null
     */
    private String getPrecomputedAnalysisContext(String factoryId) {
        if (factoryId == null || factoryId.isEmpty()) {
            log.debug("无法获取预计算分析: factoryId 为空");
            return null;
        }

        LocalDateTime now = LocalDateTime.now();
        StringBuilder context = new StringBuilder();

        try {
            // 1. 尝试获取最新日报分析
            Optional<AIAnalysisResult> dailyAnalysis = analysisResultRepository
                    .findFirstByFactoryIdAndReportTypeAndExpiresAtAfterOrderByCreatedAtDesc(
                            factoryId, "daily", now);

            if (dailyAnalysis.isPresent()) {
                AIAnalysisResult daily = dailyAnalysis.get();
                context.append("## 最新日报分析 (").append(daily.getPeriodStart().toLocalDate()).append(")\n\n");
                context.append(daily.getAnalysisText()).append("\n\n");
                log.info("📊 获取到工厂日报分析: factoryId={}, createdAt={}", factoryId, daily.getCreatedAt());
            }

            // 2. 尝试获取最新周报分析
            Optional<AIAnalysisResult> weeklyAnalysis = analysisResultRepository
                    .findFirstByFactoryIdAndReportTypeAndExpiresAtAfterOrderByCreatedAtDesc(
                            factoryId, "weekly", now);

            if (weeklyAnalysis.isPresent()) {
                AIAnalysisResult weekly = weeklyAnalysis.get();
                context.append("## 最新周报分析 (").append(weekly.getPeriodStart().toLocalDate())
                       .append(" ~ ").append(weekly.getPeriodEnd().toLocalDate()).append(")\n\n");
                context.append(weekly.getAnalysisText()).append("\n\n");
                log.info("📊 获取到工厂周报分析: factoryId={}, createdAt={}", factoryId, weekly.getCreatedAt());
            }

            // 3. 尝试获取最新月报分析（如果没有日报和周报）
            if (context.length() == 0) {
                Optional<AIAnalysisResult> monthlyAnalysis = analysisResultRepository
                        .findFirstByFactoryIdAndReportTypeAndExpiresAtAfterOrderByCreatedAtDesc(
                                factoryId, "monthly", now);

                if (monthlyAnalysis.isPresent()) {
                    AIAnalysisResult monthly = monthlyAnalysis.get();
                    context.append("## 最新月报分析 (").append(monthly.getPeriodStart().toLocalDate())
                           .append(" ~ ").append(monthly.getPeriodEnd().toLocalDate()).append(")\n\n");
                    context.append(monthly.getAnalysisText()).append("\n\n");
                    log.info("📊 获取到工厂月报分析: factoryId={}, createdAt={}", factoryId, monthly.getCreatedAt());
                }
            }

            if (context.length() > 0) {
                log.info("✅ 预计算分析上下文已加载: factoryId={}, contextLength={}", factoryId, context.length());
                return context.toString();
            } else {
                log.debug("⚠️ 未找到工厂的预计算分析数据: factoryId={}", factoryId);
                return null;
            }

        } catch (Exception e) {
            log.error("❌ 获取预计算分析失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return null;
        }
    }

    // ==================== 多意图执行方法 ====================

    /**
     * 多意图执行
     *
     * @param request       执行请求
     * @param intentResult  意图匹配结果
     * @param context       对话上下文
     * @param factoryId     工厂ID
     * @param userId        用户ID
     * @param userRole      用户角色
     * @return 合并后的执行响应
     */
    private IntentExecuteResponse executeMultiIntent(IntentExecuteRequest request,
                                                      IntentMatchResult intentResult,
                                                      ConversationContext context,
                                                      String factoryId,
                                                      Long userId,
                                                      String userRole) {
        List<IntentMatchResult.IntentMatch> intents = intentResult.getAdditionalIntents();
        if (intents == null || intents.isEmpty()) {
            // 回退到单意图执行
            return executeSingleIntent(request, intentResult, factoryId, userId, userRole);
        }

        // 检查是否需要用户确认
        MultiIntentResult.ExecutionStrategy strategy = intentResult.getExecutionStrategy();
        if (strategy == MultiIntentResult.ExecutionStrategy.USER_CONFIRM
            || intentResult.getConfidence() < 0.7) {
            return buildMultiIntentConfirmationResponse(intentResult);
        }

        // 并行或串行执行
        List<IntentExecuteResponse> results = new java.util.ArrayList<>();

        if (strategy == MultiIntentResult.ExecutionStrategy.PARALLEL) {
            // 并行执行
            results = intents.parallelStream()
                .map(intent -> executeSingleIntentByCode(request, intent.getIntentCode(),
                        intent.getExtractedParams(), factoryId, userId, userRole))
                .collect(java.util.stream.Collectors.toList());
        } else {
            // 串行执行
            for (IntentMatchResult.IntentMatch intent : intents) {
                IntentExecuteResponse result = executeSingleIntentByCode(
                    request, intent.getIntentCode(), intent.getExtractedParams(),
                    factoryId, userId, userRole);
                results.add(result);
            }
        }

        return mergeMultiIntentResults(results, intentResult);
    }

    /**
     * 单意图执行（从多意图中提取）
     */
    private IntentExecuteResponse executeSingleIntent(IntentExecuteRequest request,
                                                       IntentMatchResult intentResult,
                                                       String factoryId,
                                                       Long userId,
                                                       String userRole) {
        // 使用现有的执行逻辑
        if (intentResult.getBestMatch() != null) {
            request.setIntentCode(intentResult.getBestMatch().getIntentCode());
            return executeWithExplicitIntent(factoryId, request, userId, userRole);
        }
        return IntentExecuteResponse.builder()
                .status("FAILED")
                .message("无法识别意图")
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 根据意图代码执行单个意图
     */
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

        return executeWithExplicitIntent(factoryId, subRequest, userId, userRole);
    }

    /**
     * 构建多意图确认响应
     */
    private IntentExecuteResponse buildMultiIntentConfirmationResponse(IntentMatchResult intentResult) {
        List<IntentExecuteResponse.SuggestedAction> actions = new java.util.ArrayList<>();

        // 主意图
        if (intentResult.getBestMatch() != null) {
            actions.add(IntentExecuteResponse.SuggestedAction.builder()
                    .actionCode(intentResult.getBestMatch().getIntentCode())
                    .actionName(intentResult.getBestMatch().getIntentName())
                    .description("执行: " + intentResult.getBestMatch().getDescription())
                    .build());
        }

        // 附加意图
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

    /**
     * 合并多意图执行结果
     */
    private IntentExecuteResponse mergeMultiIntentResults(List<IntentExecuteResponse> results,
                                                           IntentMatchResult intentResult) {
        // 检查是否全部成功
        boolean allSuccess = results.stream()
                .allMatch(r -> "COMPLETED".equals(r.getStatus()) || "SUCCESS".equals(r.getStatus()));

        // 合并数据
        Map<String, Object> mergedData = new java.util.LinkedHashMap<>();
        List<IntentMatchResult.IntentMatch> intents = intentResult.getAdditionalIntents();

        for (int i = 0; i < results.size() && i < (intents != null ? intents.size() : 0); i++) {
            IntentExecuteResponse result = results.get(i);
            String intentCode = intents.get(i).getIntentCode();
            mergedData.put(intentCode, result.getResultData());
        }

        // 生成摘要消息
        String summary = results.stream()
                .map(IntentExecuteResponse::getMessage)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.joining("；"));

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

    // ==================== 对话记忆更新方法 ====================

    /**
     * 更新对话记忆
     */
    private void updateConversationMemory(String sessionId,
                                          IntentExecuteRequest request,
                                          IntentExecuteResponse response,
                                          IntentMatchResult intentResult,
                                          String factoryId,
                                          Long userId) {
        log.info("更新对话记忆: sessionId={}, userInput={}, status={}",
                sessionId,
                request.getUserInput() != null && request.getUserInput().length() > 30 ?
                        request.getUserInput().substring(0, 30) + "..." : request.getUserInput(),
                response.getStatus());
        try {
            // 添加用户消息
            conversationMemoryService.addMessage(sessionId,
                ConversationMessage.user(request.getUserInput()));

            // 添加助手响应
            String assistantMessage = response.getMessage() != null ?
                response.getMessage() : "执行完成";
            conversationMemoryService.addMessage(sessionId,
                ConversationMessage.assistant(assistantMessage));

            // 从响应中提取实体并更新槽位
            extractAndUpdateEntitySlots(sessionId, response, intentResult);

            // 更新最后意图
            if (intentResult != null && intentResult.getBestMatch() != null) {
                conversationMemoryService.updateLastIntent(sessionId,
                        intentResult.getBestMatch().getIntentCode());
            }

        } catch (Exception e) {
            log.warn("Failed to update conversation memory: sessionId={}, error={}",
                    sessionId, e.getMessage());
        }
    }

    /**
     * 从响应中提取实体并更新槽位
     */
    private void extractAndUpdateEntitySlots(String sessionId,
                                              IntentExecuteResponse response,
                                              IntentMatchResult intentResult) {
        // 1. 从受影响实体中提取槽位信息 (如果工具填充了)
        if (response.getAffectedEntities() != null) {
            for (IntentExecuteResponse.AffectedEntity entity : response.getAffectedEntities()) {
                try {
                    com.cretas.aims.dto.conversation.EntitySlot.SlotType slotType =
                            mapEntityTypeToSlotType(entity.getEntityType());
                    if (slotType != null) {
                        com.cretas.aims.dto.conversation.EntitySlot slot =
                                com.cretas.aims.dto.conversation.EntitySlot.builder()
                                        .type(slotType)
                                        .id(entity.getEntityId())
                                        .name(entity.getEntityName())
                                        .build();
                        conversationMemoryService.updateEntitySlot(sessionId, slotType, slot);
                        log.debug("Updated entity slot from affectedEntities: type={}, id={}", slotType, entity.getEntityId());
                    }
                } catch (Exception e) {
                    log.debug("Failed to update entity slot: {}", e.getMessage());
                }
            }
        }

        // 2. 从响应数据中提取实体 (兜底逻辑)
        extractEntitiesFromResponseData(sessionId, response, intentResult);
    }

    /**
     * 从响应数据中提取实体并更新槽位
     */
    @SuppressWarnings("unchecked")
    private void extractEntitiesFromResponseData(String sessionId,
                                                  IntentExecuteResponse response,
                                                  IntentMatchResult intentResult) {
        Object data = response.getResultData();
        if (data == null) {
            log.debug("No resultData to extract entities from: sessionId={}", sessionId);
            return;
        }
        log.info("从响应数据提取实体: sessionId={}, dataType={}", sessionId, data.getClass().getSimpleName());

        try {
            // 处理分页响应或列表响应
            List<Map<String, Object>> items = null;

            if (data instanceof Map) {
                Map<String, Object> dataMap = (Map<String, Object>) data;
                // 分页响应: { content: [...], totalElements: ... }
                if (dataMap.containsKey("content") && dataMap.get("content") instanceof List) {
                    items = (List<Map<String, Object>>) dataMap.get("content");
                }
            } else if (data instanceof List) {
                items = (List<Map<String, Object>>) data;
            }

            if (items == null || items.isEmpty()) {
                log.info("No items found in response data");
                return;
            }

            // 只取第一个结果作为当前上下文的实体
            Object firstItemObj = items.get(0);
            if (firstItemObj == null) {
                log.info("First item is null");
                return;
            }

            log.info("First item type: {}", firstItemObj.getClass().getName());
            Map<String, Object> firstItem;
            if (firstItemObj instanceof Map) {
                firstItem = (Map<String, Object>) firstItemObj;
            } else {
                // Convert DTO to Map using Jackson
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    firstItem = mapper.convertValue(firstItemObj, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                } catch (Exception e) {
                    log.warn("Failed to convert first item to Map: {}", e.getMessage());
                    return;
                }
            }

            // 提取批次信息
            extractBatchSlot(sessionId, firstItem);

            // 提取供应商信息
            extractSupplierSlot(sessionId, firstItem);

            // 提取产品信息
            extractProductSlot(sessionId, firstItem);

        } catch (Exception e) {
            log.debug("Failed to extract entities from response data: {}", e.getMessage());
        }
    }

    private void extractBatchSlot(String sessionId, Map<String, Object> item) {
        log.info("提取批次槽位: sessionId={}, itemKeys={}", sessionId, item.keySet());
        // 尝试多种字段名
        String batchId = getStringValue(item, "id", "batchId", "batch_id");
        String batchNumber = getStringValue(item, "batchNumber", "batch_number", "batchCode");
        log.info("提取结果: batchId={}, batchNumber={}", batchId, batchNumber);

        if (batchNumber != null || batchId != null) {
            com.cretas.aims.dto.conversation.EntitySlot slot =
                    com.cretas.aims.dto.conversation.EntitySlot.builder()
                            .type(com.cretas.aims.dto.conversation.EntitySlot.SlotType.BATCH)
                            .id(batchId != null ? batchId : batchNumber)
                            .name(batchNumber)
                            .build();
            conversationMemoryService.updateEntitySlot(sessionId,
                    com.cretas.aims.dto.conversation.EntitySlot.SlotType.BATCH, slot);
            log.debug("Extracted batch slot from response data: id={}, name={}", slot.getId(), slot.getName());
        }
    }

    private void extractSupplierSlot(String sessionId, Map<String, Object> item) {
        String supplierId = getStringValue(item, "supplierId", "supplier_id");
        String supplierName = getStringValue(item, "supplierName", "supplier_name", "supplier");

        if (supplierId != null || supplierName != null) {
            com.cretas.aims.dto.conversation.EntitySlot slot =
                    com.cretas.aims.dto.conversation.EntitySlot.builder()
                            .type(com.cretas.aims.dto.conversation.EntitySlot.SlotType.SUPPLIER)
                            .id(supplierId)
                            .name(supplierName)
                            .build();
            conversationMemoryService.updateEntitySlot(sessionId,
                    com.cretas.aims.dto.conversation.EntitySlot.SlotType.SUPPLIER, slot);
            log.debug("Extracted supplier slot from response data: id={}, name={}", slot.getId(), slot.getName());
        }
    }

    private void extractProductSlot(String sessionId, Map<String, Object> item) {
        String productId = getStringValue(item, "productTypeId", "productId", "product_id", "materialTypeId");
        String productName = getStringValue(item, "productName", "product_name", "materialTypeName", "productTypeName");

        if (productId != null || productName != null) {
            com.cretas.aims.dto.conversation.EntitySlot slot =
                    com.cretas.aims.dto.conversation.EntitySlot.builder()
                            .type(com.cretas.aims.dto.conversation.EntitySlot.SlotType.PRODUCT)
                            .id(productId)
                            .name(productName)
                            .build();
            conversationMemoryService.updateEntitySlot(sessionId,
                    com.cretas.aims.dto.conversation.EntitySlot.SlotType.PRODUCT, slot);
            log.debug("Extracted product slot from response data: id={}, name={}", slot.getId(), slot.getName());
        }
    }

    private String getStringValue(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null) {
                return value.toString();
            }
        }
        return null;
    }

    /**
     * 实体类型映射到槽位类型
     */
    private com.cretas.aims.dto.conversation.EntitySlot.SlotType mapEntityTypeToSlotType(String entityType) {
        if (entityType == null) return null;

        switch (entityType.toUpperCase()) {
            case "BATCH":
            case "MATERIAL_BATCH":
                return com.cretas.aims.dto.conversation.EntitySlot.SlotType.BATCH;
            case "SUPPLIER":
                return com.cretas.aims.dto.conversation.EntitySlot.SlotType.SUPPLIER;
            case "CUSTOMER":
                return com.cretas.aims.dto.conversation.EntitySlot.SlotType.CUSTOMER;
            case "PRODUCT":
            case "PRODUCT_TYPE":
                return com.cretas.aims.dto.conversation.EntitySlot.SlotType.PRODUCT;
            case "WAREHOUSE":
            case "LOCATION":
                return com.cretas.aims.dto.conversation.EntitySlot.SlotType.WAREHOUSE;
            default:
                return null;
        }
    }

    // ==================== 验证失败处理方法 ====================

    /**
     * 处理验证失败
     */
    private IntentExecuteResponse handleValidationFailure(IntentExecuteResponse originalResponse,
                                                           ResultValidatorService.ValidationResult validationResult,
                                                           IntentExecuteRequest request,
                                                           String factoryId,
                                                           Long userId,
                                                           String userRole) {
        log.warn("Result validation failed: issues={}", validationResult.getIssues());

        // 如果建议重试，尝试使用不同策略
        if (validationResult.isShouldRetry()) {
            log.info("Attempting retry with different strategy");
            // 可以在这里实现重试逻辑
        }

        // 返回带有验证信息的响应
        Map<String, Object> metadata = originalResponse.getMetadata() != null ?
                new HashMap<>(originalResponse.getMetadata()) : new HashMap<>();
        metadata.put("validationFailed", true);
        metadata.put("validationIssues", validationResult.getIssues());
        metadata.put("validationSuggestion", validationResult.getSuggestion());

        return IntentExecuteResponse.builder()
                .intentRecognized(originalResponse.getIntentRecognized())
                .intentCode(originalResponse.getIntentCode())
                .intentName(originalResponse.getIntentName())
                .status("VALIDATION_WARNING")
                .message(originalResponse.getMessage() + " (验证警告: " + validationResult.getSuggestion() + ")")
                .resultData(originalResponse.getResultData())
                .metadata(metadata)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ==================== 多意图执行公共方法 ====================

    /**
     * 执行多意图请求（公共方法）
     *
     * 该方法使用 AIIntentService.recognizeMultiIntent() 识别复合意图，
     * 并根据执行策略（PARALLEL/SEQUENTIAL/USER_CONFIRM）执行所有匹配的意图。
     *
     * 执行策略说明：
     * - PARALLEL: 使用 CompletableFuture 并行执行所有意图
     * - SEQUENTIAL: 按执行顺序依次执行意图
     * - USER_CONFIRM: 不执行，返回需要用户确认的响应
     *
     * @param factoryId 工厂ID
     * @param request 执行请求（包含 userInput）
     * @param userId 当前用户ID
     * @param userRole 当前用户角色
     * @return 合并后的执行响应
     */
    public IntentExecuteResponse executeMultiIntent(String factoryId, IntentExecuteRequest request,
                                                     Long userId, String userRole) {
        log.info("执行多意图识别: factoryId={}, userInput='{}'",
                factoryId,
                request.getUserInput() != null && request.getUserInput().length() > 50 ?
                        request.getUserInput().substring(0, 50) + "..." : request.getUserInput());

        // 检查多意图功能是否启用
        if (!multiIntentEnabled) {
            log.info("多意图功能已禁用，回退到单意图执行");
            return execute(factoryId, request, userId, userRole);
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
            // 回退到单意图执行
            return execute(factoryId, request, userId, userRole);
        }

        // 2. 如果不是多意图或识别失败，回退到单意图执行
        if (multiResult == null || !multiResult.isMultiIntent()
                || multiResult.getIntents() == null || multiResult.getIntents().isEmpty()) {
            log.info("非多意图请求，回退到单意图执行");
            return execute(factoryId, request, userId, userRole);
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
                // 并行执行
                results = executeMultiIntentParallel(multiResult, request, factoryId, userId, userRole);
            } else {
                // 串行执行（SEQUENTIAL 或默认）
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
     * 并行执行多个意图
     */
    private List<IntentExecuteResponse> executeMultiIntentParallel(MultiIntentResult multiResult,
                                                                     IntentExecuteRequest originalRequest,
                                                                     String factoryId,
                                                                     Long userId,
                                                                     String userRole) {
        log.info("并行执行 {} 个意图", multiResult.getIntents().size());

        List<CompletableFuture<IntentExecuteResponse>> futures = multiResult.getIntents().stream()
                .map(intent -> CompletableFuture.supplyAsync(() ->
                        executeSingleIntentFromMultiResult(intent, originalRequest, factoryId, userId, userRole),
                        sseExecutor
                ))
                .collect(Collectors.toList());

        // 等待所有任务完成
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        // 收集结果
        return futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList());
    }

    /**
     * 串行执行多个意图（按 executionOrder 排序）
     */
    private List<IntentExecuteResponse> executeMultiIntentSequential(MultiIntentResult multiResult,
                                                                       IntentExecuteRequest originalRequest,
                                                                       String factoryId,
                                                                       Long userId,
                                                                       String userRole) {
        log.info("串行执行 {} 个意图", multiResult.getIntents().size());

        // 按执行顺序排序
        List<MultiIntentResult.SingleIntentMatch> sortedIntents = multiResult.getIntents().stream()
                .sorted((a, b) -> Integer.compare(a.getExecutionOrder(), b.getExecutionOrder()))
                .collect(Collectors.toList());

        List<IntentExecuteResponse> results = new ArrayList<>();
        for (MultiIntentResult.SingleIntentMatch intent : sortedIntents) {
            IntentExecuteResponse result = executeSingleIntentFromMultiResult(
                    intent, originalRequest, factoryId, userId, userRole);
            results.add(result);

            // 如果某个意图执行失败，可以选择是否继续
            if ("FAILED".equals(result.getStatus())) {
                log.warn("意图执行失败，继续执行下一个: intentCode={}", intent.getIntentCode());
            }
        }
        return results;
    }

    /**
     * 从多意图结果中执行单个意图
     */
    private IntentExecuteResponse executeSingleIntentFromMultiResult(MultiIntentResult.SingleIntentMatch intent,
                                                                       IntentExecuteRequest originalRequest,
                                                                       String factoryId,
                                                                       Long userId,
                                                                       String userRole) {
        log.debug("执行单个意图: intentCode={}, order={}", intent.getIntentCode(), intent.getExecutionOrder());

        // 构建子请求
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

        return executeWithExplicitIntent(factoryId, subRequest, userId, userRole);
    }

    /**
     * 构建多意图用户确认响应
     */
    private IntentExecuteResponse buildMultiIntentUserConfirmationResponse(MultiIntentResult multiResult,
                                                                             String factoryId) {
        List<IntentExecuteResponse.SuggestedAction> actions = new ArrayList<>();

        // 为每个意图创建确认选项
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

        // 添加"全部执行"选项
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

    /**
     * 合并多意图执行结果
     */
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

        // 统计执行结果
        long successCount = results.stream()
                .filter(r -> "SUCCESS".equals(r.getStatus()) || "COMPLETED".equals(r.getStatus()))
                .count();
        long failedCount = results.stream()
                .filter(r -> "FAILED".equals(r.getStatus()))
                .count();

        // 合并执行数据
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

            // 关联原始意图信息
            if (i < multiResult.getIntents().size()) {
                MultiIntentResult.SingleIntentMatch originalIntent = multiResult.getIntents().get(i);
                intentResultMap.put("confidence", originalIntent.getConfidence());
                intentResultMap.put("executionOrder", originalIntent.getExecutionOrder());
            }

            intentResults.add(intentResultMap);
        }
        mergedData.put("intentResults", intentResults);

        // 生成摘要消息
        String summary = results.stream()
                .map(IntentExecuteResponse::getMessage)
                .filter(msg -> msg != null && !msg.isEmpty())
                .collect(Collectors.joining("；"));

        // 确定整体状态
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

    /**
     * 判断错误类型是否适合自动重试
     *
     * 自动重试策略说明：
     * - DATA_INSUFFICIENT: 适合重试，可能是时间范围问题或查询条件问题
     * - FORMAT_ERROR: 适合重试，通常可以通过调整参数格式解决
     * - ANALYSIS_ERROR: 适合重试，重新分析可能得到正确结果
     * - LOGIC_ERROR: 适合重试，注入纠正提示后可能修正逻辑
     * - UNKNOWN: 不适合重试，未知错误重试意义不大
     *
     * @param errorCategory 错误分类
     * @return 是否适合重试
     */
    private boolean isRetryableError(CorrectionRecord.ErrorCategory errorCategory) {
        if (errorCategory == null) {
            return false;
        }
        switch (errorCategory) {
            case DATA_INSUFFICIENT:
            case FORMAT_ERROR:
            case ANALYSIS_ERROR:
            case LOGIC_ERROR:
                return true;
            case UNKNOWN:
            default:
                return false;
        }
    }
}
