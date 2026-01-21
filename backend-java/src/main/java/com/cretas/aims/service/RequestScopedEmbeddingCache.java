package com.cretas.aims.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 请求级 Embedding 缓存
 *
 * 解决同一请求中对相同输入重复计算 Embedding 的问题。
 * 使用 ThreadLocal 实现请求隔离，每个请求线程有独立的缓存。
 *
 * 使用方式:
 * 1. 调用 getOrCompute(text) 获取或计算 embedding
 * 2. 请求结束时调用 clear() 清理缓存 (建议在 Filter 中处理)
 *
 * 性能优化:
 * - 单次请求可能调用 encode 2-7 次
 * - 使用缓存后，相同输入只计算 1 次
 * - 768 维 float[] 约占 3KB，单次请求缓存不会造成内存压力
 */
@Component
public class RequestScopedEmbeddingCache {

    private static final Logger log = LoggerFactory.getLogger(RequestScopedEmbeddingCache.class);

    private final EmbeddingClient embeddingClient;

    /**
     * ThreadLocal 缓存，key = normalized input text, value = embedding vector
     */
    private final ThreadLocal<Map<String, float[]>> requestCache =
        ThreadLocal.withInitial(HashMap::new);

    /**
     * 请求级统计
     */
    private final ThreadLocal<CacheStats> requestStats =
        ThreadLocal.withInitial(CacheStats::new);

    public RequestScopedEmbeddingCache(@Lazy EmbeddingClient embeddingClient) {
        this.embeddingClient = embeddingClient;
    }

    /**
     * 获取或计算 embedding
     * 如果缓存中存在，直接返回；否则计算并缓存
     *
     * @param text 输入文本
     * @return embedding 向量 (768维)
     */
    public float[] getOrCompute(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new float[0];
        }

        String normalizedKey = normalizeKey(text);
        Map<String, float[]> cache = requestCache.get();
        CacheStats stats = requestStats.get();

        float[] cached = cache.get(normalizedKey);
        if (cached != null) {
            stats.hits++;
            log.debug("Embedding cache HIT for: '{}' (total hits: {})",
                truncate(text, 30), stats.hits);
            return cached;
        }

        // 计算 embedding
        stats.misses++;
        float[] embedding = embeddingClient.encode(text);
        cache.put(normalizedKey, embedding);

        log.debug("Embedding cache MISS for: '{}' (computed, total misses: {})",
            truncate(text, 30), stats.misses);

        return embedding;
    }

    /**
     * 批量获取或计算 embedding
     *
     * @param texts 输入文本列表
     * @return embedding 向量列表
     */
    public float[][] batchGetOrCompute(String[] texts) {
        if (texts == null || texts.length == 0) {
            return new float[0][];
        }

        float[][] results = new float[texts.length][];
        for (int i = 0; i < texts.length; i++) {
            results[i] = getOrCompute(texts[i]);
        }
        return results;
    }

    /**
     * 清理当前请求的缓存
     * 建议在请求结束时调用（如 Filter 或 Interceptor）
     */
    public void clear() {
        CacheStats stats = requestStats.get();
        if (stats.hits > 0 || stats.misses > 0) {
            log.debug("Request embedding cache cleared. Stats: hits={}, misses={}, saved={}",
                stats.hits, stats.misses, stats.hits);
        }
        requestCache.remove();
        requestStats.remove();
    }

    /**
     * 获取当前请求的缓存大小
     */
    public int getCacheSize() {
        return requestCache.get().size();
    }

    /**
     * 获取当前请求的缓存命中统计
     */
    public CacheStats getStats() {
        return requestStats.get();
    }

    /**
     * 预热缓存 - 批量预计算常用 embedding
     */
    public void warmUp(String... texts) {
        for (String text : texts) {
            getOrCompute(text);
        }
    }

    /**
     * 直接使用 embeddingClient (绕过缓存)
     * 用于明确知道不需要缓存的场景
     */
    public float[] computeWithoutCache(String text) {
        return embeddingClient.encode(text);
    }

    /**
     * 归一化缓存 key
     * 去除多余空格，转小写
     */
    private String normalizeKey(String text) {
        return text.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    /**
     * 截断文本用于日志
     */
    private String truncate(String text, int maxLen) {
        if (text.length() <= maxLen) {
            return text;
        }
        return text.substring(0, maxLen) + "...";
    }

    /**
     * 缓存统计
     */
    public static class CacheStats {
        public int hits = 0;
        public int misses = 0;

        public int getTotal() {
            return hits + misses;
        }

        public double getHitRate() {
            int total = getTotal();
            return total == 0 ? 0.0 : (double) hits / total;
        }

        @Override
        public String toString() {
            return String.format("CacheStats{hits=%d, misses=%d, hitRate=%.2f%%}",
                hits, misses, getHitRate() * 100);
        }
    }
}
