package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.intent.IntentMatchRecord;
import com.cretas.aims.entity.learning.LearnedExpression;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.repository.learning.LearnedExpressionRepository;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.RequestScopedEmbeddingCache;
import com.cretas.aims.util.VectorUtils;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 动态 Few-Shot 示例选择服务
 *
 * 使用 Maximal Marginal Relevance (MMR) 算法选择既相关又多样的示例:
 * MMR(d) = λ * sim(d, query) - (1-λ) * max(sim(d, d_selected))
 *
 * 优势:
 * - 避免选择过于相似的示例，增加多样性
 * - 平衡相关性和多样性，提升 LLM 理解能力
 * - 覆盖更多的表达模式
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Service
public class DynamicFewShotService {

    private final LearnedExpressionRepository expressionRepository;
    private final IntentMatchRecordRepository matchRecordRepository;
    private final AIIntentConfigRepository intentConfigRepository;
    private final EmbeddingClient embeddingClient;
    private final RequestScopedEmbeddingCache requestScopedCache;

    /**
     * MMR 算法中的 lambda 参数
     * 控制相关性与多样性的平衡: 0.7 偏向相关性，0.3 偏向多样性
     */
    @Value("${cretas.ai.fewshot.mmr.lambda:0.7}")
    private double mmrLambda;

    /**
     * 返回的最大示例数量
     */
    @Value("${cretas.ai.fewshot.max-examples:7}")
    private int maxExamples;

    /**
     * 最小返回示例数量
     */
    @Value("${cretas.ai.fewshot.min-examples:5}")
    private int minExamples;

    /**
     * 最低相似度阈值
     */
    @Value("${cretas.ai.fewshot.min-similarity:0.55}")
    private double minSimilarity;

    /**
     * 候选池大小 (MMR 从中选择)
     */
    @Value("${cretas.ai.fewshot.candidate-pool-size:30}")
    private int candidatePoolSize;

    public DynamicFewShotService(
            LearnedExpressionRepository expressionRepository,
            IntentMatchRecordRepository matchRecordRepository,
            AIIntentConfigRepository intentConfigRepository,
            EmbeddingClient embeddingClient,
            RequestScopedEmbeddingCache requestScopedCache) {
        this.expressionRepository = expressionRepository;
        this.matchRecordRepository = matchRecordRepository;
        this.intentConfigRepository = intentConfigRepository;
        this.embeddingClient = embeddingClient;
        this.requestScopedCache = requestScopedCache;
    }

