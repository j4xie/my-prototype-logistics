package com.cretas.aims.service.impl;

import com.cretas.aims.dto.rag.RAGCandidateDTO;
import com.cretas.aims.dto.rag.RAGExampleDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.intent.IntentMatchRecord;
import com.cretas.aims.entity.learning.LearnedExpression;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.repository.learning.LearnedExpressionRepository;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.IntentEmbeddingCacheService;
import com.cretas.aims.service.RAGRetrievalService;
import com.cretas.aims.service.RequestScopedEmbeddingCache;
import com.cretas.aims.util.VectorUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * RAG 检索服务实现
 *
 * 从 LearnedExpression 和 IntentMatchRecord 检索历史相似案例，
 * 用于意图识别候选补充和 LLM Few-Shot 增强。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Service
public class RAGRetrievalServiceImpl implements RAGRetrievalService {

    private final IntentMatchRecordRepository matchRecordRepository;
    private final LearnedExpressionRepository expressionRepository;
    private final AIIntentConfigRepository intentConfigRepository;
    private final EmbeddingClient embeddingClient;
    private final IntentEmbeddingCacheService embeddingCacheService;
    private final RequestScopedEmbeddingCache requestScopedCache;

    /**
     * 默认查询历史记录的时间范围 (天)
     */
    private static final int DEFAULT_HISTORY_DAYS = 30;

    /**
     * 默认最低相似度阈值
     */
    private static final double DEFAULT_MIN_SIMILARITY = 0.72;

    /**
     * 高置信度阈值 (用于直接匹配)
     */
    private static final double HIGH_CONFIDENCE_THRESHOLD = 0.90;

    public RAGRetrievalServiceImpl(
            IntentMatchRecordRepository matchRecordRepository,
            LearnedExpressionRepository expressionRepository,
            AIIntentConfigRepository intentConfigRepository,
            EmbeddingClient embeddingClient,
            IntentEmbeddingCacheService embeddingCacheService,
            RequestScopedEmbeddingCache requestScopedCache) {
        this.matchRecordRepository = matchRecordRepository;
        this.expressionRepository = expressionRepository;
        this.intentConfigRepository = intentConfigRepository;
        this.embeddingClient = embeddingClient;
        this.embeddingCacheService = embeddingCacheService;
        this.requestScopedCache = requestScopedCache;
    }

