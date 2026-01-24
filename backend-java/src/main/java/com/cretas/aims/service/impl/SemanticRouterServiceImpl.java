package com.cretas.aims.service.impl;

import com.cretas.aims.dto.intent.RouteDecision;
import com.cretas.aims.dto.intent.RouteDecision.CandidateMatch;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.IntentEmbeddingCacheService;
import com.cretas.aims.service.RequestScopedEmbeddingCache;
import com.cretas.aims.service.SemanticRouterService;
import com.cretas.aims.util.VectorUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * 语义路由器服务实现
 *
 * 在 AIIntentServiceImpl 前置一层语义路由器，使用向量相似度做快速决策:
 *
 * 路由策略:
 * - score >= 0.92: DirectExecute - 直接执行，跳过LLM，节省约 500-1000ms
 * - score >= 0.75: NeedReranking - 走关键词+LLM Reranking 确认
 * - score < 0.75: NeedFullLLM - 走完整 LLM Fallback 流程
 *
 * 性能优化:
 * - 启动时预加载所有意图的向量表示 (复用 IntentEmbeddingCacheService)
 * - 使用请求级 Embedding 缓存，避免重复计算
 * - 使用 ConcurrentHashMap 存储意图向量，支持高并发
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SemanticRouterServiceImpl implements SemanticRouterService {

    private final IntentEmbeddingCacheService embeddingCacheService;
    private final AIIntentConfigRepository intentConfigRepository;
    private final EmbeddingClient embeddingClient;
    private final RequestScopedEmbeddingCache requestScopedCache;

    /**
     * 意图向量缓存: factoryId -> (intentCode -> CachedIntent)
     */
    private final Map<String, Map<String, CachedIntent>> intentVectorCache = new ConcurrentHashMap<>();

    // ==================== 路由阈值配置 ====================

    /**
     * 直接执行阈值 (默认 0.88) - v12.0 降低阈值增加语义路由使用率
     * 经测试，0.88 可以在准确性和效率间取得平衡
     */
    @Value("${cretas.router.threshold.direct-execute:0.88}")
    private double directExecuteThreshold;

    /**
     * Reranking 阈值 (默认 0.70) - v12.0 降低阈值
     * 中等置信度走Reranking，低于此值走完整LLM
     */
    @Value("${cretas.router.threshold.reranking:0.70}")
    private double rerankingThreshold;

    /**
     * 默认返回的候选数量
     */
    @Value("${cretas.router.default-top-n:5}")
    private int defaultTopN;

    // ==================== 统计计数器 ====================

    private final AtomicLong totalRoutes = new AtomicLong(0);
    private final AtomicLong directExecuteCount = new AtomicLong(0);
    private final AtomicLong needRerankingCount = new AtomicLong(0);
    private final AtomicLong needFullLLMCount = new AtomicLong(0);
    private final AtomicLong totalLatencyMs = new AtomicLong(0);

    @PostConstruct
    public void init() {
        log.info("SemanticRouterService initialized with thresholds: directExecute={}, reranking={}",
                directExecuteThreshold, rerankingThreshold);
        // 初始化时从 IntentEmbeddingCacheService 加载向量
        refreshAllCache();
    }

    @Override
    public RouteDecision route(String factoryId, String userInput) {
        return route(factoryId, userInput, defaultTopN);
    }

    @Override
    public RouteDecision route(String factoryId, String userInput, int topN) {
        long startTime = System.currentTimeMillis();

        // 参数校验
        if (userInput == null || userInput.trim().isEmpty()) {
            log.warn("Empty user input for routing");
            return RouteDecision.needFullLLM(0.0, Collections.emptyList(), userInput, 0);
        }

        // 检查 Embedding 服务是否可用
        if (!embeddingClient.isAvailable()) {
            log.warn("Embedding client not available, falling back to full LLM");
            return RouteDecision.needFullLLM(0.0, Collections.emptyList(), userInput, 0);
        }

        try {
            // 1. 获取用户输入的 Embedding (使用请求级缓存)
            float[] inputEmbedding = requestScopedCache.getOrCompute(userInput);

            // 2. 获取合并的意图向量缓存 (全局 + 工厂特定)
            Map<String, CachedIntent> combinedCache = getCombinedCache(factoryId);

            if (combinedCache.isEmpty()) {
                log.warn("No intent vectors cached for factory: {}, refreshing cache", factoryId);
                refreshCache(factoryId);
                combinedCache = getCombinedCache(factoryId);

                if (combinedCache.isEmpty()) {
                    log.error("Still no intent vectors after refresh, falling back to full LLM");
                    return RouteDecision.needFullLLM(0.0, Collections.emptyList(), userInput, 0);
                }
            }

            // 3. 计算与所有意图的余弦相似度
            List<ScoredIntent> scoredIntents = new ArrayList<>();
            for (Map.Entry<String, CachedIntent> entry : combinedCache.entrySet()) {
                CachedIntent cached = entry.getValue();
                double similarity = VectorUtils.cosineSimilarity(inputEmbedding, cached.embedding);
                scoredIntents.add(new ScoredIntent(entry.getKey(), cached.intent, similarity));
            }

            // 4. 按相似度降序排序
            scoredIntents.sort((a, b) -> Double.compare(b.score, a.score));

            // 5. 获取 Top-N 候选
            List<CandidateMatch> candidates = scoredIntents.stream()
                    .limit(topN)
                    .map(si -> CandidateMatch.fromConfig(si.intent, si.score))
                    .collect(Collectors.toList());

            // 6. 获取最高分数和对应意图
            double topScore = scoredIntents.isEmpty() ? 0.0 : scoredIntents.get(0).score;
            AIIntentConfig bestIntent = scoredIntents.isEmpty() ? null : scoredIntents.get(0).intent;

            long latencyMs = System.currentTimeMillis() - startTime;
            totalLatencyMs.addAndGet(latencyMs);
            totalRoutes.incrementAndGet();

            // 7. 三级路由决策
            RouteDecision decision;
            if (topScore >= directExecuteThreshold && bestIntent != null) {
                // 高置信度: 直接执行
                directExecuteCount.incrementAndGet();
                decision = RouteDecision.directExecute(bestIntent, topScore, candidates, userInput, latencyMs);
                log.info("SemanticRouter: DIRECT_EXECUTE for '{}' -> {} (score={}, latency={}ms)",
                        truncate(userInput, 50), bestIntent.getIntentCode(), topScore, latencyMs);

            } else if (topScore >= rerankingThreshold) {
                // 中等置信度: 需要 Reranking
                needRerankingCount.incrementAndGet();
                decision = RouteDecision.needReranking(bestIntent, topScore, candidates, userInput, latencyMs);
                log.info("SemanticRouter: NEED_RERANKING for '{}' -> {} (score={}, latency={}ms)",
                        truncate(userInput, 50),
                        bestIntent != null ? bestIntent.getIntentCode() : "null",
                        topScore, latencyMs);

            } else {
                // 低置信度: 需要完整 LLM
                needFullLLMCount.incrementAndGet();
                decision = RouteDecision.needFullLLM(topScore, candidates, userInput, latencyMs);
                log.info("SemanticRouter: NEED_FULL_LLM for '{}' (topScore={}, latency={}ms)",
                        truncate(userInput, 50), topScore, latencyMs);
            }

            return decision;

        } catch (Exception e) {
            log.error("SemanticRouter error for '{}': {}", truncate(userInput, 50), e.getMessage(), e);
            long latencyMs = System.currentTimeMillis() - startTime;
            return RouteDecision.needFullLLM(0.0, Collections.emptyList(), userInput, latencyMs);
        }
    }

    @Override
    public void refreshCache(String factoryId) {
        log.info("Refreshing semantic router cache for factory: {}", factoryId);

        try {
            // 从数据库加载意图配置
            List<AIIntentConfig> intents = intentConfigRepository.findByFactoryIdAndEnabled(factoryId, true);

            Map<String, CachedIntent> factoryCache = new ConcurrentHashMap<>();

            for (AIIntentConfig intent : intents) {
                // 从 IntentEmbeddingCacheService 获取预计算的 embedding
                Optional<float[]> embeddingOpt = embeddingCacheService.getIntentEmbedding(factoryId, intent.getIntentCode());

                if (embeddingOpt.isPresent()) {
                    factoryCache.put(intent.getIntentCode(), new CachedIntent(intent, embeddingOpt.get()));
                } else {
                    // 如果缓存中没有，尝试计算 (作为 fallback)
                    String keywordText = buildKeywordText(intent);
                    if (!keywordText.isEmpty() && embeddingClient.isAvailable()) {
                        try {
                            float[] embedding = embeddingClient.encode(keywordText);
                            factoryCache.put(intent.getIntentCode(), new CachedIntent(intent, embedding));
                        } catch (Exception e) {
                            log.warn("Failed to compute embedding for intent {}: {}", intent.getIntentCode(), e.getMessage());
                        }
                    }
                }
            }

            intentVectorCache.put(factoryId, factoryCache);
            log.info("Cached {} intent vectors for factory: {}", factoryCache.size(), factoryId);

        } catch (Exception e) {
            log.error("Failed to refresh cache for factory {}: {}", factoryId, e.getMessage(), e);
        }
    }

    @Override
    public void refreshAllCache() {
        log.info("Refreshing semantic router cache for all factories...");

        try {
            // 1. 加载全局意图 (factoryId = null)
            loadGlobalIntents();

            // 2. 获取所有有意图配置的工厂
            List<String> factoryIds = intentConfigRepository.findDistinctFactoryIds();
            for (String factoryId : factoryIds) {
                if (factoryId != null) {
                    refreshCache(factoryId);
                }
            }

            log.info("Semantic router cache refresh completed");

        } catch (Exception e) {
            log.error("Failed to refresh all cache: {}", e.getMessage(), e);
        }
    }

    @Override
    public RouterStatistics getStatistics() {
        int cachedIntentCount = 0;
        for (Map<String, CachedIntent> factoryCache : intentVectorCache.values()) {
            cachedIntentCount += factoryCache.size();
        }

        double avgLatency = totalRoutes.get() > 0 ?
                (double) totalLatencyMs.get() / totalRoutes.get() : 0.0;

        return new RouterStatisticsImpl(
                totalRoutes.get(),
                directExecuteCount.get(),
                needRerankingCount.get(),
                needFullLLMCount.get(),
                cachedIntentCount,
                avgLatency
        );
    }

    @Override
    public boolean isAvailable() {
        return embeddingClient.isAvailable() && !intentVectorCache.isEmpty();
    }

    // ==================== Private Methods ====================

    /**
     * 加载全局意图 (factoryId = null)
     */
    private void loadGlobalIntents() {
        try {
            List<AIIntentConfig> globalIntents = intentConfigRepository.findGlobalIntents();

            Map<String, CachedIntent> globalCache = new ConcurrentHashMap<>();

            for (AIIntentConfig intent : globalIntents) {
                // 从 IntentEmbeddingCacheService 获取预计算的 embedding
                // 全局意图存储在 "*" key 下
                Optional<float[]> embeddingOpt = embeddingCacheService.getIntentEmbedding("*", intent.getIntentCode());

                if (embeddingOpt.isPresent()) {
                    globalCache.put(intent.getIntentCode(), new CachedIntent(intent, embeddingOpt.get()));
                } else {
                    String keywordText = buildKeywordText(intent);
                    if (!keywordText.isEmpty() && embeddingClient.isAvailable()) {
                        try {
                            float[] embedding = embeddingClient.encode(keywordText);
                            globalCache.put(intent.getIntentCode(), new CachedIntent(intent, embedding));
                        } catch (Exception e) {
                            log.warn("Failed to compute embedding for global intent {}: {}", intent.getIntentCode(), e.getMessage());
                        }
                    }
                }
            }

            intentVectorCache.put("*", globalCache);
            log.info("Cached {} global intent vectors", globalCache.size());

        } catch (Exception e) {
            log.error("Failed to load global intents: {}", e.getMessage(), e);
        }
    }

    /**
     * 获取合并的意图缓存 (全局 + 工厂特定)
     */
    private Map<String, CachedIntent> getCombinedCache(String factoryId) {
        Map<String, CachedIntent> combined = new HashMap<>();

        // 1. 先加载全局意图
        Map<String, CachedIntent> globalCache = intentVectorCache.get("*");
        if (globalCache != null) {
            combined.putAll(globalCache);
        }

        // 2. 再加载工厂特定意图 (会覆盖同名全局意图)
        if (factoryId != null) {
            Map<String, CachedIntent> factoryCache = intentVectorCache.get(factoryId);
            if (factoryCache != null) {
                combined.putAll(factoryCache);
            }
        }

        return combined;
    }

    /**
     * 构建关键词文本用于 Embedding
     */
    private String buildKeywordText(AIIntentConfig intent) {
        StringBuilder sb = new StringBuilder();

        // 添加意图描述
        if (intent.getDescription() != null && !intent.getDescription().isEmpty()) {
            sb.append(intent.getDescription()).append(" ");
        }

        // 添加关键词
        List<String> keywords = intent.getKeywordsList();
        if (keywords != null && !keywords.isEmpty()) {
            sb.append(String.join(" ", keywords));
        }

        return sb.toString().trim();
    }

    /**
     * 截断字符串
     */
    private String truncate(String str, int maxLength) {
        if (str == null) return "";
        return str.length() > maxLength ? str.substring(0, maxLength) + "..." : str;
    }

    // ==================== Inner Classes ====================

    /**
     * 缓存的意图信息
     */
    private static class CachedIntent {
        final AIIntentConfig intent;
        final float[] embedding;

        CachedIntent(AIIntentConfig intent, float[] embedding) {
            this.intent = intent;
            this.embedding = embedding;
        }
    }

    /**
     * 带分数的意图
     */
    private static class ScoredIntent {
        final String intentCode;
        final AIIntentConfig intent;
        final double score;

        ScoredIntent(String intentCode, AIIntentConfig intent, double score) {
            this.intentCode = intentCode;
            this.intent = intent;
            this.score = score;
        }
    }

    /**
     * 路由统计实现类
     */
    @RequiredArgsConstructor
    private static class RouterStatisticsImpl implements RouterStatistics {
        private final long totalRoutes;
        private final long directExecuteCount;
        private final long needRerankingCount;
        private final long needFullLLMCount;
        private final int cachedIntentCount;
        private final double averageLatencyMs;

        @Override
        public long getTotalRoutes() { return totalRoutes; }

        @Override
        public long getDirectExecuteCount() { return directExecuteCount; }

        @Override
        public long getNeedRerankingCount() { return needRerankingCount; }

        @Override
        public long getNeedFullLLMCount() { return needFullLLMCount; }

        @Override
        public int getCachedIntentCount() { return cachedIntentCount; }

        @Override
        public double getAverageLatencyMs() { return averageLatencyMs; }
    }
}