    /**
     * 使用 MMR 算法选择最优的 Few-Shot 示例
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param targetCount 目标示例数量 (5-7)
     * @return Few-Shot 示例列表
     */
    public List<FewShotExample> selectFewShotExamples(String factoryId, String userInput, int targetCount) {
        if (!embeddingClient.isAvailable()) {
            log.debug("Embedding client not available, returning empty few-shot examples");
            return Collections.emptyList();
        }

        long startTime = System.currentTimeMillis();
        int count = Math.min(Math.max(targetCount, minExamples), maxExamples);

        try {
            // 1. 计算用户输入的 embedding
            float[] queryEmbedding = requestScopedCache.getOrCompute(userInput);

            // 2. 构建候选池
            List<FewShotCandidate> candidatePool = buildCandidatePool(factoryId, queryEmbedding);

            if (candidatePool.isEmpty()) {
                log.debug("No candidates found for few-shot selection");
                return Collections.emptyList();
            }

            // 3. 使用 MMR 算法选择示例
            List<FewShotCandidate> selectedCandidates = mmrSelect(queryEmbedding, candidatePool, count);

            // 4. 转换为 FewShotExample
            List<FewShotExample> examples = selectedCandidates.stream()
                    .map(c -> FewShotExample.builder()
                            .userInput(c.getUserInput())
                            .intentCode(c.getIntentCode())
                            .intentName(getIntentName(factoryId, c.getIntentCode()))
                            .confidence(c.getConfidence())
                            .relevanceScore(c.getRelevanceScore())
                            .diversityScore(c.getDiversityScore())
                            .source(c.getSource())
                            .build())
                    .collect(Collectors.toList());

            long latency = System.currentTimeMillis() - startTime;
            log.info("[MMR Few-Shot] Selected {} examples from {} candidates for '{}' in {}ms",
                    examples.size(), candidatePool.size(), truncate(userInput, 30), latency);

            return examples;

        } catch (Exception e) {
            log.error("MMR Few-Shot selection failed: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    /**
     * 构建候选池
     * 从 LearnedExpression 和 IntentMatchRecord 获取候选示例
     */
    private List<FewShotCandidate> buildCandidatePool(String factoryId, float[] queryEmbedding) {
        List<FewShotCandidate> pool = new ArrayList<>();

        // 1. 从 LearnedExpression 获取候选 (优先已验证的)
        List<LearnedExpression> expressions = expressionRepository.findActiveByFactory(factoryId)
                .stream()
                .filter(LearnedExpression::hasEmbedding)
                .collect(Collectors.toList());

        for (LearnedExpression expr : expressions) {
            float[] exprEmbedding = expr.getEmbeddingAsFloatArray();
            if (exprEmbedding != null) {
                double similarity = VectorUtils.cosineSimilarity(queryEmbedding, exprEmbedding);
                if (similarity >= minSimilarity) {
                    BigDecimal confidence = expr.getConfidence();
                    double confValue = confidence != null ? confidence.doubleValue() : similarity;

                    pool.add(FewShotCandidate.builder()
                            .userInput(expr.getExpression())
                            .intentCode(expr.getIntentCode())
                            .embedding(exprEmbedding)
                            .relevanceScore(similarity)
                            .confidence(confValue)
                            .source(Boolean.TRUE.equals(expr.getIsVerified()) ?
                                    "VERIFIED_EXPRESSION" : "LEARNED_EXPRESSION")
                            .isVerified(Boolean.TRUE.equals(expr.getIsVerified()))
                            .hitCount(expr.getHitCount() != null ? expr.getHitCount() : 0)
                            .build());
                }
            }
        }

        // 2. 从 IntentMatchRecord 获取高置信度记录 (用户确认的)
        LocalDateTime startDate = LocalDateTime.now().minusDays(30);
        List<IntentMatchRecord> confirmedRecords = matchRecordRepository
                .findByFactoryIdAndCreatedAtBetween(factoryId, startDate, LocalDateTime.now())
                .stream()
                .filter(r -> Boolean.TRUE.equals(r.getUserConfirmed()) && r.getMatchedIntentCode() != null)
                .limit(50)
                .collect(Collectors.toList());

        for (IntentMatchRecord record : confirmedRecords) {
            String recordInput = record.getUserInput();
            if (recordInput == null || recordInput.isEmpty()) continue;

            // 检查是否已在候选池中
            String normalizedInput = recordInput.toLowerCase().trim();
            boolean exists = pool.stream()
                    .anyMatch(c -> c.getUserInput().toLowerCase().trim().equals(normalizedInput));
            if (exists) continue;

            float[] recordEmbedding = requestScopedCache.getOrCompute(recordInput);
            double similarity = VectorUtils.cosineSimilarity(queryEmbedding, recordEmbedding);

            if (similarity >= minSimilarity) {
                BigDecimal confidence = record.getConfidenceScore();
                double confValue = confidence != null ? confidence.doubleValue() : similarity;

                pool.add(FewShotCandidate.builder()
                        .userInput(recordInput)
                        .intentCode(record.getMatchedIntentCode())
                        .embedding(recordEmbedding)
                        .relevanceScore(similarity)
                        .confidence(confValue)
                        .source("USER_CONFIRMED")
                        .isVerified(true)
                        .hitCount(1)
                        .build());
            }
        }

        // 3. 按相似度排序，取 Top candidatePoolSize
        pool.sort((a, b) -> Double.compare(b.getRelevanceScore(), a.getRelevanceScore()));
        if (pool.size() > candidatePoolSize) {
            pool = pool.subList(0, candidatePoolSize);
        }

        log.debug("Built candidate pool with {} candidates for MMR selection", pool.size());
        return pool;
    }

    /**
     * MMR (Maximal Marginal Relevance) 算法选择示例
     *
     * MMR(d) = λ * sim(d, query) - (1-λ) * max(sim(d, d_selected))
     *
     * @param queryEmbedding 查询向量
     * @param candidates 候选池
     * @param k 选择数量
     * @return 选中的候选列表
     */
    private List<FewShotCandidate> mmrSelect(float[] queryEmbedding,
                                              List<FewShotCandidate> candidates,
                                              int k) {
        if (candidates.isEmpty()) {
            return Collections.emptyList();
        }

        List<FewShotCandidate> selected = new ArrayList<>();
        Set<Integer> selectedIndices = new HashSet<>();

        // 选择 k 个示例
        while (selected.size() < k && selectedIndices.size() < candidates.size()) {
            double bestScore = Double.NEGATIVE_INFINITY;
            int bestIndex = -1;

            // 遍历所有未选中的候选
            for (int i = 0; i < candidates.size(); i++) {
                if (selectedIndices.contains(i)) continue;

                FewShotCandidate candidate = candidates.get(i);
                double relevance = candidate.getRelevanceScore();

                // 计算与已选示例的最大相似度
                double maxSimilarityToSelected = 0.0;
                for (FewShotCandidate sel : selected) {
                    double sim = VectorUtils.cosineSimilarity(candidate.getEmbedding(), sel.getEmbedding());
                    maxSimilarityToSelected = Math.max(maxSimilarityToSelected, sim);
                }

                // MMR 分数 = λ * relevance - (1-λ) * maxSimilarityToSelected
                double mmrScore = mmrLambda * relevance - (1 - mmrLambda) * maxSimilarityToSelected;

                // 优先考虑已验证的示例 (增加小量奖励)
                if (candidate.isVerified()) {
                    mmrScore += 0.05;
                }

                // 考虑命中次数 (高命中次数说明该表达很常见)
                if (candidate.getHitCount() >= 5) {
                    mmrScore += 0.02;
                }

                if (mmrScore > bestScore) {
                    bestScore = mmrScore;
                    bestIndex = i;
                }
            }

            if (bestIndex >= 0) {
                FewShotCandidate selectedCandidate = candidates.get(bestIndex);
                // 记录多样性分数 (1 - maxSimilarityToSelected)
                double maxSimToSelected = 0.0;
                for (FewShotCandidate sel : selected) {
                    double sim = VectorUtils.cosineSimilarity(selectedCandidate.getEmbedding(), sel.getEmbedding());
                    maxSimToSelected = Math.max(maxSimToSelected, sim);
                }
                selectedCandidate.setDiversityScore(1 - maxSimToSelected);

                selected.add(selectedCandidate);
                selectedIndices.add(bestIndex);

                log.debug("[MMR] Selected: '{}' -> {} (relevance={}, diversity={}, mmr={})",
                        truncate(selectedCandidate.getUserInput(), 20),
                        selectedCandidate.getIntentCode(),
                        String.format("%.3f", selectedCandidate.getRelevanceScore()),
                        String.format("%.3f", selectedCandidate.getDiversityScore()),
                        String.format("%.3f", bestScore));
            } else {
                break;
            }
        }

        return selected;
    }

    /**
     * 获取意图名称
     */
    private String getIntentName(String factoryId, String intentCode) {
        Optional<AIIntentConfig> config = intentConfigRepository.findByFactoryIdAndIntentCode(factoryId, intentCode);
        if (config.isPresent()) {
            return config.get().getIntentName();
        }
        config = intentConfigRepository.findByIntentCode(intentCode);
        return config.map(AIIntentConfig::getIntentName).orElse(intentCode);
    }

    /**
     * 截断文本
     */
    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        if (text.length() <= maxLen) return text;
        return text.substring(0, maxLen) + "...";
    }

    // ==================== 内部类 ====================

    /**
     * Few-Shot 候选
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class FewShotCandidate {
        private String userInput;
        private String intentCode;
        private float[] embedding;
        private double relevanceScore;
        private double diversityScore;
        private double confidence;
        private String source;
        private boolean isVerified;
        private int hitCount;
    }

    /**
     * Few-Shot 示例 (输出结果)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FewShotExample {
        private String userInput;
        private String intentCode;
        private String intentName;
        private double confidence;
        private double relevanceScore;
        private double diversityScore;
        private String source;

        /**
         * 格式化为 prompt 表格行
         */
        public String toPromptTableRow() {
            return String.format("| %s | %s | %s |",
                    userInput,
                    intentCode,
                    intentName != null ? intentName : "");
        }
    }
}
