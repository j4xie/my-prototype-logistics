package com.joolun.mall.service;

import com.joolun.mall.dto.analysis.ProductAnalysisDTO;

/**
 * 产品分析服务接口
 */
public interface ProductAnalysisService {
    /**
     * 获取产品分析报告
     * @param productId 产品ID
     * @return 分析报告
     */
    ProductAnalysisDTO getProductAnalysis(Long productId);
}




























