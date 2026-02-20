package com.cretas.aims.service;

import com.cretas.aims.dto.ai.CostAIContext;
import com.cretas.aims.dto.ai.ProductionAIContext;

import java.time.LocalDate;
import java.util.List;

/**
 * AI 上下文服务接口
 *
 * 提供预计算的业务数据上下文，用于：
 * 1. 减少 LLM Token 消耗
 * 2. 提升 AI 响应质量
 * 3. 支持成本差异分析
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-13
 */
public interface AIContextService {

    /**
     * 构建生产统计 AI 上下文
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 生产 AI 上下文
     */
    ProductionAIContext buildProductionContext(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 构建产品成本 AI 上下文
     *
     * @param factoryId 工厂ID
     * @param productTypeId 产品类型ID
     * @param recentBatchCount 分析的最近批次数
     * @return 成本 AI 上下文
     */
    CostAIContext buildCostContext(String factoryId, String productTypeId, Integer recentBatchCount);

    /**
     * 获取成本差异汇总
     *
     * @param factoryId 工厂ID
     * @return 成本差异汇总列表
     */
    List<CostAIContext.CostVarianceDetail> getCostVarianceSummary(String factoryId);

    /**
     * 格式化生产上下文为 AI Prompt 文本
     *
     * @param context 生产 AI 上下文
     * @return 格式化的文本，可直接注入 Prompt
     */
    String formatProductionContextForPrompt(ProductionAIContext context);

    /**
     * 格式化成本上下文为 AI Prompt 文本
     *
     * @param context 成本 AI 上下文
     * @return 格式化的文本，可直接注入 Prompt
     */
    String formatCostContextForPrompt(CostAIContext context);
}
