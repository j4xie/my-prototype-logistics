package com.cretas.aims.service;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.cache.SemanticCacheHit;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.cache.SemanticCacheConfig;

import java.util.Optional;

/**
 * 语义缓存服务接口
 * 提供基于语义相似度的意图识别结果缓存
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
public interface SemanticCacheService {

    /**
     * 查询缓存
     *
     * 查询流程：
     * 1. 精确匹配：计算输入哈希，查找完全相同的输入
     * 2. 语义匹配：生成输入向量，在候选集中找相似度最高的
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @return 缓存命中结果 (包含命中类型和缓存数据)
     */
    SemanticCacheHit queryCache(String factoryId, String userInput);

    /**
     * 缓存意图识别和执行结果
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param matchResult 意图匹配结果
     * @param executeResponse 执行结果
     */
    void cacheResult(String factoryId, String userInput,
                     IntentMatchResult matchResult, IntentExecuteResponse executeResponse);

    /**
     * 仅缓存意图识别结果 (不含执行结果)
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param matchResult 意图匹配结果
     */
    void cacheIntentResult(String factoryId, String userInput, IntentMatchResult matchResult);

    /**
     * 使指定意图的缓存失效
     * (意图配置更新时调用)
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @return 失效的缓存数量
     */
    int invalidateByIntentCode(String factoryId, String intentCode);

    /**
     * 使工厂的所有缓存失效
     *
     * @param factoryId 工厂ID
     * @return 失效的缓存数量
     */
    int invalidateByFactory(String factoryId);

    /**
     * 清理过期缓存
     *
     * @return 清理的缓存数量
     */
    int cleanupExpiredCaches();

    /**
     * 获取工厂的缓存配置
     *
     * @param factoryId 工厂ID
     * @return 缓存配置
     */
    SemanticCacheConfig getConfig(String factoryId);

    /**
     * 更新工厂的缓存配置
     *
     * @param factoryId 工厂ID
     * @param config 新配置
     * @return 更新后的配置
     */
    SemanticCacheConfig updateConfig(String factoryId, SemanticCacheConfig config);

    /**
     * 检查语义缓存是否启用
     *
     * @param factoryId 工厂ID
     * @return 是否启用
     */
    boolean isEnabled(String factoryId);

    /**
     * 获取缓存统计信息
     *
     * @param factoryId 工厂ID
     * @return 统计信息
     */
    CacheStats getStats(String factoryId);

    /**
     * 缓存统计信息
     */
    interface CacheStats {
        long getTotalEntries();
        long getValidEntries();
        long getTotalHits();
        long getExactHits();
        long getSemanticHits();
        long getMisses();
        double getHitRate();
        double getAverageHitLatencyMs();
    }
}
