package com.cretas.aims.service.impl;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentMatchResult.CandidateIntent;
import com.cretas.aims.dto.intent.IntentMatchResult.MatchMethod;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.intent.IntentMatchRecord;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.FactoryConfigService;
import com.cretas.aims.service.KeywordEffectivenessService;
import com.cretas.aims.service.KeywordPromotionService;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    /**
     * 是否启用 LLM Fallback (默认开启)
     */
    @Value("${cretas.ai.intent.llm-fallback.enabled:true}")
    private boolean llmFallbackEnabled;

    /**
     * LLM Fallback 触发的置信度阈值 (低于此值触发 LLM)
     */
    @Value("${cretas.ai.intent.llm-fallback.confidence-threshold:0.3}")
    private double llmFallbackConfidenceThreshold;

    /**
     * 是否使用 LLM 生成澄清问题 (默认开启)
     */
    @Value("${cretas.ai.intent.llm-clarification.enabled:true}")
    private boolean llmClarificationEnabled;

    /**
     * 是否启用意图匹配记录（默认开启）
     */
    @Value("${cretas.ai.intent.recording.enabled:true}")
    private boolean recordingEnabled;

    /**
     * 是否启用自动关键词学习（默认开启）
     */
    @Value("${cretas.ai.intent.auto-learn.enabled:true}")
    private boolean autoLearnEnabled;

    /**
     * 自动学习的置信度阈值（高于此值时自动学习关键词）
     */
    @Value("${cretas.ai.intent.auto-learn.confidence-threshold:0.9}")
    private double autoLearnConfidenceThreshold;

    /**
     * 每个意图最大关键词数量
     */
    @Value("${cretas.ai.intent.auto-learn.max-keywords-per-intent:50}")
    private int maxKeywordsPerIntent;

    /**
     * 停用词列表（用于过滤无意义的词）
     */
    private static final Set<String> STOP_WORDS = Set.of(
            "的", "是", "了", "把", "我", "要", "你", "他", "她", "它",
            "这", "那", "有", "没", "不", "在", "和", "与", "或", "但",
            "给", "让", "被", "对", "从", "到", "为", "以", "等", "也",
            "就", "都", "还", "很", "太", "好", "请", "帮", "帮我", "一下",
            "看看", "查", "查一下", "查看", "能", "可以", "吗", "呢", "啊", "吧"
    );

    // ==================== 交叉关键词权重机制 ====================

    /**
     * 查询指示词 - 表示用户想要查询/查看数据
     */
    private static final Set<String> QUERY_INDICATORS = Set.of(
            "查询", "查看", "多少", "还剩", "有几", "列表", "统计", "查",
            "显示", "获取", "看看", "有多少", "剩多少", "剩余", "库存",
            "情况", "状态", "有什么", "有哪些", "是多少", "数量"
    );

    /**
     * 更新指示词 - 表示用户想要修改/更新数据
     */
    private static final Set<String> UPDATE_INDICATORS = Set.of(
            "修改", "更新", "改成", "改为", "设置", "调整", "编辑", "变更", "改",
            "把", "设成", "设为", "更改", "修订", "调为", "换成"
    );

    /**
     * 操作类型枚举
     */
    private enum OperationType {
        QUERY,      // 明确的查询操作
        UPDATE,     // 明确的更新操作
        AMBIGUOUS,  // 查询和更新指示词都存在
        UNKNOWN     // 无法判断
    }

    /**
     * 检测用户输入的操作类型
     *
     * @param input 用户输入（已转小写）
     * @return 操作类型
     */
    private OperationType detectOperationType(String input) {
        if (input == null || input.isEmpty()) {
            return OperationType.UNKNOWN;
        }

        boolean hasQuery = QUERY_INDICATORS.stream().anyMatch(input::contains);
        boolean hasUpdate = UPDATE_INDICATORS.stream().anyMatch(input::contains);

        if (hasQuery && !hasUpdate) {
            return OperationType.QUERY;
        }
        if (hasUpdate && !hasQuery) {
            return OperationType.UPDATE;
        }
        if (hasQuery && hasUpdate) {
            return OperationType.AMBIGUOUS;
        }
        return OperationType.UNKNOWN;
    }

    /**
     * 判断意图是否为查询类意图
     */
    private boolean isQueryIntent(String intentCode) {
        if (intentCode == null) return false;
        return intentCode.contains("QUERY") ||
               intentCode.contains("LIST") ||
               intentCode.contains("STATS") ||
               intentCode.contains("GET") ||
               intentCode.contains("SEARCH") ||
               intentCode.contains("VIEW") ||
               intentCode.contains("STATUS") ||
               intentCode.contains("OVERVIEW");
    }

    /**
     * 判断意图是否为更新类意图
     */
    private boolean isUpdateIntent(String intentCode) {
        if (intentCode == null) return false;
        return intentCode.contains("UPDATE") ||
               intentCode.contains("CREATE") ||
               intentCode.contains("DELETE") ||
               intentCode.contains("MODIFY") ||
               intentCode.contains("SET") ||
               intentCode.contains("CHANGE") ||
               intentCode.contains("EDIT");
    }

    /**
     * 计算操作类型权重调整
     *
     * @param intentCode 意图代码
     * @param opType 检测到的操作类型
     * @return 权重调整值（正数加分，负数减分）
     */
    private int calculateOperationTypeAdjustment(String intentCode, OperationType opType) {
        if (opType == OperationType.UNKNOWN || opType == OperationType.AMBIGUOUS) {
            return 0;  // 无法判断时不调整
        }

        boolean isQuery = isQueryIntent(intentCode);
        boolean isUpdate = isUpdateIntent(intentCode);

        // 查询输入 + 查询意图 = 加分
        if (opType == OperationType.QUERY && isQuery) {
            return 25;  // 大幅加分
        }
        // 更新输入 + 更新意图 = 加分
        if (opType == OperationType.UPDATE && isUpdate) {
            return 25;  // 大幅加分
        }
        // 查询输入 + 更新意图 = 减分
        if (opType == OperationType.QUERY && isUpdate) {
            return -20;  // 减分以降低优先级
        }
        // 更新输入 + 查询意图 = 减分
        if (opType == OperationType.UPDATE && isQuery) {
            return -20;  // 减分以降低优先级
        }

        return 0;
    }

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
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, int topN) {
        return recognizeIntentWithConfidence(userInput, null, topN);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId, int topN) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return IntentMatchResult.empty(userInput);
        }

        List<AIIntentConfig> allIntents = getAllIntents();
        String normalizedInput = userInput.toLowerCase().trim();

        // 收集所有匹配结果及其分数
        List<IntentScoreEntry> scoredIntents = new ArrayList<>();

        // === BUG-001/002 修复：检测操作类型（查询 or 更新）===
        OperationType opType = detectOperationType(normalizedInput);
        log.debug("检测到操作类型: {} for input: {}", opType, normalizedInput);

        for (AIIntentConfig intent : allIntents) {
            IntentScoreEntry entry = new IntentScoreEntry();
            entry.config = intent;

            // 优先检查正则匹配
            if (matchesByRegex(intent, normalizedInput)) {
                entry.matchMethod = MatchMethod.REGEX;
                entry.matchScore = 100; // 正则匹配给最高分
                entry.matchedKeywords = Collections.emptyList();
                scoredIntents.add(entry);
                continue;
            }

            // 关键词匹配 - 使用合并后的关键词（基础 + 工厂级 + 全局）
            List<String> matchedKeywords = getMatchedKeywords(intent, normalizedInput, factoryId);
            if (!matchedKeywords.isEmpty()) {
                entry.matchMethod = MatchMethod.KEYWORD;
                // === BUG-001/002 修复：应用操作类型权重调整 ===
                int baseScore = matchedKeywords.size() * 10 + intent.getPriority();
                int opTypeAdjustment = calculateOperationTypeAdjustment(intent.getIntentCode(), opType);
                entry.matchScore = baseScore + opTypeAdjustment;

                if (opTypeAdjustment != 0) {
                    log.debug("操作类型调整: intent={}, opType={}, baseScore={}, adjustment={}, finalScore={}",
                            intent.getIntentCode(), opType, baseScore, opTypeAdjustment, entry.matchScore);
                }

                entry.matchedKeywords = matchedKeywords;
                scoredIntents.add(entry);
            }
        }

        if (scoredIntents.isEmpty()) {
            log.debug("No intent matched by rules for input: {}", userInput);
            // 尝试 LLM Fallback
            return tryLlmFallback(userInput, factoryId, allIntents, null);
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
                .build();

        // 如果置信度过低，尝试 LLM Fallback 提升
        if (bestConfidence < llmFallbackConfidenceThreshold) {
            log.debug("Low confidence ({}) for intent {}, trying LLM fallback",
                    bestConfidence, bestEntry.config.getIntentCode());
            return tryLlmFallback(userInput, factoryId, allIntents, result);
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
     * @return LLM 匹配结果，或原始规则结果
     */
    private IntentMatchResult tryLlmFallback(String userInput, String factoryId,
                                              List<AIIntentConfig> allIntents,
                                              IntentMatchResult ruleResult) {
        log.info(">>> Entering tryLlmFallback: userInput='{}', llmFallbackEnabled={}",
                userInput, llmFallbackEnabled);

        // 检查是否启用 LLM Fallback
        if (!llmFallbackEnabled) {
            log.debug("LLM fallback is disabled");
            IntentMatchResult fallbackResult = ruleResult != null ? ruleResult : IntentMatchResult.empty(userInput);
            saveIntentMatchRecord(fallbackResult, factoryId, null, null, false);
            return fallbackResult;
        }

        // 检查 LLM 服务健康状态
        boolean isHealthy = llmFallbackClient.isHealthy();
        log.info(">>> LLM service health check: isHealthy={}", isHealthy);
        if (!isHealthy) {
            log.warn("LLM service is not healthy, skipping fallback");
            IntentMatchResult fallbackResult = ruleResult != null ? ruleResult : IntentMatchResult.empty(userInput);
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

                // 自动学习：高置信度时提取并学习新关键词
                if (autoLearnEnabled && llmResult.getConfidence() >= autoLearnConfidenceThreshold) {
                    tryAutoLearnKeywords(userInput, llmResult.getBestMatch(), factoryId);
                }

                saveIntentMatchRecord(llmResult, factoryId, null, null, true);
                return llmResult;
            }

            // 如果 LLM 也没匹配，返回规则结果或空
            log.debug("LLM fallback did not find a match");
            IntentMatchResult fallbackResult = ruleResult != null ? ruleResult : IntentMatchResult.empty(userInput);
            saveIntentMatchRecord(fallbackResult, factoryId, null, null, true);
            return fallbackResult;

        } catch (Exception e) {
            log.error("LLM fallback failed: {}", e.getMessage(), e);
            IntentMatchResult fallbackResult = ruleResult != null ? ruleResult : IntentMatchResult.empty(userInput);
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

        // 常见停用词（单独使用时需要确认）
        Set<String> stopWords = Set.of(
                "查", "看", "找", "要", "帮", "给", "说", "做",
                "啥", "嘛", "吗", "呢", "吧", "了", "的", "是",
                "what", "how", "why", "help", "show", "get"
        );
        if (stopWords.contains(input)) {
            return true;
        }

        // 纯数字或特殊字符
        if (input.matches("^[\\d\\s\\p{Punct}]+$")) {
            return true;
        }

        // 无意义字符串（连续相同字符或键盘乱按）
        if (input.matches("^(.)\\1{2,}$") ||  // 如 "aaaa"
            input.matches("^[a-z]{4,}$") && !containsChineseOrMeaningful(input)) {  // 如 "asdfgh"
            return true;
        }

        return false;
    }

    /**
     * 检查是否包含中文或有意义的英文单词
     */
    private boolean containsChineseOrMeaningful(String input) {
        // 包含中文字符
        if (input.matches(".*[\\u4e00-\\u9fa5]+.*")) {
            return true;
        }

        // 常见有意义的英文单词
        Set<String> meaningfulWords = Set.of(
                "query", "list", "get", "show", "create", "update", "delete",
                "material", "batch", "quality", "shipment", "report", "alert",
                "inventory", "stock", "order", "production", "check"
        );

        for (String word : meaningfulWords) {
            if (input.contains(word)) {
                return true;
            }
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
        if (llmClarificationEnabled && candidates.size() >= 2) {
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
        if (!recordingEnabled) {
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
    public Optional<AIIntentConfig> getIntentByCode(String intentCode) {
        return intentRepository.findByIntentCodeAndIsActiveTrueAndDeletedAtIsNull(intentCode);
    }

    // ==================== 权限校验 ====================

    @Override
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
    public boolean requiresApproval(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::needsApproval)
                .orElse(false);
    }

    @Override
    public Optional<String> getApprovalChainId(String intentCode) {
        return getIntentByCode(intentCode)
                .filter(AIIntentConfig::needsApproval)
                .map(AIIntentConfig::getApprovalChainId);
    }

    // ==================== 配额管理 ====================

    @Override
    public int getQuotaCost(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::getQuotaCost)
                .orElse(1);
    }

    @Override
    public int getCacheTtl(String intentCode) {
        return getIntentByCode(intentCode)
                .map(AIIntentConfig::getCacheTtlMinutes)
                .orElse(0);
    }

    // ==================== 意图查询 ====================

    @Override
    @Cacheable(value = "allIntents")
    public List<AIIntentConfig> getAllIntents() {
        return intentRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc();
    }

    @Override
    @Cacheable(value = "intentsByCategory", key = "#category")
    public List<AIIntentConfig> getIntentsByCategory(String category) {
        return intentRepository.findByIntentCategoryAndIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc(category);
    }

    @Override
    public List<AIIntentConfig> getIntentsBySensitivity(String sensitivityLevel) {
        return intentRepository.findBySensitivityLevelAndIsActiveTrueAndDeletedAtIsNull(sensitivityLevel);
    }

    @Override
    @Cacheable(value = "intentCategories")
    public List<String> getAllCategories() {
        return intentRepository.findAllCategories();
    }

    // ==================== 意图管理 ====================

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public AIIntentConfig createIntent(AIIntentConfig intentConfig) {
        if (intentRepository.existsByIntentCodeAndDeletedAtIsNull(intentConfig.getIntentCode())) {
            throw new IllegalArgumentException("意图代码已存在: " + intentConfig.getIntentCode());
        }

        return intentRepository.save(intentConfig);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public AIIntentConfig updateIntent(AIIntentConfig intentConfig) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentConfig.getIntentCode())
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentConfig.getIntentCode()));

        existing.setIntentName(intentConfig.getIntentName());
        existing.setIntentCategory(intentConfig.getIntentCategory());
        existing.setSensitivityLevel(intentConfig.getSensitivityLevel());
        existing.setRequiredRoles(intentConfig.getRequiredRoles());
        existing.setQuotaCost(intentConfig.getQuotaCost());
        existing.setCacheTtlMinutes(intentConfig.getCacheTtlMinutes());
        existing.setRequiresApproval(intentConfig.getRequiresApproval());
        existing.setApprovalChainId(intentConfig.getApprovalChainId());
        existing.setKeywords(intentConfig.getKeywords());
        existing.setRegexPattern(intentConfig.getRegexPattern());
        existing.setDescription(intentConfig.getDescription());
        existing.setHandlerClass(intentConfig.getHandlerClass());
        existing.setMaxTokens(intentConfig.getMaxTokens());
        existing.setResponseTemplate(intentConfig.getResponseTemplate());
        existing.setPriority(intentConfig.getPriority());
        existing.setMetadata(intentConfig.getMetadata());

        return intentRepository.save(existing);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
    public void deleteIntent(String intentCode) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentCode)
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentCode));

        existing.setDeletedAt(LocalDateTime.now());
        intentRepository.save(existing);
    }

    @Override
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory"}, allEntries = true)
    public void setIntentActive(String intentCode, boolean active) {
        AIIntentConfig existing = intentRepository
                .findByIntentCodeAndDeletedAtIsNull(intentCode)
                .orElseThrow(() -> new IllegalArgumentException("意图配置不存在: " + intentCode));

        existing.setIsActive(active);
        intentRepository.save(existing);
    }

    // ==================== 缓存管理 ====================

    @Override
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories"}, allEntries = true)
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
     * 当 LLM 以高置信度识别意图时，从用户输入中提取新关键词并添加到意图配置
     *
     * @param userInput 用户输入
     * @param matchedIntent 匹配的意图配置
     * @param factoryId 工厂ID（用于工厂级别学习，可选）
     */
    private void tryAutoLearnKeywords(String userInput, AIIntentConfig matchedIntent, String factoryId) {
        try {
            // 提取新关键词
            List<String> newKeywords = extractNewKeywords(userInput, matchedIntent);

            if (newKeywords.isEmpty()) {
                log.debug("No new keywords to learn from input: {}", userInput);
                return;
            }

            // 添加到意图配置
            int added = autoAddKeywords(matchedIntent.getId(), newKeywords);

            if (added > 0) {
                log.info("Auto-learned {} keywords for intent {}: {}",
                        added, matchedIntent.getIntentCode(), newKeywords.subList(0, Math.min(added, newKeywords.size())));

                // 清除缓存使新关键词生效
                clearCache();
            }

        } catch (Exception e) {
            // 自动学习失败不应影响主流程
            log.warn("Auto-learn keywords failed for intent {}: {}",
                    matchedIntent.getIntentCode(), e.getMessage());
        }
    }

    /**
     * 从用户输入中提取新关键词
     *
     * 算法：
     * 1. 简单分词（按标点和空格）
     * 2. 过滤停用词
     * 3. 过滤已存在的关键词
     * 4. 过滤过短词（< 2 字符）
     * 5. 保留有意义的新词
     *
     * @param userInput 用户输入
     * @param intent 匹配的意图配置
     * @return 新关键词列表
     */
    private List<String> extractNewKeywords(String userInput, AIIntentConfig intent) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return Collections.emptyList();
        }

        // 获取现有关键词
        Set<String> existingKeywords = new HashSet<>();
        String keywordsJson = intent.getKeywords();
        if (keywordsJson != null && !keywordsJson.isEmpty()) {
            try {
                List<String> keywords = objectMapper.readValue(keywordsJson,
                        new TypeReference<List<String>>() {});
                existingKeywords.addAll(keywords.stream()
                        .map(String::toLowerCase)
                        .collect(Collectors.toSet()));
            } catch (Exception e) {
                log.warn("Failed to parse existing keywords: {}", e.getMessage());
            }
        }

        // 分词：按标点符号、空格分割
        String[] tokens = userInput.toLowerCase()
                .replaceAll("[\\p{Punct}\\s]+", " ")
                .trim()
                .split("\\s+");

        // 过滤并提取新关键词
        List<String> newKeywords = new ArrayList<>();
        for (String token : tokens) {
            // 过滤条件
            if (token.length() < 2) continue;                    // 过短
            if (STOP_WORDS.contains(token)) continue;            // 停用词
            if (existingKeywords.contains(token)) continue;      // 已存在
            if (token.matches("^\\d+$")) continue;               // 纯数字

            // 保留有意义的词
            newKeywords.add(token);
        }

        // 限制单次学习的关键词数量（防止噪音）
        int maxNewPerInput = 3;
        if (newKeywords.size() > maxNewPerInput) {
            newKeywords = newKeywords.subList(0, maxNewPerInput);
        }

        return newKeywords;
    }

    /**
     * 自动添加关键词到意图配置
     *
     * @param intentId 意图配置ID (String UUID)
     * @param newKeywords 新关键词列表
     * @return 实际添加的关键词数量
     */
    @Transactional
    @CacheEvict(value = {"allIntents", "intentsByCategory"}, allEntries = true)
    private int autoAddKeywords(String intentId, List<String> newKeywords) {
        if (newKeywords == null || newKeywords.isEmpty()) {
            return 0;
        }

        Optional<AIIntentConfig> intentOpt = intentRepository.findById(intentId);
        if (intentOpt.isEmpty()) {
            log.warn("Intent not found for auto-learn: id={}", intentId);
            return 0;
        }

        AIIntentConfig intent = intentOpt.get();

        try {
            // 解析现有关键词
            List<String> existingKeywords = new ArrayList<>();
            String keywordsJson = intent.getKeywords();
            if (keywordsJson != null && !keywordsJson.isEmpty()) {
                existingKeywords = objectMapper.readValue(keywordsJson,
                        new TypeReference<List<String>>() {});
            }

            // 检查是否超过最大关键词数量
            int currentCount = existingKeywords.size();
            if (currentCount >= maxKeywordsPerIntent) {
                log.debug("Intent {} reached max keywords limit ({})",
                        intent.getIntentCode(), maxKeywordsPerIntent);
                return 0;
            }

            // 添加新关键词（不重复）
            Set<String> existingSet = new HashSet<>(existingKeywords.stream()
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet()));

            int addedCount = 0;
            for (String newKeyword : newKeywords) {
                if (currentCount + addedCount >= maxKeywordsPerIntent) {
                    break;
                }
                if (!existingSet.contains(newKeyword.toLowerCase())) {
                    existingKeywords.add(newKeyword);
                    existingSet.add(newKeyword.toLowerCase());
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                // 保存更新 (updatedAt 由 JPA @PreUpdate 自动更新)
                String updatedKeywordsJson = objectMapper.writeValueAsString(existingKeywords);
                intent.setKeywords(updatedKeywordsJson);
                intentRepository.save(intent);

                log.info("Added {} keywords to intent {}: total={}",
                        addedCount, intent.getIntentCode(), existingKeywords.size());
            }

            return addedCount;

        } catch (Exception e) {
            log.error("Failed to add keywords to intent {}: {}", intentId, e.getMessage());
            return 0;
        }
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
     */
    private void tryLearnKeywordsForSelectedIntent(String factoryId, String selectedIntentCode, List<String> keywords) {
        // 检查工厂是否启用自动学习
        if (!factoryConfigService.isAutoLearnEnabled(factoryId)) {
            log.debug("工厂 {} 未启用自动学习，跳过", factoryId);
            return;
        }

        try {
            Optional<AIIntentConfig> intentOpt = getIntentByCode(selectedIntentCode);
            if (intentOpt.isEmpty()) {
                return;
            }

            AIIntentConfig intent = intentOpt.get();
            int maxKeywords = factoryConfigService.getMaxKeywordsPerIntent(factoryId);

            // 检查现有关键词数量
            String keywordsJson = intent.getKeywords();
            List<String> existingKeywords = new ArrayList<>();
            if (keywordsJson != null && !keywordsJson.isEmpty()) {
                existingKeywords = objectMapper.readValue(keywordsJson, new TypeReference<List<String>>() {});
            }

            if (existingKeywords.size() >= maxKeywords) {
                log.debug("意图 {} 关键词已达上限 {}", selectedIntentCode, maxKeywords);
                return;
            }

            // 筛选不存在的新关键词
            Set<String> existingSet = existingKeywords.stream()
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

            List<String> newKeywords = keywords.stream()
                .filter(k -> !existingSet.contains(k.toLowerCase()))
                .filter(k -> !STOP_WORDS.contains(k.toLowerCase()))
                .limit(3) // 每次最多学习3个
                .collect(Collectors.toList());

            if (!newKeywords.isEmpty()) {
                int added = autoAddKeywords(intent.getId(), newKeywords);
                if (added > 0) {
                    log.info("从用户反馈学习到 {} 个关键词到意图 {}: {}",
                        added, selectedIntentCode, newKeywords);
                    clearCache();

                    // 记录到效果追踪 (初始权重较低)
                    BigDecimal initialWeight = factoryConfigService.getLlmNewKeywordWeight(factoryId);
                    for (String keyword : newKeywords) {
                        keywordEffectivenessService.createOrUpdateKeyword(
                            factoryId, selectedIntentCode, keyword, "FEEDBACK_LEARNED", initialWeight);
                    }
                }
            }

        } catch (Exception e) {
            log.warn("学习关键词到选中意图失败: {}", e.getMessage());
        }
    }
}
