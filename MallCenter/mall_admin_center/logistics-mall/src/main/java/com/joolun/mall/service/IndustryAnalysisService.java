package com.joolun.mall.service;

import com.joolun.mall.dto.industry.IndustryAnalysisDTO;

/**
 * 行业分析服务接口
 * 提供食品溯源行业的实时AI分析
 */
public interface IndustryAnalysisService {

    /**
     * 获取行业分析报告
     *
     * @param forceRefresh 是否强制刷新（忽略缓存）
     * @return 行业分析报告DTO
     */
    IndustryAnalysisDTO getIndustryAnalysis(boolean forceRefresh);

    /**
     * 检查缓存状态
     *
     * @return 缓存是否有效
     */
    boolean isCacheValid();

    /**
     * 获取缓存剩余时间（秒）
     *
     * @return 剩余秒数，-1表示无缓存
     */
    long getCacheRemainingSeconds();

    /**
     * 清除缓存
     */
    void invalidateCache();
}
