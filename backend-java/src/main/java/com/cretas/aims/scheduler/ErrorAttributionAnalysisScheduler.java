package com.cretas.aims.scheduler;

import com.cretas.aims.entity.intent.ErrorAttributionStatistics;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.service.ErrorAttributionAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 错误归因分析定时任务调度器
 *
 * 执行以下定时任务:
 * 1. 每日凌晨1点: 聚合昨日的意图匹配统计数据
 * 2. 每周一凌晨2点: 生成周度分析报告
 * 3. 每日凌晨3点: 清理过期数据
 * 4. 每日凌晨4点: 生成优化建议
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ErrorAttributionAnalysisScheduler {

    private final ErrorAttributionAnalysisService analysisService;
    private final FactoryRepository factoryRepository;

    @Value("${cretas.ai.intent.scheduler.enabled:true}")
    private boolean schedulerEnabled;

    @Value("${cretas.ai.intent.analysis.retention-days:30}")
    private int recordRetentionDays;

    @Value("${cretas.ai.intent.statistics.retention-days:365}")
    private int statisticsRetentionDays;

    @Value("${cretas.ai.intent.suggestion.analysis-days:7}")
    private int suggestionAnalysisDays;

    // ==================== 每日统计聚合 ====================

    /**
     * 每日凌晨1点聚合昨日统计数据
     *
     * cron: 秒 分 时 日 月 周
     * 0 0 1 * * ? = 每天凌晨1:00执行
     */
    @Scheduled(cron = "0 0 1 * * ?")
    public void aggregateDailyStatistics() {
        if (!schedulerEnabled) {
            log.debug("错误归因分析调度器已禁用");
            return;
        }

        log.info("========== 开始每日统计聚合任务 ==========");
        long startTime = System.currentTimeMillis();

        try {
            int aggregatedCount = analysisService.aggregateYesterdayStatisticsForAllFactories();

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("每日统计聚合完成: 聚合 {} 个工厂的数据，耗时 {} ms",
                    aggregatedCount, elapsed);

        } catch (Exception e) {
            log.error("每日统计聚合任务失败", e);
        }
    }

    // ==================== 周度分析报告 ====================

    /**
     * 每周一凌晨2点生成周度分析报告
     *
     * cron: 0 0 2 ? * MON = 每周一凌晨2:00执行
     */
    @Scheduled(cron = "0 0 2 ? * MON")
    public void generateWeeklyReports() {
        if (!schedulerEnabled) {
            log.debug("错误归因分析调度器已禁用");
            return;
        }

        log.info("========== 开始周度分析报告生成任务 ==========");
        long startTime = System.currentTimeMillis();

        try {
            List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();
            int successCount = 0;
            int failCount = 0;

            for (String factoryId : factoryIds) {
                try {
                    Map<String, Object> report = analysisService.generateWeeklyReport(factoryId);

                    // 记录关键指标
                    @SuppressWarnings("unchecked")
                    Map<String, Object> summary = (Map<String, Object>) report.get("summary");
                    if (summary != null) {
                        log.info("工厂 {} 周报: 总请求 {}, 匹配率 {}, LLM调用 {}",
                                factoryId,
                                summary.get("totalRequests"),
                                summary.get("overallMatchRate"),
                                summary.get("llmFallbackCount"));
                    }

                    successCount++;
                } catch (Exception e) {
                    log.error("生成工厂 {} 周报失败: {}", factoryId, e.getMessage());
                    failCount++;
                }
            }

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("周度报告生成完成: 成功 {}, 失败 {}, 耗时 {} ms",
                    successCount, failCount, elapsed);

        } catch (Exception e) {
            log.error("周度分析报告任务失败", e);
        }
    }

    // ==================== 优化建议生成 ====================

    /**
     * 每日凌晨4点生成优化建议
     *
     * cron: 0 0 4 * * ? = 每天凌晨4:00执行
     */
    @Scheduled(cron = "0 0 4 * * ?")
    public void generateOptimizationSuggestions() {
        if (!schedulerEnabled) {
            log.debug("错误归因分析调度器已禁用");
            return;
        }

        log.info("========== 开始优化建议生成任务 ==========");
        long startTime = System.currentTimeMillis();

        try {
            List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();
            int totalSuggestions = 0;

            for (String factoryId : factoryIds) {
                try {
                    List<IntentOptimizationSuggestion> suggestions =
                            analysisService.generateOptimizationSuggestions(factoryId, suggestionAnalysisDays);

                    if (!suggestions.isEmpty()) {
                        log.info("工厂 {} 生成 {} 条优化建议", factoryId, suggestions.size());

                        // 记录高优先级建议
                        suggestions.stream()
                                .filter(s -> s.getImpactScore() != null && s.getImpactScore().doubleValue() >= 10.0)
                                .forEach(s -> log.info("  - [{}] {} (预估影响: {}%)",
                                        s.getSuggestionType(),
                                        s.getSuggestionDetail(),
                                        s.getImpactScore()));
                    }

                    totalSuggestions += suggestions.size();
                } catch (Exception e) {
                    log.error("生成工厂 {} 优化建议失败: {}", factoryId, e.getMessage());
                }
            }

            // 标记过期建议
            int expiredCount = analysisService.markExpiredSuggestions();
            if (expiredCount > 0) {
                log.info("标记 {} 条过期建议", expiredCount);
            }

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("优化建议生成完成: 共生成 {} 条建议, 耗时 {} ms",
                    totalSuggestions, elapsed);

        } catch (Exception e) {
            log.error("优化建议生成任务失败", e);
        }
    }

    // ==================== 数据清理 ====================

    /**
     * 每日凌晨3点清理过期数据
     *
     * cron: 0 0 3 * * ? = 每天凌晨3:00执行
     */
    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanupExpiredData() {
        if (!schedulerEnabled) {
            log.debug("错误归因分析调度器已禁用");
            return;
        }

        log.info("========== 开始数据清理任务 ==========");
        long startTime = System.currentTimeMillis();

        try {
            // 清理过期的匹配记录 (默认保留30天)
            int recordsDeleted = analysisService.cleanupOldMatchRecords(recordRetentionDays);
            if (recordsDeleted > 0) {
                log.info("清理 {} 条过期匹配记录 (保留 {} 天)",
                        recordsDeleted, recordRetentionDays);
            }

            // 清理过期的统计数据 (默认保留365天)
            int statsDeleted = analysisService.cleanupOldStatistics(statisticsRetentionDays);
            if (statsDeleted > 0) {
                log.info("清理 {} 条过期统计数据 (保留 {} 天)",
                        statsDeleted, statisticsRetentionDays);
            }

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("数据清理完成: 删除记录 {}, 删除统计 {}, 耗时 {} ms",
                    recordsDeleted, statsDeleted, elapsed);

        } catch (Exception e) {
            log.error("数据清理任务失败", e);
        }
    }

    // ==================== 手动触发接口 ====================

    /**
     * 手动触发指定工厂的统计聚合
     *
     * @param factoryId 工厂ID
     * @param date 统计日期
     * @return 聚合结果
     */
    public ErrorAttributionStatistics triggerAggregation(String factoryId, LocalDate date) {
        log.info("手动触发统计聚合: factoryId={}, date={}", factoryId, date);
        return analysisService.aggregateDailyStatistics(factoryId, date);
    }

    /**
     * 手动触发指定工厂的周报生成
     *
     * @param factoryId 工厂ID
     * @return 周报数据
     */
    public Map<String, Object> triggerWeeklyReport(String factoryId) {
        log.info("手动触发周报生成: factoryId={}", factoryId);
        return analysisService.generateWeeklyReport(factoryId);
    }

    /**
     * 手动触发指定工厂的优化建议生成
     *
     * @param factoryId 工厂ID
     * @param days 分析天数
     * @return 优化建议列表
     */
    public List<IntentOptimizationSuggestion> triggerSuggestionGeneration(String factoryId, int days) {
        log.info("手动触发优化建议生成: factoryId={}, days={}", factoryId, days);
        return analysisService.generateOptimizationSuggestions(factoryId, days);
    }

    /**
     * 手动触发所有工厂的统计聚合
     *
     * @return 聚合的工厂数量
     */
    public int triggerAllFactoriesAggregation() {
        log.info("手动触发所有工厂统计聚合");
        return analysisService.aggregateYesterdayStatisticsForAllFactories();
    }

    /**
     * 获取调度器状态
     *
     * @return 状态信息
     */
    public Map<String, Object> getSchedulerStatus() {
        return Map.of(
                "enabled", schedulerEnabled,
                "recordRetentionDays", recordRetentionDays,
                "statisticsRetentionDays", statisticsRetentionDays,
                "suggestionAnalysisDays", suggestionAnalysisDays,
                "nextDailyAggregation", "每天 01:00",
                "nextWeeklyReport", "每周一 02:00",
                "nextCleanup", "每天 03:00",
                "nextSuggestionGeneration", "每天 04:00"
        );
    }
}
