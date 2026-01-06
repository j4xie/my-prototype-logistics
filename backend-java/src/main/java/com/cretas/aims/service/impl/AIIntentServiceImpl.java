package com.cretas.aims.service.impl;

import com.cretas.aims.config.IntentKnowledgeBase;
import com.cretas.aims.config.IntentKnowledgeBase.ActionType;
import com.cretas.aims.config.IntentMatchingConfig;
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
import com.cretas.aims.service.ExpressionLearningService;
import com.cretas.aims.service.FactoryConfigService;
import com.cretas.aims.service.IntentEmbeddingCacheService;
import com.cretas.aims.service.KeywordEffectivenessService;
import com.cretas.aims.service.KeywordLearningService;
import com.cretas.aims.service.KeywordPromotionService;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    /**
     * 意图匹配统一配置
     */
    private final IntentMatchingConfig matchingConfig;

    /**
     * 意图识别知识库
     */
    private final IntentKnowledgeBase knowledgeBase;

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
        return recognizeIntentWithConfidence(userInput, null, topN);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId, int topN) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return IntentMatchResult.empty(userInput);
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
                            .requiresConfirmation(false)
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

        // 收集所有匹配结果及其分数
        List<IntentScoreEntry> scoredIntents = new ArrayList<>();

        // === BUG-001/002 修复：检测操作类型（查询 or 更新）===
        ActionType opType = knowledgeBase.detectActionType(normalizedInput);
        log.debug("检测到操作类型: {} for input: {}", opType, normalizedInput);

        for (AIIntentConfig intent : allIntents) {
            IntentScoreEntry entry = new IntentScoreEntry();
            entry.config = intent;

            // 优先检查正则匹配
            if (matchesByRegex(intent, normalizedInput)) {
                entry.matchMethod = MatchMethod.REGEX;
                entry.matchScore = matchingConfig.getRegexMatchScore(); // 使用配置的正则匹配分数
                entry.matchedKeywords = Collections.emptyList();
                scoredIntents.add(entry);
                continue;
            }

            // 关键词匹配 - 使用合并后的关键词（基础 + 工厂级 + 全局）
            List<String> matchedKeywords = getMatchedKeywords(intent, normalizedInput, factoryId);
            if (!matchedKeywords.isEmpty()) {
                entry.matchMethod = MatchMethod.KEYWORD;
                // === BUG-001/002 修复：应用操作类型权重调整 ===
                int baseScore = matchedKeywords.size() * matchingConfig.getKeywordMatchScore() + intent.getPriority();
                int opTypeAdjustment = knowledgeBase.calculateOperationTypeAdjustment(
                        intent.getIntentCode(), opType,
                        matchingConfig.getOperationTypeMatchBonus(),
                        matchingConfig.getOperationTypeMismatchPenalty());
                entry.matchScore = baseScore + opTypeAdjustment;

                if (opTypeAdjustment != 0) {
                    log.debug("操作类型调整: intent={}, opType={}, baseScore={}, adjustment={}, finalScore={}",
                            intent.getIntentCode(), opType, baseScore, opTypeAdjustment, entry.matchScore);
                }

                entry.matchedKeywords = matchedKeywords;
                scoredIntents.add(entry);
            }
        }

        // ========== 语义匹配层 (5层流程的第4层) ==========
        if (matchingConfig.isSemanticMatchEnabled() && scoredIntents.isEmpty()) {
            log.debug("关键词无匹配，尝试语义匹配: input='{}'", normalizedInput);
            IntentMatchResult semanticResult = trySemanticMatch(userInput, factoryId, opType);
            if (semanticResult != null && semanticResult.hasMatch()) {
                log.info("语义匹配成功: intent={}, confidence={}, method={}",
                        semanticResult.getBestMatch().getIntentCode(),
                        semanticResult.getConfidence(),
                        semanticResult.getMatchMethod());
                saveIntentMatchRecord(semanticResult, factoryId, null, null, false);
                return semanticResult;
            }
        } else if (matchingConfig.isSemanticMatchEnabled() && !scoredIntents.isEmpty()) {
            // 有关键词匹配结果时，尝试融合语义评分来提升置信度
            List<IntentEmbeddingCacheService.SemanticMatchResult> semanticResults =
                    embeddingCacheService.matchIntents(factoryId, userInput);

            if (!semanticResults.isEmpty()) {
                applyFusionScoring(scoredIntents, semanticResults);
            }
        }

        if (scoredIntents.isEmpty()) {
            log.debug("No intent matched by rules or semantics for input: {}", userInput);
            // Layer 5 (编辑距离匹配) 已移除，直接进入 LLM Fallback
            // 理由: 语义匹配 (Layer 4) 已合并意图配置+学习表达，编辑距离效果有限
            return tryLlmFallback(userInput, factoryId, allIntents, null, opType);
        }

        // 按分数排序
        scoredIntents.sort((a, b) -> {
            int scoreCompare = b.matchScore - a.matchScore;
            if (scoreCompare != 0) return scoreCompare;
            return b.config.getPriority().compareTo(a.config.getPriority());
        });

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

        // 如果置信度过低，尝试 LLM Fallback 提升
        if (bestConfidence < matchingConfig.getLlmFallbackConfidenceThreshold()) {
            log.debug("Low confidence ({}) for intent {}, trying LLM fallback",
                    bestConfidence, bestEntry.config.getIntentCode());
            return tryLlmFallback(userInput, factoryId, allIntents, result, opType);
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
     * @return LLM 匹配结果，或原始规则结果
     */
    private IntentMatchResult tryLlmFallback(String userInput, String factoryId,
                                              List<AIIntentConfig> allIntents,
                                              IntentMatchResult ruleResult,
                                              ActionType actionType) {
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
            // 调用 LLM 进行意图分类
            IntentMatchResult llmResult = llmFallbackClient.classifyIntent(
                    userInput, allIntents, factoryId);

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

            // 如果 LLM 也没匹配，返回规则结果或空
            log.debug("LLM fallback did not find a match");
            IntentMatchResult fallbackResult = ruleResult != null ? ruleResult :
                    IntentMatchResult.empty(userInput, actionType);
            // 如果 ruleResult 存在但没有 actionType，补充设置
            if (ruleResult != null && ruleResult.getActionType() == null) {
                fallbackResult = fallbackResult.toBuilder().actionType(actionType).build();
            }
            saveIntentMatchRecord(fallbackResult, factoryId, null, null, true);
            return fallbackResult;

        } catch (Exception e) {
            log.error("LLM fallback failed: {}", e.getMessage(), e);
            IntentMatchResult fallbackResult = ruleResult != null ? ruleResult :
                    IntentMatchResult.empty(userInput, actionType);
            // 如果 ruleResult 存在但没有 actionType，补充设置
            if (ruleResult != null && ruleResult.getActionType() == null) {
                fallbackResult = fallbackResult.toBuilder().actionType(actionType).build();
            }
            saveIntentMatchRecord(fallbackResult, factoryId, null, null, true);
            return fallbackResult;
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
                    .isStrongSignal(result.getIsStrongSignal())
                    .requiresConfirmation(result.getRequiresConfirmation())
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

        // 2. 工厂级关键词 (from keyword_effectiveness table, effectiveness >= 0.5)
        if (factoryId != null && !factoryId.isEmpty()) {
            try {
                var factoryKeywords = keywordEffectivenessService.getEffectiveKeywords(
                        factoryId, intentCode, new BigDecimal("0.5"));
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
        try {
            var globalKeywords = keywordEffectivenessService.getEffectiveKeywords(
                    "GLOBAL", intentCode, new BigDecimal("0.5"));
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
     */
    private List<String> getMatchedKeywords(AIIntentConfig intent, String input, String factoryId) {
        List<String> keywords = getAllKeywordsForMatching(factoryId, intent);
        if (keywords.isEmpty()) {
            return Collections.emptyList();
        }

        return keywords.stream()
                .filter(keyword -> input.contains(keyword.toLowerCase()))
                .collect(Collectors.toList());
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
        return intentRepository.findByIntentCodeAndIsActiveTrueAndDeletedAtIsNull(intentCode);
    }

    @Override
    public Optional<AIIntentConfig> getIntentByCode(String factoryId, String intentCode) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getIntentByCode called without factoryId, returning empty");
            return Optional.empty();
        }
        if (intentCode == null || intentCode.isBlank()) {
            return Optional.empty();
        }

        // 使用租户隔离：从工厂级+平台级意图中查找
        return getAllIntents(factoryId).stream()
                .filter(intent -> intentCode.equals(intent.getIntentCode()))
                .findFirst();
    }

    // ==================== 权限校验 ====================

    @Override
    public boolean hasPermission(String factoryId, String intentCode, String userRole) {
        Optional<AIIntentConfig> intentOpt = getIntentByCode(factoryId, intentCode);
        if (intentOpt.isEmpty()) {
            return false;
        }

        AIIntentConfig intent = intentOpt.get();
        String requiredRolesJson = intent.getRequiredRoles();

        // 如果没有配置角色限制，则所有角色都可以访问
        if (requiredRolesJson == null || requiredRolesJson.isEmpty()) {
            return true;
        }

        try {
            List<String> requiredRoles = objectMapper.readValue(requiredRolesJson,
                    new TypeReference<List<String>>() {});
            return requiredRoles.isEmpty() || requiredRoles.contains(userRole);
        } catch (Exception e) {
            log.warn("Failed to parse required roles for intent {}: {}", intentCode, e.getMessage());
            return false;
        }
    }

    @Override
    @Deprecated
    public boolean hasPermission(String intentCode, String userRole) {
        Optional<AIIntentConfig> intentOpt = getIntentByCode(intentCode);
        if (intentOpt.isEmpty()) {
            return false;
        }

        AIIntentConfig intent = intentOpt.get();
        String requiredRolesJson = intent.getRequiredRoles();

        // 如果没有配置角色限制，则所有角色都可以访问
        if (requiredRolesJson == null || requiredRolesJson.isEmpty()) {
            return true;
        }

        try {
            List<String> requiredRoles = objectMapper.readValue(requiredRolesJson,
                    new TypeReference<List<String>>() {});
            return requiredRoles.isEmpty() || requiredRoles.contains(userRole);
        } catch (Exception e) {
            log.warn("Failed to parse required roles for intent {}: {}", intentCode, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean requiresApproval(String factoryId, String intentCode) {
        return getIntentByCode(factoryId, intentCode)
                .map(AIIntentConfig::needsApproval)
                .orElse(false);
    }

    @Override
    @Deprecated
    public boolean requiresApproval(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::needsApproval)
                .orElse(false);
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
    @Cacheable(value = "allIntents", key = "#factoryId")
    public List<AIIntentConfig> getAllIntents(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getAllIntents called without factoryId, returning empty list");
            return List.of();
        }
        return intentRepository.findByFactoryIdOrPlatformLevel(factoryId);
    }

    @Override
    @Cacheable(value = "intentsByCategory", key = "#factoryId + ':' + #category")
    public List<AIIntentConfig> getIntentsByCategory(String factoryId, String category) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getIntentsByCategory called without factoryId");
            return List.of();
        }
        // 查询工厂级和平台级意图，按分类过滤
        return intentRepository.findByFactoryIdOrPlatformLevel(factoryId).stream()
                .filter(c -> category.equals(c.getIntentCategory()))
                .toList();
    }

    @Override
    @Cacheable(value = "intentsBySensitivity", key = "#factoryId + ':' + #sensitivityLevel")
    public List<AIIntentConfig> getIntentsBySensitivity(String factoryId, String sensitivityLevel) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getIntentsBySensitivity called without factoryId");
            return List.of();
        }
        return intentRepository.findByFactoryIdOrPlatformLevel(factoryId).stream()
                .filter(c -> sensitivityLevel.equals(c.getSensitivityLevel()))
                .toList();
    }

    @Override
    @Cacheable(value = "intentCategories", key = "#factoryId")
    public List<String> getAllCategories(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("getAllCategories called without factoryId");
            return List.of();
        }
        return intentRepository.findByFactoryIdOrPlatformLevel(factoryId).stream()
                .map(AIIntentConfig::getIntentCategory)
                .distinct()
                .sorted()
                .toList();
    }

    // ==================== 意图查询 (无租户隔离, 向后兼容) ====================

    @Override
    @Deprecated
    @Cacheable(value = "allIntents_legacy")
    public List<AIIntentConfig> getAllIntents() {
        log.warn("Deprecated getAllIntents() called without factoryId - consider using getAllIntents(factoryId)");
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
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public AIIntentConfig createIntent(AIIntentConfig intentConfig) {
        if (intentRepository.existsByIntentCodeAndDeletedAtIsNull(intentConfig.getIntentCode())) {
            throw new IllegalArgumentException("意图代码已存在: " + intentConfig.getIntentCode());
        }

        return intentRepository.save(intentConfig);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public AIIntentConfig updateIntent(AIIntentConfig intentConfig) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentConfig.getIntentCode())
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentConfig.getIntentCode()));

        // ★ 重要：在修改 existing 之前先创建快照！
        // 因为 Hibernate 一级缓存的原因，修改后再调用 findById 会返回同一个已修改的对象
        String previousSnapshot = rollbackService.createSnapshotForUpdate(existing);

        // 只更新非null字段，支持部分更新
        if (intentConfig.getIntentName() != null) {
            existing.setIntentName(intentConfig.getIntentName());
        }
        if (intentConfig.getIntentCategory() != null) {
            existing.setIntentCategory(intentConfig.getIntentCategory());
        }
        if (intentConfig.getSensitivityLevel() != null) {
            existing.setSensitivityLevel(intentConfig.getSensitivityLevel());
        }
        if (intentConfig.getRequiredRoles() != null) {
            existing.setRequiredRoles(intentConfig.getRequiredRoles());
        }
        if (intentConfig.getQuotaCost() != null) {
            existing.setQuotaCost(intentConfig.getQuotaCost());
        }
        if (intentConfig.getCacheTtlMinutes() != null) {
            existing.setCacheTtlMinutes(intentConfig.getCacheTtlMinutes());
        }
        if (intentConfig.getRequiresApproval() != null) {
            existing.setRequiresApproval(intentConfig.getRequiresApproval());
        }
        if (intentConfig.getApprovalChainId() != null) {
            existing.setApprovalChainId(intentConfig.getApprovalChainId());
        }
        if (intentConfig.getKeywords() != null) {
            existing.setKeywords(intentConfig.getKeywords());
        }
        if (intentConfig.getRegexPattern() != null) {
            existing.setRegexPattern(intentConfig.getRegexPattern());
        }
        if (intentConfig.getDescription() != null) {
            existing.setDescription(intentConfig.getDescription());
        }
        if (intentConfig.getHandlerClass() != null) {
            existing.setHandlerClass(intentConfig.getHandlerClass());
        }
        if (intentConfig.getMaxTokens() != null) {
            existing.setMaxTokens(intentConfig.getMaxTokens());
        }
        if (intentConfig.getResponseTemplate() != null) {
            existing.setResponseTemplate(intentConfig.getResponseTemplate());
        }
        if (intentConfig.getPriority() != null) {
            existing.setPriority(intentConfig.getPriority());
        }
        if (intentConfig.getMetadata() != null) {
            existing.setMetadata(intentConfig.getMetadata());
        }

        // 使用预先创建的快照保存，支持一键回滚
        return rollbackService.saveWithPreCreatedSnapshot(existing, previousSnapshot, null, "系统", "意图配置更新");
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    public void deleteIntent(String intentCode) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentCode)
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentCode));

        existing.setDeletedAt(LocalDateTime.now());
        intentRepository.save(existing);
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

    // ==================== 反馈记录实现 ====================

    /**
     * 记录正向反馈 - 用户确认匹配正确
     */
    @Override
    @Transactional
    public void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords) {
        if (factoryId == null || intentCode == null || matchedKeywords == null || matchedKeywords.isEmpty()) {
            log.debug("跳过记录正向反馈: 参数不完整");
            return;
        }

        try {
            for (String keyword : matchedKeywords) {
                // 记录效果追踪
                keywordEffectivenessService.recordFeedback(factoryId, intentCode, keyword, true);

                // 更新工厂采用记录
                keywordEffectivenessService.getKeywordEffectiveness(factoryId, intentCode, keyword)
                    .ifPresent(effectiveness -> {
                        BigDecimal score = effectiveness.getEffectivenessScore();
                        if (score != null) {
                            keywordPromotionService.recordAdoption(factoryId, intentCode, keyword, score);
                        }
                    });
            }

            log.info("记录正向反馈: factory={}, intent={}, keywords={}",
                factoryId, intentCode, matchedKeywords.size());

        } catch (Exception e) {
            log.warn("记录正向反馈失败: {}", e.getMessage());
        }
    }

    /**
     * 记录负向反馈 - 用户选择了其他意图
     */
    @Override
    @Transactional
    public void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                       String selectedIntentCode, List<String> matchedKeywords) {
        if (factoryId == null || rejectedIntentCode == null || matchedKeywords == null || matchedKeywords.isEmpty()) {
            log.debug("跳过记录负向反馈: 参数不完整");
            return;
        }

        try {
            // 对被拒绝的意图关键词记录负反馈
            for (String keyword : matchedKeywords) {
                keywordEffectivenessService.recordFeedback(factoryId, rejectedIntentCode, keyword, false);
            }

            log.info("记录负向反馈: factory={}, rejected={}, selected={}, keywords={}",
                factoryId, rejectedIntentCode, selectedIntentCode, matchedKeywords.size());

            // 如果用户选择了正确意图，尝试学习关键词到正确意图
            if (selectedIntentCode != null && !selectedIntentCode.equals(rejectedIntentCode)) {
                tryLearnKeywordsForSelectedIntent(factoryId, selectedIntentCode, matchedKeywords);
            }

        } catch (Exception e) {
            log.warn("记录负向反馈失败: {}", e.getMessage());
        }
    }

    /**
     * 尝试将关键词学习到用户选择的正确意图
     * 委托给 KeywordLearningService 统一处理
     */
    private void tryLearnKeywordsForSelectedIntent(String factoryId, String selectedIntentCode, List<String> keywords) {
        // 委托给 KeywordLearningService 统一处理
        int added = keywordLearningService.learnFromUserFeedback(factoryId, selectedIntentCode, keywords);
        if (added > 0) {
            clearCache();
        }
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
}
