package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.cache.SemanticCacheHit;
import com.cretas.aims.util.VectorUtils;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.cache.SemanticCache;
import com.cretas.aims.entity.cache.SemanticCacheConfig;
import com.cretas.aims.repository.SemanticCacheConfigRepository;
import com.cretas.aims.repository.SemanticCacheRepository;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.RequestScopedEmbeddingCache;
import com.cretas.aims.service.SemanticCacheService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 语义缓存服务实现
 * 提供基于语义相似度的意图识别结果缓存
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SemanticCacheServiceImpl implements SemanticCacheService {

    private final SemanticCacheRepository cacheRepository;
    private final SemanticCacheConfigRepository configRepository;
    private final EmbeddingClient embeddingClient;
    private final RequestScopedEmbeddingCache requestScopedCache;
    private final ObjectMapper objectMapper;

    // 统计计数器
    private final AtomicLong totalHits = new AtomicLong(0);
    private final AtomicLong exactHits = new AtomicLong(0);
    private final AtomicLong semanticHits = new AtomicLong(0);
    private final AtomicLong misses = new AtomicLong(0);
    private final AtomicLong totalLatencyMs = new AtomicLong(0);
    private final AtomicLong queryCount = new AtomicLong(0);

    @Override
    public SemanticCacheHit queryCache(String factoryId, String userInput) {
        long startTime = System.currentTimeMillis();

        try {
            // 1. 获取配置
            SemanticCacheConfig config = getEffectiveConfig(factoryId);
            if (!config.isEnabled()) {
                return SemanticCacheHit.miss(System.currentTimeMillis() - startTime);
            }

            // 2. 规范化输入
            String normalizedInput = normalizeInput(userInput);
            String inputHash = computeHash(normalizedInput);

            // 3. 精确匹配 (哈希)
            var exactMatch = cacheRepository.findByFactoryIdAndInputHashAndExpiresAtAfter(
                factoryId, inputHash, LocalDateTime.now());

            if (exactMatch.isPresent()) {
                SemanticCache cache = exactMatch.get();
                updateHitStats(cache);
                long latency = System.currentTimeMillis() - startTime;

                exactHits.incrementAndGet();
                totalHits.incrementAndGet();
                recordLatency(latency);

                log.debug("Exact cache hit for factory={}, hash={}, latency={}ms",
                    factoryId, inputHash, latency);

                return SemanticCacheHit.exactHit(
                    cache.getId(),
                    cache.getIntentCode(),
                    cache.getIntentResult(),
                    cache.getExecutionResult(),
                    latency
                );
            }

            // 4. 语义匹配 (向量相似度)
            if (embeddingClient.isAvailable()) {
                SemanticCacheHit semanticHit = findSemanticMatch(
                    factoryId, normalizedInput, config, startTime);
                if (semanticHit.isHit()) {
                    return semanticHit;
                }
            }

            // 5. 未命中
            misses.incrementAndGet();
            long latency = System.currentTimeMillis() - startTime;
            recordLatency(latency);

            return SemanticCacheHit.miss(latency);

        } catch (Exception e) {
            log.error("Cache query failed for factory={}: {}", factoryId, e.getMessage(), e);
            misses.incrementAndGet();
            return SemanticCacheHit.miss(System.currentTimeMillis() - startTime);
        }
    }

    @Override
    @Transactional
    public void cacheResult(String factoryId, String userInput,
                            IntentMatchResult matchResult, IntentExecuteResponse executeResponse) {
        try {
            SemanticCacheConfig config = getEffectiveConfig(factoryId);
            if (!config.isEnabled()) {
                return;
            }

            String normalizedInput = normalizeInput(userInput);
            String inputHash = computeHash(normalizedInput);

            // 检查是否已存在
            var existing = cacheRepository.findByFactoryIdAndInputHash(factoryId, inputHash);
            if (existing.isPresent()) {
                // 更新现有缓存
                SemanticCache cache = existing.get();
                cache.setIntentResult(toJson(matchResult));
                cache.setExecutionResult(toJson(executeResponse));
                cache.setConfidence(toBigDecimal(matchResult.getConfidence()));
                cache.setExpiresAt(LocalDateTime.now().plusHours(config.getCacheTtlHours()));
                cacheRepository.save(cache);
                log.debug("Updated cache for factory={}, hash={}", factoryId, inputHash);
                return;
            }

            // 创建新缓存
            byte[] embeddingVector = null;
            if (embeddingClient.isAvailable()) {
                try {
                    float[] embedding = requestScopedCache.getOrCompute(normalizedInput);
                    embeddingVector = serializeEmbedding(embedding);
                } catch (Exception e) {
                    log.warn("Failed to generate embedding for caching: {}", e.getMessage());
                }
            }

            SemanticCache cache = SemanticCache.builder()
                .factoryId(factoryId)
                .normalizedInput(normalizedInput)
                .originalInput(userInput)
                .inputHash(inputHash)
                .embeddingVector(embeddingVector)
                .intentCode(matchResult.getBestMatch() != null ?
                    matchResult.getBestMatch().getIntentCode() : null)
                .intentResult(toJson(matchResult))
                .executionResult(toJson(executeResponse))
                .confidence(toBigDecimal(matchResult.getConfidence()))
                .expiresAt(LocalDateTime.now().plusHours(config.getCacheTtlHours()))
                .build();

            cacheRepository.save(cache);
            log.debug("Created cache for factory={}, hash={}", factoryId, inputHash);

        } catch (Exception e) {
            log.error("Failed to cache result for factory={}: {}", factoryId, e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public void cacheIntentResult(String factoryId, String userInput, IntentMatchResult matchResult) {
        try {
            SemanticCacheConfig config = getEffectiveConfig(factoryId);
            if (!config.isEnabled()) {
                return;
            }

            String normalizedInput = normalizeInput(userInput);
            String inputHash = computeHash(normalizedInput);

            // 检查是否已存在
            var existing = cacheRepository.findByFactoryIdAndInputHash(factoryId, inputHash);
            if (existing.isPresent()) {
                return; // 已存在，不重复缓存
            }

            byte[] embeddingVector = null;
            if (embeddingClient.isAvailable()) {
                try {
                    float[] embedding = requestScopedCache.getOrCompute(normalizedInput);
                    embeddingVector = serializeEmbedding(embedding);
                } catch (Exception e) {
                    log.warn("Failed to generate embedding: {}", e.getMessage());
                }
            }

            SemanticCache cache = SemanticCache.builder()
                .factoryId(factoryId)
                .normalizedInput(normalizedInput)
                .originalInput(userInput)
                .inputHash(inputHash)
                .embeddingVector(embeddingVector)
                .intentCode(matchResult.getBestMatch() != null ?
                    matchResult.getBestMatch().getIntentCode() : null)
                .intentResult(toJson(matchResult))
                .confidence(toBigDecimal(matchResult.getConfidence()))
                .expiresAt(LocalDateTime.now().plusHours(config.getCacheTtlHours()))
                .build();

            cacheRepository.save(cache);

        } catch (Exception e) {
            log.error("Failed to cache intent result: {}", e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public int invalidateByIntentCode(String factoryId, String intentCode) {
        int count = cacheRepository.deleteByFactoryIdAndIntentCode(factoryId, intentCode);
        log.info("Invalidated {} cache entries for factory={}, intentCode={}",
            count, factoryId, intentCode);
        return count;
    }

    @Override
    @Transactional
    public int invalidateByFactory(String factoryId) {
        int count = cacheRepository.deleteByFactoryId(factoryId);
        log.info("Invalidated {} cache entries for factory={}", count, factoryId);
        return count;
    }

    @Override
    @Transactional
    @Scheduled(cron = "0 0 3 * * ?") // 每天凌晨3点执行
    public int cleanupExpiredCaches() {
        int count = cacheRepository.deleteExpiredCaches(LocalDateTime.now());
        if (count > 0) {
            log.info("Cleaned up {} expired cache entries", count);
        }
        return count;
    }

    @Override
    public SemanticCacheConfig getConfig(String factoryId) {
        return getEffectiveConfig(factoryId);
    }

    @Override
    @Transactional
    public SemanticCacheConfig updateConfig(String factoryId, SemanticCacheConfig config) {
        config.setFactoryId(factoryId);
        return configRepository.save(config);
    }

    @Override
    public boolean isEnabled(String factoryId) {
        Boolean enabled = configRepository.isEnabledForFactory(factoryId);
        return enabled != null && enabled;
    }

    @Override
    public CacheStats getStats(String factoryId) {
        long total = cacheRepository.countByFactoryId(factoryId);
        long valid = cacheRepository.countValidByFactoryId(factoryId, LocalDateTime.now());

        return new CacheStatsImpl(
            total,
            valid,
            totalHits.get(),
            exactHits.get(),
            semanticHits.get(),
            misses.get(),
            queryCount.get() > 0 ?
                (double) totalHits.get() / queryCount.get() : 0.0,
            queryCount.get() > 0 ?
                (double) totalLatencyMs.get() / queryCount.get() : 0.0
        );
    }

    // ========== Private Methods ==========

    private SemanticCacheHit findSemanticMatch(String factoryId, String normalizedInput,
                                                SemanticCacheConfig config, long startTime) {
        try {
            // 获取候选缓存条目
            List<SemanticCache> candidates = cacheRepository.findValidCachesByFactoryId(
                factoryId, LocalDateTime.now());

            if (candidates.isEmpty()) {
                return SemanticCacheHit.miss(System.currentTimeMillis() - startTime);
            }

            // 生成查询向量 (使用请求级缓存)
            float[] queryEmbedding = requestScopedCache.getOrCompute(normalizedInput);

            // 计算相似度，找最佳匹配
            SemanticCache bestMatch = null;
            double bestScore = 0.0;

            for (SemanticCache candidate : candidates) {
                if (candidate.getEmbeddingVector() == null) {
                    continue;
                }

                float[] candidateEmbedding = deserializeEmbedding(candidate.getEmbeddingVector());
                double similarity = VectorUtils.cosineSimilarity(queryEmbedding, candidateEmbedding);

                if (similarity >= config.getSimilarityThresholdAsDouble() && similarity > bestScore) {
                    bestScore = similarity;
                    bestMatch = candidate;
                }
            }

            if (bestMatch != null) {
                updateHitStats(bestMatch);
                long latency = System.currentTimeMillis() - startTime;

                semanticHits.incrementAndGet();
                totalHits.incrementAndGet();
                recordLatency(latency);

                log.debug("Semantic cache hit for factory={}, similarity={:.3f}, latency={}ms",
                    factoryId, bestScore, latency);

                return SemanticCacheHit.semanticHit(
                    bestMatch.getId(),
                    bestScore,
                    bestMatch.getIntentCode(),
                    bestMatch.getIntentResult(),
                    bestMatch.getExecutionResult(),
                    latency
                );
            }

            return SemanticCacheHit.miss(System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.warn("Semantic matching failed: {}", e.getMessage());
            return SemanticCacheHit.miss(System.currentTimeMillis() - startTime);
        }
    }

    private SemanticCacheConfig getEffectiveConfig(String factoryId) {
        return configRepository.findByFactoryId(factoryId)
            .or(() -> configRepository.findGlobalConfig())
            .orElseGet(SemanticCacheConfig::defaultConfig);
    }

    private void updateHitStats(SemanticCache cache) {
        cache.setHitCount(cache.getHitCount() + 1);
        cache.setLastHitAt(LocalDateTime.now());
        cacheRepository.save(cache);
    }

    private void recordLatency(long latencyMs) {
        totalLatencyMs.addAndGet(latencyMs);
        queryCount.incrementAndGet();
    }

    private String normalizeInput(String input) {
        if (input == null) {
            return "";
        }
        // 移除多余空白、转小写、标准化
        return input.trim()
            .replaceAll("\\s+", " ")
            .toLowerCase();
    }

    private String computeHash(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String toJson(Object obj) {
        if (obj == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize object to JSON", e);
            return null;
        }
    }

    private BigDecimal toBigDecimal(Double value) {
        if (value == null) {
            return null;
        }
        return BigDecimal.valueOf(value);
    }

    private byte[] serializeEmbedding(float[] embedding) {
        ByteBuffer buffer = ByteBuffer.allocate(embedding.length * 4);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        for (float f : embedding) {
            buffer.putFloat(f);
        }
        return buffer.array();
    }

    private float[] deserializeEmbedding(byte[] bytes) {
        ByteBuffer buffer = ByteBuffer.wrap(bytes);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        float[] embedding = new float[bytes.length / 4];
        for (int i = 0; i < embedding.length; i++) {
            embedding[i] = buffer.getFloat();
        }
        return embedding;
    }

    // ========== CacheStats Implementation ==========

    @RequiredArgsConstructor
    private static class CacheStatsImpl implements CacheStats {
        private final long totalEntries;
        private final long validEntries;
        private final long totalHits;
        private final long exactHits;
        private final long semanticHits;
        private final long misses;
        private final double hitRate;
        private final double averageHitLatencyMs;

        @Override
        public long getTotalEntries() {
            return totalEntries;
        }

        @Override
        public long getValidEntries() {
            return validEntries;
        }

        @Override
        public long getTotalHits() {
            return totalHits;
        }

        @Override
        public long getExactHits() {
            return exactHits;
        }

        @Override
        public long getSemanticHits() {
            return semanticHits;
        }

        @Override
        public long getMisses() {
            return misses;
        }

        @Override
        public double getHitRate() {
            return hitRate;
        }

        @Override
        public double getAverageHitLatencyMs() {
            return averageHitLatencyMs;
        }
    }
}
