package com.cretas.aims.service;

import com.cretas.aims.dto.intent.UnifiedSemanticMatch;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.learning.LearnedExpression;

import java.util.List;
import java.util.Optional;

/**
 * 意图 Embedding 缓存服务
 * 预计算并缓存所有意图的关键词向量，加速语义匹配
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-05
 */
public interface IntentEmbeddingCacheService {

    /**
     * 初始化缓存，预计算所有意图的 embedding
     */
    void initializeCache();

    /**
     * 刷新单个工厂的意图缓存
     *
     * @param factoryId 工厂ID
     */
    void refreshFactoryCache(String factoryId);

    /**
     * 刷新单个意图的缓存
     *
     * @param factoryId  工厂ID
     * @param intentCode 意图代码
     */
    void refreshIntentCache(String factoryId, String intentCode);

    /**
     * 获取意图的预计算 embedding
     *
     * @param factoryId  工厂ID
     * @param intentCode 意图代码
     * @return embedding 向量，如果不存在返回 empty
     */
    Optional<float[]> getIntentEmbedding(String factoryId, String intentCode);

    /**
     * 计算用户输入与所有意图的语义相似度
     *
     * @param factoryId  工厂ID
     * @param userInput  用户输入
     * @return 匹配结果列表，按相似度降序排列
     */
    List<SemanticMatchResult> matchIntents(String factoryId, String userInput);

    /**
     * 清除工厂的缓存
     *
     * @param factoryId 工厂ID
     */
    void clearFactoryCache(String factoryId);

    /**
     * 获取缓存统计信息
     *
     * @return 统计信息
     */
    CacheStatistics getStatistics();

    // ========== 统一语义搜索 (意图配置 + 已学习表达) ==========

    /**
     * 统一语义匹配 (Layer 4)
     *
     * 同时搜索:
     * - 意图配置 (AIIntentConfig) 的 embedding
     * - 已学习表达 (LearnedExpression) 的 embedding
     *
     * @param factoryId  工厂ID
     * @param userInput  用户输入
     * @param minSimilarity 最低相似度阈值 (推荐 0.72)
     * @return 匹配结果列表，按相似度降序排列
     */
    List<UnifiedSemanticMatch> matchIntentsWithExpressions(String factoryId, String userInput, double minSimilarity);

    /**
     * 缓存学习的表达 embedding
     *
     * @param expression 学习的表达
     */
    void cacheExpression(LearnedExpression expression);

    /**
     * 批量缓存表达 embedding
     *
     * @param expressions 表达列表
     */
    void cacheExpressions(List<LearnedExpression> expressions);

    /**
     * 刷新表达缓存
     *
     * @param factoryId 工厂ID
     */
    void refreshExpressionCache(String factoryId);

    /**
     * 移除表达缓存
     *
     * @param expressionId 表达ID
     */
    void removeExpressionCache(String expressionId);

    /**
     * 语义匹配结果
     */
    interface SemanticMatchResult {
        String getIntentCode();
        AIIntentConfig getIntent();
        double getSimilarity();
        MatchLevel getMatchLevel();
    }

    /**
     * 匹配级别
     */
    enum MatchLevel {
        HIGH,      // ≥0.85 高置信
        MEDIUM,    // 0.72-0.85 中置信
        LOW,       // 0.60-0.72 低置信
        NONE       // <0.60 无匹配
    }

    /**
     * 缓存统计
     */
    interface CacheStatistics {
        int getTotalIntents();
        int getCachedIntents();
        long getCacheHits();
        long getCacheMisses();
        double getAverageMatchLatencyMs();
    }
}
