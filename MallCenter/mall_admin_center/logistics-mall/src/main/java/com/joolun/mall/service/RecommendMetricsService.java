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

    /**
     * 获取A/B测试对比数据
     * @param experimentName 实验名称
     * @param days 天数
     * @return 各组的转化率对比
     */
    Map<String, Object> getABTestComparison(String experimentName, int days);

    /**
     * 获取推荐多样性评分
     * 多样性 = 推荐结果中不同类目数 / 总推荐数
     * @param days 天数
     * @return 多样性指标
     */
    Map<String, Object> getDiversityScore(int days);

    /**
     * 获取用户留存率
     * 计算通过推荐访问的用户在后续几天的回访率
     * @param days 统计天数
     * @return 留存率数据
     */
    Map<String, Object> getRetentionRate(int days);

    /**
     * 获取推荐深度分析
     * 用户点击推荐商品的平均位置
     * @param days 天数
     * @return 点击深度分析
     */
    Map<String, Object> getClickDepthAnalysis(int days);

    /**
     * 记录商品曝光（带类目和位置信息，用于多样性和深度分析）
     * @param userId 用户ID
     * @param productIds 曝光的商品ID列表
     * @param categoryIds 对应的类目ID列表
     * @param source 曝光来源
     */
    void recordImpressionsWithCategory(Long userId, java.util.List<String> productIds,
                                       java.util.List<String> categoryIds, String source);

    /**
     * 记录商品点击（带位置信息）
     * @param userId 用户ID
     * @param productId 点击的商品ID
     * @param position 商品在推荐列表中的位置（从1开始）
     * @param source 点击来源
     */
    void recordClickWithPosition(Long userId, String productId, int position, String source);
}