    @Override
    public List<RAGCandidate> retrieveSimilarCases(String factoryId, String userInput, int topK, double minSimilarity) {
        if (!embeddingClient.isAvailable()) {
            log.debug("Embedding client not available, skipping RAG retrieval");
            return Collections.emptyList();
        }

        long startTime = System.currentTimeMillis();
        List<RAGCandidate> candidates = new ArrayList<>();

        try {
            // 1. 计算用户输入的 embedding (使用请求级缓存)
            float[] inputEmbedding = requestScopedCache.getOrCompute(userInput);

            // 2. 从 LearnedExpression 检索
            List<RAGCandidate> expressionCandidates = retrieveFromExpressions(factoryId, inputEmbedding, minSimilarity);
            candidates.addAll(expressionCandidates);

            // 3. 从 IntentMatchRecord 检索 (高置信度 + 用户确认的记录)
            List<RAGCandidate> recordCandidates = retrieveFromMatchRecords(factoryId, inputEmbedding, minSimilarity);
            candidates.addAll(recordCandidates);

            // 4. 去重 (相同 userInput + intentCode 保留相似度最高的)
            candidates = deduplicateCandidates(candidates);

            // 5. 按相似度降序排序，取 Top-K
            candidates.sort((a, b) -> Double.compare(b.getSimilarity(), a.getSimilarity()));
            if (candidates.size() > topK) {
                candidates = candidates.subList(0, topK);
            }

            long latency = System.currentTimeMillis() - startTime;
            log.debug("RAG retrieval completed: factory={}, input='{}', found {} candidates in {}ms",
                    factoryId, truncate(userInput, 30), candidates.size(), latency);

            return candidates;

        } catch (Exception e) {
            log.error("RAG retrieval failed: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    @Override
    public List<RAGExample> getFewShotExamples(String factoryId, String userInput, int count) {
        if (!embeddingClient.isAvailable()) {
            log.debug("Embedding client not available, returning empty few-shot examples");
            return Collections.emptyList();
        }

        try {
            // 计算用户输入的 embedding
            float[] inputEmbedding = requestScopedCache.getOrCompute(userInput);

            List<RAGExampleDTO> examples = new ArrayList<>();

            // 1. 优先从已验证的 LearnedExpression 获取
            List<LearnedExpression> verifiedExpressions = expressionRepository.findActiveByFactory(factoryId)
                    .stream()
                    .filter(e -> Boolean.TRUE.equals(e.getIsVerified()) && e.hasEmbedding())
                    .collect(Collectors.toList());

            for (LearnedExpression expr : verifiedExpressions) {
                float[] exprEmbedding = expr.getEmbeddingAsFloatArray();
                if (exprEmbedding != null) {
                    double similarity = VectorUtils.cosineSimilarity(inputEmbedding, exprEmbedding);
                    if (similarity >= DEFAULT_MIN_SIMILARITY) {
                        String intentName = getIntentName(factoryId, expr.getIntentCode());
                        examples.add(RAGExampleDTO.create(
                                expr.getExpression(),
                                expr.getIntentCode(),
                                intentName,
                                similarity,
                                true
                        ));
                    }
                }
            }

            // 2. 如果已验证的不够，补充高置信度的未验证表达
            if (examples.size() < count) {
                List<LearnedExpression> unverifiedExpressions = expressionRepository.findActiveByFactory(factoryId)
                        .stream()
                        .filter(e -> !Boolean.TRUE.equals(e.getIsVerified()) && e.hasEmbedding())
                        .filter(e -> e.getHitCount() != null && e.getHitCount() >= 3) // 至少命中3次
                        .collect(Collectors.toList());

                for (LearnedExpression expr : unverifiedExpressions) {
                    if (examples.size() >= count * 2) break; // 限制候选数量

                    float[] exprEmbedding = expr.getEmbeddingAsFloatArray();
                    if (exprEmbedding != null) {
                        double similarity = VectorUtils.cosineSimilarity(inputEmbedding, exprEmbedding);
                        if (similarity >= DEFAULT_MIN_SIMILARITY) {
                            String intentName = getIntentName(factoryId, expr.getIntentCode());
                            examples.add(RAGExampleDTO.create(
                                    expr.getExpression(),
                                    expr.getIntentCode(),
                                    intentName,
                                    similarity,
                                    false
                            ));
                        }
                    }
                }
            }

            // 3. 排序：优先已验证，其次相似度
            examples.sort((a, b) -> {
                // 已验证优先
                if (a.isVerified() != b.isVerified()) {
                    return a.isVerified() ? -1 : 1;
                }
                // 相似度降序
                return Double.compare(b.getSimilarity(), a.getSimilarity());
            });

            // 4. 取 Top count
            if (examples.size() > count) {
                examples = examples.subList(0, count);
            }

            log.debug("Few-shot examples retrieved: factory={}, found {} examples", factoryId, examples.size());
            return new ArrayList<>(examples);

        } catch (Exception e) {
            log.error("Failed to get few-shot examples: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    @Override
    public Optional<RAGCandidate> findDirectMatch(String factoryId, String userInput, double minConfidence) {
        // 1. 首先检查 LearnedExpression 精确匹配 (hash)
        String inputHash = LearnedExpression.computeHash(userInput);
        List<LearnedExpression> exactMatches = expressionRepository.findByExpressionHash(inputHash, factoryId);

        if (!exactMatches.isEmpty()) {
            LearnedExpression match = exactMatches.get(0);
            BigDecimal confidence = match.getConfidence();
            double confValue = confidence != null ? confidence.doubleValue() : 0.8;

            if (confValue >= minConfidence) {
                log.debug("Direct hash match found: input='{}', intent={}, confidence={}",
                        truncate(userInput, 30), match.getIntentCode(), confValue);

                return Optional.of(RAGCandidateDTO.fromLearnedExpression(
                        match.getExpression(),
                        match.getIntentCode(),
                        confValue,
                        1.0 // 精确匹配相似度为 1.0
                ));
            }
        }

        // 2. 如果没有精确匹配，尝试语义相似度匹配
        if (embeddingClient.isAvailable()) {
            float[] inputEmbedding = requestScopedCache.getOrCompute(userInput);

            // 检查高相似度的已验证表达
            List<LearnedExpression> expressions = expressionRepository.findActiveByFactory(factoryId)
                    .stream()
                    .filter(e -> Boolean.TRUE.equals(e.getIsVerified()) && e.hasEmbedding())
                    .collect(Collectors.toList());

            for (LearnedExpression expr : expressions) {
                float[] exprEmbedding = expr.getEmbeddingAsFloatArray();
                if (exprEmbedding != null) {
                    double similarity = VectorUtils.cosineSimilarity(inputEmbedding, exprEmbedding);
                    if (similarity >= minConfidence) {
                        BigDecimal confidence = expr.getConfidence();
                        double confValue = confidence != null ? confidence.doubleValue() : similarity;

                        log.debug("Direct semantic match found: input='{}', intent={}, similarity={}",
                                truncate(userInput, 30), expr.getIntentCode(), similarity);

                        return Optional.of(RAGCandidateDTO.fromLearnedExpression(
                                expr.getExpression(),
                                expr.getIntentCode(),
                                confValue,
                                similarity
                        ));
                    }
                }
            }
        }

        return Optional.empty();
    }

    @Override
    public boolean hasRelevantHistory(String factoryId, String userInput, double threshold) {
        // 1. 检查精确匹配
        String inputHash = LearnedExpression.computeHash(userInput);
        List<LearnedExpression> exactMatches = expressionRepository.findByExpressionHash(inputHash, factoryId);
        if (!exactMatches.isEmpty()) {
            return true;
        }

        // 2. 检查语义相似匹配
        if (embeddingClient.isAvailable()) {
            float[] inputEmbedding = requestScopedCache.getOrCompute(userInput);

            List<LearnedExpression> expressions = expressionRepository.findActiveByFactory(factoryId)
                    .stream()
                    .filter(LearnedExpression::hasEmbedding)
                    .limit(100) // 限制检查数量
                    .collect(Collectors.toList());

            for (LearnedExpression expr : expressions) {
                float[] exprEmbedding = expr.getEmbeddingAsFloatArray();
                if (exprEmbedding != null) {
                    double similarity = VectorUtils.cosineSimilarity(inputEmbedding, exprEmbedding);
                    if (similarity >= threshold) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // ========== Private Methods ==========

    /**
     * 从 LearnedExpression 检索相似案例
     */
    private List<RAGCandidate> retrieveFromExpressions(String factoryId, float[] inputEmbedding, double minSimilarity) {
        List<RAGCandidate> candidates = new ArrayList<>();

        List<LearnedExpression> expressions = expressionRepository.findActiveByFactory(factoryId)
                .stream()
                .filter(LearnedExpression::hasEmbedding)
                .collect(Collectors.toList());

        for (LearnedExpression expr : expressions) {
            float[] exprEmbedding = expr.getEmbeddingAsFloatArray();
            if (exprEmbedding != null) {
                double similarity = VectorUtils.cosineSimilarity(inputEmbedding, exprEmbedding);
                if (similarity >= minSimilarity) {
                    BigDecimal confidence = expr.getConfidence();
                    double confValue = confidence != null ? confidence.doubleValue() : similarity;

                    candidates.add(RAGCandidateDTO.fromLearnedExpression(
                            expr.getExpression(),
                            expr.getIntentCode(),
                            confValue,
                            similarity
                    ));
                }
            }
        }

        return candidates;
    }

    /**
     * 从 IntentMatchRecord 检索相似案例
     */
    private List<RAGCandidate> retrieveFromMatchRecords(String factoryId, float[] inputEmbedding, double minSimilarity) {
        List<RAGCandidate> candidates = new ArrayList<>();

        // 查询最近 30 天的高置信度或用户确认记录
        LocalDateTime startDate = LocalDateTime.now().minusDays(DEFAULT_HISTORY_DAYS);

        // 获取用户确认的记录 (这些是最可靠的)
        List<IntentMatchRecord> confirmedRecords = matchRecordRepository
                .findByFactoryIdAndCreatedAtBetween(factoryId, startDate, LocalDateTime.now())
                .stream()
                .filter(r -> Boolean.TRUE.equals(r.getUserConfirmed()) && r.getMatchedIntentCode() != null)
                .limit(100) // 限制数量
                .collect(Collectors.toList());

        for (IntentMatchRecord record : confirmedRecords) {
            String recordInput = record.getUserInput();
            if (recordInput == null || recordInput.isEmpty()) continue;

            // 计算相似度
            float[] recordEmbedding = requestScopedCache.getOrCompute(recordInput);
            double similarity = VectorUtils.cosineSimilarity(inputEmbedding, recordEmbedding);

            if (similarity >= minSimilarity) {
                BigDecimal confidence = record.getConfidenceScore();
                double confValue = confidence != null ? confidence.doubleValue() : similarity;

                candidates.add(RAGCandidateDTO.fromMatchRecord(
                        recordInput,
                        record.getMatchedIntentCode(),
                        confValue,
                        similarity,
                        true
                ));
            }
        }

        // 获取高置信度记录 (未经用户确认但置信度高)
        List<IntentMatchRecord> highConfRecords = matchRecordRepository
                .findByFactoryIdAndCreatedAtBetween(factoryId, startDate, LocalDateTime.now())
                .stream()
                .filter(r -> r.getMatchedIntentCode() != null
                        && r.getConfidenceScore() != null
                        && r.getConfidenceScore().doubleValue() >= HIGH_CONFIDENCE_THRESHOLD
                        && r.getUserConfirmed() == null) // 未确认但高置信度
                .limit(50)
                .collect(Collectors.toList());

        for (IntentMatchRecord record : highConfRecords) {
            String recordInput = record.getUserInput();
            if (recordInput == null || recordInput.isEmpty()) continue;

            float[] recordEmbedding = requestScopedCache.getOrCompute(recordInput);
            double similarity = VectorUtils.cosineSimilarity(inputEmbedding, recordEmbedding);

            if (similarity >= minSimilarity) {
                BigDecimal confidence = record.getConfidenceScore();
                double confValue = confidence != null ? confidence.doubleValue() : similarity;

                candidates.add(RAGCandidateDTO.fromMatchRecord(
                        recordInput,
                        record.getMatchedIntentCode(),
                        confValue,
                        similarity,
                        false
                ));
            }
        }

        return candidates;
    }

    /**
     * 去重候选 (相同 userInput + intentCode 保留相似度最高的)
     */
    private List<RAGCandidate> deduplicateCandidates(List<RAGCandidate> candidates) {
        Map<String, RAGCandidate> deduped = new HashMap<>();

        for (RAGCandidate candidate : candidates) {
            String key = candidate.getUserInput().toLowerCase().trim() + "|" + candidate.getIntentCode();
            RAGCandidate existing = deduped.get(key);

            if (existing == null || candidate.getSimilarity() > existing.getSimilarity()) {
                deduped.put(key, candidate);
            }
        }

        return new ArrayList<>(deduped.values());
    }

    /**
     * 获取意图名称
     */
    private String getIntentName(String factoryId, String intentCode) {
        // 先尝试工厂特定意图
        Optional<AIIntentConfig> config = intentConfigRepository.findByFactoryIdAndIntentCode(factoryId, intentCode);
        if (config.isPresent()) {
            return config.get().getDescription();
        }

        // 再尝试全局意图
        config = intentConfigRepository.findByIntentCode(intentCode);
        if (config.isPresent()) {
            return config.get().getDescription();
        }

        return intentCode; // 返回代码作为备选
    }

    /**
     * 截断文本用于日志
     */
    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        if (text.length() <= maxLen) return text;
        return text.substring(0, maxLen) + "...";
    }
}
