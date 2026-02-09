package com.cretas.aims.service.impl;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.intent.IntentMatchRecord;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.ConfidenceCalibrationService;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.RequestScopedEmbeddingCache;
import com.cretas.aims.util.VectorUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 置信度校准服务实现
 *
 * 多源置信度融合公式:
 * finalConfidence = w1 * llmConf + w2 * semanticSim + w3 * keywordMatch + w4 * transitionProb
 *
 * 权重配置:
 * - w1 (LLM自评估): 0.4
 * - w2 (语义相似度): 0.3
 * - w3 (关键词匹配): 0.2
 * - w4 (转移概率): 0.1
 *
 * 使用 Laplace 平滑计算意图转移概率:
 * P(toIntent|fromIntent) = (count(from->to) + alpha) / (count(from->*) + alpha * |V|)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Service
public class ConfidenceCalibrationServiceImpl implements ConfidenceCalibrationService {

    private final IntentMatchRecordRepository matchRecordRepository;
    private final AIIntentConfigRepository intentConfigRepository;
    private final EmbeddingClient embeddingClient;
    private final RequestScopedEmbeddingCache requestScopedCache;

    // ==================== 权重配置 ====================

    @Value("${cretas.ai.calibration.weight.llm:0.4}")
    private double weightLlm;

    @Value("${cretas.ai.calibration.weight.semantic:0.3}")
    private double weightSemantic;

    @Value("${cretas.ai.calibration.weight.keyword:0.2}")
    private double weightKeyword;

    @Value("${cretas.ai.calibration.weight.transition:0.1}")
    private double weightTransition;

    // ==================== Laplace 平滑配置 ====================

    /**
     * Laplace 平滑参数 (alpha)
     * 用于避免零概率问题
     */
    @Value("${cretas.ai.calibration.laplace-alpha:1.0}")
    private double laplaceAlpha;

    /**
     * 转移概率矩阵刷新间隔 (小时)
     */
    @Value("${cretas.ai.calibration.transition-refresh-hours:6}")
    private int transitionRefreshHours;

    /**
     * 历史数据查询天数
     */
    @Value("${cretas.ai.calibration.history-days:30}")
    private int historyDays;

    // ==================== 转移概率矩阵缓存 ====================

    /**
     * 转移计数矩阵: factoryId -> (fromIntent -> (toIntent -> count))
     */
    private final Map<String, Map<String, Map<String, Long>>> transitionCounts = new ConcurrentHashMap<>();

    /**
     * 意图词汇表: factoryId -> Set<intentCode>
     */
    private final Map<String, Set<String>> intentVocabulary = new ConcurrentHashMap<>();

    /**
     * 最后更新时间
     */
    private final Map<String, LocalDateTime> lastUpdateTimes = new ConcurrentHashMap<>();

    public ConfidenceCalibrationServiceImpl(
            IntentMatchRecordRepository matchRecordRepository,
            AIIntentConfigRepository intentConfigRepository,
            EmbeddingClient embeddingClient,
            RequestScopedEmbeddingCache requestScopedCache) {
        this.matchRecordRepository = matchRecordRepository;
        this.intentConfigRepository = intentConfigRepository;
        this.embeddingClient = embeddingClient;
        this.requestScopedCache = requestScopedCache;
    }

    @PostConstruct
    public void init() {
        log.info("ConfidenceCalibrationService initialized with weights: llm={}, semantic={}, keyword={}, transition={}",
                weightLlm, weightSemantic, weightKeyword, weightTransition);
        log.info("Laplace smoothing alpha={}, history days={}", laplaceAlpha, historyDays);
    }

    @Override
    public CalibratedConfidence calibrate(String factoryId, Long userId, String intentCode,
                                           ConfidenceInputs inputs) {
        // 1. 获取各分量值 (默认为 0.5)
        double llmConf = inputs.getLlmConfidence() != null ? inputs.getLlmConfidence() : 0.5;
        double semanticSim = inputs.getSemanticSimilarity() != null ? inputs.getSemanticSimilarity() : 0.5;
        double keywordMatch = inputs.getKeywordMatchScore() != null ? inputs.getKeywordMatchScore() : 0.5;
        double transitionProb = inputs.getTransitionProbability() != null ? inputs.getTransitionProbability() : 0.5;

        // 2. 计算加权融合置信度
        double finalConfidence = weightLlm * llmConf
                + weightSemantic * semanticSim
                + weightKeyword * keywordMatch
                + weightTransition * transitionProb;

        // 3. 计算各分量贡献
        Map<String, Double> contributions = new LinkedHashMap<>();
        contributions.put("llm", weightLlm * llmConf);
        contributions.put("semantic", weightSemantic * semanticSim);
        contributions.put("keyword", weightKeyword * keywordMatch);
        contributions.put("transition", weightTransition * transitionProb);

        // 4. 确定推荐行动
        RecommendedAction action = determineAction(finalConfidence);

        // 5. 构建结果
        double adjustment = finalConfidence - llmConf;
        boolean isStrong = finalConfidence >= 0.8;

        String details = String.format(
                "融合计算: %.3f*%.3f + %.3f*%.3f + %.3f*%.3f + %.3f*%.3f = %.3f (调整: %+.3f)",
                weightLlm, llmConf,
                weightSemantic, semanticSim,
                weightKeyword, keywordMatch,
                weightTransition, transitionProb,
                finalConfidence, adjustment);

        log.debug("[Calibration] intent={}, final={}, adjustment={}, action={}",
                intentCode, String.format("%.3f", finalConfidence),
                String.format("%+.3f", adjustment), action);

        return CalibratedConfidence.builder()
                .finalConfidence(finalConfidence)
                .componentContributions(contributions)
                .confidenceAdjustment(adjustment)
                .isStrongSignal(isStrong)
                .recommendedAction(action)
                .calibrationDetails(details)
                .build();
    }

