package com.cretas.aims.service;

import com.cretas.aims.entity.Factory;
import com.cretas.aims.repository.FactoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

/**
 * AI报告定时任务调度器
 *
 * 功能：
 * 1. 每周一早上6点自动生成所有工厂的周报告
 * 2. 每月1日早上6点自动生成所有工厂的月报告
 * 3. 定期清理过期的报告和审计日志
 *
 * 注意：
 * - 定时任务生成的报告不消耗AI配额
 * - 周报告保留30天，月报告保留90天
 * - 审计日志保留3年（ISO 27001合规）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 */
@Component
@EnableScheduling
public class AIReportScheduler {
    private static final Logger log = LoggerFactory.getLogger(AIReportScheduler.class);

    @Autowired
    private AIEnterpriseService aiEnterpriseService;

    @Autowired
    private FactoryRepository factoryRepository;

    /**
     * 每周一早上6点生成周报告
     * Cron表达式: 0 0 6 * * MON
     * - 秒: 0
     * - 分: 0
     * - 时: 6
     * - 日: *（任意）
     * - 月: *（任意）
     * - 星期: MON（周一）
     */
    @Scheduled(cron = "0 0 6 * * MON")
    public void generateWeeklyReportsForAllFactories() {
        log.info("========== 开始生成周报告 ==========");
        long startTime = System.currentTimeMillis();

        try {
            // 1. 获取所有活跃的工厂
            List<Factory> activeFactories = factoryRepository.findAll().stream()
                    .filter(f -> Boolean.TRUE.equals(f.getIsActive()))
                    .collect(java.util.stream.Collectors.toList());

            log.info("找到 {} 个活跃工厂，开始生成周报告", activeFactories.size());

            // 2. 计算上周的时间范围（上周一到上周日）
            LocalDate lastMonday = LocalDate.now().minusWeeks(1).with(java.time.DayOfWeek.MONDAY);
            LocalDate lastSunday = lastMonday.plusDays(6);

            log.info("报告周期: {} 至 {}", lastMonday, lastSunday);

            // 3. 为每个工厂生成周报告
            int successCount = 0;
            int failureCount = 0;

            for (Factory factory : activeFactories) {
                try {
                    aiEnterpriseService.generateWeeklyReport(
                            factory.getId(),
                            lastMonday,
                            lastSunday
                    );
                    successCount++;
                    log.info("✅ 工厂 {} 周报告生成成功", factory.getId());

                    // 避免同时请求过多，间隔2秒
                    Thread.sleep(2000);

                } catch (Exception e) {
                    failureCount++;
                    log.error("❌ 工厂 {} 周报告生成失败: {}", factory.getId(), e.getMessage(), e);
                }
            }

            long duration = System.currentTimeMillis() - startTime;
            log.info("========== 周报告生成完成 ==========");
            log.info("总计: {} 个工厂 | 成功: {} | 失败: {} | 耗时: {}ms",
                    activeFactories.size(), successCount, failureCount, duration);

        } catch (Exception e) {
            log.error("周报告生成任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 每月1日早上6点生成月报告
     * Cron表达式: 0 0 6 1 * *
     * - 秒: 0
     * - 分: 0
     * - 时: 6
     * - 日: 1（每月1日）
     * - 月: *（任意）
     * - 星期: *（任意）
     */
    @Scheduled(cron = "0 0 6 1 * *")
    public void generateMonthlyReportsForAllFactories() {
        log.info("========== 开始生成月报告 ==========");
        long startTime = System.currentTimeMillis();

        try {
            // 1. 获取所有活跃的工厂
            List<Factory> activeFactories = factoryRepository.findAll().stream()
                    .filter(f -> Boolean.TRUE.equals(f.getIsActive()))
                    .collect(java.util.stream.Collectors.toList());

            log.info("找到 {} 个活跃工厂，开始生成月报告", activeFactories.size());

            // 2. 计算上月的时间范围（上月1日到上月最后一天）
            LocalDate lastMonthStart = LocalDate.now().minusMonths(1).withDayOfMonth(1);
            LocalDate lastMonthEnd = lastMonthStart.with(TemporalAdjusters.lastDayOfMonth());

            log.info("报告月份: {} 至 {}", lastMonthStart, lastMonthEnd);

            // 3. 为每个工厂生成月报告
            int successCount = 0;
            int failureCount = 0;

            for (Factory factory : activeFactories) {
                try {
                    aiEnterpriseService.generateMonthlyReport(
                            factory.getId(),
                            lastMonthStart,
                            lastMonthEnd
                    );
                    successCount++;
                    log.info("✅ 工厂 {} 月报告生成成功", factory.getId());

                    // 避免同时请求过多，间隔3秒
                    Thread.sleep(3000);

                } catch (Exception e) {
                    failureCount++;
                    log.error("❌ 工厂 {} 月报告生成失败: {}", factory.getId(), e.getMessage(), e);
                }
            }

            long duration = System.currentTimeMillis() - startTime;
            log.info("========== 月报告生成完成 ==========");
            log.info("总计: {} 个工厂 | 成功: {} | 失败: {} | 耗时: {}ms",
                    activeFactories.size(), successCount, failureCount, duration);

        } catch (Exception e) {
            log.error("月报告生成任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 每天凌晨2点清理过期报告
     * Cron表达式: 0 0 2 * * *
     * - 秒: 0
     * - 分: 0
     * - 时: 2
     * - 日: *（每天）
     * - 月: *（任意）
     * - 星期: *（任意）
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void cleanExpiredReports() {
        log.info("========== 开始清理过期报告 ==========");
        long startTime = System.currentTimeMillis();

        try {
            // 使用Repository的deleteExpiredReports方法清理
            // 该方法在AIAnalysisResultRepository中定义
            int deletedCount = 0; // TODO: 调用repository.deleteExpiredReports(LocalDateTime.now());

            long duration = System.currentTimeMillis() - startTime;
            log.info("========== 过期报告清理完成 ==========");
            log.info("删除 {} 条过期报告 | 耗时: {}ms", deletedCount, duration);

        } catch (Exception e) {
            log.error("过期报告清理任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 每周日凌晨3点清理旧配额记录（保留最近26周即半年）
     * Cron表达式: 0 0 3 * * SUN
     * - 秒: 0
     * - 分: 0
     * - 时: 3
     * - 日: *（任意）
     * - 月: *（任意）
     * - 星期: SUN（周日）
     */
    @Scheduled(cron = "0 0 3 * * SUN")
    public void cleanOldQuotaRecords() {
        log.info("========== 开始清理旧配额记录 ==========");
        long startTime = System.currentTimeMillis();

        try {
            // 保留最近26周（半年）的配额记录
            LocalDate cutoffDate = LocalDate.now().minusWeeks(26);
            int deletedCount = 0; // TODO: 调用quotaUsageRepository.deleteOldQuotaRecords(cutoffDate);

            long duration = System.currentTimeMillis() - startTime;
            log.info("========== 旧配额记录清理完成 ==========");
            log.info("删除 {} 条旧配额记录（早于{}） | 耗时: {}ms",
                    deletedCount, cutoffDate, duration);

        } catch (Exception e) {
            log.error("旧配额记录清理任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 每月1日凌晨4点清理旧审计日志（保留3年用于合规）
     * Cron表达式: 0 0 4 1 * *
     * - 秒: 0
     * - 分: 0
     * - 时: 4
     * - 日: 1（每月1日）
     * - 月: *（任意）
     * - 星期: *（任意）
     */
    @Scheduled(cron = "0 0 4 1 * *")
    public void cleanOldAuditLogs() {
        log.info("========== 开始清理旧审计日志 ==========");
        long startTime = System.currentTimeMillis();

        try {
            // 保留3年的审计日志（ISO 27001合规）
            java.time.LocalDateTime cutoffDate = java.time.LocalDateTime.now().minusYears(3);
            int deletedCount = 0; // TODO: 调用auditLogRepository.deleteOldAuditLogs(cutoffDate);

            long duration = System.currentTimeMillis() - startTime;
            log.info("========== 旧审计日志清理完成 ==========");
            log.info("删除 {} 条旧审计日志（早于{}） | 耗时: {}ms",
                    deletedCount, cutoffDate, duration);

        } catch (Exception e) {
            log.error("旧审计日志清理任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 手动触发周报告生成（用于测试或补生成）
     */
    public void manualGenerateWeeklyReport(String factoryId, LocalDate weekStart, LocalDate weekEnd) {
        log.info("手动触发周报告生成: factoryId={}, week={} to {}", factoryId, weekStart, weekEnd);
        try {
            aiEnterpriseService.generateWeeklyReport(factoryId, weekStart, weekEnd);
            log.info("✅ 手动周报告生成成功: factoryId={}", factoryId);
        } catch (Exception e) {
            log.error("❌ 手动周报告生成失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 手动触发月报告生成（用于测试或补生成）
     */
    public void manualGenerateMonthlyReport(String factoryId, LocalDate monthStart, LocalDate monthEnd) {
        log.info("手动触发月报告生成: factoryId={}, month={} to {}", factoryId, monthStart, monthEnd);
        try {
            aiEnterpriseService.generateMonthlyReport(factoryId, monthStart, monthEnd);
            log.info("✅ 手动月报告生成成功: factoryId={}", factoryId);
        } catch (Exception e) {
            log.error("❌ 手动月报告生成失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            throw e;
        }
    }
}
