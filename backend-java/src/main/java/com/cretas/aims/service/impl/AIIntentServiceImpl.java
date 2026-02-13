package com.cretas.aims.service.impl;

import com.cretas.aims.config.ArenaRLConfig;
import com.cretas.aims.config.IntentKnowledgeBase;
import com.cretas.aims.config.IntentKnowledgeBase.ActionType;
import com.cretas.aims.config.IntentMatchingConfig;
import com.cretas.aims.dto.intent.IntentFeedbackRequest;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentMatchResult.CandidateIntent;
import com.cretas.aims.dto.intent.IntentMatchResult.MatchMethod;
import com.cretas.aims.dto.intent.UnifiedSemanticMatch;
import com.cretas.aims.entity.cache.SemanticCacheConfig;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.SemanticCacheConfigRepository;
import com.cretas.aims.entity.intent.IntentMatchRecord;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.entity.learning.LearnedExpression;
import com.cretas.aims.entity.learning.TrainingSample;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.ConversationService;
import com.cretas.aims.service.ExpressionLearningService;
import com.cretas.aims.service.IntentFeedbackService;
import com.cretas.aims.service.FactoryConfigService;
import com.cretas.aims.service.IntentEmbeddingCacheService;
import com.cretas.aims.service.KeywordEffectivenessService;
import com.cretas.aims.service.KeywordLearningService;
import com.cretas.aims.service.KeywordPromotionService;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.cretas.aims.service.AIIntentDomainDefaultService;
import com.cretas.aims.service.ConversationMemoryService;
import com.cretas.aims.service.MultiLabelIntentClassifier;
import com.cretas.aims.service.QueryPreprocessorService;
import com.cretas.aims.service.TwoStageIntentClassifier;
import com.cretas.aims.service.SemanticRouterService;
import com.cretas.aims.service.LongTextHandler;
import com.cretas.aims.service.RAGRetrievalService;
import com.cretas.aims.service.intent.IntentPreprocessor;
import com.cretas.aims.service.SemanticIntentMatcher;
import com.cretas.aims.service.ClassifierIntentMatcher;
import com.cretas.aims.dto.ClassifierResult;
import com.cretas.aims.dto.SemanticMatchResult;
import com.cretas.aims.dto.intent.RouteDecision;
import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.dto.ai.PreprocessedQuery;
import com.cretas.aims.dto.clarification.ClarificationDecision;
import com.cretas.aims.dto.clarification.ReferenceResult;
import com.cretas.aims.dto.conversation.ConversationContext;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * AI意图服务实现
 *
 * 提供AI请求的意图识别和配置管理:
 * - 基于关键词匹配和正则表达式的意图识别
 * - 支持角色权限校验
 * - 支持缓存优化
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIIntentServiceImpl implements AIIntentService {

    private final AIIntentConfigRepository intentRepository;
    private final IntentMatchRecordRepository recordRepository;
    private final ObjectMapper objectMapper;
    private final LlmIntentFallbackClient llmFallbackClient;
    private final FactoryConfigService factoryConfigService;
    private final KeywordEffectivenessService keywordEffectivenessService;
    private final KeywordPromotionService keywordPromotionService;
    private final KeywordLearningService keywordLearningService;
    private final IntentConfigRollbackService rollbackService;
    private final IntentEmbeddingCacheService embeddingCacheService;
    private final ExpressionLearningService expressionLearningService;
    private final SemanticCacheConfigRepository semanticCacheConfigRepository;
    private final ConversationService conversationService;
    private final AIIntentDomainDefaultService domainDefaultService;
    private final QueryPreprocessorService queryPreprocessorService;
    private final ConversationMemoryService conversationMemoryService;
    private final MultiLabelIntentClassifier multiLabelIntentClassifier;
    private final IntentFeedbackService intentFeedbackService;

    /**
     * v8.0: 两阶段意图分类器
     */
    private final TwoStageIntentClassifier twoStageIntentClassifier;

    /**
     * v14.0: 语义意图匹配器
     * 使用 Embedding 向量相似度替代精确匹配，提高泛化能力
     */
    private SemanticIntentMatcher semanticIntentMatcher;

    @Autowired(required = false)
    public void setSemanticIntentMatcher(SemanticIntentMatcher semanticIntentMatcher) {
        this.semanticIntentMatcher = semanticIntentMatcher;
        log.info("[SemanticMatcher] SemanticIntentMatcher 注入: {}",
                semanticIntentMatcher != null ? "成功" : "未配置");
    }

    /**
     * 意图匹配统一配置
     */
    private final IntentMatchingConfig matchingConfig;

    /**
     * ArenaRL 锦标赛配置
     */
    private final ArenaRLConfig arenaRLConfig;

    /**
     * 意图识别知识库
     */
    private final IntentKnowledgeBase knowledgeBase;

    /**
     * v11.0: 语义路由器服务
     * 在 LLM 调用前进行向量相似度快速决策
     */
    private final SemanticRouterService semanticRouterService;

    /**
     * v11.0: 长文本处理器
     * 对超长输入进行摘要，避免 LLM 调用超时
     */
    private final LongTextHandler longTextHandler;

    /**
     * v11.4: RAG 检索服务
     * 用于检索历史相似案例，增强意图识别
     * 使用 setter 注入，因为实现可能不存在
     */
    private RAGRetrievalService ragRetrievalService;

    @Autowired(required = false)
    public void setRagRetrievalService(RAGRetrievalService ragRetrievalService) {
        this.ragRetrievalService = ragRetrievalService;
        log.info("[RAG] RAGRetrievalService 注入: {}", ragRetrievalService != null ? "成功" : "未配置");
    }

    /**
     * Phase 3: 智能澄清服务
     * 基于业务实体检测决定是否需要澄清
     */
    private com.cretas.aims.service.SmartClarificationService smartClarificationService;

    @Autowired(required = false)
    public void setSmartClarificationService(
            com.cretas.aims.service.SmartClarificationService smartClarificationService) {
        this.smartClarificationService = smartClarificationService;
        log.info("[Clarification] SmartClarificationService 注入: {}",
                smartClarificationService != null ? "成功" : "未配置");
    }

    /**
     * Phase 3: 指代消解服务
     * 会话级指代消解
     */
    private com.cretas.aims.service.CoreferenceResolutionService coreferenceResolutionService;

    @Autowired(required = false)
    public void setCoreferenceResolutionService(
            com.cretas.aims.service.CoreferenceResolutionService coreferenceResolutionService) {
        this.coreferenceResolutionService = coreferenceResolutionService;
        log.info("[Coreference] CoreferenceResolutionService 注入: {}",
                coreferenceResolutionService != null ? "成功" : "未配置");
    }

    /**
     * v15.0: 长句子预处理器
     * 对超过阈值的长句子提取关键词，提高意图识别准确率
     */
    private IntentPreprocessor intentPreprocessor;

    @Autowired(required = false)
    public void setIntentPreprocessor(IntentPreprocessor intentPreprocessor) {
        this.intentPreprocessor = intentPreprocessor;
        log.info("[IntentPreprocessor] IntentPreprocessor 注入: {}",
                intentPreprocessor != null ? "成功" : "未配置");
    }

    /**
     * v16.0: Python 分类器意图匹配器
     * 使用 BERT 模型直接分类，185 个意图类别的 softmax 概率
     * 准确率: 97.45% Top-1, 99.68% Top-3
     */
    private ClassifierIntentMatcher classifierIntentMatcher;

    @Autowired(required = false)
    public void setClassifierIntentMatcher(ClassifierIntentMatcher classifierIntentMatcher) {
        this.classifierIntentMatcher = classifierIntentMatcher;
        log.info("[Classifier] ClassifierIntentMatcher 注入: {}",
                classifierIntentMatcher != null ? "成功" : "未配置");
    }

    /**
     * 是否启用查询预处理
     */
    @Value("${cretas.ai.preprocess.enabled:true}")
    private boolean preprocessEnabled;

    /**
     * v11.0: 是否启用语义路由器
     */
    @Value("${cretas.ai.semantic-router.enabled:true}")
    private boolean semanticRouterEnabled;

    /**
     * v11.0: 是否启用长文本处理
     */
    @Value("${cretas.ai.long-text.enabled:true}")
    private boolean longTextEnabled;

    /**
     * v14.0: 是否启用语义相似度匹配
     * 在精确短语匹配失败后，使用向量相似度进行泛化匹配
     */
    @Value("${cretas.ai.semantic-similarity.enabled:true}")
    private boolean semanticSimilarityEnabled;

    /**
     * v16.0: 是否启用 Python 分类器
     * 在短语匹配失败后，使用 BERT 模型进行直接分类
     */
    @Value("${python-classifier.enabled:false}")
    private boolean classifierEnabled;

    /**
     * v16.0: 分类器高置信度阈值
     * 超过此阈值时直接返回结果，跳过后续匹配
     */
    @Value("${python-classifier.high-confidence-threshold:0.85}")
    private double classifierHighConfidenceThreshold;

    // ==================== 意图识别 ====================

    @Override
    public Optional<AIIntentConfig> recognizeIntent(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return Optional.empty();
        }

        List<AIIntentConfig> allIntents = getAllIntents();
        String normalizedInput = userInput.toLowerCase().trim();

        // 优先使用正则匹配
        for (AIIntentConfig intent : allIntents) {
            if (matchesByRegex(intent, normalizedInput)) {
                log.debug("Intent matched by regex: {} for input: {}", intent.getIntentCode(), userInput);
                return Optional.of(intent);
            }
        }

        // 然后使用关键词匹配
        List<AIIntentConfig> keywordMatches = new ArrayList<>();
        for (AIIntentConfig intent : allIntents) {
            int matchScore = calculateKeywordMatchScore(intent, normalizedInput);
            if (matchScore > 0) {
                keywordMatches.add(intent);
            }
        }

        // 按优先级和匹配分数排序，返回最佳匹配
        if (!keywordMatches.isEmpty()) {
            keywordMatches.sort((a, b) -> {
                int priorityCompare = b.getPriority().compareTo(a.getPriority());
                if (priorityCompare != 0) return priorityCompare;
                return calculateKeywordMatchScore(b, normalizedInput) -
                       calculateKeywordMatchScore(a, normalizedInput);
            });
            AIIntentConfig bestMatch = keywordMatches.get(0);
            log.debug("Intent matched by keywords: {} for input: {}", bestMatch.getIntentCode(), userInput);
            return Optional.of(bestMatch);
        }

        log.debug("No intent matched for input: {}", userInput);
        return Optional.empty();
    }

    @Override
    public Optional<AIIntentConfig> recognizeIntent(String factoryId, String userInput) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("recognizeIntent called without factoryId, returning empty");
            return Optional.empty();
        }
        if (userInput == null || userInput.trim().isEmpty()) {
            return Optional.empty();
        }

        List<AIIntentConfig> allIntents = getAllIntents(factoryId);
        String normalizedInput = userInput.toLowerCase().trim();

        // 优先使用正则匹配
        for (AIIntentConfig intent : allIntents) {
            if (matchesByRegex(intent, normalizedInput)) {
                log.debug("Intent matched by regex: {} for input: {} (factoryId: {})",
                         intent.getIntentCode(), userInput, factoryId);
                return Optional.of(intent);
            }
        }

        // 然后使用关键词匹配
        List<AIIntentConfig> keywordMatches = new ArrayList<>();
        for (AIIntentConfig intent : allIntents) {
            int matchScore = calculateKeywordMatchScore(intent, normalizedInput);
            if (matchScore > 0) {
                keywordMatches.add(intent);
            }
        }

        // 按优先级和匹配分数排序，返回最佳匹配
        if (!keywordMatches.isEmpty()) {
            keywordMatches.sort((a, b) -> {
                int priorityCompare = b.getPriority().compareTo(a.getPriority());
                if (priorityCompare != 0) return priorityCompare;
                return calculateKeywordMatchScore(b, normalizedInput) -
                       calculateKeywordMatchScore(a, normalizedInput);
            });
            AIIntentConfig bestMatch = keywordMatches.get(0);
            log.debug("Intent matched by keywords: {} for input: {} (factoryId: {})",
                     bestMatch.getIntentCode(), userInput, factoryId);
            return Optional.of(bestMatch);
        }

        log.debug("No intent matched for input: {} (factoryId: {})", userInput, factoryId);
        return Optional.empty();
    }

    @Override
    public List<AIIntentConfig> recognizeAllIntents(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return Collections.emptyList();
        }

        List<AIIntentConfig> allIntents = getAllIntents();
        String normalizedInput = userInput.toLowerCase().trim();

        return allIntents.stream()
                .filter(intent -> matchesByRegex(intent, normalizedInput) ||
                                  calculateKeywordMatchScore(intent, normalizedInput) > 0)
                .sorted(Comparator.comparing(AIIntentConfig::getPriority).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public List<AIIntentConfig> recognizeAllIntents(String factoryId, String userInput) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("recognizeAllIntents called without factoryId, returning empty list");
            return Collections.emptyList();
        }
        if (userInput == null || userInput.trim().isEmpty()) {
            return Collections.emptyList();
        }

        List<AIIntentConfig> allIntents = getAllIntents(factoryId);
        String normalizedInput = userInput.toLowerCase().trim();

        List<AIIntentConfig> matches = allIntents.stream()
                .filter(intent -> matchesByRegex(intent, normalizedInput) ||
                                  calculateKeywordMatchScore(intent, normalizedInput) > 0)
                .sorted(Comparator.comparing(AIIntentConfig::getPriority).reversed())
                .collect(Collectors.toList());

        log.debug("Found {} matching intents for input: {} (factoryId: {})",
                 matches.size(), userInput, factoryId);
        return matches;
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, int topN) {
        return recognizeIntentWithConfidence(userInput, null, topN, null, null, null);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId, int topN, Long userId, String userRole) {
        return recognizeIntentWithConfidence(userInput, factoryId, topN, userId, userRole, null);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId, int topN,
                                                           Long userId, String userRole, String sessionId) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return IntentMatchResult.empty(userInput);
        }

        // ========== v11.12: 移除写操作前置拦截 ==========
        // 写操作（删除、修改、添加等）应通过 requiredRoles 权限机制控制，而非在意图识别阶段拦截
        // 这允许系统正确识别 PROCESSING_BATCH_CREATE, SHIPMENT_CREATE 等写操作意图
        // 权限检查在执行阶段由 sensitivityLevel + requiredRoles 机制保障
        // if (isWriteOnlyInput(userInput)) {
        //     log.info("v11.2 写操作检测前置: 检测到写操作，直接拒绝: input='{}'", userInput);
        //     IntentMatchResult noMatchResult = IntentMatchResult.builder()
        //             .bestMatch(null)
        //             .topCandidates(Collections.emptyList())
        //             .confidence(0.0)
        //             .matchMethod(MatchMethod.NONE)
        //             .userInput(userInput)
        //             .requiresConfirmation(true)
        //             .clarificationQuestion("抱歉，AI 助手目前只支持数据查询，不支持删除、修改、添加等操作。如需执行写操作，请使用对应的管理功能。")
        //             .build();
        //     return noMatchResult;
        // }

        // === 新增：查询预处理 ===
        String processedInput = userInput;
        PreprocessedQuery preprocessedQuery = null;
        QueryPreprocessorService.EnhancedPreprocessResult enhancedResult = null;
        IntentKnowledgeBase.VerbNounDisambiguationResult verbNounResult = null;

        if (preprocessEnabled) {
            try {
                // Step 1: 增强预处理（语气词过滤、口语标准化、核心提取）
                enhancedResult = queryPreprocessorService.enhancedPreprocess(userInput);
                if (enhancedResult != null && enhancedResult.getProcessedInput() != null) {
                    processedInput = enhancedResult.getProcessedInput();
                    log.debug("Enhanced preprocess: '{}' -> '{}', features={}",
                            userInput, processedInput, enhancedResult.getQueryFeatures());
                }

                // Step 2: 动词+名词消歧（在 IntentKnowledgeBase 中进行）
                // v4.5修复: 使用原始输入检测时间上下文，避免预处理后丢失时间词
                // 例如 "上周入库的原料" 预处理后变成 "入库原料"，导致时间上下文丢失
                verbNounResult = knowledgeBase.disambiguateByVerbNoun(processedInput, userInput);
                if (verbNounResult != null && verbNounResult.isDisambiguated()) {
                    log.info("VerbNoun disambiguation: '{}' -> intent={} (verb={}, noun={}, conf={})",
                            processedInput, verbNounResult.getRecommendedIntent(),
                            verbNounResult.getVerb(), verbNounResult.getNoun(),
                            verbNounResult.getConfidence());
                }

                // Step 3: 如果有会话上下文，执行完整预处理（指代消解等）
                if (sessionId != null) {
                    ConversationContext context = conversationMemoryService
                        .getOrCreateContext(factoryId, userId, sessionId);

                    // Phase 3: 增强指代消解（使用 CoreferenceResolutionService）
                    processedInput = performCoreferenceResolution(processedInput, context);

                    preprocessedQuery = queryPreprocessorService.preprocess(processedInput, context);
                    if (preprocessedQuery != null && preprocessedQuery.getFinalQuery() != null) {
                        processedInput = preprocessedQuery.getFinalQuery();
                    }
                }

                log.info("Query preprocessed: '{}' -> '{}'", userInput, processedInput);
            } catch (Exception e) {
                log.warn("Query preprocessing failed, using original input", e);
            }
        }

        // ========== v11.0: 长文本处理 ==========
        // 对超长输入进行摘要，避免 LLM 调用超时
        if (longTextEnabled && longTextHandler != null && longTextHandler.needsProcessing(processedInput)) {
            try {
                String originalLength = String.valueOf(processedInput.length());
                processedInput = longTextHandler.processForIntent(processedInput);
                log.info("v11.0 LongTextHandler: {}字 -> {}字", originalLength, processedInput.length());
            } catch (Exception e) {
                log.warn("Long text processing failed, using original input: {}", e.getMessage());
            }
        }

        // ========== v15.0: 长句子关键词提取 ==========
        // 对超过阈值的长句子提取关键词，提高意图分类准确率
        // IntentPreprocessor 专注于关键词提取，与 LongTextHandler 的摘要功能互补
        List<String> multiIntentSegments = null;
        if (intentPreprocessor != null && intentPreprocessor.needsPreprocessing(processedInput)) {
            try {
                String originalInput = processedInput;

                // Step 1: 检测并拆分多意图句子
                multiIntentSegments = intentPreprocessor.splitMultiIntent(processedInput);
                if (multiIntentSegments != null && multiIntentSegments.size() > 1) {
                    log.info("v15.0 IntentPreprocessor 检测到多意图: input='{}', segments={}",
                            originalInput, multiIntentSegments);
                    // 多意图场景：后续会通过 multiIntentSegments 分别处理每个意图
                } else {
                    // 单意图场景：提取关键词用于分类
                    String keywords = intentPreprocessor.extractKeywords(processedInput);
                    if (keywords != null && !keywords.trim().isEmpty()) {
                        processedInput = keywords;
                        log.info("v15.0 IntentPreprocessor 关键词提取: '{}' -> '{}'",
                                originalInput, processedInput);
                    }
                }
            } catch (Exception e) {
                log.warn("IntentPreprocessor processing failed, using original input: {}", e.getMessage());
            }
        }

        // ========== v12.2 Phase 3: 模糊输入强制澄清 ==========
        // 在任何匹配之前检测极度模糊的输入，直接触发澄清
        IntentMatchResult vagueInputResult = checkAndHandleVagueInput(userInput, factoryId, userId, sessionId);
        if (vagueInputResult != null) {
            return vagueInputResult;
        }

        // ========== v11.7: 多意图和不完整输入前置检测 ==========
        // 在短语短路之前检测特殊场景，避免绕过后续处理逻辑
        boolean skipPhraseShortcut = false;

        // 检测1: 多意图触发词 - 如果包含 "和/还有/同时" 等，需要走多意图流程
        if (containsMultiIntentTrigger(userInput)) {
            log.info("v11.7 检测到多意图触发词，跳过短语短路: input='{}'", userInput);
            skipPhraseShortcut = true;
        }

        // 检测2: 不完整输入 - 需要触发 clarification (Phase 3 智能澄清)
        if (!skipPhraseShortcut) {
            // Phase 3: 获取会话上下文用于智能澄清决策
            ConversationContext clarificationContext = null;
            if (sessionId != null && conversationMemoryService != null) {
                try {
                    clarificationContext = conversationMemoryService.getOrCreateContext(factoryId, userId, sessionId);
                } catch (Exception e) {
                    log.debug("获取会话上下文失败，使用无上下文澄清: {}", e.getMessage());
                }
            }

            // 使用智能澄清决策
            ClarificationDecision clarificationDecision = makeSmartClarificationDecision(
                    userInput, null, clarificationContext);

            if (clarificationDecision.isNeedClarification()) {
                log.info("Phase 3 智能澄清触发: input='{}', type={}, missingSlots={}",
                        userInput, clarificationDecision.getClarificationType(),
                        clarificationDecision.getMissingSlots());

                // 构建澄清结果
                IntentMatchResult clarificationResult = buildClarificationResult(
                        userInput, clarificationDecision, null, clarificationContext);
                clarificationResult.setMatchMethod(MatchMethod.REJECTED);

                return clarificationResult;
            } else if (clarificationDecision.isCanProceedWithInference()
                    && clarificationDecision.hasInferredDefaults()) {
                // 可以使用推断值继续执行，记录推断信息
                log.info("Phase 3: 使用推断值继续: input='{}', inferred={}",
                        userInput, clarificationDecision.getInferredDefaults());
            }
        }

        // ========== v11.5: 短语匹配优先短路 + 实体-意图冲突检测 ==========
        // 只有明确的单意图输入才走短语短路
        if (!skipPhraseShortcut) {
            Optional<String> earlyPhraseMatch = knowledgeBase.matchPhrase(userInput);
            if (earlyPhraseMatch.isPresent()) {
                String matchedIntentCode = earlyPhraseMatch.get();

                // v11.5: 检测实体-意图冲突，如果有冲突则不走短路
                boolean hasConflict = knowledgeBase.hasEntityIntentConflict(userInput, matchedIntentCode);
                if (hasConflict) {
                    log.info("v11.5 跳过短语短路: input='{}' 存在实体-意图冲突，将走语义路由", userInput);
                } else {
                    List<AIIntentConfig> allIntents = getAllIntents(factoryId);
                    Optional<AIIntentConfig> intentOpt = allIntents.stream()
                            .filter(i -> i.getIntentCode().equals(matchedIntentCode))
                            .findFirst();

                    if (intentOpt.isPresent()) {
                        AIIntentConfig intent = intentOpt.get();
                        ActionType detectedActionType = knowledgeBase.detectActionType(userInput.toLowerCase().trim());
                        log.info("v11.7 PhraseMatch shortcut: input='{}', intent={}", userInput, matchedIntentCode);

                        IntentMatchResult phraseResult = IntentMatchResult.builder()
                                .bestMatch(intent)
                                .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                        intent, 0.98, 98, Collections.emptyList(), MatchMethod.PHRASE_MATCH)))
                                .confidence(0.98)
                                .matchMethod(MatchMethod.PHRASE_MATCH)
                                .matchedKeywords(Collections.emptyList())
                                .isStrongSignal(true)
                                .requiresConfirmation(false)
                                .userInput(userInput)
                                .actionType(detectedActionType)
                                .build();

                        if (preprocessedQuery != null) {
                            phraseResult.setPreprocessedQuery(preprocessedQuery);
                        }

                        saveIntentMatchRecord(phraseResult, factoryId, userId, sessionId, false);
                        return applyNegationConversion(phraseResult, enhancedResult, factoryId);
                    }
                }
            }
        }

        // ========== v16.0: Python 分类器快速决策 ==========
        // 使用 BERT 模型直接分类，准确率 97.45% Top-1
        // 高置信度直接返回，低置信度继续走语义路由器
        if (classifierEnabled && classifierIntentMatcher != null && classifierIntentMatcher.isAvailable()
                && !skipPhraseShortcut) {
            try {
                Optional<ClassifierResult> classifierResult = classifierIntentMatcher.classify(processedInput);

                if (classifierResult.isPresent()) {
                    ClassifierResult result = classifierResult.get();
                    log.info("v16.0 Classifier: intent={}, confidence={}, latency={}ms",
                            result.getIntentCode(), String.format("%.4f", result.getConfidence()), result.getLatencyMs());

                    // 高置信度直接返回
                    if (result.getConfidence() >= classifierHighConfidenceThreshold) {
                        List<AIIntentConfig> allIntents = getAllIntents(factoryId);
                        Optional<AIIntentConfig> intentOpt = allIntents.stream()
                                .filter(i -> i.getIntentCode().equals(result.getIntentCode()))
                                .findFirst();

                        if (intentOpt.isPresent()) {
                            AIIntentConfig intent = intentOpt.get();
                            ActionType detectedActionType = knowledgeBase.detectActionType(userInput.toLowerCase().trim());

                            IntentMatchResult classifierMatchResult = IntentMatchResult.builder()
                                    .bestMatch(intent)
                                    .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                            intent, result.getConfidence(),
                                            (int) (result.getConfidence() * 100),
                                            Collections.emptyList(), MatchMethod.CLASSIFIER)))
                                    .confidence(result.getConfidence())
                                    .matchMethod(MatchMethod.CLASSIFIER)
                                    .matchedKeywords(Collections.emptyList())
                                    .isStrongSignal(result.getConfidence() >= 0.9)
                                    .requiresConfirmation(false)
                                    .userInput(userInput)
                                    .actionType(detectedActionType)
                                    .build();

                            if (preprocessedQuery != null) {
                                classifierMatchResult.setPreprocessedQuery(preprocessedQuery);
                            }

                            saveIntentMatchRecord(classifierMatchResult, factoryId, userId, sessionId, false);

                            log.info("v16.0 CLASSIFIER_DIRECT: intent={}, confidence={}, saved LLM call",
                                    result.getIntentCode(), String.format("%.4f", result.getConfidence()));

                            return applyNegationConversion(classifierMatchResult, enhancedResult, factoryId);
                        }
                    }
                    // 低置信度记录日志，继续走语义路由器
                    log.debug("v16.0 Classifier confidence too low ({} < {}), proceeding to semantic router",
                            String.format("%.4f", result.getConfidence()), classifierHighConfidenceThreshold);
                }
            } catch (Exception e) {
                log.warn("v16.0 Classifier failed, falling back to semantic router: {}", e.getMessage());
            }
        }

        // ========== v11.0: 语义路由器快速决策 ==========
        // 在 LLM 调用前使用向量相似度做快速路由决策
        // - DIRECT_EXECUTE (score >= 0.92): 直接返回，跳过 LLM
        // - NEED_RERANKING (score >= 0.75): 只对 top candidates 调用 LLM 确认
        // - NEED_FULL_LLM (score < 0.75): 走完整 LLM 流程
        // v12.1: 当检测到多意图触发词时，跳过语义路由器，走多意图检测流程
        if (semanticRouterEnabled && semanticRouterService.isAvailable() && !skipPhraseShortcut) {
            try {
                RouteDecision routeDecision = semanticRouterService.route(factoryId, processedInput, topN);

                if (routeDecision != null) {
                    log.info("v11.0 SemanticRouter: type={}, score={}, intent={}, latency={}ms",
                            routeDecision.getRouteType(),
                            routeDecision.getTopScore(),
                            routeDecision.getBestMatchIntentCode(),
                            routeDecision.getRouteLatencyMs());

                    // DIRECT_EXECUTE: 高置信度，直接返回
                    if (routeDecision.canDirectExecute()) {
                        String routedIntent = routeDecision.getBestMatchIntentCode();

                        // v13: 食品实体冲突检测 — 防止"生产牛肉"等食品知识查询被语义路由到工厂意图
                        if (knowledgeBase.hasEntityIntentConflict(userInput, routedIntent)) {
                            log.info("v13 SemanticRouter食品冲突: input='{}' 路由到 '{}' 但包含食品实体，修正为FOOD_KNOWLEDGE_QUERY",
                                    userInput, routedIntent);
                            List<AIIntentConfig> allIntentsForFood = getAllIntents(factoryId);
                            Optional<AIIntentConfig> foodIntentOpt = allIntentsForFood.stream()
                                    .filter(i -> "FOOD_KNOWLEDGE_QUERY".equals(i.getIntentCode()))
                                    .findFirst();
                            if (foodIntentOpt.isPresent()) {
                                AIIntentConfig foodIntent = foodIntentOpt.get();
                                IntentMatchResult foodResult = IntentMatchResult.builder()
                                        .bestMatch(foodIntent)
                                        .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                                foodIntent, 0.90, 90, Collections.emptyList(), MatchMethod.SEMANTIC)))
                                        .confidence(0.90)
                                        .matchMethod(MatchMethod.SEMANTIC)
                                        .matchedKeywords(Collections.emptyList())
                                        .isStrongSignal(true)
                                        .requiresConfirmation(false)
                                        .userInput(userInput)
                                        .build();
                                if (preprocessedQuery != null) {
                                    foodResult.setPreprocessedQuery(preprocessedQuery);
                                }
                                saveIntentMatchRecord(foodResult, factoryId, userId, sessionId, false);
                                return foodResult;
                            }
                            // fallback: 如果找不到 FOOD_KNOWLEDGE_QUERY 意图配置，继续走完整流程
                            log.warn("v13 FOOD_KNOWLEDGE_QUERY 意图配置不存在，继续走完整流程");
                        }

                        IntentMatchResult directResult = convertRouteDecisionToResult(
                                routeDecision, userInput, processedInput, enhancedResult);

                        // 附加预处理结果
                        if (preprocessedQuery != null) {
                            directResult.setPreprocessedQuery(preprocessedQuery);
                        }

                        // 记录匹配
                        saveIntentMatchRecord(directResult, factoryId, userId, sessionId, false);

                        log.info("v11.0 DIRECT_EXECUTE: intent={}, score={}, saved {}ms by skipping LLM",
                                routeDecision.getBestMatchIntentCode(),
                                routeDecision.getTopScore(),
                                estimateLLMSavings());

                        return applyNegationConversion(directResult, enhancedResult, factoryId);
                    }

                    // NEED_RERANKING: 中等置信度，使用候选进行 LLM Reranking
                    if (routeDecision.needsReranking() && !routeDecision.getCandidates().isEmpty()) {
                        IntentMatchResult rerankingResult = performSemanticRouterReranking(
                                routeDecision, processedInput, userInput, factoryId,
                                userId, userRole, enhancedResult);

                        if (rerankingResult != null && rerankingResult.hasMatch()) {
                            // 附加预处理结果
                            if (preprocessedQuery != null) {
                                rerankingResult.setPreprocessedQuery(preprocessedQuery);
                            }

                            log.info("v11.0 NEED_RERANKING completed: intent={}, finalScore={}",
                                    rerankingResult.getBestMatch().getIntentCode(),
                                    rerankingResult.getConfidence());

                            return applyNegationConversion(rerankingResult, enhancedResult, factoryId);
                        }
                        // Reranking 失败，继续走完整流程
                        log.debug("v11.0 NEED_RERANKING failed, falling through to full LLM");
                    }

                    // NEED_FULL_LLM: 低置信度，继续走完整流程
                    log.debug("v11.0 NEED_FULL_LLM: proceeding to doRecognizeIntentWithConfidence");
                }
            } catch (Exception e) {
                log.warn("v11.0 SemanticRouter failed, falling back to standard flow: {}", e.getMessage());
                // 继续走标准流程
            }
        }

        // 使用处理后的输入进行意图识别
        // v12.1: 传递 skipPhraseShortcut 标志，确保多意图检测能执行
        IntentMatchResult result = doRecognizeIntentWithConfidence(
                processedInput, userInput, factoryId, topN, userId, userRole,
                enhancedResult, verbNounResult, skipPhraseShortcut);

        // 附加预处理结果到匹配结果（如果有）
        if (preprocessedQuery != null && result != null) {
            result.setPreprocessedQuery(preprocessedQuery);
        }

        // v7.5: 否定语义意图转换
        // 当检测到否定语义时，将动作类意图转换为对应的查询类意图
        if (result != null && result.getBestMatch() != null && enhancedResult != null) {
            QueryPreprocessorService.NegationInfo negationInfo = enhancedResult.getNegationInfo();
            if (negationInfo != null && negationInfo.hasNegation()) {
                String originalIntentCode = result.getBestMatch().getIntentCode();
                String convertedIntentCode = convertNegationIntent(originalIntentCode, true);

                if (!convertedIntentCode.equals(originalIntentCode)) {
                    // 查找转换后的意图配置
                    AIIntentConfig convertedConfig = getIntentConfigByCode(factoryId, convertedIntentCode);
                    if (convertedConfig != null) {
                        log.info("v7.5否定语义转换成功: {} -> {}, 否定词='{}', 排除内容='{}'",
                                originalIntentCode, convertedIntentCode,
                                negationInfo.getNegationWord(), negationInfo.getExcludedContent());

                        // 重建结果，使用转换后的意图
                        result = result.toBuilder()
                                .bestMatch(convertedConfig)
                                .build();
                    } else {
                        log.warn("v7.5否定语义转换失败: 找不到意图配置 {}", convertedIntentCode);
                    }
                }
            }
        }

        return result;
    }

    /**
     * 内部意图识别核心逻辑
     *
     * @param processedInput 预处理后的输入
     * @param originalInput 原始用户输入
     * @param factoryId 工厂ID
     * @param topN 返回候选数量
     * @param userId 用户ID
     * @param userRole 用户角色
     * @param enhancedResult 增强预处理结果（可为 null）
     * @param verbNounResult 动词+名词消歧结果（可为 null）
     * @return 意图匹配结果
     */
    private IntentMatchResult doRecognizeIntentWithConfidence(String processedInput, String originalInput,
                                                              String factoryId, int topN,
                                                              Long userId, String userRole,
                                                              QueryPreprocessorService.EnhancedPreprocessResult enhancedResult,
                                                              IntentKnowledgeBase.VerbNounDisambiguationResult verbNounResult,
                                                              boolean skipPhraseShortcut) {
        String userInput = processedInput; // 使用处理后的输入进行匹配

        // ========== v11.2修复: Layer 0 - 短语匹配优先短路 ==========
        // v4.5原逻辑：只有当原始/处理后短语匹配结果不同时才短路
        // v11.2修复：短语匹配成功即短路，确保高质量短语映射优先生效
        // 这修复了 "销售排名"、"质检结果" 等精确短语被语义匹配覆盖的问题
        // v12.1修复: 当检测到多意图触发词时，跳过短语短路，确保多意图检测能执行
        Optional<String> originalPhraseMatch = knowledgeBase.matchPhrase(originalInput);
        if (originalPhraseMatch.isPresent() && !skipPhraseShortcut) {
            // 短语匹配成功，直接使用短语映射结果
            String matchedIntent = originalPhraseMatch.get();
            List<AIIntentConfig> allIntents = getAllIntents(factoryId);
            Optional<AIIntentConfig> intentOpt = allIntents.stream()
                    .filter(i -> i.getIntentCode().equals(matchedIntent))
                    .findFirst();

            if (intentOpt.isPresent()) {
                AIIntentConfig intent = intentOpt.get();
                ActionType detectedActionType = knowledgeBase.detectActionType(originalInput.toLowerCase().trim());
                log.info("v4.5原始输入短语匹配: original='{}', processed='{}', intent={}",
                        originalInput, processedInput, matchedIntent);

                IntentMatchResult result = IntentMatchResult.builder()
                        .bestMatch(intent)
                        .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                intent, 0.95, 95, Collections.emptyList(), MatchMethod.SEMANTIC)))
                        .confidence(0.95)
                        .matchMethod(MatchMethod.SEMANTIC)
                        .matchedKeywords(Collections.emptyList())
                        .isStrongSignal(true)
                        .requiresConfirmation(false)
                        .userInput(originalInput)
                        .actionType(detectedActionType)
                        .build();

                saveIntentMatchRecord(result, factoryId, null, null, false);
                return result;
            }
        }

        // ========== v11.13: 处理后输入短语匹配 ==========
        // 拼写纠正后的输入可能匹配到短语，如 "考亲记录" -> "考勤记录" -> ATTENDANCE_HISTORY
        // v12.1修复: 当检测到多意图触发词时，跳过短语短路，确保多意图检测能执行
        if (!processedInput.equals(originalInput) && !skipPhraseShortcut) {
            Optional<String> processedPhraseMatch = knowledgeBase.matchPhrase(processedInput);
            if (processedPhraseMatch.isPresent()) {
                String matchedIntent = processedPhraseMatch.get();
                List<AIIntentConfig> allIntents = getAllIntents(factoryId);
                Optional<AIIntentConfig> intentOpt = allIntents.stream()
                        .filter(i -> i.getIntentCode().equals(matchedIntent))
                        .findFirst();

                if (intentOpt.isPresent()) {
                    AIIntentConfig intent = intentOpt.get();
                    ActionType detectedActionType = knowledgeBase.detectActionType(processedInput.toLowerCase().trim());
                    log.info("v11.13处理后输入短语匹配: original='{}', processed='{}', intent={}",
                            originalInput, processedInput, matchedIntent);

                    IntentMatchResult result = IntentMatchResult.builder()
                            .bestMatch(intent)
                            .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                    intent, 0.93, 93, Collections.emptyList(), MatchMethod.SEMANTIC)))
                            .confidence(0.93)
                            .matchMethod(MatchMethod.SEMANTIC)
                            .matchedKeywords(Collections.emptyList())
                            .isStrongSignal(true)
                            .requiresConfirmation(false)
                            .userInput(originalInput)
                            .actionType(detectedActionType)
                            .build();

                    saveIntentMatchRecord(result, factoryId, null, null, false);
                    return result;
                }
            }
        }

        // ========== v14.0 Layer 0.4: 语义相似度匹配 ==========
        // 当精确短语匹配失败时，使用向量相似度进行泛化匹配
        // 例如: "销量最高" 语义匹配到 "销售排名" -> REPORT_KPI
        // v14.0修复: 当检测到多意图触发词时，跳过此快速路径
        if (!skipPhraseShortcut && semanticSimilarityEnabled && semanticIntentMatcher != null
                && semanticIntentMatcher.isSemanticMatchingAvailable()) {
            try {
                SemanticMatchResult semanticResult = semanticIntentMatcher.matchBySimilarity(userInput, null);

                if (semanticResult.isMatched()) {
                    String matchedIntentCode = semanticResult.getIntentCode();
                    List<AIIntentConfig> allIntents = getAllIntents(factoryId);

                    Optional<AIIntentConfig> intentOpt = allIntents.stream()
                            .filter(i -> i.getIntentCode().equals(matchedIntentCode))
                            .findFirst();

                    if (intentOpt.isPresent()) {
                        AIIntentConfig intent = intentOpt.get();
                        ActionType detectedActionType = knowledgeBase.detectActionType(userInput.toLowerCase().trim());

                        log.info("v14.0语义相似度匹配: input='{}', matchedPhrase='{}', intent={}, similarity={:.4f}, time={}ms",
                                userInput, semanticResult.getMatchedPhrase(), matchedIntentCode,
                                semanticResult.getSimilarity(), semanticResult.getMatchTimeMs());

                        IntentMatchResult result = IntentMatchResult.builder()
                                .bestMatch(intent)
                                .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                        intent, semanticResult.getSimilarity(),
                                        (int)(semanticResult.getSimilarity() * 100),
                                        Collections.singletonList(semanticResult.getMatchedPhrase()),
                                        MatchMethod.SEMANTIC)))
                                .confidence(semanticResult.getSimilarity())
                                .matchMethod(MatchMethod.SEMANTIC)
                                .matchedKeywords(Collections.singletonList(semanticResult.getMatchedPhrase()))
                                .isStrongSignal(semanticResult.getSimilarity() >= 0.85)
                                .requiresConfirmation(semanticResult.getSimilarity() < 0.85)
                                .userInput(originalInput)
                                .actionType(detectedActionType)
                                .build();

                        saveIntentMatchRecord(result, factoryId, null, null, false);
                        return result;
                    } else {
                        log.debug("v14.0语义匹配意图未找到配置: {}", matchedIntentCode);
                    }
                }
            } catch (Exception e) {
                log.warn("v14.0语义相似度匹配异常: {}", e.getMessage());
                // 继续执行后续匹配逻辑
            }
        }

        // ========== Layer 0.5: 动词+名词消歧快速路径 ==========
        // 如果动词+名词消歧成功且置信度足够高，直接返回该意图
        // v12.1修复: 当检测到多意图触发词时，跳过此快速路径，确保多意图检测能执行
        if (!skipPhraseShortcut && verbNounResult != null && verbNounResult.isDisambiguated()
                && verbNounResult.getConfidence() >= 0.80) {
            String recommendedIntent = verbNounResult.getRecommendedIntent();
            List<AIIntentConfig> allIntents = getAllIntents(factoryId);

            Optional<AIIntentConfig> intentOpt = allIntents.stream()
                    .filter(i -> i.getIntentCode().equals(recommendedIntent))
                    .findFirst();

            if (intentOpt.isPresent()) {
                AIIntentConfig intent = intentOpt.get();
                ActionType detectedActionType = knowledgeBase.detectActionType(userInput.toLowerCase().trim());

                log.info("动词+名词消歧快速匹配: input='{}', intent={}, verb={}, noun={}",
                        originalInput, recommendedIntent, verbNounResult.getVerb(), verbNounResult.getNoun());

                IntentMatchResult result = IntentMatchResult.builder()
                        .bestMatch(intent)
                        .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                intent, verbNounResult.getConfidence(), 95,
                                List.of(verbNounResult.getVerb(), verbNounResult.getNoun()),
                                MatchMethod.SEMANTIC)))
                        .confidence(verbNounResult.getConfidence())
                        .matchMethod(MatchMethod.SEMANTIC)
                        .matchedKeywords(List.of(verbNounResult.getVerb(), verbNounResult.getNoun()))
                        .isStrongSignal(true)
                        .requiresConfirmation(verbNounResult.getConfidence() < 0.85)
                        .userInput(originalInput)
                        .actionType(detectedActionType)
                        .build();

                // 记录匹配
                saveIntentMatchRecord(result, factoryId, null, null, false);
                return result;
            }
        }

        // ========== Layer 0.6: v9.0 多维意图分类 ==========
        // 基于业界最佳实践：名词分组优于动词分组，多维分类支持细粒度意图识别
        // v9.0: 添加 Modifier 维度 (STATS, ANOMALY, FUTURE, CRITICAL 等)
        // 参考: Vonage Intent Classification Hierarchy, IEEE Two-Stage Intent Recognition Framework
        try {
            TwoStageIntentClassifier.TwoStageResult twoStageResult =
                    twoStageIntentClassifier.classify(userInput);

            // v10.0: 提高短路阈值到 0.92，让更多中置信度请求有机会触发 LLM 学习
            if (twoStageResult.isSuccessful() && twoStageResult.getConfidence() >= 0.92) {
                String composedIntent = twoStageResult.getComposedIntent();
                List<AIIntentConfig> allIntents = getAllIntents(factoryId);

                Optional<AIIntentConfig> intentOpt = allIntents.stream()
                        .filter(i -> i.getIntentCode().equals(composedIntent))
                        .findFirst();

                if (intentOpt.isPresent()) {
                    AIIntentConfig intent = intentOpt.get();

                    // v13: 食品实体冲突检测 — 防止"生产牛肉"等被两阶段分类器误路由到工厂意图
                    if (knowledgeBase.hasEntityIntentConflict(originalInput, composedIntent)) {
                        log.info("v13 TwoStage食品冲突: input='{}' 两阶段分类到 '{}' 但包含食品实体，修正为FOOD_KNOWLEDGE_QUERY",
                                originalInput, composedIntent);
                        Optional<AIIntentConfig> foodIntentOpt = allIntents.stream()
                                .filter(i -> "FOOD_KNOWLEDGE_QUERY".equals(i.getIntentCode()))
                                .findFirst();
                        if (foodIntentOpt.isPresent()) {
                            AIIntentConfig foodIntent = foodIntentOpt.get();
                            IntentMatchResult foodResult = IntentMatchResult.builder()
                                    .bestMatch(foodIntent)
                                    .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                            foodIntent, 0.90, 90, Collections.emptyList(), MatchMethod.SEMANTIC)))
                                    .confidence(0.90)
                                    .matchMethod(MatchMethod.SEMANTIC)
                                    .matchedKeywords(Collections.emptyList())
                                    .isStrongSignal(true)
                                    .requiresConfirmation(false)
                                    .userInput(originalInput)
                                    .build();
                            saveIntentMatchRecord(foodResult, factoryId, null, null, false);
                            return foodResult;
                        }
                    }

                    ActionType detectedActionType = knowledgeBase.detectActionType(userInput.toLowerCase().trim());

                    log.info("v9.0多维分类命中: domain={}, action={}, modifiers={}, intent={}, confidence={}, " +
                                    "domainKeyword='{}', actionContext='{}', timeScope={}, targetScope={}",
                            twoStageResult.getDomain(), twoStageResult.getAction(),
                            twoStageResult.getModifiers(), composedIntent, twoStageResult.getConfidence(),
                            twoStageResult.getDomainKeyword(), twoStageResult.getActionContext(),
                            twoStageResult.getTimeScope(), twoStageResult.getTargetScope());

                    IntentMatchResult result = IntentMatchResult.builder()
                            .bestMatch(intent)
                            .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                    intent, twoStageResult.getConfidence(), 95,
                                    twoStageResult.getDomainKeyword() != null ?
                                            List.of(twoStageResult.getDomainKeyword()) : Collections.emptyList(),
                                    MatchMethod.SEMANTIC)))
                            .confidence(twoStageResult.getConfidence())
                            .matchMethod(MatchMethod.SEMANTIC)
                            .matchedKeywords(twoStageResult.getDomainKeyword() != null ?
                                    List.of(twoStageResult.getDomainKeyword()) : Collections.emptyList())
                            .isStrongSignal(true)
                            .requiresConfirmation(twoStageResult.getConfidence() < 0.90)
                            .userInput(originalInput)
                            .actionType(detectedActionType)
                            .build();

                    saveIntentMatchRecord(result, factoryId, null, null, false);
                    return result;
                } else {
                    log.debug("v8.0两阶段分类意图未找到配置: {}", composedIntent);
                }
            } else if (twoStageResult.isSuccessful()) {
                // 置信度较低但成功分类，记录日志供后续层使用
                log.debug("v8.0两阶段分类低置信度: domain={}, action={}, conf={}",
                        twoStageResult.getDomain(), twoStageResult.getAction(),
                        twoStageResult.getConfidence());
            }
        } catch (Exception e) {
            log.warn("v8.0两阶段分类异常: {}", e.getMessage());
        }

        // ========== Layer 1: 精确表达匹配 (hash查表, O(1)) ==========
        try {
            Optional<ExpressionLearningService.ExpressionMatchResult> exactMatch =
                    expressionLearningService.matchExactExpression(factoryId, userInput);
            if (exactMatch.isPresent()) {
                ExpressionLearningService.ExpressionMatchResult match = exactMatch.get();
                log.info("精确表达匹配成功: intent={}, expr={}",
                        match.getIntentCode(), truncate(match.getExpression(), 50));

                // 查找对应的意图配置（使用租户隔离）
                Optional<AIIntentConfig> intentOpt = getAllIntents(factoryId).stream()
                        .filter(i -> i.getIntentCode().equals(match.getIntentCode()))
                        .findFirst();

                if (intentOpt.isPresent()) {
                    AIIntentConfig intent = intentOpt.get();
                    // 检测操作类型 (即使是精确匹配也要检测)
                    ActionType detectedActionType = knowledgeBase.detectActionType(userInput.toLowerCase().trim());
                    IntentMatchResult result = IntentMatchResult.builder()
                            .bestMatch(intent)
                            .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                    intent, 1.0, 100, Collections.emptyList(), MatchMethod.EXACT)))
                            .confidence(1.0)
                            .matchMethod(MatchMethod.EXACT)
                            .matchedKeywords(Collections.emptyList())
                            .isStrongSignal(true)
                            .requiresConfirmation(true)  // v4.2: 需要确认
                            .userInput(userInput)
                            .actionType(detectedActionType)
                            .build();

                    // 记录训练样本
                    if (matchingConfig.isSampleCollectionEnabled()) {
                        expressionLearningService.recordSample(factoryId, userInput,
                                match.getIntentCode(), TrainingSample.MatchMethod.EXACT,
                                1.0, null);
                    }

                    saveIntentMatchRecord(result, factoryId, null, null, false);
                    return result;
                }
            }
        } catch (Exception e) {
            log.warn("精确表达匹配异常: {}", e.getMessage());
        }

        // 使用租户隔离获取意图配置
        List<AIIntentConfig> allIntents = getAllIntents(factoryId);
        String normalizedInput = userInput.toLowerCase().trim();

        // ========== v7.0架构优化: 移除短语映射优先检查 ==========
        // 短语匹配现在作为 preciseVerification() 中的评分项，而不是跳过语义识别
        // 这修复了 "创建原料批次" 被短语匹配到 MATERIAL_BATCH_QUERY 的问题
        // 因为语义识别能正确检测到 "创建" 动词

        // ========== Layer 0: 问题类型分类 ==========
        // 判断是操作指令、通用咨询问题还是闲聊
        IntentKnowledgeBase.QuestionType questionType = knowledgeBase.detectQuestionType(userInput);
        log.debug("检测到问题类型: {} for input: '{}'", questionType, userInput);

        // v6.3架构改进：
        // - CONVERSATIONAL（闲聊）直接拒绝，不尝试业务匹配
        // - GENERAL_QUESTION（通用问题）使用更高置信度阈值
        if (questionType == IntentKnowledgeBase.QuestionType.CONVERSATIONAL) {
            log.info("检测到闲聊类型，直接拒绝: input='{}'", userInput);
            IntentMatchResult noMatchResult = IntentMatchResult.builder()
                    .bestMatch(null)
                    .topCandidates(Collections.emptyList())
                    .confidence(0.0)
                    .matchMethod(MatchMethod.NONE)
                    .matchedKeywords(Collections.emptyList())
                    .isStrongSignal(false)
                    .requiresConfirmation(false)
                    .userInput(userInput)
                    .actionType(ActionType.UNKNOWN)
                    .questionType(questionType)
                    .build();
            saveIntentMatchRecord(noMatchResult, factoryId, null, null, false);
            return noMatchResult;
        }

        // ========== v11.12: 移除写操作拦截 ==========
        // 写操作意图（如 PROCESSING_BATCH_CREATE, USER_CREATE 等）应被正常识别
        // 权限控制由 AIIntentConfig.requiredRoles 在执行阶段处理
        // if (isWriteOnlyInput(originalInput)) {
        //     log.info("检测到写操作，直接拒绝: input='{}'", originalInput);
        //     IntentMatchResult noMatchResult = IntentMatchResult.builder()
        //             .bestMatch(null)
        //             .topCandidates(Collections.emptyList())
        //             .confidence(0.0)
        //             .matchMethod(MatchMethod.NONE)
        //             .matchedKeywords(Collections.emptyList())
        //             .isStrongSignal(false)
        //             .requiresConfirmation(false)
        //             .userInput(userInput)
        //             .actionType(ActionType.UNKNOWN)
        //             .questionType(questionType)
        //             .clarificationQuestion("抱歉，AI 助手目前只支持数据查询，不支持删除、修改、添加等操作。请通过管理后台进行数据操作。")
        //             .build();
        //     saveIntentMatchRecord(noMatchResult, factoryId, null, null, false);
        //     return noMatchResult;
        // }

        boolean isAmbiguousQuery = (questionType == IntentKnowledgeBase.QuestionType.GENERAL_QUESTION);
        if (isAmbiguousQuery) {
            log.info("问题类型为GENERAL_QUESTION，将使用更高置信度阈值: input='{}'", userInput);
        }

        ActionType opType = knowledgeBase.detectActionType(normalizedInput);
        log.debug("检测到操作类型: {} for input: {}", opType, normalizedInput);

        // ========== v6.0 语义优先架构 ==========
        // 核心改革: 语义匹配优先 → 精确验证 → 置信度决策
        if (matchingConfig.isSemanticFirstEnabled()) {
            log.debug("使用v6.0语义优先架构");

            // ========== v12.9: 多意图前置检测 ==========
            // 当检测到多意图触发词时，直接调用多标签分类器，不依赖语义路由结果
            // 这修复了多意图查询被语义路由阻塞的问题
            if (containsMultiIntentTrigger(originalInput) && multiLabelIntentClassifier.isAvailable()) {
                log.info("v12.9 多意图前置检测: input='{}'", originalInput);
                try {
                    MultiIntentResult multiResult = multiLabelIntentClassifier.classifyMultiLabel(originalInput, factoryId);

                    if (multiResult.isMultiIntent() && multiResult.getIntents() != null
                            && multiResult.getIntents().size() > 1) {
                        log.info("v12.9 多意图检测成功: input='{}', intentCount={}, strategy={}",
                                originalInput, multiResult.getIntents().size(), multiResult.getExecutionStrategy());

                        // 获取第一个意图作为 bestMatch
                        MultiIntentResult.SingleIntentMatch firstIntent = multiResult.getIntents().get(0);
                        AIIntentConfig firstConfig = getAllIntents(factoryId).stream()
                                .filter(c -> c.getIntentCode().equals(firstIntent.getIntentCode()))
                                .findFirst()
                                .orElse(null);

                        if (firstConfig != null) {
                            // 构建附加意图列表 (除第一个外的其他意图)
                            List<IntentMatchResult.IntentMatch> additionalIntents = new ArrayList<>();
                            for (int i = 1; i < multiResult.getIntents().size(); i++) {
                                MultiIntentResult.SingleIntentMatch intent = multiResult.getIntents().get(i);
                                additionalIntents.add(IntentMatchResult.IntentMatch.builder()
                                        .intentCode(intent.getIntentCode())
                                        .intentName(intent.getIntentName())
                                        .confidence(intent.getConfidence())
                                        .extractedParams(intent.getExtractedParams())
                                        .executionOrder(intent.getExecutionOrder())
                                        .reasoning(intent.getReasoning())
                                        .build());
                            }

                            IntentMatchResult multiIntentResult = IntentMatchResult.builder()
                                    .bestMatch(firstConfig)
                                    .topCandidates(Collections.singletonList(CandidateIntent.fromConfig(
                                            firstConfig, firstIntent.getConfidence(),
                                            (int)(firstIntent.getConfidence() * 100),
                                            Collections.emptyList(), MatchMethod.SEMANTIC)))
                                    .confidence(firstIntent.getConfidence())
                                    .matchMethod(MatchMethod.SEMANTIC)
                                    .matchedKeywords(Collections.emptyList())
                                    .isStrongSignal(multiResult.getOverallConfidence() >= 0.75)
                                    .requiresConfirmation(multiResult.requiresUserConfirmation())
                                    .userInput(originalInput)
                                    .actionType(opType)
                                    .isMultiIntent(true)
                                    .additionalIntents(additionalIntents)
                                    .executionStrategy(multiResult.getExecutionStrategy())
                                    .build();

                            saveIntentMatchRecord(multiIntentResult, factoryId, null, null, false);
                            return multiIntentResult;
                        }
                    } else {
                        log.debug("v12.9 多标签分类器未检测到多意图: {}",
                                multiResult.getReasoning() != null ? multiResult.getReasoning() : "单意图");
                    }
                } catch (Exception e) {
                    log.warn("v12.9 多意图前置检测异常，继续单意图流程: {}", e.getMessage());
                }
            }

            // Step 1: 语义路由 - 向量相似度匹配 Top-5 候选
            SemanticRoutingResult routingResult = semanticFirstRouting(userInput, factoryId);

            if (!routingResult.isEmpty()) {
                // Step 2: 精确验证 - 短语/关键词/粒度/域 调整分数
                List<SemanticCandidate> verifiedCandidates =
                        preciseVerification(userInput, factoryId, routingResult, opType);

                if (!verifiedCandidates.isEmpty()) {
                    SemanticCandidate bestCandidate = verifiedCandidates.get(0);
                    double confidence = bestCandidate.adjustedScore;

                    log.info("语义优先匹配: intent={}, semantic={:.3f}, adjusted={:.3f}",
                            bestCandidate.intentCode, bestCandidate.semanticScore, confidence);

                    // 构建候选列表
                    List<CandidateIntent> candidates = verifiedCandidates.stream()
                            .limit(5)
                            .map(c -> CandidateIntent.builder()
                                    .intentCode(c.intentCode)
                                    .intentName(c.config.getIntentName())
                                    .intentCategory(c.config.getIntentCategory())
                                    .confidence(c.adjustedScore)
                                    .matchScore((int)(c.adjustedScore * 100))
                                    .matchedKeywords(c.matchedKeywords)
                                    .matchMethod(c.phraseConfirmed ? MatchMethod.PHRASE_MATCH : MatchMethod.SEMANTIC)
                                    .description(c.config.getDescription())
                                    .build())
                            .collect(Collectors.toList());

                    // ========== Step 2.5: 多意图检测 (MultiLabelIntentClassifier) ==========
                    // 当用户输入包含多意图触发词时，调用多标签分类器
                    // 触发词: "和", "还有", "同时", "另外", "以及", "并且", "顺便"
                    // v12.1修复: 使用 originalInput 检测多意图，因为 userInput 可能已被预处理丢失触发词
                    if (containsMultiIntentTrigger(originalInput) && multiLabelIntentClassifier.isAvailable()) {
                        try {
                            // v12.1: 使用原始输入进行多意图分类，保留完整语义
                            MultiIntentResult multiResult = multiLabelIntentClassifier.classifyMultiLabel(originalInput, factoryId);

                            if (multiResult.isMultiIntent() && multiResult.getIntents() != null
                                    && multiResult.getIntents().size() > 1) {
                                log.info("多意图检测成功: input='{}', intentCount={}, strategy={}",
                                        userInput, multiResult.getIntents().size(), multiResult.getExecutionStrategy());

                                // 获取第一个意图作为 bestMatch
                                MultiIntentResult.SingleIntentMatch firstIntent = multiResult.getIntents().get(0);
                                AIIntentConfig firstConfig = getAllIntents(factoryId).stream()
                                        .filter(c -> c.getIntentCode().equals(firstIntent.getIntentCode()))
                                        .findFirst()
                                        .orElse(null);

                                if (firstConfig != null) {
                                    // 构建附加意图列表 (除第一个外的其他意图)
                                    List<IntentMatchResult.IntentMatch> additionalIntents = new ArrayList<>();
                                    for (int i = 1; i < multiResult.getIntents().size(); i++) {
                                        MultiIntentResult.SingleIntentMatch intent = multiResult.getIntents().get(i);
                                        additionalIntents.add(IntentMatchResult.IntentMatch.builder()
                                                .intentCode(intent.getIntentCode())
                                                .intentName(intent.getIntentName())
                                                .confidence(intent.getConfidence())
                                                .extractedParams(intent.getExtractedParams())
                                                .executionOrder(intent.getExecutionOrder())
                                                .reasoning(intent.getReasoning())
                                                .build());
                                    }

                                    IntentMatchResult multiIntentMatchResult = IntentMatchResult.builder()
                                            .bestMatch(firstConfig)
                                            .topCandidates(candidates)
                                            .confidence(firstIntent.getConfidence())
                                            .matchMethod(MatchMethod.SEMANTIC)
                                            .matchedKeywords(Collections.emptyList())
                                            .isStrongSignal(multiResult.getOverallConfidence() >= 0.75)
                                            .requiresConfirmation(multiResult.requiresUserConfirmation())
                                            .userInput(userInput)
                                            .actionType(opType)
                                            .isMultiIntent(true)
                                            .additionalIntents(additionalIntents)
                                            .executionStrategy(multiResult.getExecutionStrategy())
                                            .build();

                                    saveIntentMatchRecord(multiIntentMatchResult, factoryId, null, null, false);
                                    return multiIntentMatchResult;
                                }
                            }
                        } catch (Exception e) {
                            log.warn("多意图检测异常，继续单意图流程: {}", e.getMessage());
                        }
                    }

                    // Step 3: 置信度决策
                    double highThreshold = matchingConfig.getSemanticFirstHighThreshold();

                    // v6.3: 对于模糊查询（如"xxx怎么样"），使用更高的置信度阈值
                    // 确保只有真正高置信度的业务查询才会被识别，避免误判
                    if (isAmbiguousQuery) {
                        highThreshold = Math.max(highThreshold, 0.90);
                        log.debug("模糊查询使用更高阈值: {}", highThreshold);
                    }

                    // 高置信度: 检查是否需要强制 LLM 验证
                    if (confidence >= highThreshold) {
                        // v7.1: 操作类意图即使高置信度也需要 ArenaRL 验证
                        // 原因: 操作有风险，短语冲突可能导致误匹配
                        boolean isWriteOperation = isWriteOperationType(opType, bestCandidate.intentCode);
                        boolean hasCloseCompetitor = candidates.size() >= 2 &&
                                (candidates.get(0).getConfidence() - candidates.get(1).getConfidence()) < 0.12;

                        // v7.1.1: 强短语匹配豁免 ArenaRL
                        // 如果用户输入包含某个强短语，找到对应的候选并直接返回
                        CandidateIntent strongPhraseCandidate = findStrongPhraseCandidate(userInput, candidates);

                        if (strongPhraseCandidate != null) {
                            // 找到强短语匹配，直接返回该候选，跳过 ArenaRL
                            log.info("v7.1.1: 强短语匹配豁免 ArenaRL: intent={}, 原最佳={}",
                                    strongPhraseCandidate.getIntentCode(), bestCandidate.intentCode);

                            // 重新构建候选列表，将强短语候选放在首位
                            List<CandidateIntent> reorderedCandidates = new ArrayList<>();
                            reorderedCandidates.add(strongPhraseCandidate);
                            for (CandidateIntent c : candidates) {
                                if (!c.getIntentCode().equals(strongPhraseCandidate.getIntentCode())) {
                                    reorderedCandidates.add(c);
                                }
                            }

                            // 查找强短语候选的配置
                            AIIntentConfig strongPhraseConfig = getAllIntents(factoryId).stream()
                                    .filter(c -> c.getIntentCode().equals(strongPhraseCandidate.getIntentCode()))
                                    .findFirst()
                                    .orElse(bestCandidate.config);

                            IntentMatchResult result = IntentMatchResult.builder()
                                    .bestMatch(strongPhraseConfig)
                                    .topCandidates(reorderedCandidates)
                                    .confidence(strongPhraseCandidate.getConfidence())
                                    .matchMethod(MatchMethod.PHRASE_MATCH)
                                    .matchedKeywords(strongPhraseCandidate.getMatchedKeywords())
                                    .isStrongSignal(true)
                                    .requiresConfirmation(false)
                                    .userInput(userInput)
                                    .actionType(opType)
                                    .questionType(questionType)
                                    .build();
                            saveIntentMatchRecord(result, factoryId, null, null, false);
                            return result;
                        }

                        if (isWriteOperation && hasCloseCompetitor) {
                            log.info("v7.1: 操作类意图强制 ArenaRL 验证: intent={}, opType={}, gap={:.3f}",
                                    bestCandidate.intentCode, opType,
                                    candidates.get(0).getConfidence() - candidates.get(1).getConfidence());
                            // 继续执行，进入 ArenaRL/LLM Reranking 流程
                        } else {
                            // 查询类意图或差距足够大，直接返回
                            IntentMatchResult result = IntentMatchResult.builder()
                                    .bestMatch(bestCandidate.config)
                                    .topCandidates(candidates)
                                    .confidence(confidence)
                                    .matchMethod(bestCandidate.phraseConfirmed ? MatchMethod.PHRASE_MATCH : MatchMethod.SEMANTIC)
                                    .matchedKeywords(bestCandidate.matchedKeywords)
                                    .isStrongSignal(true)
                                    .requiresConfirmation(false)
                                    .userInput(userInput)
                                    .actionType(opType)
                                    .questionType(questionType)
                                    .build();

                            log.info("语义优先高置信度直接返回: intent={}, confidence={:.3f}",
                                    bestCandidate.intentCode, confidence);
                            saveIntentMatchRecord(result, factoryId, null, null, false);
                            return result;
                        }
                    }

                    // 中/低置信度: 构建结果交给后续 LLM Reranking/Fallback 处理
                    IntentMatchResult semanticResult = IntentMatchResult.builder()
                            .bestMatch(bestCandidate.config)
                            .topCandidates(candidates)
                            .confidence(confidence)
                            .matchMethod(MatchMethod.SEMANTIC)
                            .matchedKeywords(bestCandidate.matchedKeywords)
                            .isStrongSignal(false)
                            .requiresConfirmation(true)
                            .userInput(userInput)
                            .questionType(questionType)
                            .actionType(opType)
                            .build();

                    // v6.3 + v11.13: 对于模糊查询，如果置信度低于阈值，直接拒绝匹配
                    // 避免 "天气怎么样" 这类非业务查询被错误匹配
                    // v11.13修复: 业务分析请求(包含业务关键词+分析指示词)使用较低阈值0.65
                    if (isAmbiguousQuery && confidence < 0.88) {
                        // v11.13: 检查是否为业务分析请求
                        boolean isBusinessAnalysis = knowledgeBase.isAnalysisRequest(userInput, questionType);
                        if (isBusinessAnalysis && confidence >= 0.65) {
                            log.info("v11.13: 识别为业务分析请求，使用较低阈值: input='{}', confidence={:.3f}",
                                    userInput, confidence);
                            // 继续处理，不拒绝
                        } else {
                            log.info("模糊查询置信度过低 ({:.3f} < 0.88)，拒绝匹配: input='{}'", confidence, userInput);
                            IntentMatchResult noMatch = IntentMatchResult.builder()
                                    .bestMatch(null)
                                    .topCandidates(Collections.emptyList())
                                    .confidence(0.0)
                                    .matchMethod(MatchMethod.NONE)
                                    .matchedKeywords(Collections.emptyList())
                                    .isStrongSignal(false)
                                    .requiresConfirmation(false)
                                    .userInput(userInput)
                                    .actionType(opType)
                                    .questionType(questionType)
                                    .build();
                            saveIntentMatchRecord(noMatch, factoryId, null, null, false);
                            return noMatch;
                        }
                    }

                    // ========== v11.4 RAG: 历史相似案例增强 ==========
                    // 在 LLM Reranking 之前，先检查 RAG 是否有高置信历史匹配
                    // 如果找到直接匹配，可以避免 LLM 调用，提升响应速度
                    if (ragRetrievalService != null && matchingConfig.isInRerankingRange(confidence)) {
                        // Step 1: 尝试查找高置信历史直接复用 (相似度 >= 0.90)
                        try {
                            Optional<RAGRetrievalService.RAGCandidate> directMatch =
                                    ragRetrievalService.findDirectMatch(factoryId, userInput, 0.90);
                            if (directMatch.isPresent()) {
                                RAGRetrievalService.RAGCandidate ragCandidate = directMatch.get();
                                log.info("[RAG] 找到高置信历史匹配: input='{}', intent={}, confidence={:.3f}, similarity={:.3f}, source={}",
                                        userInput, ragCandidate.getIntentCode(), ragCandidate.getConfidence(),
                                        ragCandidate.getSimilarity(), ragCandidate.getSource());

                                // 查找对应意图配置
                                Optional<AIIntentConfig> ragIntentOpt = allIntents.stream()
                                        .filter(i -> i.getIntentCode().equals(ragCandidate.getIntentCode()))
                                        .findFirst();

                                if (ragIntentOpt.isPresent()) {
                                    AIIntentConfig ragIntent = ragIntentOpt.get();
                                    // 使用 RAG 历史置信度，但不低于语义评分置信度
                                    double ragConfidence = Math.max(ragCandidate.getConfidence(), confidence);

                                    // 构建 RAG 匹配结果
                                    CandidateIntent ragTopCandidate = CandidateIntent.builder()
                                            .intentCode(ragCandidate.getIntentCode())
                                            .intentName(ragIntent.getIntentName())
                                            .intentCategory(ragIntent.getIntentCategory())
                                            .confidence(ragConfidence)
                                            .matchMethod(MatchMethod.SEMANTIC)
                                            .description(ragIntent.getDescription())
                                            .build();

                                    // 将 RAG 候选放在首位
                                    List<CandidateIntent> ragCandidates = new ArrayList<>();
                                    ragCandidates.add(ragTopCandidate);
                                    for (CandidateIntent c : candidates) {
                                        if (!c.getIntentCode().equals(ragCandidate.getIntentCode())) {
                                            ragCandidates.add(c);
                                        }
                                    }

                                    IntentMatchResult ragResult = IntentMatchResult.builder()
                                            .bestMatch(ragIntent)
                                            .topCandidates(ragCandidates)
                                            .confidence(ragConfidence)
                                            .matchMethod(MatchMethod.SEMANTIC)
                                            .matchedKeywords(Collections.emptyList())
                                            .isStrongSignal(true)
                                            .requiresConfirmation(ragConfidence < 0.85)
                                            .userInput(userInput)
                                            .actionType(opType)
                                            .questionType(questionType)
                                            .build();

                                    saveIntentMatchRecord(ragResult, factoryId, null, null, false);
                                    return ragResult;
                                }
                            }
                        } catch (Exception e) {
                            log.warn("[RAG] 直接匹配检索异常: {}", e.getMessage());
                        }

                        // Step 2: 检索相似案例补充候选 (相似度 >= 0.72)
                        try {
                            List<RAGRetrievalService.RAGCandidate> similarCases =
                                    ragRetrievalService.retrieveSimilarCases(factoryId, userInput, 5, 0.72);
                            if (!similarCases.isEmpty()) {
                                log.info("[RAG] 检索到 {} 个相似案例，将补充到候选列表", similarCases.size());

                                // 用于记录已在候选中的意图
                                Map<String, CandidateIntent> candidateMap = new LinkedHashMap<>();
                                for (CandidateIntent c : candidates) {
                                    candidateMap.put(c.getIntentCode(), c);
                                }

                                // 处理 RAG 候选
                                for (RAGRetrievalService.RAGCandidate ragCandidate : similarCases) {
                                    String intentCode = ragCandidate.getIntentCode();
                                    if (candidateMap.containsKey(intentCode)) {
                                        // 如果候选列表中已有该意图，提升其权重
                                        CandidateIntent existing = candidateMap.get(intentCode);
                                        // 置信度提升: 加权平均，RAG 贡献 20%
                                        double boostedConfidence = existing.getConfidence() * 0.8 +
                                                ragCandidate.getConfidence() * 0.2 * ragCandidate.getSimilarity();
                                        CandidateIntent boosted = CandidateIntent.builder()
                                                .intentCode(existing.getIntentCode())
                                                .intentName(existing.getIntentName())
                                                .intentCategory(existing.getIntentCategory())
                                                .confidence(Math.min(boostedConfidence, 0.95))
                                                .matchScore(existing.getMatchScore())
                                                .matchedKeywords(existing.getMatchedKeywords())
                                                .matchMethod(existing.getMatchMethod())
                                                .description(existing.getDescription())
                                                .build();
                                        candidateMap.put(intentCode, boosted);
                                        log.debug("[RAG] 提升候选权重: intent={}, original={:.3f}, boosted={:.3f}",
                                                intentCode, existing.getConfidence(), boosted.getConfidence());
                                    } else {
                                        // 新候选：查找意图配置并添加
                                        Optional<AIIntentConfig> ragIntentOpt = allIntents.stream()
                                                .filter(i -> i.getIntentCode().equals(intentCode))
                                                .findFirst();
                                        if (ragIntentOpt.isPresent()) {
                                            AIIntentConfig ragIntent = ragIntentOpt.get();
                                            CandidateIntent newCandidate = CandidateIntent.builder()
                                                    .intentCode(intentCode)
                                                    .intentName(ragIntent.getIntentName())
                                                    .intentCategory(ragIntent.getIntentCategory())
                                                    .confidence(ragCandidate.getConfidence() * ragCandidate.getSimilarity())
                                                    .matchMethod(MatchMethod.SEMANTIC)
                                                    .description(ragIntent.getDescription())
                                                    .build();
                                            candidateMap.put(intentCode, newCandidate);
                                            log.debug("[RAG] 添加新候选: intent={}, confidence={:.3f}",
                                                    intentCode, newCandidate.getConfidence());
                                        }
                                    }
                                }

                                // 重新排序候选列表
                                candidates = candidateMap.values().stream()
                                        .sorted((a, b) -> Double.compare(b.getConfidence(), a.getConfidence()))
                                        .collect(Collectors.toList());

                                // 更新 semanticResult 的候选列表
                                semanticResult = semanticResult.toBuilder()
                                        .topCandidates(candidates)
                                        .build();

                                // 检查 RAG 增强后是否达到高置信度
                                if (!candidates.isEmpty() && candidates.get(0).getConfidence() >= 0.85) {
                                    CandidateIntent topCandidate = candidates.get(0);
                                    log.info("[RAG] 增强后达到高置信度: intent={}, confidence={:.3f}",
                                            topCandidate.getIntentCode(), topCandidate.getConfidence());

                                    // 查找对应的意图配置
                                    AIIntentConfig topIntent = allIntents.stream()
                                            .filter(i -> i.getIntentCode().equals(topCandidate.getIntentCode()))
                                            .findFirst()
                                            .orElse(null);

                                    IntentMatchResult ragEnhancedResult = IntentMatchResult.builder()
                                            .bestMatch(topIntent)
                                            .topCandidates(candidates)
                                            .confidence(topCandidate.getConfidence())
                                            .matchMethod(MatchMethod.SEMANTIC)
                                            .matchedKeywords(Collections.emptyList())
                                            .isStrongSignal(true)
                                            .requiresConfirmation(false)
                                            .userInput(userInput)
                                            .actionType(opType)
                                            .questionType(questionType)
                                            .build();

                                    saveIntentMatchRecord(ragEnhancedResult, factoryId, null, null, false);
                                    return ragEnhancedResult;
                                }
                            }
                        } catch (Exception e) {
                            log.warn("[RAG] 相似案例检索异常: {}", e.getMessage());
                        }
                    }

                    // 中置信度走 LLM Reranking
                    if (matchingConfig.isInRerankingRange(confidence)) {
                        log.info("语义优先中置信度 ({:.3f})，触发 LLM Reranking", confidence);
                        return tryLlmReranking(userInput, factoryId, candidates, semanticResult, opType, userId, userRole);
                    }

                    // 低置信度走 LLM Fallback
                    log.info("语义优先低置信度 ({:.3f})，触发 LLM Fallback", confidence);
                    return tryLlmFallback(userInput, factoryId, allIntents, semanticResult, opType, userId, userRole);
                }
            }

            // 语义路由无结果，降级到 LLM Fallback
            log.debug("语义路由无结果，降级到 LLM Fallback");
            return tryLlmFallback(userInput, factoryId, allIntents, null, opType, userId, userRole);
        }

        // ========== v4.0 并行多层评分架构 (向后兼容) ==========
        // 替代原有的 Layer 1.5 - Layer 4 串行瀑布式架构
        // 并行执行: 短语匹配 + 语义匹配 + 关键词匹配，综合评分
        log.debug("使用v4.0并行评分架构");

        // 调用并行评分方法
        IntentMatchResult parallelResult = parallelScoreMatch(userInput, factoryId, allIntents, opType);

        if (parallelResult != null && parallelResult.hasMatch()) {
            double confidence = parallelResult.getConfidence();
            log.info("并行评分匹配成功: intent={}, confidence={:.3f}, method={}",
                    parallelResult.getBestMatch().getIntentCode(),
                    confidence,
                    parallelResult.getMatchMethod());

            // 置信度 >= 0.75: 直接返回（高置信度）
            if (confidence >= 0.75) {
                saveIntentMatchRecord(parallelResult, factoryId, null, null, false);

                // 记录训练样本
                if (matchingConfig.isSampleCollectionEnabled()) {
                    expressionLearningService.recordSample(factoryId, userInput,
                            parallelResult.getBestMatch().getIntentCode(),
                            TrainingSample.MatchMethod.KEYWORD, // 暂用KEYWORD
                            confidence, null);
                }

                return parallelResult;
            }

            // 置信度 0.72-0.75: 中等置信度，可以返回但标记需要确认
            if (confidence >= 0.72) {
                IntentMatchResult confirmedResult = parallelResult.toBuilder()
                        .requiresConfirmation(true)
                        .build();
                saveIntentMatchRecord(confirmedResult, factoryId, null, null, false);
                return confirmedResult;
            }

            // 置信度 < 0.5: 低置信度，继续走后续流程（可能触发LLM）
            log.debug("并行评分置信度过低 ({:.3f})，继续后续流程", confidence);
        }

        // 无并行评分结果，或置信度过低
        List<IntentScoreEntry> scoredIntents = new ArrayList<>();

        if (parallelResult == null || parallelResult.getConfidence() < 0.72) {
            log.debug("No intent matched by rules or semantics for input: {}", userInput);

            // ========== Layer 3.5: 域默认意图 (关键词失败但域检测成功) ==========
            try {
                IntentKnowledgeBase.Domain detectedDomain = knowledgeBase.detectDomain(normalizedInput);
                String inputDomain = detectedDomain != null ? detectedDomain.name() : null;
                if (inputDomain != null && !"GENERAL".equals(inputDomain)) {
                    Optional<String> defaultIntentCode = domainDefaultService.getPrimaryIntent(factoryId, inputDomain);
                    if (defaultIntentCode.isPresent()) {
                        String intentCode = defaultIntentCode.get();
                        Optional<AIIntentConfig> defaultIntent = findIntentByCode(intentCode, allIntents);
                        if (defaultIntent.isPresent()) {
                            AIIntentConfig intentConfig = defaultIntent.get();
                            log.info("Layer 3.5 域默认意图触发: domain={}, defaultIntent={}, input='{}'",
                                    inputDomain, intentCode, userInput);

                            CandidateIntent candidate = CandidateIntent.builder()
                                    .intentCode(intentCode)
                                    .intentName(intentConfig.getIntentName())
                                    .confidence(0.60)
                                    .matchMethod(MatchMethod.DOMAIN_DEFAULT)
                                    .build();

                            IntentMatchResult defaultResult = IntentMatchResult.builder()
                                    .bestMatch(intentConfig)
                                    .topCandidates(List.of(candidate))
                                    .confidence(0.60)
                                    .matchMethod(MatchMethod.DOMAIN_DEFAULT)
                                    .matchedKeywords(List.of())
                                    .isStrongSignal(false)
                                    .requiresConfirmation(true)
                                    .userInput(userInput)
                                    .actionType(opType)
                                    .build();

                            saveIntentMatchRecord(defaultResult, factoryId, userId, null, false);
                            return defaultResult;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Layer 3.5 域默认意图查找失败: {}", e.getMessage());
            }

            // ========== Layer 5: 多轮对话 (无匹配时自动触发) ==========
            if (userId != null) {
                log.info("无匹配结果，自动触发多轮对话: factoryId={}, userId={}, input='{}'",
                        factoryId, userId, userInput);

                try {
                    ConversationService.ConversationResponse conversationResp =
                            conversationService.startConversation(factoryId, userId, userInput);

                    if (conversationResp != null && conversationResp.getSessionId() != null) {
                        log.info("多轮对话已启动: sessionId={}, round={}/{}",
                                conversationResp.getSessionId(),
                                conversationResp.getCurrentRound(),
                                conversationResp.getMaxRounds());

                        // 返回带会话信息的空结果
                        // 使用 conversationResp 的 confidence，如果为 null 则使用 0.75
                        // 这样当 LLM 成功识别/建议意图时，可以触发自学习
                        double respConfidence = conversationResp.getConfidence() != null
                                ? conversationResp.getConfidence() : 0.75;
                        IntentMatchResult conversationResult = IntentMatchResult.builder()
                                .bestMatch(null)
                                .topCandidates(List.of())
                                .confidence(respConfidence)
                                .matchMethod(MatchMethod.NONE)
                                .matchedKeywords(List.of())
                                .isStrongSignal(false)
                                .requiresConfirmation(true)
                                .userInput(userInput)
                                .actionType(opType)
                                .sessionId(conversationResp.getSessionId())
                                .conversationMessage(conversationResp.getMessage())
                                .build();

                        saveIntentMatchRecord(conversationResult, factoryId, userId,
                                conversationResp.getSessionId(), false);
                        return conversationResult;
                    }
                } catch (Exception e) {
                    log.warn("启动多轮对话失败: {}", e.getMessage());
                    // 失败时继续走 LLM fallback 流程
                }
            }

            // Layer 5 (编辑距离匹配) 已移除，直接进入 LLM Fallback
            // 理由: 语义匹配 (Layer 4) 已合并意图配置+学习表达，编辑距离效果有限
            return tryLlmFallback(userInput, factoryId, allIntents, null, opType, userId, userRole);
        }

        // 按分数排序
        scoredIntents.sort((a, b) -> {
            int scoreCompare = b.matchScore - a.matchScore;
            if (scoreCompare != 0) return scoreCompare;
            return b.config.getPriority().compareTo(a.config.getPriority());
        });

        // ========== 阶段四：意图消歧 ==========
        // 如果前两个候选意图分数接近（差距<25%），应用消歧逻辑
        // v7.2优化: 从0.10扩大到0.25，触发更多等价检查，减少"假失败"
        IntentKnowledgeBase.Domain inputDomain = knowledgeBase.detectDomain(userInput);
        if (scoredIntents.size() >= 2) {
            IntentScoreEntry first = scoredIntents.get(0);
            IntentScoreEntry second = scoredIntents.get(1);
            double scoreDiff = (double)(first.matchScore - second.matchScore) / first.matchScore;

            if (scoreDiff < 0.25) {
                log.debug("检测到分数接近的意图，尝试消歧: first={} ({}), second={} ({}), diff={:.2f}%",
                        first.config.getIntentCode(), first.matchScore,
                        second.config.getIntentCode(), second.matchScore, scoreDiff * 100);

                // 检查是否功能等价
                if (knowledgeBase.areFunctionallyEquivalent(
                        first.config.getIntentCode(), second.config.getIntentCode())) {
                    log.debug("意图功能等价，保持第一个: {} <=> {}",
                            first.config.getIntentCode(), second.config.getIntentCode());
                } else {
                    // 使用领域优先级选择
                    List<String> candidateCodes = scoredIntents.stream()
                            .limit(3)
                            .map(e -> e.config.getIntentCode())
                            .collect(Collectors.toList());
                    Optional<String> bestIntentCode = knowledgeBase.selectBestIntent(candidateCodes, inputDomain);

                    if (bestIntentCode.isPresent() &&
                        !bestIntentCode.get().equals(first.config.getIntentCode())) {
                        // 重新排序，将消歧选中的意图放到第一位
                        String selectedCode = bestIntentCode.get();
                        for (int i = 1; i < scoredIntents.size(); i++) {
                            if (scoredIntents.get(i).config.getIntentCode().equals(selectedCode)) {
                                IntentScoreEntry selected = scoredIntents.remove(i);
                                scoredIntents.add(0, selected);
                                log.info("消歧重排序: 选中 {} 替代 {}",
                                        selectedCode, first.config.getIntentCode());
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 计算最高分用于归一化
        int maxScore = scoredIntents.get(0).matchScore;

        // 构建候选列表
        List<CandidateIntent> candidates = scoredIntents.stream()
                .limit(topN)
                .map(entry -> {
                    double confidence = (double) entry.matchScore / (maxScore > 0 ? maxScore : 1);
                    return CandidateIntent.fromConfig(
                            entry.config,
                            Math.min(1.0, confidence), // 确保不超过1.0
                            entry.matchScore,
                            entry.matchedKeywords,
                            entry.matchMethod
                    );
                })
                .collect(Collectors.toList());

        // 获取最佳匹配
        IntentScoreEntry bestEntry = scoredIntents.get(0);
        double bestConfidence = candidates.get(0).getConfidence();

        // 判断是否为强信号
        boolean isStrongSignal = isStrongSignal(bestEntry, candidates, bestConfidence);

        // 判断是否需要确认
        boolean requiresConfirmation = determineRequiresConfirmation(userInput, bestEntry.config, isStrongSignal, candidates);

        // 生成澄清问题（如果需要）
        String clarificationQuestion = requiresConfirmation ?
                generateClarificationQuestion(userInput, factoryId, candidates) : null;

        IntentMatchResult result = IntentMatchResult.builder()
                .bestMatch(bestEntry.config)
                .topCandidates(candidates)
                .confidence(bestConfidence)
                .matchMethod(bestEntry.matchMethod)
                .matchedKeywords(bestEntry.matchedKeywords)
                .isStrongSignal(isStrongSignal)
                .requiresConfirmation(requiresConfirmation)
                .clarificationQuestion(clarificationQuestion)
                .userInput(userInput)
                .actionType(opType)  // Layer 2/3: 设置检测到的操作类型
                .build();

        // ========== Layer 5: 多轮对话 (置信度 < 30% 时自动触发) ==========
        if (bestConfidence < 0.30 && userId != null) {
            log.info("低置信度 ({}) 自动触发多轮对话: intent={}, factoryId={}, userId={}",
                    bestConfidence, bestEntry.config.getIntentCode(), factoryId, userId);

            try {
                ConversationService.ConversationResponse conversationResp =
                        conversationService.startConversation(factoryId, userId, userInput);

                if (conversationResp != null && conversationResp.getSessionId() != null) {
                    log.info("多轮对话已启动: sessionId={}, round={}/{}",
                            conversationResp.getSessionId(),
                            conversationResp.getCurrentRound(),
                            conversationResp.getMaxRounds());

                    // 返回带会话信息的结果
                    IntentMatchResult conversationResult = result.toBuilder()
                            .sessionId(conversationResp.getSessionId())
                            .conversationMessage(conversationResp.getMessage())
                            .requiresConfirmation(true)
                            .build();

                    saveIntentMatchRecord(conversationResult, factoryId, userId,
                            conversationResp.getSessionId(), false);
                    return conversationResult;
                }
            } catch (Exception e) {
                log.warn("启动多轮对话失败: {}", e.getMessage());
                // 失败时继续走 LLM fallback 流程
            }
        }

        // ========== 置信度分层决策 ==========
        // 高置信度区 (>= 0.85): 直接返回，语义评分已足够准确
        // 中置信度区 (0.58-0.85): LLM Reranking，语义评分+LLM双保险
        // 低置信度区 (< 0.58): LLM Fallback，需要完整分类

        double rerankingUpperBound = matchingConfig.getLlmRerankingUpperBound();
        double rerankingLowerBound = matchingConfig.getLlmFallbackConfidenceThreshold();

        // 高置信度: 直接返回
        if (bestConfidence >= rerankingUpperBound) {
            log.info("High confidence ({:.2f} >= {:.2f}), direct return: intent={}",
                    bestConfidence, rerankingUpperBound, bestEntry.config.getIntentCode());
            saveIntentMatchRecord(result, factoryId, null, null, false);
            return result;
        }

        // 中置信度: 尝试 LLM Reranking
        if (matchingConfig.isLlmRerankingEnabled() && bestConfidence >= rerankingLowerBound) {
            log.info("Medium confidence ({:.2f} in [{:.2f}, {:.2f})), trying LLM Reranking: intent={}",
                    bestConfidence, rerankingLowerBound, rerankingUpperBound, bestEntry.config.getIntentCode());
            return tryLlmReranking(userInput, factoryId, candidates, result, opType, userId, userRole);
        }

        // 低置信度: 尝试 LLM Fallback
        if (bestConfidence < rerankingLowerBound) {
            log.debug("Low confidence ({:.2f} < {:.2f}) for intent {}, trying LLM fallback",
                    bestConfidence, rerankingLowerBound, bestEntry.config.getIntentCode());
            return tryLlmFallback(userInput, factoryId, allIntents, result, opType, userId, userRole);
        }

        log.debug("Intent recognized: {} with confidence {} for input: {}",
                bestEntry.config.getIntentCode(), bestConfidence, userInput);

        // 记录意图匹配 (规则匹配，未调用 LLM)
        saveIntentMatchRecord(result, factoryId, null, null, false);

        return result;
    }

    /**
     * 尝试使用 LLM Fallback 进行意图识别
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID（用于 LLM 上下文）
     * @param allIntents 所有可用意图
     * @param ruleResult 规则匹配结果（可能为 null）
     * @param actionType 检测到的操作类型
     * @param userId 用户ID（用于Tool Calling）
     * @param userRole 用户角色（用于Tool Calling）
     * @return LLM 匹配结果，或原始规则结果
     */
    private IntentMatchResult tryLlmFallback(String userInput, String factoryId,
                                              List<AIIntentConfig> allIntents,
                                              IntentMatchResult ruleResult,
                                              ActionType actionType,
                                              Long userId,
                                              String userRole) {
        log.info(">>> Entering tryLlmFallback: userInput='{}', llmFallbackEnabled={}",
                userInput, matchingConfig.isLlmFallbackEnabled());

        // 检查是否启用 LLM Fallback
        if (!matchingConfig.isLlmFallbackEnabled()) {
            log.debug("LLM fallback is disabled");
            IntentMatchResult fallbackResult = ruleResult != null ? ruleResult :
                    IntentMatchResult.empty(userInput, actionType);
            // 如果 ruleResult 存在但没有 actionType，补充设置
            if (ruleResult != null && ruleResult.getActionType() == null) {
                fallbackResult = fallbackResult.toBuilder().actionType(actionType).build();
            }
            saveIntentMatchRecord(fallbackResult, factoryId, null, null, false);
            return fallbackResult;
        }

        // 检查 LLM 服务健康状态
        boolean isHealthy = llmFallbackClient.isHealthy();
        log.info(">>> LLM service health check: isHealthy={}", isHealthy);
        if (!isHealthy) {
            log.warn("LLM service is not healthy, skipping fallback");
            IntentMatchResult fallbackResult = ruleResult != null ? ruleResult :
                    IntentMatchResult.empty(userInput, actionType);
            // 如果 ruleResult 存在但没有 actionType，补充设置
            if (ruleResult != null && ruleResult.getActionType() == null) {
                fallbackResult = fallbackResult.toBuilder().actionType(actionType).build();
            }
            saveIntentMatchRecord(fallbackResult, factoryId, null, null, false);
            return fallbackResult;
        }

        try {
            // v4.1优化：当有候选意图时，优先使用候选意图列表（缩小LLM搜索空间）
            List<AIIntentConfig> intentsForLlm = allIntents;
            if (ruleResult != null && ruleResult.getTopCandidates() != null
                    && !ruleResult.getTopCandidates().isEmpty()) {
                // 从topCandidates提取意图代码
                Set<String> candidateCodes = ruleResult.getTopCandidates().stream()
                        .map(c -> c.getIntentCode())
                        .collect(java.util.stream.Collectors.toSet());

                // 将候选意图放在前面，其余意图放在后面
                List<AIIntentConfig> prioritizedIntents = new ArrayList<>();
                List<AIIntentConfig> otherIntents = new ArrayList<>();
                for (AIIntentConfig intent : allIntents) {
                    if (candidateCodes.contains(intent.getIntentCode())) {
                        prioritizedIntents.add(intent);
                    } else {
                        otherIntents.add(intent);
                    }
                }
                prioritizedIntents.addAll(otherIntents);
                intentsForLlm = prioritizedIntents;

                log.info("LLM fallback with {} prioritized candidates: {}",
                        candidateCodes.size(), candidateCodes);
            }

            // 调用 LLM 进行意图分类（传递userId和userRole用于Tool Calling）
            IntentMatchResult llmResult = llmFallbackClient.classifyIntent(
                    userInput, intentsForLlm, factoryId, userId, userRole);

            // 如果 LLM 成功匹配，使用 LLM 结果
            if (llmResult.hasMatch()) {
                log.info("LLM fallback succeeded: intent={} confidence={}",
                        llmResult.getBestMatch().getIntentCode(), llmResult.getConfidence());

                double confidence = llmResult.getConfidence();
                String intentCode = llmResult.getBestMatch().getIntentCode();

                // 总是记录训练样本（用于未来模型微调）
                if (matchingConfig.isSampleCollectionEnabled()) {
                    try {
                        expressionLearningService.recordSample(
                                factoryId, userInput, intentCode,
                                TrainingSample.MatchMethod.LLM, confidence, null);
                    } catch (Exception e) {
                        log.warn("记录训练样本失败: {}", e.getMessage());
                    }
                }

                // 自动学习：分层策略
                if (matchingConfig.isAutoLearnEnabled()) {
                    if (confidence >= matchingConfig.getAutoLearnConfidenceThreshold()) {
                        // 高置信度：学习关键词 + 表达
                        tryAutoLearnKeywords(userInput, llmResult.getBestMatch(), factoryId);
                        tryAutoLearnExpression(userInput, intentCode, factoryId, confidence,
                                LearnedExpression.SourceType.LLM_FALLBACK);
                        log.info("高置信度学习: 关键词+表达, intent={}, confidence={}",
                                intentCode, confidence);
                    } else if (confidence >= matchingConfig.getAutoLearnExpressionThreshold()) {
                        // 中置信度：只学习表达（不影响关键词）
                        tryAutoLearnExpression(userInput, intentCode, factoryId, confidence,
                                LearnedExpression.SourceType.LLM_FALLBACK);
                        log.info("中置信度学习: 仅表达, intent={}, confidence={}",
                                intentCode, confidence);
                    } else {
                        log.debug("低置信度不学习: intent={}, confidence={}", intentCode, confidence);
                    }
                }

                // 为 LLM 结果设置 actionType
                IntentMatchResult resultWithActionType = llmResult.toBuilder()
                        .actionType(actionType)
                        .build();
                saveIntentMatchRecord(resultWithActionType, factoryId, null, null, true);
                return resultWithActionType;
            }

            // 如果 LLM 也没匹配，触发 clarification 机制
            log.info("LLM fallback did not find a match, triggering clarification for: '{}'", userInput);

            // v4.2优化: LLM无法识别时，返回带clarification的结果而不是直接返回NONE
            String clarificationQuestion = generateLlmFailureClarification(userInput, allIntents);

            IntentMatchResult fallbackResult;
            if (ruleResult != null) {
                // 有规则候选结果，带上clarification问题
                fallbackResult = ruleResult.toBuilder()
                        .actionType(actionType != null ? actionType : ruleResult.getActionType())
                        .requiresConfirmation(true)
                        .clarificationQuestion(clarificationQuestion)
                        .build();
            } else {
                // 完全没有匹配，返回空结果但带clarification
                fallbackResult = IntentMatchResult.builder()
                        .userInput(userInput)
                        .actionType(actionType)
                        .confidence(0.0)
                        .requiresConfirmation(true)
                        .clarificationQuestion(clarificationQuestion)
                        .build();
            }
            saveIntentMatchRecord(fallbackResult, factoryId, null, null, true);
            return fallbackResult;

        } catch (Exception e) {
            log.error("LLM fallback failed: {}", e.getMessage(), e);
            // v4.2优化: 异常时也触发clarification而不是直接返回空
            String clarificationQuestion = "抱歉，系统处理时遇到问题。请您重新描述一下您的需求，或者选择：\n" +
                    "1. 查询数据\n2. 执行操作\n3. 查看报表";

            IntentMatchResult fallbackResult;
            if (ruleResult != null) {
                fallbackResult = ruleResult.toBuilder()
                        .actionType(actionType != null ? actionType : ruleResult.getActionType())
                        .requiresConfirmation(true)
                        .clarificationQuestion(clarificationQuestion)
                        .build();
            } else {
                fallbackResult = IntentMatchResult.builder()
                        .userInput(userInput)
                        .actionType(actionType)
                        .confidence(0.0)
                        .requiresConfirmation(true)
                        .clarificationQuestion(clarificationQuestion)
                        .build();
            }
            saveIntentMatchRecord(fallbackResult, factoryId, null, null, true);
            return fallbackResult;
        }
    }

    /**
     * 尝试使用 LLM Reranking 进行意图确认
     *
     * 这是两阶段检索架构的第二阶段:
     * - 第一阶段: 语义评分系统已生成 Top-N 候选
     * - 第二阶段: LLM 对候选进行精细化重排序确认
     *
     * 适用场景: 中置信度区间 (0.58-0.85)，语义评分有把握但不确定
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @param candidates 语义评分的 Top-N 候选意图
     * @param semanticResult 语义评分结果
     * @param actionType 检测到的操作类型
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return LLM 确认后的结果，或回退到语义评分结果
     */
    private IntentMatchResult tryLlmReranking(String userInput, String factoryId,
                                               List<CandidateIntent> candidates,
                                               IntentMatchResult semanticResult,
                                               ActionType actionType,
                                               Long userId,
                                               String userRole) {
        log.info(">>> Entering tryLlmReranking: userInput='{}', candidates={}, rerankingEnabled={}",
                userInput, candidates.size(), matchingConfig.isLlmRerankingEnabled());

        // 检查是否启用 LLM Reranking
        if (!matchingConfig.isLlmRerankingEnabled()) {
            log.debug("LLM Reranking is disabled, returning semantic result");
            saveIntentMatchRecord(semanticResult, factoryId, null, null, false);
            return semanticResult;
        }

        try {
            // 限制候选数量
            int topK = matchingConfig.getLlmRerankingTopCandidates();
            List<CandidateIntent> topCandidates = candidates.stream()
                    .limit(topK)
                    .collect(Collectors.toList());

            // ========== ArenaRL 歧义裁决 (使用 DashScope，不依赖外部 AI 服务) ==========
            // 检查是否满足 ArenaRL 触发条件 (top1-top2 < 0.15 且 top1 < 0.85)
            log.info("[ArenaRL] 检查触发条件: configExists={}, enabled={}, candidates={}",
                    arenaRLConfig != null,
                    arenaRLConfig != null ? arenaRLConfig.isIntentDisambiguationEnabled() : "N/A",
                    topCandidates.size());
            if (arenaRLConfig != null && arenaRLConfig.isIntentDisambiguationEnabled() && topCandidates.size() >= 2) {
                double top1Conf = topCandidates.get(0).getConfidence();
                double top2Conf = topCandidates.get(1).getConfidence();
                double gap = top1Conf - top2Conf;
                double threshold = arenaRLConfig.getIntentDisambiguation().getAmbiguityThreshold();
                double minTrigger = arenaRLConfig.getIntentDisambiguation().getMinTriggerConfidence();

                if (gap < threshold && top1Conf < minTrigger) {
                    log.info("[ArenaRL] 触发意图歧义裁决: top1={:.3f}, top2={:.3f}, gap={:.3f} < threshold={:.3f}",
                            top1Conf, top2Conf, gap, threshold);

                    // 调用 ArenaRL 锦标赛裁决
                    LlmIntentFallbackClient.ArenaRLResult arenaResult =
                            llmFallbackClient.disambiguateWithArenaRL(userInput, topCandidates, factoryId);

                    if (arenaResult.isSuccess()) {
                        log.info("[ArenaRL] 裁决完成: winner={}, confidence={:.3f}, comparisons={}",
                                arenaResult.getWinnerIntentCode(),
                                arenaResult.getWinnerConfidence(),
                                arenaResult.getComparisonCount());

                        // 使用 ArenaRL 结果
                        String winnerCode = arenaResult.getWinnerIntentCode();
                        Optional<AIIntentConfig> winnerConfigOpt = intentRepository.findByIntentCode(winnerCode);

                        if (winnerConfigOpt.isPresent()) {
                            AIIntentConfig winnerConfig = winnerConfigOpt.get();

                            // 构建 ArenaRL 裁决结果
                            CandidateIntent winnerCandidate = CandidateIntent.builder()
                                    .intentCode(winnerCode)
                                    .intentName(winnerConfig.getIntentName())
                                    .intentCategory(winnerConfig.getIntentCategory())
                                    .confidence(arenaResult.getWinnerConfidence())
                                    .matchMethod(MatchMethod.LLM) // 使用 LLM 方法标记
                                    .description(winnerConfig.getDescription())
                                    .build();

                            List<CandidateIntent> arenaRankedCandidates = new ArrayList<>();
                            arenaRankedCandidates.add(winnerCandidate);
                            for (CandidateIntent c : topCandidates) {
                                if (!c.getIntentCode().equals(winnerCode)) {
                                    arenaRankedCandidates.add(c);
                                }
                            }

                            IntentMatchResult arenaResult2 = IntentMatchResult.builder()
                                    .bestMatch(winnerConfig)
                                    .topCandidates(arenaRankedCandidates)
                                    .confidence(arenaResult.getWinnerConfidence())
                                    .matchMethod(MatchMethod.LLM)
                                    .build();

                            saveIntentMatchRecord(arenaResult2, factoryId, null, null, false);
                            return arenaResult2;
                        }
                    } else {
                        log.warn("[ArenaRL] 裁决失败，回退到 LLM Reranking: {}", arenaResult.getErrorMessage());
                    }
                } else {
                    log.info("[ArenaRL] 未触发: top1={}, top2={}, gap={} (threshold={}), minTrigger={}",
                            top1Conf, top2Conf, gap, threshold, minTrigger);
                }
            }

            // ========== LLM Reranking 回退 (需要检查外部 AI 服务健康状态) ==========
            // 检查 LLM 服务健康状态 (仅在 ArenaRL 未触发或失败时检查)
            if (!llmFallbackClient.isHealthy()) {
                log.warn("LLM service is not healthy, returning semantic result");
                saveIntentMatchRecord(semanticResult, factoryId, null, null, false);
                return semanticResult;
            }

            // 调用 LLM Reranking (ArenaRL 未触发或失败时的回退)
            LlmIntentFallbackClient.RerankingResult rerankingResult =
                    llmFallbackClient.rerankCandidates(userInput, topCandidates, factoryId);

            if (!rerankingResult.isSuccess()) {
                log.warn("LLM Reranking failed: {}, returning semantic result", rerankingResult.getErrorMessage());
                saveIntentMatchRecord(semanticResult, factoryId, null, null, false);
                return semanticResult;
            }

            // 查找 LLM 选中的意图配置
            String selectedIntentCode = rerankingResult.getSelectedIntentCode();
            Optional<AIIntentConfig> selectedConfigOpt = intentRepository.findByIntentCode(selectedIntentCode);

            if (selectedConfigOpt.isEmpty()) {
                log.warn("LLM selected unknown intent: {}, returning semantic result", selectedIntentCode);
                saveIntentMatchRecord(semanticResult, factoryId, null, null, false);
                return semanticResult;
            }

            AIIntentConfig selectedConfig = selectedConfigOpt.get();

            // 计算调整后的置信度
            double adjustedConfidence = rerankingResult.getAdjustedConfidence();
            double minBoost = matchingConfig.getLlmRerankingConfig().getConfidenceBoostMin();

            // 如果 LLM 确认了语义评分的第一选择，提升置信度
            if (rerankingResult.isMatchesOriginalRanking()) {
                adjustedConfidence = Math.min(1.0, Math.max(adjustedConfidence,
                        semanticResult.getConfidence() + minBoost));
                log.info("LLM confirmed semantic ranking, boosted confidence: {:.2f} -> {:.2f}",
                        semanticResult.getConfidence(), adjustedConfidence);
            } else {
                log.info("LLM adjusted ranking: {} -> {}, confidence: {:.2f}",
                        semanticResult.getBestMatch().getIntentCode(),
                        selectedIntentCode,
                        adjustedConfidence);
            }

            // 更新候选列表，将选中的意图移到第一位
            List<CandidateIntent> updatedCandidates = new ArrayList<>();
            CandidateIntent selectedCandidate = null;

            for (CandidateIntent c : candidates) {
                if (c.getIntentCode().equals(selectedIntentCode)) {
                    selectedCandidate = CandidateIntent.builder()
                            .intentCode(c.getIntentCode())
                            .intentName(c.getIntentName())
                            .intentCategory(c.getIntentCategory())
                            .confidence(adjustedConfidence)
                            .matchScore(c.getMatchScore())
                            .matchedKeywords(c.getMatchedKeywords())
                            .matchMethod(MatchMethod.LLM)
                            .description(c.getDescription())
                            .build();
                } else {
                    updatedCandidates.add(c);
                }
            }

            if (selectedCandidate == null) {
                // 如果找不到匹配的候选，创建新的
                selectedCandidate = CandidateIntent.builder()
                        .intentCode(selectedIntentCode)
                        .intentName(selectedConfig.getIntentName())
                        .intentCategory(selectedConfig.getIntentCategory())
                        .confidence(adjustedConfidence)
                        .matchMethod(MatchMethod.LLM)
                        .description(selectedConfig.getDescription())
                        .build();
            }

            updatedCandidates.add(0, selectedCandidate);

            // 构建最终结果
            IntentMatchResult finalResult = IntentMatchResult.builder()
                    .bestMatch(selectedConfig)
                    .topCandidates(updatedCandidates)
                    .confidence(adjustedConfidence)
                    .matchMethod(MatchMethod.LLM) // 标记为 LLM 确认
                    .matchedKeywords(semanticResult.getMatchedKeywords())
                    .isStrongSignal(true) // LLM 确认后视为强信号
                    .requiresConfirmation(false) // LLM 确认后不需要用户再确认
                    .userInput(userInput)
                    .actionType(actionType)
                    .build();

            // 自动学习: LLM 确认的意图，学习表达
            if (matchingConfig.isAutoLearnEnabled() && adjustedConfidence >= matchingConfig.getAutoLearnExpressionThreshold()) {
                tryAutoLearnExpression(userInput, selectedIntentCode, factoryId, adjustedConfidence,
                        LearnedExpression.SourceType.LLM_RERANKING);
                log.info("LLM Reranking 学习表达: intent={}, confidence={:.2f}",
                        selectedIntentCode, adjustedConfidence);
            }

            // 记录训练样本
            if (matchingConfig.isSampleCollectionEnabled()) {
                try {
                    expressionLearningService.recordSample(
                            factoryId, userInput, selectedIntentCode,
                            TrainingSample.MatchMethod.LLM_RERANKING, adjustedConfidence,
                            rerankingResult.getReasoning());
                } catch (Exception e) {
                    log.warn("记录训练样本失败: {}", e.getMessage());
                }
            }

            // 记录意图匹配 (LLM Reranking)
            saveIntentMatchRecord(finalResult, factoryId, null, null, true);

            log.info("LLM Reranking success: intent={}, confidence={:.2f}, reasoning='{}'",
                    selectedIntentCode, adjustedConfidence,
                    truncate(rerankingResult.getReasoning(), 50));

            return finalResult;

        } catch (Exception e) {
            log.error("LLM Reranking failed with exception: {}", e.getMessage(), e);
            // 降级到语义评分结果
            saveIntentMatchRecord(semanticResult, factoryId, null, null, false);
            return semanticResult;
        }
    }

    /**
     * 判断是否为强信号
     */
    private boolean isStrongSignal(IntentScoreEntry bestEntry, List<CandidateIntent> candidates, double confidence) {
        // 条件1: 匹配关键词 >= 3 或正则匹配
        boolean hasEnoughKeywords = bestEntry.matchMethod == MatchMethod.REGEX ||
                (bestEntry.matchedKeywords != null && bestEntry.matchedKeywords.size() >= 3);

        // 条件2: 与第二候选的置信度差距 > 0.3
        boolean hasSignificantGap = true;
        if (candidates.size() >= 2) {
            double gap = candidates.get(0).getConfidence() - candidates.get(1).getConfidence();
            hasSignificantGap = gap > 0.3;
        }

        // 条件3: 优先级 >= 80
        boolean hasHighPriority = bestEntry.config.getPriority() >= 80;

        return hasEnoughKeywords && hasSignificantGap && hasHighPriority;
    }

    /**
     * 判断是否需要用户确认
     *
     * @param userInput 用户输入文本
     * @param config 匹配的意图配置
     * @param isStrongSignal 是否为强信号
     * @param candidates 候选意图列表
     * @return 是否需要用户确认
     */
    private boolean determineRequiresConfirmation(String userInput, AIIntentConfig config, boolean isStrongSignal,
                                                   List<CandidateIntent> candidates) {
        // 短输入总是需要确认（单字符或仅2-3个字符的输入可能是误触发）
        if (userInput != null && userInput.trim().length() <= 3) {
            log.debug("短输入需要确认: length={}", userInput.trim().length());
            return true;
        }

        // 常见停用词/无意义输入需要确认
        if (isAmbiguousInput(userInput)) {
            log.debug("模糊输入需要确认: input={}", userInput);
            return true;
        }

        // 高敏感度意图总是需要确认
        String sensitivity = config.getSensitivityLevel();
        if ("HIGH".equals(sensitivity) || "CRITICAL".equals(sensitivity)) {
            return true;
        }

        // 弱信号需要确认
        if (!isStrongSignal) {
            return true;
        }

        // 多个候选且差距小需要确认
        if (candidates.size() >= 2) {
            double gap = candidates.get(0).getConfidence() - candidates.get(1).getConfidence();
            if (gap < 0.2) {
                return true;
            }
        }

        return false;
    }

    /**
     * v7.1: 判断是否为写入/操作类意图
     *
     * 写入操作风险较高，需要更严格的验证
     *
     * @param opType 检测到的操作类型
     * @param intentCode 意图代码
     * @return 是否为写入操作类型
     */
    private boolean isWriteOperationType(ActionType opType, String intentCode) {
        // 基于操作类型判断
        if (opType != null) {
            switch (opType) {
                case CREATE:
                case UPDATE:
                case DELETE:
                    // 注意: ActionType 枚举没有 EXECUTE，操作类判断通过 intentCode 后缀实现
                    return true;
                default:
                    break;
            }
        }

        // 基于意图代码后缀判断
        if (intentCode != null) {
            String upper = intentCode.toUpperCase();
            return upper.contains("_CREATE") ||
                   upper.contains("_UPDATE") ||
                   upper.contains("_DELETE") ||
                   upper.contains("_START") ||
                   upper.contains("_STOP") ||
                   upper.contains("_PAUSE") ||
                   upper.contains("_RESUME") ||
                   upper.contains("_COMPLETE") ||
                   upper.contains("_EXECUTE") ||
                   upper.contains("_CONSUME") ||
                   upper.contains("_RELEASE") ||
                   upper.contains("_RESERVE") ||
                   upper.contains("_ACKNOWLEDGE") ||
                   upper.contains("_RESOLVE") ||
                   upper.contains("CLOCK_IN") ||
                   upper.contains("CLOCK_OUT");
        }

        return false;
    }

    /**
     * v11.1: 判断输入是否为纯写操作（而非查询操作）
     *
     * 写操作关键词（删除、修改、添加等）+ 没有查询相关词 = 纯写操作
     * 例如：
     * - "删除销售记录" -> 纯写操作，返回 true
     * - "查看删除记录" -> 查询操作，返回 false
     * - "修改库存数据" -> 纯写操作，返回 true
     *
     * @param userInput 用户输入
     * @return 是否为纯写操作
     */
    private boolean isWriteOnlyInput(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return false;
        }

        String normalized = userInput.trim();

        // 写操作关键词（动词）- 按优先级排列
        String[] writeKeywords = {
            "删除", "删掉", "移除", "清空", "清除",
            "修改", "更改", "变更", "编辑",
            "添加", "新增", "新建", "录入", "增加",
            "更新", "创建"
        };

        // 查询动作词（只有这些动词开头才能表示这是一个查询）
        String[] queryPrefixes = {
            "查询", "查看", "查一下", "看一下", "看看", "帮我查", "帮我看",
            "显示", "获取", "统计", "分析", "汇总", "查",
            "了解", "告诉", "告知", "列出", "列表"
        };

        // 方法1: 检查是否以查询词开头
        for (String prefix : queryPrefixes) {
            if (normalized.startsWith(prefix)) {
                log.debug("输入以查询词'{}'开头，不是写操作: {}", prefix, userInput);
                return false;
            }
        }

        // 方法2: 检查是否以写操作词开头，或在前5个字符内包含写操作词
        for (String keyword : writeKeywords) {
            if (normalized.startsWith(keyword)) {
                log.info("输入以写操作词'{}'开头，是写操作: {}", keyword, userInput);
                return true;
            }
            // 也检查前5个字符（允许"帮我删除"这样的模式）
            int pos = normalized.indexOf(keyword);
            if (pos >= 0 && pos <= 4) {
                // 但要排除"查看删除记录"这样的情况
                boolean hasQueryBefore = false;
                for (String qPrefix : queryPrefixes) {
                    if (normalized.startsWith(qPrefix)) {
                        hasQueryBefore = true;
                        break;
                    }
                }
                if (!hasQueryBefore) {
                    log.info("输入在前5字符内包含写操作词'{}'，是写操作: {}", keyword, userInput);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 检测用户输入是否包含多意图触发词
     *
     * 多意图触发词表明用户可能在一次输入中表达了多个独立的意图，
     * 例如："查询今天的生产量和员工出勤" 包含两个独立查询
     *
     * @param userInput 用户输入
     * @return 如果包含多意图触发词返回 true
     */
    private boolean containsMultiIntentTrigger(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return false;
        }

        String normalized = userInput.trim().toLowerCase();

        // ========== v11.9: 精确多意图检测 ==========
        // 只有明确表达多个独立意图的情况才返回 true

        // 1. 强多意图触发词（明确表示要做多件事）
        // v12.7: 扩展触发词列表
        String[] strongMultiIntentTriggers = {
            "顺便", "另外", "还要", "再查", "再看", "同时还",
            // v12.7新增: 更多表示并列意图的词
            "一起", "都", "同时", "并且", "还得", "还需要", "一并", "连同", "加上"
        };
        for (String trigger : strongMultiIntentTriggers) {
            if (normalized.contains(trigger)) {
                log.info("v12.7 检测到强多意图触发词'{}': {}", trigger, userInput);
                return true;
            }
        }

        // v12.8: 关联查询检测细化 - 只有单领域关联才不是多意图
        // "考勤异常的人和他们负责的设备故障有没有关联" 这种跨领域关联查询仍是多意图
        String[] correlationPatterns = {"的关系", "的关联", "有没有关联", "有关系吗", "相关性", "关联分析"};
        for (String pattern : correlationPatterns) {
            if (normalized.contains(pattern)) {
                // v12.8: 检查是否涉及多个领域
                int domainCount = countDomainsInInput(normalized);
                if (domainCount < 2) {
                    log.debug("v12.8 单领域关联查询，不是多意图: {}", userInput);
                    return false;
                }
                // v12.8: 多领域关联查询，可能是多意图或需要特殊处理
                log.info("v12.8 多领域关联查询: domains={}, input={}", domainCount, userInput);
                // 不返回，继续检查是否有其他多意图特征
            }
        }

        // 2. 排除对比模式（需要检查是否多领域）
        // v12.7修复: "比较A和B" 如果A和B是同一领域则不是多意图，如果是不同领域则是多意图
        String[] comparisonPrefixes = {"比较", "对比", "对照", "比对"};
        for (String prefix : comparisonPrefixes) {
            if (normalized.contains(prefix)) {
                // v12.7: 先检查领域数量，再决定是否排除
                // 如果只有一个领域（如"比较上月和本月销售"），则不是多意图
                // 如果有多个领域（如"考勤和效率对比"），则仍是多意图
                int domainCount = countDomainsInInput(normalized);
                if (domainCount < 2) {
                    log.debug("v12.7 单领域对比模式，不是多意图: {}", userInput);
                    return false;
                }
                log.info("v12.7 多领域对比查询，仍为多意图: domains={}, input={}", domainCount, userInput);
                // 不返回，继续检查
            }
        }

        // 3. 排除时间范围模式（不是多意图）
        // "本月和上月"、"今天和昨天" 都是单意图（时间范围查询）
        String[] timeWords = {"月", "周", "天", "日", "年", "季", "今", "昨", "前", "上", "下", "本"};
        if (normalized.contains("和")) {
            String[] parts = normalized.split("和");
            if (parts.length == 2) {
                boolean leftIsTime = false, rightIsTime = false;
                for (String tw : timeWords) {
                    if (parts[0].contains(tw)) leftIsTime = true;
                    if (parts[1].contains(tw)) rightIsTime = true;
                }
                if (leftIsTime && rightIsTime) {
                    log.debug("v11.9 检测到时间范围模式，不是多意图: {}", userInput);
                    return false;
                }
            }
        }

        // 4. "和"连接的是两个不同领域的名词时才是多意图
        // 例如："销售和库存" 可能是多意图，"趋势和排名" 不是
        // 这里简化处理：只有当"和"两边都是独立的业务领域词时才是多意图
        if (normalized.contains("和") || normalized.contains("还有") || normalized.contains("以及")) {
            String[] parts = normalized.split("和|还有|以及");
            if (parts.length >= 2) {
                int domainCount = countDomainsInInput(normalized);
                // 两个部分都包含不同的领域关键词才是多意图
                if (domainCount >= 2) {
                    log.info("v12.7 检测到多领域关键词，可能是多意图: domains={}, input={}", domainCount, userInput);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * v12.7: 计算输入中包含的不同领域数量
     * 用于判断是否为多意图查询
     */
    private int countDomainsInInput(String input) {
        // v12.7: 扩展领域关键词列表
        String[] domainKeywords = {
            // 原有领域
            "销售", "库存", "生产", "设备", "考勤", "质检", "发货", "订单", "物料", "财务",
            // v12.7新增: 更多业务领域词
            "出勤", "KPI", "异常", "效率", "批次", "告警", "进度", "客户", "供应商",
            "报表", "统计", "预警", "维护", "员工", "人员", "成本", "利润", "产量"
        };

        Set<String> foundDomains = new HashSet<>();
        for (String domain : domainKeywords) {
            if (input.contains(domain)) {
                foundDomains.add(domain);
            }
        }
        return foundDomains.size();
    }

    /**
     * v12.2 Phase 3: 模糊输入强制澄清
     *
     * 检测极度模糊的输入（如"查一下"、"看看"、"帮我处理"、"有问题"等），
     * 这些输入缺乏足够的业务上下文，无法可靠地识别意图。
     * 直接触发澄清，避免被错误的短语匹配或关键词匹配捕获。
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param sessionId 会话ID
     * @return 澄清结果，如果输入不是模糊的则返回 null
     */
    private IntentMatchResult checkAndHandleVagueInput(String userInput, String factoryId, Long userId, String sessionId) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return null;
        }

        String normalized = userInput.trim().toLowerCase();

        // v12.3: 业务关键词白名单 - 包含这些词的输入不触发澄清
        // 即使输入很短，只要包含明确的业务意图词，就应该尝试识别
        // v12.4: 扩展业务关键词白名单 - 200测试覆盖
        String[] businessKeywords = {
            // 操作动词
            "删除", "移除", "取消", "作废", "清空", "重置", "注销",
            "创建", "新建", "添加", "录入", "获取", "显示", "查询",
            "修改", "更新", "编辑", "变更", "调整",
            "撤销", "废弃", "清理", "批量",
            // 业务名词 - 核心
            "订单", "库存", "考勤", "设备", "质检", "生产", "发货", "客户", "供应商",
            "物料", "原料", "批次", "追溯", "告警", "预警", "温度", "冷链",
            "用户", "账号", "员工", "工时", "绩效", "排班", "班次",
            "出库", "入库", "采购", "销售", "盘点", "成品",
            "HACCP", "溯源", "产线", "工单", "维修", "维护",
            // 业务名词 - 扩展
            "产品", "仓库", "配置", "价格", "参数", "进度", "周期",
            "报表", "季度", "年度", "月份",
            // 口语化业务表达
            "到齐", "正常", "合格", "靠谱", "跑起来", "完成",
            "够不够", "发了没", "过了吗", "联系",
            // 行业术语
            "FIFO", "BOM", "SOP", "OEE", "WMS", "TMS", "ERP",
            "先进先出", "物料清单", "标准作业", "设备效率", "仓储管理", "运输管理",
            "断链", "合格率", "周转"
        };

        // 检查是否包含业务关键词
        for (String keyword : businessKeywords) {
            if (normalized.contains(keyword.toLowerCase())) {
                log.debug("v12.3 输入包含业务关键词'{}', 跳过模糊检测: {}", keyword, userInput);
                return null;  // 包含业务关键词，不触发澄清
            }
        }

        // v12.2: 极度模糊输入黑名单 - 这些输入必须触发澄清
        // 特点：纯动词/代词/确认词，缺乏业务名词
        // v12.9: 移除 "有问题"，它应该映射到 ALERT_LIST
        String[] vagueInputBlacklist = {
            // 纯动作词（无业务对象）
            "查一下", "看看", "看一下", "瞧瞧", "瞅瞅",
            "帮我处理", "处理一下", "处理下",
            "帮我查", "帮查", "查下", "看下",
            // 模糊问题 - v12.9: 移除 "有问题" (应映射到 ALERT_LIST)
            "有啥问题", "问题",
            // 模糊指代
            "这个", "那个", "哪个",
            // 极短模糊（纯名词无动作）
            "数据", "报表", "统计", "分析",
            // 纯确认词
            "好的", "可以", "行", "好", "嗯"
        };

        for (String vague : vagueInputBlacklist) {
            if (normalized.equals(vague)) {
                log.info("v12.3 模糊输入强制澄清: input='{}' 匹配黑名单'{}'", userInput, vague);

                String clarificationMessage = generateVagueInputClarification(userInput);

                IntentMatchResult result = IntentMatchResult.builder()
                        .bestMatch(null)
                        .confidence(0.0)
                        .matchMethod(MatchMethod.REJECTED)
                        .requiresConfirmation(true)
                        .clarificationQuestion(clarificationMessage)
                        .userInput(userInput)
                        .build();

                return result;
            }
        }

        // 检测2: 极短输入（<=2字符）且不在白名单中
        if (normalized.length() <= 2) {
            log.info("v12.3 极短输入强制澄清: input='{}' 长度={}", userInput, normalized.length());

            String clarificationMessage = "您的输入「" + userInput + "」太简短了，请详细描述您想要做什么。\n" +
                    "例如：\n" +
                    "• 查看今天的订单\n" +
                    "• 查询库存情况\n" +
                    "• 统计本月考勤";

            IntentMatchResult result = IntentMatchResult.builder()
                    .bestMatch(null)
                    .confidence(0.0)
                    .matchMethod(MatchMethod.REJECTED)
                    .requiresConfirmation(true)
                    .clarificationQuestion(clarificationMessage)
                    .userInput(userInput)
                    .build();

            return result;
        }

        return null;
    }

    /**
     * v12.2: 生成模糊输入的澄清问题
     */
    private String generateVagueInputClarification(String userInput) {
        String normalized = userInput.trim().toLowerCase();

        // 根据输入类型生成不同的澄清问题
        if (normalized.contains("查") || normalized.contains("看")) {
            return "您想查询什么信息？请告诉我具体内容，例如：\n" +
                    "• 查看订单 - 订单列表\n" +
                    "• 查看库存 - 库存情况\n" +
                    "• 查看设备 - 设备状态\n" +
                    "• 查看考勤 - 考勤记录";
        } else if (normalized.contains("处理") || normalized.contains("操作")) {
            return "您想处理什么？请告诉我具体操作，例如：\n" +
                    "• 创建订单\n" +
                    "• 更新库存\n" +
                    "• 审批申请\n" +
                    "• 处理告警";
        } else if (normalized.contains("问题")) {
            return "您提到了「问题」，请问是什么方面的问题？\n" +
                    "• 设备问题 - 查看设备状态和告警\n" +
                    "• 质量问题 - 查看质检记录\n" +
                    "• 库存问题 - 查看库存预警\n" +
                    "• 其他问题 - 请详细描述";
        } else {
            return "您的输入「" + userInput + "」不够明确，请详细描述您的需求。\n" +
                    "例如：\n" +
                    "• 查看今天的订单\n" +
                    "• 统计本月销售额\n" +
                    "• 查询设备状态";
        }
    }

    /**
     * v11.10: 增强不完整输入检测，需要触发 clarification
     *
     * 不完整输入的特征：
     * 1. 短输入 + 纯指示词/代词（如"那个"、"帮我看看"）
     * 2. 包含代词引用（如"上次那个"、"刚才说的"）
     * 3. 重复/继续请求（如"再来一次"）
     * 4. 过短且无业务关键词
     */
    private boolean isIncompleteInput(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return true;
        }

        String normalized = userInput.trim().toLowerCase();

        // 1. 短输入检测（<=4字符且是常见不完整模式）
        if (normalized.length() <= 4) {
            String[] shortIncomplete = {"那个", "这个", "哪个", "什么", "帮我", "查下", "看下", "再来"};
            for (String pattern : shortIncomplete) {
                if (normalized.equals(pattern) || normalized.contains(pattern)) {
                    log.info("v11.10 检测到短不完整输入: {}", userInput);
                    return true;
                }
            }
        }

        // 2. 不完整输入模式列表（扩展）
        String[] incompletePatterns = {
            // 代词引用
            "帮我看看那个", "就是那个", "那个东西", "那个数据", "那个报表",
            "上次那个", "刚才那个", "刚才说的", "前面那个", "之前那个",
            "你刚才查的", "刚才查的", "刚刚那个", "你刚才",
            // 重复/继续请求
            "再查一次", "再查一下", "再来一次", "再来一下",
            "接着", "接着看", "继续查",
            // 模糊请求
            "帮我查下", "帮我看下", "帮我看看", "查一下那个",
            "就是关于", "关于那个", "有关那个",
            // 上下文依赖
            "是什么来着", "叫什么来着", "在哪来着",
            "上次说的", "之前说的", "前面说的"
        };

        for (String pattern : incompletePatterns) {
            if (normalized.contains(pattern)) {
                log.info("v11.10 检测到不完整输入模式'{}': {}", pattern, userInput);
                return true;
            }
        }

        // 3. 纯指示词（整个输入就是指示词）
        String[] pureIndicators = {"继续", "好", "行", "可以", "确定", "是的", "对", "嗯", "好的", "再来", "再来一次"};
        for (String indicator : pureIndicators) {
            if (normalized.equals(indicator)) {
                log.info("v11.10 检测到纯指示词: {}", userInput);
                return true;
            }
        }

        // v12.0: 增加极短模糊输入检测
        // 这些输入太模糊，无法确定用户意图，需要澄清
        // v12.9: 移除 "导出"、"有问题"，它们应该有默认意图映射
        String[] veryShortAmbiguous = {
            "相关数据", "那个", "这个", "看看情况", "统计一下", "报表",
            "查一下", "对比分析", "更新一下状态",
            "分析报告", "那个记录", "汇总表", "第三季度的数据"
        };
        for (String pattern : veryShortAmbiguous) {
            if (normalized.equals(pattern)) {
                log.info("v12.0 检测到模糊短输入需要澄清: {}", userInput);
                return true;
            }
        }

        // v12.0: 检测纯动词输入（无业务名词）
        // 例如: "查询一下" 没有说查询什么
        String[] pureActionPatterns = {
            "我想查询一下", "帮我处理一下", "查一下上周的", "对比一下"
        };
        for (String pattern : pureActionPatterns) {
            if (normalized.equals(pattern) || normalized.startsWith(pattern)) {
                // 检查后面是否有业务关键词
                String remaining = normalized.replace(pattern, "").trim();
                if (remaining.isEmpty() || remaining.length() <= 2) {
                    log.info("v12.0 检测到纯动词输入需要澄清: {}", userInput);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Phase 3: 智能澄清决策
     *
     * 使用 SmartClarificationService 进行智能判断：
     * - 检查业务实体是否足够
     * - 尝试从上下文推断缺失信息
     * - 只在真正缺少必要信息时触发澄清
     *
     * @param userInput 用户输入
     * @param matchResult 意图匹配结果（可能为 null）
     * @param context 会话上下文（可能为 null）
     * @return 澄清决策
     */
    private ClarificationDecision makeSmartClarificationDecision(
            String userInput,
            IntentMatchResult matchResult,
            ConversationContext context) {

        // 如果 SmartClarificationService 不可用，使用默认逻辑
        if (smartClarificationService == null || !smartClarificationService.isAvailable()) {
            // 回退到简单的不完整输入检测
            if (isIncompleteInput(userInput)) {
                return ClarificationDecision.need(
                        ClarificationDecision.ClarificationType.INCOMPLETE_PARAMS,
                        "输入不够明确",
                        Collections.emptyList(),
                        0.0);
            }
            return ClarificationDecision.noNeed(matchResult != null && matchResult.getConfidence() != null
                    ? matchResult.getConfidence() : 0.5);
        }

        // 获取最佳匹配的意图配置
        AIIntentConfig intent = matchResult != null ? matchResult.getBestMatch() : null;

        // 调用智能澄清服务
        ClarificationDecision decision = smartClarificationService.decideClarification(
                userInput, intent, matchResult, context);

        log.debug("Phase 3 智能澄清决策: needClarification={}, type={}, confidence={}",
                decision.isNeedClarification(),
                decision.getClarificationType(),
                decision.getConfidenceWithoutClarification());

        return decision;
    }

    /**
     * Phase 3: 构建带智能澄清的意图匹配结果
     *
     * @param userInput 用户输入
     * @param decision 澄清决策
     * @param intent 意图配置（可能为 null）
     * @param context 会话上下文
     * @return 意图匹配结果
     */
    private IntentMatchResult buildClarificationResult(
            String userInput,
            ClarificationDecision decision,
            AIIntentConfig intent,
            ConversationContext context) {

        // 生成澄清问题
        List<String> questions = new ArrayList<>();
        if (smartClarificationService != null && decision.hasMissingSlots()) {
            questions = smartClarificationService.generateClarificationQuestions(decision, intent, context);
        }

        // 构建澄清消息
        String clarificationMessage;
        if (smartClarificationService != null && !questions.isEmpty()) {
            clarificationMessage = smartClarificationService.buildClarificationMessage(decision, questions, intent);
        } else {
            clarificationMessage = "您的输入不够明确，请问您想查询什么信息？例如：销售数据、库存情况、生产进度等";
        }

        IntentMatchResult.IntentMatchResultBuilder builder = IntentMatchResult.builder()
                .bestMatch(intent)
                .topCandidates(Collections.emptyList())
                .confidence(decision.getConfidenceWithoutClarification())
                .matchMethod(MatchMethod.NONE)
                .matchedKeywords(Collections.emptyList())
                .isStrongSignal(false)
                .requiresConfirmation(true)
                .userInput(userInput)
                .actionType(ActionType.UNKNOWN)
                .clarificationQuestion(clarificationMessage);

        // 如果有推断的默认值，可以在元数据中传递
        if (decision.hasInferredDefaults() && decision.isCanProceedWithInference()) {
            // 可以选择继续执行并附带推断说明
            builder.confidence(decision.getConfidenceWithoutClarification());
        }

        return builder.build();
    }

    /**
     * Phase 3: 执行指代消解
     *
     * 在意图识别前对用户输入进行指代消解，
     * 将代词（如"它"、"这个"、"那批"）替换为具体实体
     *
     * @param userInput 用户输入
     * @param context 会话上下文
     * @return 消解后的输入（如果无指代或消解失败则返回原输入）
     */
    private String performCoreferenceResolution(String userInput, ConversationContext context) {
        if (coreferenceResolutionService == null || !coreferenceResolutionService.isAvailable()) {
            return userInput;
        }

        if (!coreferenceResolutionService.hasUnresolvedReferences(userInput)) {
            log.debug("Phase 3: 输入无需指代消解: '{}'", userInput);
            return userInput;
        }

        try {
            ReferenceResult result = coreferenceResolutionService.resolve(userInput, context);

            if (result.isResolved() && result.isModified()) {
                log.info("Phase 3 指代消解成功: '{}' -> '{}', confidence={}, method={}",
                        userInput, result.getResolvedText(),
                        result.getConfidence(), result.getResolutionMethod());
                return result.getResolvedText();
            } else if (result.hasUnresolvedReferences()) {
                log.debug("Phase 3: 部分指代未消解: unresolved={}",
                        result.getUnresolvedReferences());
            }
        } catch (Exception e) {
            log.warn("Phase 3 指代消解失败: {}", e.getMessage());
        }

        return userInput;
    }

    /**
     * v7.1.1: 查找强短语匹配的候选
     *
     * 强短语匹配是指用户输入完全包含某个已知会被 ArenaRL 误判的关键短语，
     * 且该短语唯一指向某个意图。这些短语应该绕过 ArenaRL，直接使用短语映射结果。
     *
     * @param userInput 用户输入
     * @param candidates 候选列表
     * @return 强短语匹配的候选，如果没有则返回 null
     */
    private CandidateIntent findStrongPhraseCandidate(String userInput, List<CandidateIntent> candidates) {
        String input = userInput.toLowerCase().trim();

        // 定义强短语映射（这些短语被 ArenaRL 经常误判）
        // 格式: 输入短语 -> 正确意图
        Map<String, String> strongPhrases = new LinkedHashMap<>();

        // 打卡类 - "下班" 系列容易被误判为 CLOCK_IN
        strongPhrases.put("下班打卡", "CLOCK_OUT");
        strongPhrases.put("下班签退", "CLOCK_OUT");
        strongPhrases.put("下班", "CLOCK_OUT");
        strongPhrases.put("签退", "CLOCK_OUT");

        // 生产控制类 - "暂停" 容易被误判为 SCHEDULING_SET_MANUAL
        strongPhrases.put("暂停生产", "PROCESSING_BATCH_PAUSE");
        strongPhrases.put("暂停批次", "PROCESSING_BATCH_PAUSE");
        strongPhrases.put("生产暂停", "PROCESSING_BATCH_PAUSE");

        // 质检类 - "记录" 容易被误判为执行操作
        strongPhrases.put("质检记录", "QUALITY_CHECK_QUERY");
        strongPhrases.put("检验记录", "QUALITY_CHECK_QUERY");
        strongPhrases.put("质量记录", "QUALITY_CHECK_QUERY");

        // v7.2: 原料创建类 - "添加" 容易被误判为 MATERIAL_UPDATE
        strongPhrases.put("添加新原料", "MATERIAL_BATCH_CREATE");
        strongPhrases.put("新增原料", "MATERIAL_BATCH_CREATE");
        strongPhrases.put("录入原料", "MATERIAL_BATCH_CREATE");
        strongPhrases.put("原料入库", "MATERIAL_BATCH_CREATE");

        // v7.2: 客户统计类 - "客户统计" 容易被误判为 REPORT_DASHBOARD_OVERVIEW
        strongPhrases.put("客户统计", "CUSTOMER_STATS");
        strongPhrases.put("客户数据统计", "CUSTOMER_STATS");
        strongPhrases.put("客户分析", "CUSTOMER_STATS");

        // v7.2: 原料批次详情 - 消除"批次详情"歧义
        strongPhrases.put("原料批次详情", "MATERIAL_BATCH_QUERY");
        strongPhrases.put("原材料批次", "MATERIAL_BATCH_QUERY");
        strongPhrases.put("原料批次", "MATERIAL_BATCH_QUERY");
        strongPhrases.put("查批次", "MATERIAL_BATCH_QUERY");

        // v11.3: 出勤历史 - "今天几个人上班"容易被误判为 ATTENDANCE_TODAY
        strongPhrases.put("今天几个人上班", "ATTENDANCE_HISTORY");
        strongPhrases.put("出勤统计", "ATTENDANCE_HISTORY");
        strongPhrases.put("张三的出勤", "ATTENDANCE_HISTORY");
        strongPhrases.put("员工考勤", "ATTENDANCE_HISTORY");

        // v11.3: 发货/物流查询
        strongPhrases.put("物流到哪了", "SHIPMENT_QUERY");
        strongPhrases.put("今天出货量", "SHIPMENT_QUERY");
        strongPhrases.put("发货状态", "SHIPMENT_QUERY");
        strongPhrases.put("出货统计", "SHIPMENT_QUERY");

        // v11.3: 告警列表 - "异常情况"容易被误判为 REPORT_ANOMALY
        strongPhrases.put("今天异常情况", "ALERT_LIST");
        strongPhrases.put("今天异常", "ALERT_LIST");
        strongPhrases.put("有什么警报", "ALERT_LIST");

        // v11.3: 部门业绩/排名 - 容易被误判为 ATTENDANCE_DEPARTMENT
        strongPhrases.put("各部门业绩", "REPORT_KPI");
        strongPhrases.put("部门排名", "REPORT_KPI");
        strongPhrases.put("哪个部门最好", "REPORT_KPI");

        // v11.3: 地区/区域销售 - 容易被误判为其他意图
        strongPhrases.put("华东区销售", "REPORT_TRENDS");
        strongPhrases.put("北京销售额", "REPORT_TRENDS");
        strongPhrases.put("各地区数据", "REPORT_TRENDS");
        strongPhrases.put("区域分析", "REPORT_TRENDS");
        strongPhrases.put("地区销售", "REPORT_TRENDS");

        // v11.3: 财务指标
        strongPhrases.put("毛利率多少", "REPORT_FINANCE");
        strongPhrases.put("利润率", "REPORT_FINANCE");

        // 检查用户输入是否包含强短语
        for (Map.Entry<String, String> entry : strongPhrases.entrySet()) {
            String phrase = entry.getKey();
            String expectedIntent = entry.getValue();

            if (input.contains(phrase)) {
                // 在候选列表中查找对应的意图
                for (CandidateIntent candidate : candidates) {
                    if (candidate.getIntentCode().equals(expectedIntent)) {
                        log.debug("v7.1.1 强短语匹配: '{}' 包含 '{}' -> {} (在候选列表中找到)",
                                input, phrase, expectedIntent);
                        return candidate;
                    }
                }
                // 短语匹配但候选中没有对应意图
                log.debug("v7.1.1 强短语匹配: '{}' 包含 '{}' -> {} (但候选列表中没有该意图)",
                        input, phrase, expectedIntent);
            }
        }

        return null;
    }

    /**
     * v7.1: 计算时态语义调整分数
     *
     * 时态线索通常表示查询状态而非执行动作:
     * - "正在xxx" → 查询当前状态
     * - "今天的xxx" → 查询今日数据
     * - "最近的xxx" → 查询近期记录
     * - "当前xxx" → 查询当前状态
     *
     * @param userInput 用户输入
     * @param intentCode 意图代码
     * @return 调整分数 (正数表示加分，负数表示减分)
     */
    private double calculateTemporalSemanticAdjustment(String userInput, String intentCode) {
        String input = userInput.toLowerCase();
        String intentUpper = intentCode.toUpperCase();

        // 时态查询词
        boolean hasTemporalQueryMarker = input.contains("正在") ||
                input.contains("今天的") ||
                input.contains("今日") ||
                input.contains("最近的") ||
                input.contains("最近") ||
                input.contains("当前") ||
                input.contains("目前");

        if (!hasTemporalQueryMarker) {
            return 0.0; // 无时态标记，不调整
        }

        // 检查意图是查询类还是操作类
        boolean isQueryIntent = intentUpper.contains("_LIST") ||
                intentUpper.contains("_QUERY") ||
                intentUpper.contains("_DETAIL") ||
                intentUpper.contains("_STATS") ||
                intentUpper.contains("_HISTORY") ||
                intentUpper.contains("_TIMELINE") ||
                intentUpper.contains("_ACTIVE") ||
                intentUpper.contains("_STATUS");

        boolean isActionIntent = intentUpper.contains("_START") ||
                intentUpper.contains("_CREATE") ||
                intentUpper.contains("_UPDATE") ||
                intentUpper.contains("_DELETE") ||
                intentUpper.contains("_EXECUTE");

        if (isQueryIntent && !isActionIntent) {
            // 时态标记 + 查询意图 = 正确匹配，加分
            log.debug("v7.1时态语义: {} 检测到时态查询词 + 查询意图 (+0.08)", intentCode);
            return 0.08;
        } else if (isActionIntent && !isQueryIntent) {
            // 时态标记 + 操作意图 = 可能错误，减分
            log.debug("v7.1时态语义: {} 检测到时态查询词但是操作意图 (-0.12)", intentCode);
            return -0.12;
        }

        return 0.0;
    }

    /**
     * 计算时态与意图的一致性分数 v7.4
     *
     * 规则：
     * - 过去时态 (刚才/之前/已经) + 查询类意图 → +10分
     * - 过去时态 + 动作类意图 (CREATE/START/EXECUTE) → -15分
     * - 将来时态 (即将/将要/马上) + 查询类意图 → +10分
     * - 将来时态 + 动作类意图 → -10分
     * - 进行时态 (正在/ing) + 状态类意图 → +10分
     *
     * @param input 用户输入
     * @param intentCode 意图代码
     * @param semanticAction 语义动作 (如 READ, QUERY, CREATE 等)
     * @return 调整分数 (正数表示加分，负数表示减分)
     */
    private int calculateTenseConsistency(String input, String intentCode, String semanticAction) {
        // 检测时态
        boolean isPast = input.matches(".*(刚才|之前|已经|曾经|上次|昨天|前天|历史).*");
        boolean isFuture = input.matches(".*(即将|将要|马上|明天|下周|未来|将).*");
        boolean isOngoing = input.matches(".*(正在|在进行|进行中|运行中).*");

        // 判断意图类型
        boolean isActionIntent = intentCode.contains("CREATE") || intentCode.contains("START")
            || intentCode.contains("EXECUTE") || intentCode.contains("UPDATE")
            || intentCode.contains("RECORD") || intentCode.contains("CONSUME");
        boolean isQueryIntent = "READ".equalsIgnoreCase(semanticAction)
            || "QUERY".equalsIgnoreCase(semanticAction)
            || intentCode.contains("QUERY") || intentCode.contains("LIST")
            || intentCode.contains("DETAIL") || intentCode.contains("STATS");
        boolean isStatusIntent = intentCode.contains("STATUS") || intentCode.contains("LIST");

        int score = 0;

        // 过去时态规则
        if (isPast) {
            if (isQueryIntent) {
                score += 10;  // 过去时态查询，加分
                log.debug("v7.4时态一致性: {} 过去时态 + 查询意图 (+10)", intentCode);
            }
            if (isActionIntent) {
                score -= 15;  // 过去时态不应执行动作，扣分
                log.debug("v7.4时态一致性: {} 过去时态 + 动作意图 (-15)", intentCode);
            }
        }

        // 将来时态规则
        if (isFuture) {
            if (isQueryIntent) {
                score += 10;  // 将来时态查询（如查即将到期），加分
                log.debug("v7.4时态一致性: {} 将来时态 + 查询意图 (+10)", intentCode);
            }
            if (isActionIntent) {
                score -= 10;  // 将来时态通常不是立即执行
                log.debug("v7.4时态一致性: {} 将来时态 + 动作意图 (-10)", intentCode);
            }
        }

        // 进行时态规则
        if (isOngoing) {
            if (isStatusIntent || isQueryIntent) {
                score += 10;  // 进行时态查状态，加分
                log.debug("v7.4时态一致性: {} 进行时态 + 状态/查询意图 (+10)", intentCode);
            }
        }

        return score;
    }

    /**
     * 判断输入是否模糊/无意义
     */
    private boolean isAmbiguousInput(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return true;
        }

        String input = userInput.trim().toLowerCase();

        // 使用知识库中的短输入停用词
        if (knowledgeBase.isShortInputStopWord(input)) {
            return true;
        }

        // 纯数字或特殊字符
        if (input.matches("^[\\d\\s\\p{Punct}]+$")) {
            return true;
        }

        // 无意义字符串（连续相同字符或键盘乱按）
        if (input.matches("^(.)\\1{2,}$") ||  // 如 "aaaa"
            input.matches("^[a-z]{4,}$") && !knowledgeBase.isMeaningfulInput(input)) {  // 如 "asdfgh"
            return true;
        }

        return false;
    }

    /**
     * 判断输入是否需要确认（用于LLM结果的二次检查）
     * 短输入或模糊输入应该触发确认，无论匹配方法
     */
    private boolean shouldRequireConfirmationForInput(String userInput) {
        if (userInput == null) {
            return false;
        }

        String trimmed = userInput.trim();

        // 短输入（<=3个字符）总是需要确认
        if (trimmed.length() <= 3) {
            return true;
        }

        // 模糊输入需要确认
        return isAmbiguousInput(userInput);
    }

    /**
     * 生成澄清问题
     *
     * @param userInput 用户输入（用于 LLM 上下文）
     * @param factoryId 工厂ID（用于 LLM 上下文）
     * @param candidates 候选意图列表
     * @return 澄清问题文本
     */
    private String generateClarificationQuestion(String userInput, String factoryId,
                                                   List<CandidateIntent> candidates) {
        // 尝试使用 LLM 生成更自然的澄清问题
        if (matchingConfig.isLlmClarificationEnabled() && candidates.size() >= 2) {
            try {
                String llmQuestion = llmFallbackClient.generateClarificationQuestion(
                        userInput, candidates, factoryId);
                if (llmQuestion != null && !llmQuestion.isEmpty()) {
                    log.debug("LLM generated clarification question: {}", llmQuestion);
                    return llmQuestion;
                }
            } catch (Exception e) {
                log.warn("LLM clarification question generation failed, using template: {}", e.getMessage());
            }
        }

        // 回退到模板生成
        return generateTemplateClarificationQuestion(candidates);
    }

    /**
     * 使用模板生成澄清问题（作为 LLM 的备用方案）
     */
    private String generateTemplateClarificationQuestion(List<CandidateIntent> candidates) {
        if (candidates.isEmpty()) {
            return "请问您想要做什么操作？";
        }

        if (candidates.size() == 1) {
            return String.format("您是想要「%s」吗？", candidates.get(0).getIntentName());
        }

        StringBuilder sb = new StringBuilder("请问您想要的操作是：\n");
        for (int i = 0; i < Math.min(3, candidates.size()); i++) {
            CandidateIntent c = candidates.get(i);
            sb.append(String.format("%d. %s (%s)\n", i + 1, c.getIntentName(), c.getDescription()));
        }
        return sb.toString();
    }

    /**
     * v4.2: LLM无法识别意图时生成澄清问题
     * 当规则匹配和LLM都无法确定意图时，生成引导性问题让用户澄清
     */
    private String generateLlmFailureClarification(String userInput, List<AIIntentConfig> allIntents) {
        // 尝试从输入中识别领域，给出领域相关的建议
        IntentKnowledgeBase.Domain detectedDomain = knowledgeBase.detectDomain(userInput);

        if (detectedDomain != null && detectedDomain != IntentKnowledgeBase.Domain.GENERAL) {
            // 根据检测到的领域，给出该领域常见操作的建议
            String domainName = detectedDomain.getDisplayName();
            return String.format("我没有完全理解您的意思。您的问题似乎与「%s」相关，请问您想要：\n" +
                    "1. 查询%s相关信息\n" +
                    "2. 执行%s相关操作\n" +
                    "3. 查看%s统计报表\n" +
                    "或者，请您更详细地描述一下需求？",
                    domainName, domainName, domainName, domainName);
        }

        // 无法识别领域时的通用澄清问题
        return "抱歉，我没有完全理解您的意思。请问您想要：\n" +
                "1. 查询某类数据（如设备、原料、生产批次等）\n" +
                "2. 执行某个操作（如创建、修改、删除等）\n" +
                "3. 查看报表或统计\n" +
                "4. 其他（请详细描述）\n" +
                "请选择或更详细地描述您的需求。";
    }

    /**
     * v4.2: 为通用咨询问题生成澄清提示
     *
     * 当系统检测到用户输入是GENERAL_QUESTION类型时，生成引导性问题
     * 帮助用户明确是想要咨询建议还是执行具体操作
     *
     * @param userInput 用户输入
     * @param questionType 问题类型
     * @return 澄清问题字符串
     */
    private String generateGeneralQuestionClarification(String userInput,
            IntentKnowledgeBase.QuestionType questionType) {
        // 尝试识别输入中的关键词来生成更精准的澄清
        IntentKnowledgeBase.Domain detectedDomain = knowledgeBase.detectDomain(userInput);

        if (questionType == IntentKnowledgeBase.QuestionType.CONVERSATIONAL) {
            // 闲聊类型 - 不需要澄清，直接交给LLM回复
            return null;
        }

        // GENERAL_QUESTION类型 - 可能是咨询也可能是操作意图不明确
        if (detectedDomain != null && detectedDomain != IntentKnowledgeBase.Domain.GENERAL) {
            String domainName = detectedDomain.getDisplayName();
            return String.format("您的问题与「%s」相关。请问您是想：\n" +
                    "1. 获取%s相关的建议和指导\n" +
                    "2. 查询具体的%s数据\n" +
                    "3. 执行%s相关操作\n" +
                    "请选择或详细描述您的需求。",
                    domainName, domainName, domainName, domainName);
        }

        // 无法识别领域时的通用澄清
        return "请问您是想：\n" +
                "1. 获取操作建议和指导\n" +
                "2. 查询具体数据（如库存、生产进度等）\n" +
                "3. 执行某个操作（如创建任务、修改信息等）\n" +
                "请选择或更详细地描述您的需求。";
    }

    // ==================== 意图匹配记录 ====================

    /**
     * 保存意图匹配记录（异步，不阻塞主流程）
     *
     * @param result 匹配结果
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param sessionId 会话ID
     * @param llmCalled 是否调用了LLM
     */
    private void saveIntentMatchRecord(IntentMatchResult result, String factoryId,
                                         Long userId, String sessionId, boolean llmCalled) {
        if (!matchingConfig.isRecordingEnabled()) {
            return;
        }

        try {
            // 序列化候选意图列表
            String topCandidatesJson = null;
            String matchedKeywordsJson = null;
            if (result.getTopCandidates() != null && !result.getTopCandidates().isEmpty()) {
                List<Map<String, Object>> candidateList = result.getTopCandidates().stream()
                        .map(c -> {
                            Map<String, Object> map = new HashMap<>();
                            map.put("intentCode", c.getIntentCode());
                            map.put("confidence", c.getConfidence());
                            map.put("matchScore", c.getMatchScore());
                            return map;
                        })
                        .collect(Collectors.toList());
                topCandidatesJson = objectMapper.writeValueAsString(candidateList);
            }

            if (result.getMatchedKeywords() != null && !result.getMatchedKeywords().isEmpty()) {
                matchedKeywordsJson = objectMapper.writeValueAsString(result.getMatchedKeywords());
            }

            // 构建记录实体
            IntentMatchRecord.IntentMatchRecordBuilder recordBuilder = IntentMatchRecord.builder()
                    .factoryId(factoryId != null ? factoryId : "DEFAULT")
                    .userId(userId != null ? userId : 0L)
                    .sessionId(sessionId)
                    .userInput(result.getUserInput())
                    .normalizedInput(result.getUserInput() != null ? result.getUserInput().toLowerCase().trim() : null)
                    .confidenceScore(BigDecimal.valueOf(result.getConfidence()))
                    .topCandidates(topCandidatesJson)
                    .matchedKeywords(matchedKeywordsJson)
                    .isStrongSignal(result.getIsStrongSignal() != null ? result.getIsStrongSignal() : false)
                    .requiresConfirmation(result.getRequiresConfirmation() != null ? result.getRequiresConfirmation() : false)
                    .clarificationQuestion(result.getClarificationQuestion())
                    .llmCalled(llmCalled)
                    .executionStatus(IntentMatchRecord.ExecutionStatus.PENDING);

            // 匹配方法转换
            if (result.getMatchMethod() != null) {
                switch (result.getMatchMethod()) {
                    case REGEX:
                        recordBuilder.matchMethod(IntentMatchRecord.MatchMethod.REGEX);
                        break;
                    case KEYWORD:
                        recordBuilder.matchMethod(IntentMatchRecord.MatchMethod.KEYWORD);
                        break;
                    case SEMANTIC:
                        recordBuilder.matchMethod(IntentMatchRecord.MatchMethod.SEMANTIC);
                        break;
                    case FUSION:
                        recordBuilder.matchMethod(IntentMatchRecord.MatchMethod.FUSION);
                        break;
                    case LLM:
                        recordBuilder.matchMethod(IntentMatchRecord.MatchMethod.LLM);
                        break;
                    case DOMAIN_DEFAULT:
                        recordBuilder.matchMethod(IntentMatchRecord.MatchMethod.DOMAIN_DEFAULT);
                        break;
                    default:
                        recordBuilder.matchMethod(IntentMatchRecord.MatchMethod.NONE);
                }
            } else {
                recordBuilder.matchMethod(IntentMatchRecord.MatchMethod.NONE);
            }

            // 填充最佳匹配信息
            if (result.hasMatch()) {
                AIIntentConfig bestMatch = result.getBestMatch();
                recordBuilder.matchedIntentCode(bestMatch.getIntentCode())
                        .matchedIntentName(bestMatch.getIntentName())
                        .matchedIntentCategory(bestMatch.getIntentCategory());

                // 匹配分数（取第一个候选的分数）
                if (result.getTopCandidates() != null && !result.getTopCandidates().isEmpty()) {
                    recordBuilder.matchScore(result.getTopCandidates().get(0).getMatchScore());
                }
            }

            IntentMatchRecord record = recordBuilder.build();
            recordRepository.save(record);

            log.debug("Intent match record saved: id={}, intent={}, confidence={}",
                    record.getId(), record.getMatchedIntentCode(), record.getConfidenceScore());

        } catch (Exception e) {
            // 记录失败不应该影响主流程
            log.warn("Failed to save intent match record: {}", e.getMessage());
        }
    }

    /**
     * 获取用于匹配的所有关键词（合并基础关键词 + 工厂级 + 全局）
     *
     * @param factoryId 工厂ID（可为null，表示只使用基础和全局关键词）
     * @param intent 意图配置
     * @return 合并后的关键词列表
     */
    private List<String> getAllKeywordsForMatching(String factoryId, AIIntentConfig intent) {
        Set<String> allKeywords = new HashSet<>();
        String intentCode = intent.getIntentCode();

        // 1. 基础关键词 (from JSON field)
        String keywordsJson = intent.getKeywords();
        if (keywordsJson != null && !keywordsJson.isEmpty()) {
            try {
                List<String> baseKeywords = objectMapper.readValue(keywordsJson,
                        new TypeReference<List<String>>() {});
                allKeywords.addAll(baseKeywords);
            } catch (Exception e) {
                log.warn("Failed to parse base keywords for intent {}: {}", intentCode, e.getMessage());
            }
        }

        // 2. 工厂级关键词 (from keyword_effectiveness table, effectiveness >= 0.3)
        // v4.1优化: 降低阈值0.5→0.3，让更多学习到的关键词参与匹配
        if (factoryId != null && !factoryId.isEmpty()) {
            try {
                var factoryKeywords = keywordEffectivenessService.getEffectiveKeywords(
                        factoryId, intentCode, new BigDecimal("0.3"));
                factoryKeywords.forEach(k -> allKeywords.add(k.getKeyword()));
                if (!factoryKeywords.isEmpty()) {
                    log.debug("Added {} factory-level keywords for intent {} in factory {}",
                            factoryKeywords.size(), intentCode, factoryId);
                }
            } catch (Exception e) {
                log.warn("Failed to get factory keywords for intent {}: {}", intentCode, e.getMessage());
            }
        }

        // 3. 全局关键词 (GLOBAL, from keyword_effectiveness table)
        // v4.1优化: 降低阈值0.5→0.3，让更多学习到的关键词参与匹配
        try {
            var globalKeywords = keywordEffectivenessService.getEffectiveKeywords(
                    "GLOBAL", intentCode, new BigDecimal("0.3"));
            globalKeywords.forEach(k -> allKeywords.add(k.getKeyword()));
            if (!globalKeywords.isEmpty()) {
                log.debug("Added {} global keywords for intent {}", globalKeywords.size(), intentCode);
            }
        } catch (Exception e) {
            log.warn("Failed to get global keywords for intent {}: {}", intentCode, e.getMessage());
        }

        return new ArrayList<>(allKeywords);
    }

    /**
     * 获取匹配的关键词列表（带工厂ID）
     *
     * v5.0优化: 长关键词优先匹配，基于位置的重叠检测
     * - 按关键词长度倒序排列
     * - 使用位置追踪防止短词覆盖长词
     * - 例如："查发货"应该匹配完整的"查发货"而非"发货"
     */
    private List<String> getMatchedKeywords(AIIntentConfig intent, String input, String factoryId) {
        List<String> keywords = getAllKeywordsForMatching(factoryId, intent);
        if (keywords.isEmpty()) {
            return Collections.emptyList();
        }

        // v5.0优化: 按长度降序排序，长关键词优先匹配
        List<String> sortedKeywords = keywords.stream()
                .sorted((a, b) -> Integer.compare(b.length(), a.length()))
                .collect(Collectors.toList());

        List<String> matchedKeywords = new ArrayList<>();
        String lowerInput = input.toLowerCase();

        // 记录已匹配的位置区间，防止短词覆盖长词
        Set<Integer> usedPositions = new HashSet<>();

        for (String keyword : sortedKeywords) {
            String lowerKeyword = keyword.toLowerCase();
            int idx = lowerInput.indexOf(lowerKeyword);
            if (idx >= 0 && !isPositionOverlap(idx, lowerKeyword.length(), usedPositions)) {
                matchedKeywords.add(keyword);
                markPositionUsed(idx, lowerKeyword.length(), usedPositions);
            }
        }

        return matchedKeywords;
    }

    /**
     * 检查位置是否与已使用的位置重叠
     */
    private boolean isPositionOverlap(int start, int length, Set<Integer> usedPositions) {
        for (int i = start; i < start + length; i++) {
            if (usedPositions.contains(i)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 标记位置为已使用
     */
    private void markPositionUsed(int start, int length, Set<Integer> usedPositions) {
        for (int i = start; i < start + length; i++) {
            usedPositions.add(i);
        }
    }

    /**
     * 获取匹配的关键词列表（向后兼容，无工厂ID）
     */
    private List<String> getMatchedKeywords(AIIntentConfig intent, String input) {
        return getMatchedKeywords(intent, input, null);
    }

    /**
     * 内部类：意图分数条目
     */
    private static class IntentScoreEntry {
        AIIntentConfig config;
        MatchMethod matchMethod;
        int matchScore;
        List<String> matchedKeywords;
    }

    @Override
    @Deprecated
    public Optional<AIIntentConfig> getIntentByCode(String intentCode) {
        log.debug("Delegating getIntentByCode(intentCode={}) to intentConfigService", intentCode);
        return intentRepository.findByIntentCodeAndIsActiveTrueAndDeletedAtIsNull(intentCode);
    }

    @Override
    public Optional<AIIntentConfig> getIntentByCode(String factoryId, String intentCode) {
        log.debug("Delegating getIntentByCode(factoryId={}, intentCode={}) to intentConfigService", factoryId, intentCode);
        // v11.2d: 使用支持全局意图回退的查询方法
        // 优先返回工厂级配置，如果没有则返回全局配置（factoryId IS NULL）
        List<AIIntentConfig> results = intentRepository.findByIntentCodeAndFactoryIdOrPlatform(intentCode, factoryId);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }


    /**
     * Check if user role has permission for the given intent config
     */
    private boolean checkRolePermission(AIIntentConfig config, String userRole) {
        if (config == null || userRole == null) {
            return false;
        }
        // If no allowed roles specified, allow all
        if (config.getRequiredRoles() == null || config.getRequiredRoles().isBlank()) {
            return true;
        }
        // v11.2d: Support both JSON array and comma-separated formats
        String roles = config.getRequiredRoles().trim();
        if (roles.startsWith("[")) {
            // JSON array format: ["role1", "role2"]
            // Simple parsing without ObjectMapper for performance
            return roles.contains("\"" + userRole + "\"");
        } else {
            // Legacy comma-separated format: role1,role2
            return java.util.Arrays.asList(roles.split(",")).contains(userRole);
        }
    }

    // ==================== 权限校验 ====================

    @Override
    public boolean hasPermission(String factoryId, String intentCode, String userRole) {
        log.debug("Delegating hasPermission(factoryId={}, intentCode={}, userRole={}) to intentPermissionService",
                factoryId, intentCode, userRole);
        return getIntentByCode(factoryId, intentCode).map(config -> checkRolePermission(config, userRole)).orElse(false);
    }

    @Override
    @Deprecated
    public boolean hasPermission(String intentCode, String userRole) {
        log.debug("Delegating hasPermission(intentCode={}, userRole={}) to intentPermissionService",
                intentCode, userRole);
        return getIntentByCode(intentCode).map(config -> checkRolePermission(config, userRole)).orElse(false);
    }

    @Override
    public boolean requiresApproval(String factoryId, String intentCode) {
        log.debug("Delegating requiresApproval(factoryId={}, intentCode={}) to intentPermissionService",
                factoryId, intentCode);
        return getIntentByCode(factoryId, intentCode).map(AIIntentConfig::needsApproval).orElse(false);
    }

    @Override
    @Deprecated
    public boolean requiresApproval(String intentCode) {
        log.debug("Delegating requiresApproval(intentCode={}) to intentPermissionService", intentCode);
        return getIntentByCode(intentCode).map(AIIntentConfig::needsApproval).orElse(false);
    }

    @Override
    public Optional<String> getApprovalChainId(String factoryId, String intentCode) {
        return getIntentByCode(factoryId, intentCode)
                .filter(AIIntentConfig::needsApproval)
                .map(AIIntentConfig::getApprovalChainId);
    }

    @Override
    @Deprecated
    public Optional<String> getApprovalChainId(String intentCode) {
        return getIntentByCode(intentCode)
                .filter(AIIntentConfig::needsApproval)
                .map(AIIntentConfig::getApprovalChainId);
    }

    // ==================== 配额管理 ====================

    @Override
    public int getQuotaCost(String factoryId, String intentCode) {
        return getIntentByCode(factoryId, intentCode)
                .map(AIIntentConfig::getQuotaCost)
                .orElse(1);
    }

    @Override
    @Deprecated
    public int getQuotaCost(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::getQuotaCost)
                .orElse(1);
    }

    @Override
    public int getCacheTtl(String factoryId, String intentCode) {
        return getIntentByCode(factoryId, intentCode)
                .map(AIIntentConfig::getCacheTtlMinutes)
                .orElse(0);
    }

    @Override
    @Deprecated
    public int getCacheTtl(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::getCacheTtlMinutes)
                .orElse(0);
    }

    // ==================== 意图查询 (租户隔离) ====================

    @Override
    public List<AIIntentConfig> getAllIntents(String factoryId) {
        log.debug("Delegating getAllIntents(factoryId={}) to intentConfigService", factoryId);
        return intentRepository.findByFactoryIdOrPlatformLevel(factoryId);
    }

    @Override
    @Cacheable(value = "intentsByCategory", key = "#factoryId + ':' + #category")
    public List<AIIntentConfig> getIntentsByCategory(String factoryId, String category) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getIntentsByCategory called without factoryId");
            return List.of();
        }
        return intentRepository.findByFactoryIdAndCategory(factoryId, category);
    }

    @Override
    @Cacheable(value = "intentsBySensitivity", key = "#factoryId + ':' + #sensitivityLevel")
    public List<AIIntentConfig> getIntentsBySensitivity(String factoryId, String sensitivityLevel) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getIntentsBySensitivity called without factoryId");
            return List.of();
        }
        return intentRepository.findByFactoryIdAndSensitivity(factoryId, sensitivityLevel);
    }

    @Override
    @Cacheable(value = "intentCategories", key = "#factoryId")
    public List<String> getAllCategories(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getAllCategories called without factoryId");
            return List.of();
        }
        return intentRepository.findCategoriesByFactoryId(factoryId);
    }

    // ==================== 意图查询 (无租户隔离, 向后兼容) ====================

    @Override
    @Deprecated
    public List<AIIntentConfig> getAllIntents() {
        log.debug("Delegating getAllIntents() to intentConfigService");
        return intentRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc();
    }

    @Override
    @Deprecated
    @Cacheable(value = "intentsByCategory_legacy", key = "#category")
    public List<AIIntentConfig> getIntentsByCategory(String category) {
        log.warn("Deprecated getIntentsByCategory() called without factoryId");
        return intentRepository.findByIntentCategoryAndIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc(category);
    }

    @Override
    @Deprecated
    public List<AIIntentConfig> getIntentsBySensitivity(String sensitivityLevel) {
        log.warn("Deprecated getIntentsBySensitivity() called without factoryId");
        return intentRepository.findBySensitivityLevelAndIsActiveTrueAndDeletedAtIsNull(sensitivityLevel);
    }

    @Override
    @Deprecated
    @Cacheable(value = "intentCategories_legacy")
    public List<String> getAllCategories() {
        log.warn("Deprecated getAllCategories() called without factoryId");
        return intentRepository.findAllCategories();
    }

    // ==================== 意图管理 ====================

    @Override
    @Transactional
    public AIIntentConfig createIntent(AIIntentConfig intentConfig) {
        log.debug("Delegating createIntent(intentCode={}) to intentConfigService", intentConfig.getIntentCode());
        return intentRepository.save(intentConfig);
    }

    @Override
    @Transactional
    public AIIntentConfig updateIntent(AIIntentConfig intentConfig) {
        log.debug("Delegating updateIntent(intentCode={}) to intentConfigService", intentConfig.getIntentCode());
        return intentRepository.save(intentConfig);
    }

    @Override
    @Transactional
    public void deleteIntent(String intentCode) {
        log.debug("Delegating deleteIntent(intentCode={}) to intentConfigService", intentCode);
        intentRepository.findByIntentCodeAndDeletedAtIsNull(intentCode).ifPresent(config -> { config.setDeletedAt(java.time.LocalDateTime.now()); intentRepository.save(config); });
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public void setIntentActive(String intentCode, boolean active) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentCode)
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentCode));

        existing.setIsActive(active);
        intentRepository.save(existing);
    }

    // ==================== 多意图识别 ====================

    @Override
    public MultiIntentResult recognizeMultiIntent(String userInput, String factoryId) {
        return recognizeMultiIntent(userInput, factoryId, multiLabelIntentClassifier.getDefaultThreshold());
    }

    @Override
    public MultiIntentResult recognizeMultiIntent(String userInput, String factoryId, double threshold) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return MultiIntentResult.builder()
                    .isMultiIntent(false)
                    .intents(Collections.emptyList())
                    .executionStrategy(MultiIntentResult.ExecutionStrategy.PARALLEL)
                    .overallConfidence(0.0)
                    .reasoning("输入为空")
                    .build();
        }

        // 检查服务可用性
        if (!multiLabelIntentClassifier.isAvailable()) {
            log.warn("多标签意图分类器不可用，降级为单意图识别");
            // 降级处理：使用现有的单意图识别
            IntentMatchResult singleResult = recognizeIntentWithConfidence(userInput, factoryId, 1, null, null, null);
            if (singleResult != null && singleResult.getBestMatch() != null) {
                return MultiIntentResult.builder()
                        .isMultiIntent(false)
                        .intents(Collections.singletonList(
                                MultiIntentResult.SingleIntentMatch.builder()
                                        .intentCode(singleResult.getBestMatch().getIntentCode())
                                        .intentName(singleResult.getBestMatch().getIntentName())
                                        .confidence(singleResult.getConfidence())
                                        .extractedParams(new HashMap<>())
                                        .reasoning("降级为单意图识别")
                                        .executionOrder(1)
                                        .build()
                        ))
                        .executionStrategy(MultiIntentResult.ExecutionStrategy.PARALLEL)
                        .overallConfidence(singleResult.getConfidence())
                        .reasoning("Embedding服务不可用，降级为单意图")
                        .build();
            }
            return MultiIntentResult.builder()
                    .isMultiIntent(false)
                    .intents(Collections.emptyList())
                    .executionStrategy(MultiIntentResult.ExecutionStrategy.PARALLEL)
                    .overallConfidence(0.0)
                    .reasoning("无法识别意图")
                    .build();
        }

        try {
            // 使用多标签分类器
            MultiIntentResult result = multiLabelIntentClassifier.classifyMultiLabel(userInput, factoryId, threshold);

            log.info("多意图识别完成: isMulti={}, intents={}, strategy={}, confidence={:.3f}",
                    result.isMultiIntent(),
                    result.getIntents() != null ? result.getIntents().size() : 0,
                    result.getExecutionStrategy(),
                    result.getOverallConfidence());

            return result;

        } catch (Exception e) {
            log.error("多意图识别失败: {}", e.getMessage(), e);
            return MultiIntentResult.builder()
                    .isMultiIntent(false)
                    .intents(Collections.emptyList())
                    .executionStrategy(MultiIntentResult.ExecutionStrategy.PARALLEL)
                    .overallConfidence(0.0)
                    .reasoning("识别过程异常: " + e.getMessage())
                    .build();
        }
    }

    // ==================== 缓存管理 ====================

    @Override
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public void clearCache() {
        log.info("Cleared AI intent config cache");
    }

    @Override
    public void refreshCache() {
        clearCache();
        getAllIntents(); // 重新加载缓存
        log.info("Refreshed AI intent config cache");
    }

    // ==================== 私有方法 ====================

    /**
     * 使用正则表达式匹配意图
     */
    private boolean matchesByRegex(AIIntentConfig intent, String input) {
        String regexPattern = intent.getRegexPattern();
        if (regexPattern == null || regexPattern.isEmpty()) {
            return false;
        }

        try {
            return Pattern.compile(regexPattern, Pattern.CASE_INSENSITIVE)
                    .matcher(input)
                    .find();
        } catch (Exception e) {
            log.warn("Invalid regex pattern for intent {}: {}", intent.getIntentCode(), regexPattern);
            return false;
        }
    }

    /**
     * 计算关键词匹配分数（带工厂ID）
     * 返回匹配的关键词数量
     */
    private int calculateKeywordMatchScore(AIIntentConfig intent, String input, String factoryId) {
        List<String> keywords = getAllKeywordsForMatching(factoryId, intent);
        if (keywords.isEmpty()) {
            return 0;
        }

        int score = 0;
        for (String keyword : keywords) {
            if (input.contains(keyword.toLowerCase())) {
                score++;
            }
        }
        return score;
    }

    /**
     * 计算关键词匹配分数（向后兼容，无工厂ID）
     * 返回匹配的关键词数量
     */
    private int calculateKeywordMatchScore(AIIntentConfig intent, String input) {
        return calculateKeywordMatchScore(intent, input, null);
    }

    // ==================== 自动学习关键词 ====================

    /**
     * 尝试自动学习关键词
     *
     * 当 LLM 以高置信度识别意图时，从用户输入中提取新关键词并添加到意图配置。
     * 委托给 KeywordLearningService 统一处理。
     *
     * @param userInput 用户输入
     * @param matchedIntent 匹配的意图配置
     * @param factoryId 工厂ID（用于工厂级别学习，可选）
     */
    private void tryAutoLearnKeywords(String userInput, AIIntentConfig matchedIntent, String factoryId) {
        // 委托给 KeywordLearningService 统一处理
        int added = keywordLearningService.learnFromMatchedIntent(userInput, matchedIntent, factoryId);
        if (added > 0) {
            clearCache();
        }
    }

    // extractNewKeywords() 和 autoAddKeywords() 方法已迁移到 KeywordLearningServiceImpl
    // 由 keywordLearningService.learnFromMatchedIntent() 和 keywordLearningService.learnFromUserFeedback() 调用

    /**
     * 尝试自动学习表达
     *
     * 将完整的用户输入作为表达模式学习，用于后续精确匹配。
     *
     * @param userInput  用户输入
     * @param intentCode 意图代码
     * @param factoryId  工厂ID
     * @param confidence 置信度
     * @param sourceType 来源类型
     */
    private void tryAutoLearnExpression(String userInput, String intentCode,
                                         String factoryId, double confidence,
                                         LearnedExpression.SourceType sourceType) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return;
        }

        try {
            LearnedExpression learned = expressionLearningService.learnExpression(
                    factoryId, intentCode, userInput.trim(), confidence, sourceType);

            if (learned != null) {
                log.debug("学习新表达: factory={}, intent={}, expr={}",
                        factoryId, intentCode, truncate(userInput, 50));
            }
        } catch (Exception e) {
            log.warn("学习表达失败: {}", e.getMessage());
        }
    }

    /**
     * 截断字符串
     */
    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }

    // ==================== v11.0 语义路由器辅助方法 ====================

    /**
     * 将 RouteDecision 转换为 IntentMatchResult
     *
     * @param routeDecision 路由决策
     * @param originalInput 原始用户输入
     * @param processedInput 预处理后的输入
     * @param enhancedResult 增强预处理结果
     * @return IntentMatchResult
     */
    private IntentMatchResult convertRouteDecisionToResult(
            RouteDecision routeDecision,
            String originalInput,
            String processedInput,
            QueryPreprocessorService.EnhancedPreprocessResult enhancedResult) {

        AIIntentConfig bestIntent = routeDecision.getBestMatchIntent();
        if (bestIntent == null) {
            return IntentMatchResult.empty(originalInput);
        }

        // 检测操作类型
        ActionType actionType = knowledgeBase.detectActionType(processedInput.toLowerCase().trim());

        // 转换候选列表
        List<CandidateIntent> candidates = routeDecision.getCandidates().stream()
                .map(c -> CandidateIntent.builder()
                        .intentCode(c.getIntentCode())
                        .intentName(c.getIntentName())
                        .intentCategory(c.getIntentConfig() != null ? c.getIntentConfig().getIntentCategory() : null)
                        .confidence(c.getScore())
                        .matchScore((int)(c.getScore() * 100))
                        .matchedKeywords(Collections.emptyList())
                        .matchMethod(MatchMethod.SEMANTIC)
                        .description(c.getDescription())
                        .build())
                .collect(Collectors.toList());

        return IntentMatchResult.builder()
                .bestMatch(bestIntent)
                .topCandidates(candidates)
                .confidence(routeDecision.getTopScore())
                .matchMethod(MatchMethod.SEMANTIC)
                .matchedKeywords(Collections.emptyList())
                .isStrongSignal(routeDecision.getTopScore() >= 0.92)
                .requiresConfirmation(false)
                .userInput(originalInput)
                .actionType(actionType)
                .build();
    }

    /**
     * 执行语义路由器的 LLM Reranking
     *
     * 使用 RouteDecision 中的候选列表进行快速 LLM 确认
     *
     * @param routeDecision 路由决策
     * @param processedInput 预处理后的输入
     * @param originalInput 原始用户输入
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param userRole 用户角色
     * @param enhancedResult 增强预处理结果
     * @return IntentMatchResult 或 null（如果 Reranking 失败）
     */
    private IntentMatchResult performSemanticRouterReranking(
            RouteDecision routeDecision,
            String processedInput,
            String originalInput,
            String factoryId,
            Long userId,
            String userRole,
            QueryPreprocessorService.EnhancedPreprocessResult enhancedResult) {

        try {
            // 将 RouteDecision 候选转换为 CandidateIntent 列表
            List<CandidateIntent> candidates = routeDecision.getCandidates().stream()
                    .map(c -> CandidateIntent.builder()
                            .intentCode(c.getIntentCode())
                            .intentName(c.getIntentName())
                            .intentCategory(c.getIntentConfig() != null ? c.getIntentConfig().getIntentCategory() : null)
                            .confidence(c.getScore())
                            .matchScore((int)(c.getScore() * 100))
                            .matchedKeywords(Collections.emptyList())
                            .matchMethod(MatchMethod.SEMANTIC)
                            .description(c.getDescription())
                            .build())
                    .collect(Collectors.toList());

            if (candidates.isEmpty()) {
                return null;
            }

            // 检测操作类型
            ActionType actionType = knowledgeBase.detectActionType(processedInput.toLowerCase().trim());

            // 构建初始结果用于 Reranking
            IntentMatchResult initialResult = IntentMatchResult.builder()
                    .bestMatch(routeDecision.getBestMatchIntent())
                    .topCandidates(candidates)
                    .confidence(routeDecision.getTopScore())
                    .matchMethod(MatchMethod.SEMANTIC)
                    .matchedKeywords(Collections.emptyList())
                    .isStrongSignal(false)
                    .requiresConfirmation(true)
                    .userInput(originalInput)
                    .actionType(actionType)
                    .build();

            // 调用现有的 LLM Reranking 方法
            IntentMatchResult rerankingResult = tryLlmReranking(
                    processedInput, factoryId, candidates, initialResult, actionType, userId, userRole);

            return rerankingResult;

        } catch (Exception e) {
            log.warn("v11.0 performSemanticRouterReranking failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 应用否定语义转换
     *
     * 提取自 recognizeIntentWithConfidence 的否定语义处理逻辑
     *
     * @param result 原始匹配结果
     * @param enhancedResult 增强预处理结果
     * @param factoryId 工厂ID
     * @return 转换后的结果
     */
    private IntentMatchResult applyNegationConversion(
            IntentMatchResult result,
            QueryPreprocessorService.EnhancedPreprocessResult enhancedResult,
            String factoryId) {

        if (result == null || result.getBestMatch() == null || enhancedResult == null) {
            return result;
        }

        QueryPreprocessorService.NegationInfo negationInfo = enhancedResult.getNegationInfo();
        if (negationInfo == null || !negationInfo.hasNegation()) {
            return result;
        }

        String originalIntentCode = result.getBestMatch().getIntentCode();
        String convertedIntentCode = convertNegationIntent(originalIntentCode, true);

        if (!convertedIntentCode.equals(originalIntentCode)) {
            // 查找转换后的意图配置
            AIIntentConfig convertedConfig = getIntentConfigByCode(factoryId, convertedIntentCode);
            if (convertedConfig != null) {
                log.info("v11.0否定语义转换: {} -> {}, 否定词='{}'",
                        originalIntentCode, convertedIntentCode, negationInfo.getNegationWord());

                return result.toBuilder()
                        .bestMatch(convertedConfig)
                        .build();
            }
        }

        return result;
    }

    /**
     * 估算跳过 LLM 调用节省的时间 (毫秒)
     *
     * 基于统计数据估算：
     * - 平均 LLM Fallback 耗时: 800-1500ms
     * - 平均 LLM Reranking 耗时: 500-1000ms
     *
     * @return 估算节省的毫秒数
     */
    private long estimateLLMSavings() {
        // 基于配置的超时时间估算
        // 实际节省时间取决于 LLM 响应速度
        int timeout = matchingConfig.getLlmFallback().getTimeout();
        return timeout > 0 ? Math.min(timeout / 2, 1000L) : 800L;
    }

    // ==================== 反馈记录实现 (委托到 intentFeedbackService) ====================

    /**
     * 记录正向反馈 - 用户确认匹配正确
     */
    @Override
    @Transactional
    public void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords) {
        log.debug("Delegating recordPositiveFeedback(factoryId={}, intentCode={}, keywordCount={}) to intentFeedbackService",
                factoryId, intentCode, matchedKeywords != null ? matchedKeywords.size() : 0);
        intentFeedbackService.recordPositiveFeedback(factoryId, intentCode, matchedKeywords);
    }

    /**
     * 记录负向反馈 - 用户选择了其他意图
     */
    @Override
    @Transactional
    public void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                       String selectedIntentCode, List<String> matchedKeywords) {
        log.debug("Delegating recordNegativeFeedback(factoryId={}, rejectedIntent={}, selectedIntent={}) to intentFeedbackService",
                factoryId, rejectedIntentCode, selectedIntentCode);
        intentFeedbackService.recordNegativeFeedback(factoryId, rejectedIntentCode, selectedIntentCode, matchedKeywords);
    }

    // ==================== v4.0 并行评分架构 ====================

    /**
     * v4.0 并行多层评分
     *
     * 核心思想：并行执行所有匹配层，综合评分后决策
     *
     * 权重配置：
     * - 短语精确匹配: 1.0 (满分，100%准确)
     * - 语义向量匹配: 0.6 (主力层，高召回)
     * - 关键词匹配:   0.3 (辅助层，易冲突)
     * - 领域加分:     0.1 (微调)
     *
     * 置信度决策：
     * - ≥0.75: 直接返回
     * - 0.5-0.75: 需要LLM确认
     * - <0.5: LLM兜底
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @param allIntents 所有意图配置
     * @param opType 操作类型
     * @return 意图匹配结果
     */
    private IntentMatchResult parallelScoreMatch(String userInput, String factoryId,
                                                  List<AIIntentConfig> allIntents, ActionType opType) {
        String normalizedInput = userInput.toLowerCase().trim();

        // ========== Layer 1: 并行执行短语匹配 ==========
        Optional<String> phraseMatchedIntent = knowledgeBase.matchPhrase(userInput);

        // ========== Layer 2: 并行执行语义匹配 ==========
        List<UnifiedSemanticMatch> semanticResults = Collections.emptyList();
        try {
            semanticResults = embeddingCacheService.matchIntentsWithExpressions(factoryId, userInput, 0.50);
        } catch (Exception e) {
            log.warn("语义匹配异常: {}", e.getMessage());
        }

        // 构建语义分数映射
        Map<String, Double> semanticScoreMap = new HashMap<>();
        for (UnifiedSemanticMatch sr : semanticResults) {
            semanticScoreMap.put(sr.getIntentCode(), sr.getSimilarity());
        }

        // ========== Layer 3: 并行执行关键词匹配 ==========
        Map<String, KeywordMatchInfo> keywordScoreMap = new HashMap<>();
        for (AIIntentConfig intent : allIntents) {
            List<String> matchedKeywords = getMatchedKeywords(intent, normalizedInput, factoryId);
            if (!matchedKeywords.isEmpty()) {
                // v5.0优化: 关键词评分递减收益
                double keywordScore = 0.0;
                double[] diminishingWeights = matchingConfig.getParallelScore().getKeywordDiminishingWeights();
                double tailWeight = matchingConfig.getParallelScore().getKeywordTailWeight();
                for (int i = 0; i < matchedKeywords.size(); i++) {
                    double weight = (i < diminishingWeights.length) ? diminishingWeights[i] : tailWeight;
                    keywordScore += weight;
                }
                keywordScore = Math.min(1.0, keywordScore);
                keywordScoreMap.put(intent.getIntentCode(), new KeywordMatchInfo(keywordScore, matchedKeywords));
            }
        }

        // ========== 领域检测 ==========
        IntentKnowledgeBase.Domain inputDomain = knowledgeBase.detectDomain(userInput);

        // ========== 综合评分计算 ==========
        List<ParallelScoreEntry> scoredEntries = new ArrayList<>();

        for (AIIntentConfig intent : allIntents) {
            String intentCode = intent.getIntentCode();

            // 短语分数 (命中=1.0, 未命中=0.0)
            double phraseScore = phraseMatchedIntent.isPresent() &&
                    phraseMatchedIntent.get().equals(intentCode) ? 1.0 : 0.0;

            // 语义分数 (0.0-1.0)
            double semanticScore = semanticScoreMap.getOrDefault(intentCode, 0.0);

            // 关键词分数 (0.0-1.0)
            KeywordMatchInfo keywordInfo = keywordScoreMap.get(intentCode);
            double keywordScore = keywordInfo != null ? keywordInfo.score : 0.0;
            List<String> matchedKeywords = keywordInfo != null ? keywordInfo.keywords : Collections.emptyList();

            // v5.0优化: 根据领域关键词命中数量动态加分
            IntentKnowledgeBase.Domain intentDomain = knowledgeBase.getDomainFromIntentCode(intentCode);
            double domainBonus = 0.0;
            if (inputDomain != IntentKnowledgeBase.Domain.GENERAL && intentDomain == inputDomain) {
                int domainKeywordCount = knowledgeBase.countDomainKeywords(normalizedInput, inputDomain);
                // v7.2优化：命中1个词+0.13, 2个词+0.21, 3+个词+0.25 (上限0.25)
                // 增强领域关键词权重，从0.05提升到0.08
                domainBonus = Math.min(0.25, 0.05 + domainKeywordCount * 0.08);
            }

            // 操作类型加分 (匹配+0.15, 不匹配-0.10)
            // v7.2优化: 增加ActionType一致性验证权重，从(+10,-3)调整为(+15,-10)
            double opTypeBonus = knowledgeBase.calculateOperationTypeAdjustment(
                    intentCode, opType, 15, 10) / 100.0;

            // === 负向关键词扣分 ===
            double negativeKeywordPenalty = 0.0;
            List<String> negativeKws = intent.getNegativeKeywordsList();
            for (String negKw : negativeKws) {
                if (normalizedInput.contains(negKw.toLowerCase())) {
                    negativeKeywordPenalty += 0.15;  // 每个负向词扣0.15分
                }
            }

            // 加权综合评分
            // v5.0优化: 使用配置的权重
            IntentMatchingConfig.ParallelScoreConfig scoreConfig = matchingConfig.getParallelScore();
            double finalScore = phraseScore * scoreConfig.getPhraseWeight()
                    + semanticScore * scoreConfig.getSemanticWeight()
                    + keywordScore * scoreConfig.getKeywordWeight()
                    + domainBonus * 1.0
                    + opTypeBonus * 1.0;

            // 扣除负向关键词惩罚
            finalScore = Math.max(0.0, finalScore - negativeKeywordPenalty);

            // 负向关键词扣分日志
            if (negativeKeywordPenalty > 0) {
                log.debug("负向关键词扣分: intent={}, penalty={:.2f}, negativeKws={}",
                        intentCode, negativeKeywordPenalty, negativeKws);
            }

            // v4.1优化: 降低过滤阈值0.01→0.001，让低分意图也能进入候选，由LLM兜底
            if (finalScore > 0.001) {
                ParallelScoreEntry entry = new ParallelScoreEntry();
                entry.config = intent;
                entry.phraseScore = phraseScore;
                entry.semanticScore = semanticScore;
                entry.keywordScore = keywordScore;
                entry.domainBonus = domainBonus;
                entry.finalScore = finalScore;
                entry.matchedKeywords = matchedKeywords;

                // 确定主要匹配方法
                if (phraseScore > 0) {
                    entry.matchMethod = MatchMethod.EXACT;
                } else if (semanticScore > keywordScore) {
                    entry.matchMethod = MatchMethod.SEMANTIC;
                } else if (keywordScore > 0) {
                    entry.matchMethod = MatchMethod.KEYWORD;
                } else {
                    entry.matchMethod = MatchMethod.FUSION;
                }

                scoredEntries.add(entry);
            }
        }

        // 无匹配结果
        if (scoredEntries.isEmpty()) {
            log.debug("并行评分无匹配结果: input='{}'", userInput);
            return null;
        }

        // 按综合分数排序
        scoredEntries.sort((a, b) -> Double.compare(b.finalScore, a.finalScore));

        // 获取最佳匹配
        ParallelScoreEntry bestEntry = scoredEntries.get(0);
        double confidence = Math.min(1.0, bestEntry.finalScore);

        log.debug("并行评分结果: intent={}, finalScore={:.3f}, phrase={:.2f}, semantic={:.2f}, keyword={:.2f}, domain={:.2f}",
                bestEntry.config.getIntentCode(), bestEntry.finalScore,
                bestEntry.phraseScore, bestEntry.semanticScore, bestEntry.keywordScore, bestEntry.domainBonus);

        // 构建候选列表
        List<CandidateIntent> candidates = scoredEntries.stream()
                .limit(5)
                .map(entry -> CandidateIntent.builder()
                        .intentCode(entry.config.getIntentCode())
                        .intentName(entry.config.getIntentName())
                        .intentCategory(entry.config.getIntentCategory())
                        .confidence(Math.min(1.0, entry.finalScore))
                        .matchScore((int)(entry.finalScore * 100))
                        .matchedKeywords(entry.matchedKeywords)
                        .matchMethod(entry.matchMethod)
                        .description(entry.config.getDescription())
                        .build())
                .collect(Collectors.toList());

        // 判断信号强度
        boolean isStrongSignal = confidence >= 0.75 &&
                (candidates.size() < 2 || candidates.get(0).getConfidence() - candidates.get(1).getConfidence() > 0.15);

        // 判断是否需要确认
        boolean requiresConfirmation = confidence < 0.75 || !isStrongSignal;

        return IntentMatchResult.builder()
                .bestMatch(bestEntry.config)
                .topCandidates(candidates)
                .confidence(confidence)
                .matchMethod(bestEntry.matchMethod)
                .matchedKeywords(bestEntry.matchedKeywords)
                .isStrongSignal(isStrongSignal)
                .requiresConfirmation(requiresConfirmation)
                .userInput(userInput)
                .actionType(opType)
                .build();
    }

    /**
     * 并行评分条目
     */
    private static class ParallelScoreEntry {
        AIIntentConfig config;
        double phraseScore;
        double semanticScore;
        double keywordScore;
        double domainBonus;
        double finalScore;
        List<String> matchedKeywords;
        MatchMethod matchMethod;
    }

    /**
     * 关键词匹配信息
     */
    private static class KeywordMatchInfo {
        double score;
        List<String> keywords;

        KeywordMatchInfo(double score, List<String> keywords) {
            this.score = score;
            this.keywords = keywords;
        }
    }

    // ==================== v6.0 语义优先架构 ====================

    /**
     * 语义优先路由 - v6.0核心架构
     *
     * 将语义匹配从"并行评分因子"提升为"第一优先级路由"：
     * 1. 先通过向量相似度匹配 Top-5 候选意图
     * 2. 如果最佳置信度 >= 0.85，直接返回（高置信度）
     * 3. 否则返回候选列表，交由精确验证层处理
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @return 语义路由结果，包含候选列表
     */
    private SemanticRoutingResult semanticFirstRouting(String userInput, String factoryId) {
        try {
            // 调用统一语义搜索 (包含意图配置 + 已学习表达)
            List<UnifiedSemanticMatch> semanticResults =
                    embeddingCacheService.matchIntentsWithExpressions(factoryId, userInput, 0.50);

            if (semanticResults.isEmpty()) {
                log.debug("语义路由无结果: factory={}, input='{}'", factoryId, userInput);
                return SemanticRoutingResult.empty();
            }

            // 检测用户输入的领域和粒度
            IntentKnowledgeBase.Domain inputDomain = knowledgeBase.detectDomain(userInput);
            IntentKnowledgeBase.Granularity inputGranularity = knowledgeBase.detectGranularity(userInput);

            log.debug("语义路由: 检测到 domain={}, granularity={}", inputDomain, inputGranularity);

            // 构建候选列表
            List<SemanticCandidate> candidates = new ArrayList<>();
            for (UnifiedSemanticMatch match : semanticResults) {
                if (candidates.size() >= 5) break;  // Top-5

                String intentCode = match.getIntentCode();
                AIIntentConfig config = getIntentConfigByCode(factoryId, intentCode);
                if (config == null) continue;

                SemanticCandidate candidate = new SemanticCandidate();
                candidate.intentCode = intentCode;
                candidate.config = config;
                candidate.semanticScore = match.getSimilarity();
                candidate.adjustedScore = match.getSimilarity();  // 初始分数=语义分数
                candidate.matchSource = match.getSourceType() != null ? match.getSourceType().name() : "UNKNOWN";

                candidates.add(candidate);
            }

            if (candidates.isEmpty()) {
                return SemanticRoutingResult.empty();
            }

            // 最佳语义分数
            double bestSemanticScore = candidates.get(0).semanticScore;

            log.info("语义路由完成: 候选数={}, 最佳分数={:.3f}, 最佳意图={}",
                    candidates.size(), bestSemanticScore, candidates.get(0).intentCode);

            return SemanticRoutingResult.builder()
                    .candidates(candidates)
                    .bestSemanticScore(bestSemanticScore)
                    .inputDomain(inputDomain)
                    .inputGranularity(inputGranularity)
                    .build();

        } catch (Exception e) {
            log.warn("语义路由异常: {}", e.getMessage());
            return SemanticRoutingResult.empty();
        }
    }

    /**
     * 精确验证层 - v6.0架构
     *
     * 对语义路由的候选结果进行精确验证和分数调整：
     * 1. 短语匹配验证 - 语义结果是否有短语支持? (+0.15)
     * 2. 关键词交叉验证 - 是否命中意图特征词? (+0.10)
     * 3. 粒度检测 - LIST/DETAIL/STATS 是否一致? (不匹配 -0.20)
     * 4. 域隔离过滤 - 排除跨域干扰候选 (不匹配 -0.25)
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @param routingResult 语义路由结果
     * @param opType 操作类型
     * @return 验证后的候选列表（已调整分数并排序）
     */
    private List<SemanticCandidate> preciseVerification(
            String userInput,
            String factoryId,
            SemanticRoutingResult routingResult,
            ActionType opType) {

        if (routingResult.isEmpty()) {
            return Collections.emptyList();
        }

        String normalizedInput = userInput.toLowerCase().trim();
        Optional<String> phraseMatch = knowledgeBase.matchPhrase(userInput);
        IntentKnowledgeBase.Granularity inputGranularity = routingResult.getInputGranularity();
        IntentKnowledgeBase.Domain inputDomain = routingResult.getInputDomain();

        // ========== v11.12.2: ActionType 软过滤 ==========
        // 修正：硬过滤导致通过率下降，改为软过滤（评分调整）
        // - 写操作（CREATE/UPDATE/DELETE）时，对查询类意图降分但不过滤
        // - 查询操作时，不过滤
        // - 这保留了 ActionType 的指导作用，同时避免过滤掉正确候选
        List<SemanticCandidate> candidates = new ArrayList<>(routingResult.getCandidates());

        // v7.0优化: 如果短语匹配的意图不在语义候选中，注入该意图
        // 这确保短语匹配的意图有机会参与评分竞争
        // v11.12.2: 移除 ActionType 兼容性检查，短语匹配是强信号应始终注入
        if (phraseMatch.isPresent()) {
            String phraseMatchedIntent = phraseMatch.get();
            boolean alreadyInCandidates = candidates.stream()
                    .anyMatch(c -> c.intentCode.equals(phraseMatchedIntent));

            if (!alreadyInCandidates) {
                // 从意图配置中查找该意图
                List<AIIntentConfig> allIntents = getAllIntents(factoryId);
                AIIntentConfig phraseIntentConfig = allIntents.stream()
                        .filter(c -> c.getIntentCode().equals(phraseMatchedIntent))
                        .findFirst()
                        .orElse(null);

                if (phraseIntentConfig != null) {
                    SemanticCandidate injectedCandidate = new SemanticCandidate();
                    injectedCandidate.intentCode = phraseMatchedIntent;
                    // v7.0: 短语完全匹配给予高基础分数（0.80）
                    // 加上短语加分（0.15）后为0.95，确保短语匹配的意图能竞争胜出
                    injectedCandidate.semanticScore = 0.80;
                    injectedCandidate.config = phraseIntentConfig;
                    injectedCandidate.phraseConfirmed = true; // 标记为短语确认
                    candidates.add(injectedCandidate);
                    log.info("v7.0短语注入: 将 {} 注入候选列表 (基础分0.80 + 短语加分0.15 = 0.95)", phraseMatchedIntent);
                }
            }
        }

        for (SemanticCandidate candidate : candidates) {
            double adjustment = 0.0;

            // v7.0优化: 短语/关键词匹配互斥 - 取最高分避免过拟合
            // 原实现叠加可能导致过度加分 (+0.25)，改为互斥取最高
            double textMatchBonus = 0.0;

            // 1. 短语匹配验证 - 语义结果是否有短语支持? (+0.15)
            if (phraseMatch.isPresent() && phraseMatch.get().equals(candidate.intentCode)) {
                textMatchBonus = 0.15;
                candidate.phraseConfirmed = true;
                log.debug("短语验证通过: {} (+0.15)", candidate.intentCode);
            }

            // 2. 关键词交叉验证 - 是否命中意图特征词? (+0.10)
            // 仅在短语未匹配时使用关键词加分（互斥逻辑）
            List<String> matchedKeywords = getMatchedKeywords(candidate.config, normalizedInput, factoryId);
            if (!matchedKeywords.isEmpty()) {
                candidate.matchedKeywords = matchedKeywords;
                if (textMatchBonus < 0.10) {
                    // 短语未匹配，使用关键词加分
                    textMatchBonus = 0.10;
                    log.debug("关键词验证通过: {} (+0.10), keywords={}", candidate.intentCode, matchedKeywords);
                } else {
                    // 短语已匹配，关键词不额外加分，但记录日志
                    log.debug("关键词验证通过(短语优先，不叠加): {} keywords={}", candidate.intentCode, matchedKeywords);
                }
            }

            // 应用文本匹配加分（上限 0.15）
            adjustment += textMatchBonus;

            // 3. 粒度检测 - LIST/DETAIL/STATS 是否一致?
            IntentKnowledgeBase.Granularity intentGranularity =
                    knowledgeBase.getIntentGranularity(candidate.intentCode);
            if (!knowledgeBase.isGranularityCompatible(inputGranularity, intentGranularity)) {
                adjustment -= 0.20;
                log.debug("粒度不匹配: {} (-0.20), input={}, intent={}",
                        candidate.intentCode, inputGranularity, intentGranularity);
            }

            // 4. 域隔离过滤 - 排除跨域干扰候选
            // v7.0优化: 短语确认的候选不受域惩罚（短语匹配是强信号）
            IntentKnowledgeBase.Domain intentDomain =
                    knowledgeBase.getDomainFromIntentCode(candidate.intentCode);
            if (inputDomain != IntentKnowledgeBase.Domain.GENERAL &&
                intentDomain != IntentKnowledgeBase.Domain.GENERAL &&
                inputDomain != intentDomain) {
                if (candidate.phraseConfirmed) {
                    // 短语确认的候选跳过域惩罚
                    log.debug("域不匹配但短语已确认，跳过惩罚: {} (无惩罚), input={}, intent={}",
                            candidate.intentCode, inputDomain, intentDomain);
                } else {
                    adjustment -= 0.25;
                    log.debug("域不匹配: {} (-0.25), input={}, intent={}",
                            candidate.intentCode, inputDomain, intentDomain);
                }
            } else if (inputDomain == intentDomain && inputDomain != IntentKnowledgeBase.Domain.GENERAL) {
                // 域匹配加分
                adjustment += 0.05;
            }

            // 5. 操作类型匹配加分 (v7.2优化: 增加权重)
            double opTypeBonus = knowledgeBase.calculateOperationTypeAdjustment(
                    candidate.intentCode, opType, 15, 10) / 100.0;
            adjustment += opTypeBonus;

            // 6. v7.1: 时态语义检测 - 区分查询状态 vs 执行动作
            // "正在xxx" / "今天的xxx" / "最近的xxx" 通常是查询状态，不是执行动作
            double temporalAdjustment = calculateTemporalSemanticAdjustment(normalizedInput, candidate.intentCode);
            adjustment += temporalAdjustment;

            // 7. v7.4: 时态一致性评分 - 过去/将来/进行时态与意图类型匹配
            // "刚才启动的批次" → 查询意图, "即将到期的原料" → 查询意图
            String semanticAction = candidate.config != null ? candidate.config.getSemanticAction() : null;
            int tenseScore = calculateTenseConsistency(userInput, candidate.intentCode, semanticAction);
            if (tenseScore != 0) {
                double tenseAdjustment = tenseScore / 100.0;  // 转换为分数比例
                adjustment += tenseAdjustment;
                log.debug("v7.4时态一致性调整: {} -> {} ({})", candidate.intentCode, tenseScore, tenseAdjustment);
            }

            // 计算最终调整后分数
            candidate.adjustedScore = Math.max(0.0, Math.min(1.0,
                    candidate.semanticScore + adjustment));

            log.debug("精确验证: {} semantic={:.3f} adj={:+.3f} final={:.3f}",
                    candidate.intentCode, candidate.semanticScore, adjustment, candidate.adjustedScore);
        }

        // 按调整后分数重新排序
        candidates.sort((a, b) ->
                Double.compare(b.adjustedScore, a.adjustedScore));

        return candidates;
    }

    /**
     * 语义路由结果
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    private static class SemanticRoutingResult {
        private List<SemanticCandidate> candidates;
        private double bestSemanticScore;
        private IntentKnowledgeBase.Domain inputDomain;
        private IntentKnowledgeBase.Granularity inputGranularity;

        public boolean isEmpty() {
            return candidates == null || candidates.isEmpty();
        }

        public static SemanticRoutingResult empty() {
            return SemanticRoutingResult.builder()
                    .candidates(Collections.emptyList())
                    .bestSemanticScore(0.0)
                    .build();
        }
    }

    /**
     * 语义候选条目
     */
    private static class SemanticCandidate {
        String intentCode;
        AIIntentConfig config;
        double semanticScore;      // 原始语义分数
        double adjustedScore;      // 精确验证后调整分数
        String matchSource;        // 匹配来源 (CONFIG/EXPRESSION)
        boolean phraseConfirmed;   // 是否被短语匹配确认
        List<String> matchedKeywords = Collections.emptyList();
    }

    // ==================== 语义匹配方法 ====================

    /**
     * 尝试语义匹配
     *
     * 当关键词匹配无结果时调用，使用预计算的 embedding 进行语义匹配。
     * 根据匹配级别决定策略：
     * - HIGH (≥0.85): 直接使用语义结果
     * - MEDIUM (0.72-0.85): 返回结果但标记需要融合
     * - LOW (<0.72): 返回 null，交给 LLM fallback
     *
     * 优化7: 语义结果按领域重排序
     * - 检测输入所属领域
     * - 同领域的意图优先排序
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @param opType    操作类型
     * @return 语义匹配结果，如果无匹配则返回 null
     */
    private IntentMatchResult trySemanticMatch(String userInput, String factoryId, ActionType opType) {
        try {
            // 使用统一语义搜索 (包含意图配置 + 已学习表达)
            List<UnifiedSemanticMatch> semanticResults =
                    embeddingCacheService.matchIntentsWithExpressions(factoryId, userInput, 0.60);

            if (semanticResults.isEmpty()) {
                log.debug("统一语义匹配无结果: factory={}, input='{}'", factoryId, userInput);
                return null;
            }

            // 优化7: 检测输入领域并对语义结果进行领域重排序
            IntentKnowledgeBase.Domain inputDomain = knowledgeBase.detectDomain(userInput);
            if (inputDomain != IntentKnowledgeBase.Domain.GENERAL) {
                // 按领域匹配度重排序：同领域优先，然后按相似度
                semanticResults.sort((a, b) -> {
                    IntentKnowledgeBase.Domain domainA = knowledgeBase.getDomainFromIntentCode(a.getIntentCode());
                    IntentKnowledgeBase.Domain domainB = knowledgeBase.getDomainFromIntentCode(b.getIntentCode());

                    boolean aMatch = (domainA == inputDomain);
                    boolean bMatch = (domainB == inputDomain);

                    // 同领域意图排前面
                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;
                    // 同领域或都不匹配时，按相似度排序
                    return Double.compare(b.getSimilarity(), a.getSimilarity());
                });
                log.debug("语义结果按领域重排序: inputDomain={}, top={}", inputDomain,
                        semanticResults.isEmpty() ? "none" : semanticResults.get(0).getIntentCode());
            }

            // 获取最佳语义匹配
            UnifiedSemanticMatch bestMatch = semanticResults.get(0);
            double similarity = bestMatch.getSimilarity();
            String intentCode = bestMatch.getIntentCode();

            // 获取配置的阈值 (默认: HIGH=0.85, MEDIUM=0.72)
            SemanticCacheConfig config = semanticCacheConfigRepository.findByFactoryId(factoryId)
                    .orElseGet(SemanticCacheConfig::defaultConfig);
            double highThreshold = config.getSimilarityThresholdAsDouble();
            double mediumThreshold = config.getMediumThresholdAsDouble();

            IntentEmbeddingCacheService.MatchLevel level;
            if (similarity >= highThreshold) {
                level = IntentEmbeddingCacheService.MatchLevel.HIGH;
            } else if (similarity >= mediumThreshold) {
                level = IntentEmbeddingCacheService.MatchLevel.MEDIUM;
            } else if (similarity >= 0.60) {
                level = IntentEmbeddingCacheService.MatchLevel.LOW;
            } else {
                level = IntentEmbeddingCacheService.MatchLevel.NONE;
            }

            log.debug("统一语义匹配结果: intent={}, similarity={}, level={}, source={}",
                    intentCode, similarity, level, bestMatch.getSourceType());

            // 只有 HIGH 或 MEDIUM 级别才返回结果
            if (level == IntentEmbeddingCacheService.MatchLevel.HIGH ||
                level == IntentEmbeddingCacheService.MatchLevel.MEDIUM) {

                // 从数据库获取意图配置
                AIIntentConfig bestIntent = getIntentConfigByCode(factoryId, intentCode);
                if (bestIntent == null) {
                    log.warn("无法获取意图配置: factory={}, intentCode={}", factoryId, intentCode);
                    return null;
                }

                MatchMethod matchMethod = level == IntentEmbeddingCacheService.MatchLevel.HIGH
                        ? MatchMethod.SEMANTIC : MatchMethod.FUSION;

                // 构建候选列表
                List<CandidateIntent> candidates = new ArrayList<>();
                for (UnifiedSemanticMatch match : semanticResults) {
                    if (match.getSimilarity() < mediumThreshold) continue;
                    if (candidates.size() >= 5) break;

                    AIIntentConfig matchConfig = getIntentConfigByCode(factoryId, match.getIntentCode());
                    if (matchConfig == null) continue;

                    IntentEmbeddingCacheService.MatchLevel candidateLevel =
                            match.getSimilarity() >= highThreshold
                                    ? IntentEmbeddingCacheService.MatchLevel.HIGH
                                    : IntentEmbeddingCacheService.MatchLevel.MEDIUM;

                    candidates.add(CandidateIntent.builder()
                            .intentCode(match.getIntentCode())
                            .intentName(matchConfig.getIntentName())
                            .intentCategory(matchConfig.getIntentCategory())
                            .confidence(match.getSimilarity())
                            .matchScore((int)(match.getSimilarity() * 100))
                            .matchedKeywords(Collections.emptyList())
                            .matchMethod(candidateLevel == IntentEmbeddingCacheService.MatchLevel.HIGH
                                    ? MatchMethod.SEMANTIC : MatchMethod.FUSION)
                            .description(matchConfig.getDescription())
                            .build());
                }

                // 判断信号强度
                boolean isStrongSignal = level == IntentEmbeddingCacheService.MatchLevel.HIGH &&
                        (candidates.size() < 2 ||
                         candidates.get(0).getConfidence() - candidates.get(1).getConfidence() > 0.1);

                // 判断是否需要确认
                boolean requiresConfirmation = !isStrongSignal &&
                        bestIntent.getSensitivityLevel() != null &&
                        ("HIGH".equals(bestIntent.getSensitivityLevel()) ||
                         "CRITICAL".equals(bestIntent.getSensitivityLevel()));

                return IntentMatchResult.builder()
                        .bestMatch(bestIntent)
                        .topCandidates(candidates)
                        .confidence(similarity)
                        .matchMethod(matchMethod)
                        .matchedKeywords(Collections.emptyList())
                        .isStrongSignal(isStrongSignal)
                        .requiresConfirmation(requiresConfirmation)
                        .userInput(userInput)
                        .actionType(opType)  // Layer 4: 语义匹配也设置操作类型
                        .build();
            }

            // LOW 或 NONE 级别，返回 null 交给 LLM
            return null;

        } catch (Exception e) {
            log.warn("统一语义匹配异常: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 根据意图代码获取意图配置
     */
    private AIIntentConfig getIntentConfigByCode(String factoryId, String intentCode) {
        // 先查工厂特定的
        Optional<AIIntentConfig> config = intentRepository.findByFactoryIdAndIntentCode(factoryId, intentCode);
        if (config.isPresent()) {
            return config.get();
        }
        // 再查全局的
        return intentRepository.findByFactoryIdAndIntentCode(null, intentCode).orElse(null);
    }

    /**
     * 否定语义意图转换 v7.5
     * 当检测到否定语义时，将动作类意图转换为对应的查询类意图
     *
     * 转换规则：
     * - XXX_COMPLETE → XXX_LIST (如 PROCESSING_BATCH_COMPLETE → PROCESSING_BATCH_LIST)
     * - XXX_ACKNOWLEDGE → XXX_LIST (如 ALERT_ACKNOWLEDGE → ALERT_LIST)
     * - XXX_STOP/START/UPDATE → XXX_STATUS/LIST
     * - XXX_CREATE → XXX_QUERY
     *
     * @param intentCode 原始意图代码
     * @param hasNegation 是否检测到否定语义
     * @return 转换后的意图代码（如果需要转换），否则返回原始代码
     */
    private String convertNegationIntent(String intentCode, boolean hasNegation) {
        if (!hasNegation || intentCode == null) {
            return intentCode;
        }

        // 定义转换映射
        Map<String, String> negationConversions = Map.ofEntries(
                // 批次相关
                Map.entry("PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_LIST"),
                Map.entry("PROCESSING_BATCH_START", "PROCESSING_BATCH_LIST"),
                Map.entry("PROCESSING_BATCH_PAUSE", "PROCESSING_BATCH_LIST"),
                Map.entry("PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST"),
                // 告警相关
                Map.entry("ALERT_ACKNOWLEDGE", "ALERT_LIST"),
                Map.entry("ALERT_CREATE", "ALERT_LIST"),
                // 设备相关
                Map.entry("EQUIPMENT_STOP", "EQUIPMENT_STATUS"),
                Map.entry("EQUIPMENT_START", "EQUIPMENT_STATUS"),
                Map.entry("EQUIPMENT_CONTROL", "EQUIPMENT_STATUS"),
                Map.entry("EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_STATUS"),
                // 发货相关
                Map.entry("SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY"),
                Map.entry("SHIPMENT_CREATE", "SHIPMENT_QUERY"),
                Map.entry("SHIPMENT_UPDATE", "SHIPMENT_QUERY"),
                // 原料相关
                Map.entry("MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_QUERY"),
                Map.entry("MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_QUERY"),
                Map.entry("MATERIAL_EXPIRED_QUERY", "MATERIAL_BATCH_QUERY"),
                // 质检相关
                Map.entry("QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY"),
                Map.entry("QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY"),
                // 考勤相关
                Map.entry("CLOCK_IN", "ATTENDANCE_QUERY"),
                Map.entry("CLOCK_OUT", "ATTENDANCE_QUERY"),
                Map.entry("ATTENDANCE_RECORD", "ATTENDANCE_QUERY"),
                // 供应商相关
                Map.entry("SUPPLIER_EVALUATE", "SUPPLIER_QUERY"),
                // 地磅相关
                Map.entry("SCALE_ADD_DEVICE", "MATERIAL_BATCH_QUERY")
        );

        String converted = negationConversions.get(intentCode);
        if (converted != null) {
            log.info("v7.5否定语义转换: {} -> {}", intentCode, converted);
            return converted;
        }

        return intentCode;
    }

    /**
     * 应用融合评分
     *
     * 将语义相似度分数与关键词匹配分数融合：
     * fusionScore = semanticScore * 0.6 + keywordScore * 0.4 (归一化后)
     *
     * 只对已有关键词匹配结果的意图进行融合增强。
     *
     * @param scoredIntents   关键词匹配结果列表
     * @param semanticResults 语义匹配结果列表
     */
    private void applyFusionScoring(List<IntentScoreEntry> scoredIntents,
                                     List<IntentEmbeddingCacheService.SemanticMatchResult> semanticResults) {
        if (scoredIntents.isEmpty() || semanticResults.isEmpty()) {
            return;
        }

        // 构建语义分数映射
        Map<String, Double> semanticScoreMap = new HashMap<>();
        for (IntentEmbeddingCacheService.SemanticMatchResult sr : semanticResults) {
            semanticScoreMap.put(sr.getIntentCode(), sr.getSimilarity());
        }

        // 找出关键词匹配的最高分用于归一化
        int maxKeywordScore = scoredIntents.stream()
                .mapToInt(e -> e.matchScore)
                .max()
                .orElse(1);

        // 应用融合评分
        for (IntentScoreEntry entry : scoredIntents) {
            String intentCode = entry.config.getIntentCode();
            Double semanticScore = semanticScoreMap.get(intentCode);

            if (semanticScore != null && semanticScore >= matchingConfig.getSemanticMediumThreshold()) {
                // 归一化关键词分数到 0-1 范围
                double normalizedKeywordScore = (double) entry.matchScore / maxKeywordScore;

                // 融合评分: 语义60% + 关键词40%
                double fusionScore = semanticScore * matchingConfig.getFusionSemanticWeight() +
                                    normalizedKeywordScore * matchingConfig.getFusionKeywordWeight();

                // 转回整数分数 (放大到100分制)
                int newScore = (int)(fusionScore * 100);

                if (newScore > entry.matchScore) {
                    log.debug("融合评分提升: intent={}, keyword={}, semantic={:.2f}, fusion={}",
                            intentCode, entry.matchScore, semanticScore, newScore);
                    entry.matchScore = newScore;
                    entry.matchMethod = MatchMethod.FUSION;
                }
            }
        }
    }

    /**
     * 从意图列表中按代码查找意图配置
     *
     * @param intentCode 意图代码
     * @param allIntents 所有意图配置列表
     * @return 匹配的意图配置
     */
    private Optional<AIIntentConfig> findIntentByCode(String intentCode, List<AIIntentConfig> allIntents) {
        if (intentCode == null || allIntents == null) {
            return Optional.empty();
        }
        return allIntents.stream()
                .filter(intent -> intentCode.equals(intent.getIntentCode()))
                .findFirst();
    }

    // ==================== 意图反馈学习 ====================

    /**
     * 处理意图识别反馈
     * 用户可以纠正错误的意图识别结果，系统自动学习
     *
     * @param factoryId 工厂ID
     * @param userId    用户ID
     * @param request   反馈请求
     */
    @Override
    @Transactional
    public void processIntentFeedback(String factoryId, Long userId, IntentFeedbackRequest request) {
        log.debug("Delegating processIntentFeedback(factoryId={}, userId={}, matchedIntent={}) to intentFeedbackService",
                factoryId, userId, request.getMatchedIntentCode());
        intentFeedbackService.processIntentFeedback(factoryId, userId, request);
    }
}