    @Override
    public List<CalibratedCandidate> calibrateCandidates(String factoryId, Long userId,
                                                          List<IntentMatchResult.CandidateIntent> candidates,
                                                          String userInput, String previousIntentCode) {
        if (candidates == null || candidates.isEmpty()) {
            return Collections.emptyList();
        }

        List<CalibratedCandidate> calibrated = new ArrayList<>();

        for (IntentMatchResult.CandidateIntent candidate : candidates) {
            String intentCode = candidate.getIntentCode();
            double originalConf = candidate.getConfidence() != null ? candidate.getConfidence() : 0.5;

            // 1. LLM 置信度 (使用原始置信度)
            double llmConf = originalConf;

            // 2. 语义相似度 (如果有 Embedding 客户端)
            double semanticSim = computeSemanticSimilarity(factoryId, userInput, intentCode);

            // 3. 关键词匹配度
            double keywordMatch = computeKeywordMatchScore(candidate.getMatchedKeywords(), intentCode, factoryId);

            // 4. 转移概率
            double transitionProb = previousIntentCode != null ?
                    getTransitionProbability(factoryId, previousIntentCode, intentCode) : 0.5;

            // 5. 计算融合置信度
            double finalConf = weightLlm * llmConf
                    + weightSemantic * semanticSim
                    + weightKeyword * keywordMatch
                    + weightTransition * transitionProb;

            calibrated.add(CalibratedCandidate.builder()
                    .intentCode(intentCode)
                    .intentName(candidate.getIntentName())
                    .originalConfidence(originalConf)
                    .calibratedConfidence(finalConf)
                    .llmContribution(weightLlm * llmConf)
                    .semanticContribution(weightSemantic * semanticSim)
                    .keywordContribution(weightKeyword * keywordMatch)
                    .transitionContribution(weightTransition * transitionProb)
                    .isStrongSignal(finalConf >= 0.8)
                    .build());
        }

        // 按校准后的置信度降序排序
        calibrated.sort((a, b) -> Double.compare(b.getCalibratedConfidence(), a.getCalibratedConfidence()));

        return calibrated;
    }

    @Override
    public double getTransitionProbability(String factoryId, String fromIntent, String toIntent) {
        if (fromIntent == null || toIntent == null) {
            return 0.5; // 默认概率
        }

        // 确保转移矩阵已加载
        ensureTransitionMatrixLoaded(factoryId);

        Map<String, Map<String, Long>> factoryMatrix = transitionCounts.get(factoryId);
        Set<String> vocabulary = intentVocabulary.getOrDefault(factoryId, Collections.emptySet());

        if (factoryMatrix == null || vocabulary.isEmpty()) {
            return 0.5; // 无数据，返回默认值
        }

        // Laplace 平滑计算
        // P(toIntent|fromIntent) = (count(from->to) + alpha) / (count(from->*) + alpha * |V|)
        Map<String, Long> fromTransitions = factoryMatrix.getOrDefault(fromIntent, Collections.emptyMap());
        long countFromTo = fromTransitions.getOrDefault(toIntent, 0L);
        long countFromAll = fromTransitions.values().stream().mapToLong(Long::longValue).sum();

        int vocabSize = vocabulary.size();
        double probability = (countFromTo + laplaceAlpha) / (countFromAll + laplaceAlpha * vocabSize);

        log.trace("[Transition] P({}|{}) = ({} + {}) / ({} + {} * {}) = {}",
                toIntent, fromIntent, countFromTo, laplaceAlpha, countFromAll, laplaceAlpha, vocabSize,
                String.format("%.4f", probability));

        return probability;
    }

