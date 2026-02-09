package com.cretas.aims.scheduler;

import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.service.calibration.BehaviorCalibrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * 行为校准指标定时计算任务
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的行为校准系统
 *
 * 功能:
 * 1. 每日凌晨计算前一天的校准指标
 * 2. 每周一计算上周的汇总指标
 * 3. 每月1号计算上月的汇总指标
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BehaviorCalibrationScheduler {

    private final BehaviorCalibrationService calibrationService;
    private final FactoryRepository factoryRepository;

    /**
     * 每日凌晨 1:00 计算前一天的校准指标
     * Cron: 秒 分 时 日 月 周
     */
    @Scheduled(cron = "0 0 1 * * ?")
    public void calculateDailyMetrics() {
        log.info("开始执行每日校准指标计算...");

        LocalDate yesterday = LocalDate.now().minusDays(1);

        try {
            // 获取所有工厂ID
            List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();

            int successCount = 0;
            int failCount = 0;

            for (String factoryId : factoryIds) {
                try {
                    BehaviorCalibrationMetrics metrics = calibrationService.calculateDailyMetrics(factoryId, yesterday);
                    if (metrics != null) {
                        successCount++;
                        log.debug("工厂 {} 的每日指标计算完成: compositeScore={}",
                                factoryId, metrics.getCompositeScore());
                    }
                } catch (Exception e) {
                    failCount++;
                    log.warn("工厂 {} 的每日指标计算失败: {}", factoryId, e.getMessage());
                }
            }

            log.info("每日校准指标计算完成: 成功={}, 失败={}, 日期={}", successCount, failCount, yesterday);

        } catch (Exception e) {
            log.error("每日校准指标计算任务失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 每周一凌晨 2:00 计算上周的汇总指标
     */
    @Scheduled(cron = "0 0 2 ? * MON")
    public void calculateWeeklyMetrics() {
        log.info("开始执行每周校准指标计算...");

        LocalDate lastWeekEnd = LocalDate.now().minusDays(1);
        LocalDate lastWeekStart = lastWeekEnd.minusDays(6);

        try {
            List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();

            for (String factoryId : factoryIds) {
                try {
                    // 计算周汇总（使用最近7天的数据平均值）
                    Double avgScore = calibrationService.getAverageCompositeScore(factoryId, lastWeekStart, lastWeekEnd);
                    log.info("工厂 {} 上周平均分: {}", factoryId, avgScore);
                } catch (Exception e) {
                    log.warn("工厂 {} 的每周指标计算失败: {}", factoryId, e.getMessage());
                }
            }

            log.info("每周校准指标计算完成");

        } catch (Exception e) {
            log.error("每周校准指标计算任务失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 每月1号凌晨 3:00 计算上月的汇总指标
     */
    @Scheduled(cron = "0 0 3 1 * ?")
    public void calculateMonthlyMetrics() {
        log.info("开始执行每月校准指标计算...");

        LocalDate lastMonthEnd = LocalDate.now().minusDays(1);
        LocalDate lastMonthStart = lastMonthEnd.withDayOfMonth(1);

        try {
            List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();

            for (String factoryId : factoryIds) {
                try {
                    // 计算月汇总
                    Double avgScore = calibrationService.getAverageCompositeScore(factoryId, lastMonthStart, lastMonthEnd);
                    log.info("工厂 {} 上月平均分: {}", factoryId, avgScore);
                } catch (Exception e) {
                    log.warn("工厂 {} 的每月指标计算失败: {}", factoryId, e.getMessage());
                }
            }

            log.info("每月校准指标计算完成");

        } catch (Exception e) {
            log.error("每月校准指标计算任务失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 每日凌晨 1:30 计算工具可靠性统计
     */
    @Scheduled(cron = "0 30 1 * * ?")
    public void calculateToolReliabilityStats() {
        log.info("开始执行工具可靠性统计计算...");

        LocalDate yesterday = LocalDate.now().minusDays(1);

        try {
            List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();

            for (String factoryId : factoryIds) {
                try {
                    calibrationService.calculateToolReliabilityStats(factoryId, yesterday);
                    log.debug("工厂 {} 的工具可靠性统计计算完成", factoryId);
                } catch (Exception e) {
                    log.warn("工厂 {} 的工具可靠性统计计算失败: {}", factoryId, e.getMessage());
                }
            }

            log.info("工具可靠性统计计算完成");

        } catch (Exception e) {
            log.error("工具可靠性统计计算任务失败: {}", e.getMessage(), e);
        }
    }
}
