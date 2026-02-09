package com.cretas.aims.service;

import com.cretas.aims.entity.intent.KeywordEffectiveness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 关键词效果追踪服务接口
 */
public interface KeywordEffectivenessService {

    /**
     * 记录用户反馈
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param keyword 关键词
     * @param isPositive 是否正向反馈
     */
    void recordFeedback(String factoryId, String intentCode, String keyword, boolean isPositive);

    /**
     * 获取关键词效果记录
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param keyword 关键词
     * @return 效果记录
     */
    Optional<KeywordEffectiveness> getKeywordEffectiveness(
        String factoryId, String intentCode, String keyword);

    /**
     * 获取意图的有效关键词列表
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param threshold 效果阈值
     * @return 有效关键词列表
     */
    List<KeywordEffectiveness> getEffectiveKeywords(
        String factoryId, String intentCode, BigDecimal threshold);

    /**
     * 创建或更新关键词效果记录
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param keyword 关键词
     * @param source 来源 (MANUAL/AUTO_LEARNED/PROMOTED)
     * @param initialWeight 初始权重
     * @return 效果记录
     */
    KeywordEffectiveness createOrUpdateKeyword(
        String factoryId, String intentCode, String keyword,
        String source, BigDecimal initialWeight);

    /**
     * 检查关键词是否已存在于其他意图
     *
     * @param factoryId 工厂ID
     * @param keyword 关键词
     * @param excludeIntentCode 排除的意图代码
     * @return true 如果存在于其他意图
     */
    boolean existsInOtherIntent(String factoryId, String keyword, String excludeIntentCode);

    /**
     * 清理低效关键词
     *
     * @param factoryId 工厂ID
     * @param threshold 清理阈值
     * @param minNegative 最小负反馈数
     * @return 清理的关键词数量
     */
    int cleanupLowEffectivenessKeywords(String factoryId, BigDecimal threshold, int minNegative);

    /**
     * 重算所有关键词的 specificity
     */
    void recalculateAllSpecificity();

    /**
     * 获取工厂某意图的关键词数量
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @return 关键词数量
     */
    long countKeywords(String factoryId, String intentCode);
}
