package com.cretas.aims.service;

import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.ProcessingMode;
import com.cretas.aims.dto.ai.QueryFeatures;

/**
 * 复杂度路由服务接口
 *
 * 根据查询复杂度决定处理模式。
 * 实现两阶段策略：
 * - Phase 1: 规则 + 特征提取 (立即可用)
 * - Phase 2: 轻量 Agent 判断边界情况 (后续)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface ComplexityRouter {

    /**
     * 根据查询复杂度决定处理模式
     *
     * @param userInput 用户输入
     * @param context 分析上下文 (可选)
     * @return 处理模式
     */
    ProcessingMode route(String userInput, AnalysisContext context);

    /**
     * 评估查询复杂度 (0-1)
     *
     * @param userInput 用户输入
     * @param context 分析上下文 (可选)
     * @return 复杂度分数
     */
    double estimateComplexity(String userInput, AnalysisContext context);

    /**
     * 提取查询特征
     *
     * @param userInput 用户输入
     * @param context 分析上下文 (可选)
     * @return 查询特征
     */
    QueryFeatures extractFeatures(String userInput, AnalysisContext context);
}
