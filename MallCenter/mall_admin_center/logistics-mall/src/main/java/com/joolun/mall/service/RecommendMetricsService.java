package com.joolun.mall.service;

import java.util.Map;

/**
 * 推荐系统指标监控服务
 * 跟踪推荐效果的核心指标
 */
public interface RecommendMetricsService {

    /**
     * 记录商品曝光
     * @param userId 用户ID
     * @param productIds 曝光的商品ID列表
     * @param source 曝光来源 (ai_chat, search, homepage, etc.)
     */
    void recordImpressions(Long userId, java.util.List<String> productIds, String source);

    /**
     * 记录商品点击
     * @param userId 用户ID
     * @param productId 点击的商品ID
     * @param source 点击来源
     */
    void recordClick(Long userId, String productId, String source);

    /**
     * 记录购买转化
     * @param userId 用户ID
     * @param productId 购买的商品ID
     * @param amount 购买金额
     * @param source 来源
     */
    void recordPurchase(Long userId, String productId, double amount, String source);

    /**
     * 记录AI对话满意度
     * @param userId 用户ID
     * @param sessionId 会话ID
     * @param satisfied 是否满意 (true=满意, false=不满意)
     */
    void recordChatSatisfaction(Long userId, String sessionId, boolean satisfied);

    /**
     * 记录极速匹配服务使用
     * @param userId 用户ID
     * @param keywords 搜索关键词
     * @param accepted 是否接受服务
     */
    void recordExpressMatchUsage(Long userId, java.util.List<String> keywords, boolean accepted);

    /**
     * 获取实时指标概览
     * @return 指标数据
     */
    Map<String, Object> getRealtimeMetrics();

    /**
     * 获取指定时间段的指标报告
     * @param days 天数
     * @return 指标报告
     */
    Map<String, Object> getMetricsReport(int days);

    /**
     * 获取来源分析
     * @param days 天数
     * @return 各来源的指标对比
     */
    Map<String, Object> getSourceAnalysis(int days);
}
