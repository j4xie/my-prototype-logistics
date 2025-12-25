package com.joolun.mall.service;

import com.joolun.mall.dto.analysis.FactoryAnalysisDTO;

/**
 * 工厂分析服务接口
 */
public interface FactoryAnalysisService {
    /**
     * 获取工厂分析报告
     * @param factoryId 工厂ID
     * @return 分析报告
     */
    FactoryAnalysisDTO getFactoryAnalysis(Long factoryId);
}




