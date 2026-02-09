package com.cretas.aims.service;

import com.cretas.aims.entity.intent.ErrorAttributionStatistics;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 错误归因分析服务接口
 *
 * 提供:
 * - 每日统计聚合（从 intent_match_records 聚合到 error_attribution_statistics）
 * - 趋势分析
 * - 错误模式识别
 * - 优化建议生成
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
public interface ErrorAttributionAnalysisService {

    // ==================== 统计聚合 ====================

    /**
     * 聚合指定日期的统计数据
     *
     * @param factoryId 工厂ID
     * @param date 统计日期
     * @return 统计结果
     */
    ErrorAttributionStatistics aggregateDailyStatistics(String factoryId, LocalDate date);

    /**
     * 聚合所有工厂的昨日统计数据
     *
     * @return 聚合结果数量
     */
    int aggregateYesterdayStatisticsForAllFactories();

    /**
     * 重新聚合日期范围内的统计数据
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 聚合结果列表
     */
    List<ErrorAttributionStatistics> reaggregateDateRange(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 趋势分析 ====================

    /**
     * 分析匹配成功率趋势
     *
     * @param factoryId 工厂ID
     * @param days 天数
     * @return 趋势数据 {date: rate}
     */
    Map<LocalDate, Double> analyzeMatchRateTrend(String factoryId, int days);

    /**
     * 分析LLM Fallback使用趋势
     *
     * @param factoryId 工厂ID
     * @param days 天数
     * @return 趋势数据 {date: count}
     */
    Map<LocalDate, Integer> analyzeLlmFallbackTrend(String factoryId, int days);

    /**
     * 分析错误归因分布趋势
     *
     * @param factoryId 工厂ID
     * @param days 天数
     * @return 趋势数据 {date: {attribution: count}}
     */
    Map<LocalDate, Map<String, Integer>> analyzeErrorAttributionTrend(String factoryId, int days);

    // ==================== 错误模式识别 ====================

    /**
     * 识别高频失败模式
     *
     * @param factoryId 工厂ID
     * @param days 分析天数
     * @param minFrequency 最小频率
     * @return 失败模式列表 {userInput, count, matchedIntent}
     */
    List<Map<String, Object>> identifyFailurePatterns(String factoryId, int days, int minFrequency);

    /**
     * 识别歧义意图
     *
     * @param factoryId 工厂ID
     * @param days 分析天数
     * @return 歧义意图列表 {intentCode, avgConfidence, conflictingIntents}
     */
    List<Map<String, Object>> identifyAmbiguousIntents(String factoryId, int days);

    /**
     * 识别规则缺失的输入模式
     *
     * @param factoryId 工厂ID
     * @param days 分析天数
     * @param minCount 最小出现次数
     * @return 缺失模式列表 {inputPattern, count, suggestedKeywords}
     */
    List<Map<String, Object>> identifyMissingRulePatterns(String factoryId, int days, int minCount);

    // ==================== 优化建议生成 ====================

    /**
     * 生成优化建议
     *
     * @param factoryId 工厂ID
     * @param days 分析天数
     * @return 生成的建议列表
     */
    List<IntentOptimizationSuggestion> generateOptimizationSuggestions(String factoryId, int days);

    /**
     * 周度分析报告
     *
     * @param factoryId 工厂ID
     * @return 周报数据 {summary, trends, suggestions, topIssues}
     */
    Map<String, Object> generateWeeklyReport(String factoryId);

    // ==================== 清理操作 ====================

    /**
     * 清理过期的匹配记录
     *
     * @param retentionDays 保留天数
     * @return 删除的记录数
     */
    int cleanupOldMatchRecords(int retentionDays);

    /**
     * 清理过期的统计数据
     *
     * @param retentionDays 保留天数
     * @return 删除的记录数
     */
    int cleanupOldStatistics(int retentionDays);

    /**
     * 清理过期的优化建议
     *
     * @return 标记为过期的建议数
     */
    int markExpiredSuggestions();
}
