package com.cretas.aims.service;

import com.cretas.aims.dto.intent.RouteDecision;

/**
 * 语义路由器服务接口
 *
 * 在意图识别流程前置一层快速路由器，使用向量相似度做快速决策:
 * - 启动时预加载所有意图的向量表示
 * - 计算输入向量与意图向量的余弦相似度
 * - 三级路由决策:
 *   - score >= 0.92: DirectExecute (直接执行，跳过LLM)
 *   - score >= 0.75: NeedReranking (走关键词+LLM Reranking)
 *   - score < 0.75: NeedFullLLM (走完整LLM Fallback)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
public interface SemanticRouterService {

    /**
     * 执行语义路由
     *
     * 计算用户输入与所有意图的语义相似度，返回路由决策
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @return 路由决策结果
     */
    RouteDecision route(String factoryId, String userInput);

    /**
     * 执行语义路由 (带 Top-N 参数)
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param topN      返回的候选数量
     * @return 路由决策结果
     */
    RouteDecision route(String factoryId, String userInput, int topN);

    /**
     * 刷新工厂的意图向量缓存
     *
     * @param factoryId 工厂ID
     */
    void refreshCache(String factoryId);

    /**
     * 刷新所有工厂的意图向量缓存
     */
    void refreshAllCache();

    /**
     * 获取路由统计信息
     *
     * @return 统计信息
     */
    RouterStatistics getStatistics();

    /**
     * 检查路由器是否可用
     *
     * @return 是否可用
     */
    boolean isAvailable();

    /**
     * 路由器统计信息
     */
    interface RouterStatistics {
        /**
         * 总路由次数
         */
        long getTotalRoutes();

        /**
         * 直接执行次数 (DirectExecute)
         */
        long getDirectExecuteCount();

        /**
         * 需要 Reranking 次数
         */
        long getNeedRerankingCount();

        /**
         * 需要完整 LLM 次数
         */
        long getNeedFullLLMCount();

        /**
         * 缓存的意图数量
         */
        int getCachedIntentCount();

        /**
         * 平均路由延迟 (毫秒)
         */
        double getAverageLatencyMs();

        /**
         * 直接执行比例 (%)
         */
        default double getDirectExecuteRate() {
            long total = getTotalRoutes();
            return total > 0 ? (double) getDirectExecuteCount() / total * 100 : 0;
        }

        /**
         * 需要 Reranking 比例 (%)
         */
        default double getNeedRerankingRate() {
            long total = getTotalRoutes();
            return total > 0 ? (double) getNeedRerankingCount() / total * 100 : 0;
        }

        /**
         * 需要完整 LLM 比例 (%)
         */
        default double getNeedFullLLMRate() {
            long total = getTotalRoutes();
            return total > 0 ? (double) getNeedFullLLMCount() / total * 100 : 0;
        }
    }
}
