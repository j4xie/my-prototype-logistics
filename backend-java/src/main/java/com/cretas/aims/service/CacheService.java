package com.cretas.aims.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Redis缓存服务
 * 用于AI分析结果的缓存，减少重复调用AI服务
 * 支持Redis不可用时使用内存缓存
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-03
 */
@Service
public class CacheService {
    private static final Logger log = LoggerFactory.getLogger(CacheService.class);

    private final RedisTemplate<String, Object> redisTemplate;
    private final Map<String, Object> memoryCache;
    private final boolean useMemoryCache;

    // Default constructor for memory-only cache
    public CacheService() {
        this.redisTemplate = null;
        this.memoryCache = new ConcurrentHashMap<>();
        this.useMemoryCache = true;
        log.warn("使用内存临时缓存服务 (Redis不可用)");
    }

    // Constructor with optional RedisTemplate
    @Autowired(required = false)
    public CacheService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.memoryCache = new ConcurrentHashMap<>();
        this.useMemoryCache = (redisTemplate == null);

        if (useMemoryCache) {
            log.warn("使用内存临时缓存服务 (Redis不可用)");
        } else {
            log.info("使用Redis缓存服务");
        }
    }

    /**
     * AI分析缓存前缀
     */
    private static final String AI_ANALYSIS_PREFIX = "ai:analysis:";

    /**
     * 会话历史缓存前缀
     */
    private static final String SESSION_HISTORY_PREFIX = "ai:session:";

    /**
     * 默认缓存时间：5分钟
     */
    private static final long DEFAULT_CACHE_MINUTES = 5;

    /**
     * 会话缓存时间：30分钟
     */
    private static final long SESSION_CACHE_MINUTES = 30;

    /**
     * 获取AI分析缓存
     *
     * @param factoryId 工厂ID
     * @param batchId   批次ID
     * @return 缓存的分析结果，如果不存在返回null
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getAIAnalysisCache(String factoryId, String batchId) {
        try {
            String key = buildAIAnalysisKey(factoryId, batchId);

            if (useMemoryCache) {
                Object cached = memoryCache.get(key);
                if (cached != null && cached instanceof Map) {
                    log.info("命中内存缓存: factoryId={}, batchId={}", factoryId, batchId);
                    return (Map<String, Object>) cached;
                }
            } else {
                Object cached = redisTemplate.opsForValue().get(key);
                if (cached != null && cached instanceof Map) {
                    log.info("命中Redis缓存: factoryId={}, batchId={}", factoryId, batchId);
                    return (Map<String, Object>) cached;
                }
            }

            log.debug("未命中缓存: factoryId={}, batchId={}", factoryId, batchId);
            return null;
        } catch (Exception e) {
            log.warn("获取AI分析缓存失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 保存AI分析缓存
     *
     * @param factoryId 工厂ID
     * @param batchId   批次ID
     * @param result    分析结果
     */
    public void setAIAnalysisCache(String factoryId, String batchId, Map<String, Object> result) {
        try {
            String key = buildAIAnalysisKey(factoryId, batchId);

            if (useMemoryCache) {
                memoryCache.put(key, result);
                log.info("保存内存缓存: factoryId={}, batchId={}", factoryId, batchId);
            } else {
                redisTemplate.opsForValue().set(key, result, DEFAULT_CACHE_MINUTES, TimeUnit.MINUTES);
                log.info("保存Redis缓存: factoryId={}, batchId={}, ttl={}分钟",
                        factoryId, batchId, DEFAULT_CACHE_MINUTES);
            }
        } catch (Exception e) {
            log.warn("保存AI分析缓存失败: {}", e.getMessage());
        }
    }

    /**
     * 获取会话历史
     *
     * @param sessionId 会话ID
     * @return 会话历史，如果不存在返回null
     */
    public Object getSessionHistory(String sessionId) {
        try {
            String key = buildSessionKey(sessionId);

            if (useMemoryCache) {
                Object history = memoryCache.get(key);
                if (history != null) {
                    log.info("获取会话历史(内存): sessionId={}", sessionId);
                    return history;
                }
            } else {
                Object history = redisTemplate.opsForValue().get(key);
                if (history != null) {
                    log.info("获取会话历史(Redis): sessionId={}", sessionId);
                    return history;
                }
            }

            return null;
        } catch (Exception e) {
            log.warn("获取会话历史失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 保存会话历史
     *
     * @param sessionId 会话ID
     * @param history   会话历史
     */
    public void setSessionHistory(String sessionId, Object history) {
        try {
            String key = buildSessionKey(sessionId);

            if (useMemoryCache) {
                memoryCache.put(key, history);
                log.info("保存会话历史(内存): sessionId={}", sessionId);
            } else {
                redisTemplate.opsForValue().set(key, history, SESSION_CACHE_MINUTES, TimeUnit.MINUTES);
                log.info("保存会话历史(Redis): sessionId={}, ttl={}分钟", sessionId, SESSION_CACHE_MINUTES);
            }
        } catch (Exception e) {
            log.warn("保存会话历史失败: {}", e.getMessage());
        }
    }

    /**
     * 清除AI分析缓存
     *
     * @param factoryId 工厂ID
     * @param batchId   批次ID
     */
    public void clearAIAnalysisCache(String factoryId, String batchId) {
        try {
            String key = buildAIAnalysisKey(factoryId, batchId);

            if (useMemoryCache) {
                memoryCache.remove(key);
                log.info("清除AI分析缓存(内存): factoryId={}, batchId={}", factoryId, batchId);
            } else {
                redisTemplate.delete(key);
                log.info("清除AI分析缓存(Redis): factoryId={}, batchId={}", factoryId, batchId);
            }
        } catch (Exception e) {
            log.warn("清除AI分析缓存失败: {}", e.getMessage());
        }
    }

    /**
     * 清除会话历史
     *
     * @param sessionId 会话ID
     */
    public void clearSessionHistory(String sessionId) {
        try {
            String key = buildSessionKey(sessionId);

            if (useMemoryCache) {
                memoryCache.remove(key);
                log.info("清除会话历史(内存): sessionId={}", sessionId);
            } else {
                redisTemplate.delete(key);
                log.info("清除会话历史(Redis): sessionId={}", sessionId);
            }
        } catch (Exception e) {
            log.warn("清除会话历史失败: {}", e.getMessage());
        }
    }

    /**
     * 构建AI分析缓存Key
     */
    private String buildAIAnalysisKey(String factoryId, String batchId) {
        return AI_ANALYSIS_PREFIX + factoryId + ":" + batchId;
    }

    /**
     * 构建会话历史Key
     */
    private String buildSessionKey(String sessionId) {
        return SESSION_HISTORY_PREFIX + sessionId;
    }

    /**
     * 检查Redis连接状态
     *
     * @return true表示连接正常
     */
    public boolean isRedisAvailable() {
        if (useMemoryCache) {
            return false;
        }
        try {
            redisTemplate.opsForValue().get("health_check");
            return true;
        } catch (Exception e) {
            log.warn("Redis连接异常: {}", e.getMessage());
            return false;
        }
    }
}