    @Override
    public void refreshTransitionMatrix(String factoryId) {
        log.info("Refreshing transition matrix for factory: {}", factoryId);
        long startTime = System.currentTimeMillis();

        try {
            // 1. 获取意图词汇表
            List<AIIntentConfig> intents = intentConfigRepository.findByFactoryIdAndEnabled(factoryId, true);
            Set<String> vocabulary = intents.stream()
                    .map(AIIntentConfig::getIntentCode)
                    .collect(Collectors.toSet());

            // 添加全局意图
            List<AIIntentConfig> globalIntents = intentConfigRepository.findGlobalIntents();
            vocabulary.addAll(globalIntents.stream()
                    .map(AIIntentConfig::getIntentCode)
                    .collect(Collectors.toSet()));

            intentVocabulary.put(factoryId, vocabulary);

            // 2. 统计转移计数
            LocalDateTime startDate = LocalDateTime.now().minusDays(historyDays);
            List<IntentMatchRecord> records = matchRecordRepository
                    .findByFactoryIdAndCreatedAtBetween(factoryId, startDate, LocalDateTime.now())
                    .stream()
                    .filter(r -> r.getMatchedIntentCode() != null && r.getUserId() != null)
                    .sorted(Comparator.comparing(IntentMatchRecord::getCreatedAt))
                    .collect(Collectors.toList());

            Map<String, Map<String, Long>> matrix = new ConcurrentHashMap<>();

            // 按用户分组，统计连续意图转移
            Map<Long, List<IntentMatchRecord>> byUser = records.stream()
                    .collect(Collectors.groupingBy(IntentMatchRecord::getUserId));

            for (List<IntentMatchRecord> userRecords : byUser.values()) {
                if (userRecords.size() < 2) continue;

                // 按时间排序
                userRecords.sort(Comparator.comparing(IntentMatchRecord::getCreatedAt));

                for (int i = 1; i < userRecords.size(); i++) {
                    String fromIntent = userRecords.get(i - 1).getMatchedIntentCode();
                    String toIntent = userRecords.get(i).getMatchedIntentCode();

                    if (fromIntent != null && toIntent != null) {
                        matrix.computeIfAbsent(fromIntent, k -> new ConcurrentHashMap<>())
                                .merge(toIntent, 1L, Long::sum);
                    }
                }
            }

            transitionCounts.put(factoryId, matrix);
            lastUpdateTimes.put(factoryId, LocalDateTime.now());

            long latency = System.currentTimeMillis() - startTime;
            int intentCount = vocabulary.size();
            long totalTransitions = matrix.values().stream()
                    .flatMap(m -> m.values().stream())
                    .mapToLong(Long::longValue)
                    .sum();

            log.info("Transition matrix refreshed for factory {}: {} intents, {} transitions in {}ms",
                    factoryId, intentCount, totalTransitions, latency);

        } catch (Exception e) {
            log.error("Failed to refresh transition matrix for factory {}: {}", factoryId, e.getMessage(), e);
        }
    }

    @Override
    public TransitionMatrixStats getTransitionMatrixStats(String factoryId) {
        ensureTransitionMatrixLoaded(factoryId);

        Map<String, Map<String, Long>> matrix = transitionCounts.getOrDefault(factoryId, Collections.emptyMap());
        Set<String> vocabulary = intentVocabulary.getOrDefault(factoryId, Collections.emptySet());
        LocalDateTime lastUpdate = lastUpdateTimes.get(factoryId);

        // 统计总转移数
        long totalTransitions = matrix.values().stream()
                .flatMap(m -> m.values().stream())
                .mapToLong(Long::longValue)
                .sum();

        // 获取 Top 转移对
        List<TransitionPair> topPairs = new ArrayList<>();
        for (Map.Entry<String, Map<String, Long>> fromEntry : matrix.entrySet()) {
            String fromIntent = fromEntry.getKey();
            for (Map.Entry<String, Long> toEntry : fromEntry.getValue().entrySet()) {
                String toIntent = toEntry.getKey();
                long count = toEntry.getValue();
                double prob = getTransitionProbability(factoryId, fromIntent, toIntent);

                topPairs.add(TransitionPair.builder()
                        .fromIntent(fromIntent)
                        .toIntent(toIntent)
                        .count(count)
                        .probability(prob)
                        .build());
            }
        }

        // 按次数降序排序，取 Top 10
        topPairs.sort((a, b) -> Long.compare(b.getCount(), a.getCount()));
        if (topPairs.size() > 10) {
            topPairs = topPairs.subList(0, 10);
        }

        return TransitionMatrixStats.builder()
                .factoryId(factoryId)
                .intentCount(vocabulary.size())
                .totalTransitions(totalTransitions)
                .lastUpdated(lastUpdate != null ?
                        lastUpdate.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : "N/A")
                .smoothingAlpha(laplaceAlpha)
                .topTransitions(topPairs)
                .build();
    }

