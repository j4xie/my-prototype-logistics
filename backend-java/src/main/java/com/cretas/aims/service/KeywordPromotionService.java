package com.cretas.aims.service;

import com.cretas.aims.entity.intent.KeywordFactoryAdoption;

import java.math.BigDecimal;
import java.util.List;

/**
 * 关键词晋升服务接口
 * 负责工厂级关键词到全局关键词的晋升逻辑
 */
public interface KeywordPromotionService {

    /**
     * 记录工厂采用关键词
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param keyword 关键词
     * @param effectivenessScore 效果评分
     * @return 采用记录
     */
    KeywordFactoryAdoption recordAdoption(
        String factoryId, String intentCode, String keyword, BigDecimal effectivenessScore);

    /**
     * 禁用关键词
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param keyword 关键词
     * @param reason 禁用原因
     */
    void disableKeyword(String factoryId, String intentCode, String keyword, String reason);

    /**
     * 启用关键词
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param keyword 关键词
     */
    void enableKeyword(String factoryId, String intentCode, String keyword);

    /**
     * 检查关键词是否符合晋升条件
     *
     * @param intentCode 意图代码
     * @param keyword 关键词
     * @param minFactories 最小采用工厂数
     * @param minEffectiveness 最小平均效果评分
     * @return true 如果符合晋升条件
     */
    boolean checkPromotionEligibility(
        String intentCode, String keyword, int minFactories, BigDecimal minEffectiveness);

    /**
     * 晋升关键词到全局
     *
     * @param intentCode 意图代码
     * @param keyword 关键词
     * @return true 如果晋升成功
     */
    boolean promoteToGlobal(String intentCode, String keyword);

    /**
     * 运行晋升检查（定时任务调用）
     *
     * @param minFactories 最小采用工厂数
     * @param minEffectiveness 最小平均效果评分
     * @return 晋升的关键词数量
     */
    int runPromotionCheck(int minFactories, BigDecimal minEffectiveness);

    /**
     * 获取某意图的已晋升关键词
     *
     * @param intentCode 意图代码
     * @return 已晋升关键词列表
     */
    List<String> getPromotedKeywords(String intentCode);

    /**
     * 同步效果评分到采用记录
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param keyword 关键词
     * @param effectivenessScore 效果评分
     */
    void syncEffectivenessScore(
        String factoryId, String intentCode, String keyword, BigDecimal effectivenessScore);
}