    // ==================== 定时任务 ====================

    /**
     * 定时刷新所有工厂的转移矩阵
     */
    @Scheduled(fixedRateString = "${cretas.ai.calibration.transition-refresh-ms:21600000}") // 默认 6 小时
    public void scheduledRefresh() {
        log.info("Scheduled transition matrix refresh starting...");

        try {
            List<String> factoryIds = intentConfigRepository.findDistinctFactoryIds();
            for (String factoryId : factoryIds) {
                if (factoryId != null) {
                    refreshTransitionMatrix(factoryId);
                }
            }
            log.info("Scheduled transition matrix refresh completed for {} factories", factoryIds.size());
        } catch (Exception e) {
            log.error("Scheduled transition matrix refresh failed: {}", e.getMessage(), e);
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 确保转移矩阵已加载
     */
    private void ensureTransitionMatrixLoaded(String factoryId) {
        LocalDateTime lastUpdate = lastUpdateTimes.get(factoryId);
        if (lastUpdate == null || lastUpdate.plusHours(transitionRefreshHours).isBefore(LocalDateTime.now())) {
            refreshTransitionMatrix(factoryId);
        }
    }

    /**
     * 计算语义相似度
     */
    private double computeSemanticSimilarity(String factoryId, String userInput, String intentCode) {
        if (!embeddingClient.isAvailable()) {
            return 0.5;
        }

        try {
            // 获取意图的描述文本
            Optional<AIIntentConfig> configOpt = intentConfigRepository.findByFactoryIdAndIntentCode(factoryId, intentCode);
            if (!configOpt.isPresent()) {
                configOpt = intentConfigRepository.findByIntentCode(intentCode);
            }

            if (!configOpt.isPresent()) {
                return 0.5;
            }

            AIIntentConfig config = configOpt.get();
            String intentText = buildIntentText(config);

            float[] inputEmbedding = requestScopedCache.getOrCompute(userInput);
            float[] intentEmbedding = requestScopedCache.getOrCompute(intentText);

            return VectorUtils.cosineSimilarity(inputEmbedding, intentEmbedding);

        } catch (Exception e) {
            log.warn("Failed to compute semantic similarity: {}", e.getMessage());
            return 0.5;
        }
    }

    /**
     * 构建意图文本用于语义比较
     */
    private String buildIntentText(AIIntentConfig config) {
        StringBuilder sb = new StringBuilder();
        if (config.getIntentName() != null) {
            sb.append(config.getIntentName()).append(" ");
        }
        if (config.getDescription() != null) {
            sb.append(config.getDescription()).append(" ");
        }
        if (config.getKeywords() != null) {
            sb.append(config.getKeywords());
        }
        return sb.toString().trim();
    }

    /**
     * 计算关键词匹配度
     */
    private double computeKeywordMatchScore(List<String> matchedKeywords, String intentCode, String factoryId) {
        if (matchedKeywords == null || matchedKeywords.isEmpty()) {
            return 0.3; // 无匹配关键词给予较低基础分
        }

        // 获取意图的总关键词数量
        Optional<AIIntentConfig> configOpt = intentConfigRepository.findByFactoryIdAndIntentCode(factoryId, intentCode);
        if (!configOpt.isPresent()) {
            configOpt = intentConfigRepository.findByIntentCode(intentCode);
        }

        if (!configOpt.isPresent()) {
            return 0.5;
        }

        AIIntentConfig config = configOpt.get();
        List<String> allKeywords = config.getKeywordsList();

        if (allKeywords == null || allKeywords.isEmpty()) {
            return matchedKeywords.size() >= 2 ? 0.7 : 0.5;
        }

        // 关键词匹配比例
        double ratio = (double) matchedKeywords.size() / allKeywords.size();

        // 匹配的关键词数量也很重要
        if (matchedKeywords.size() >= 3) {
            ratio = Math.min(1.0, ratio + 0.2);
        } else if (matchedKeywords.size() >= 2) {
            ratio = Math.min(1.0, ratio + 0.1);
        }

        return Math.min(1.0, ratio);
    }

    /**
     * 确定推荐行动
     */
    private RecommendedAction determineAction(double confidence) {
        if (confidence >= 0.85) {
            return RecommendedAction.EXECUTE_DIRECTLY;
        } else if (confidence >= 0.6) {
            return RecommendedAction.CONFIRM_AND_EXECUTE;
        } else if (confidence >= 0.4) {
            return RecommendedAction.SHOW_CANDIDATES;
        } else {
            return RecommendedAction.REQUEST_CLARIFICATION;
        }
    }
}
