package com.cretas.aims.scheduler;

import com.cretas.aims.dto.aps.WeightAdjustmentResult;
import com.cretas.aims.entity.FactorySchedulingConfig;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.repository.FactorySchedulingConfigRepository;
import com.cretas.aims.service.aps.StrategyWeightAdaptationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * APS策略权重自适应调整定时任务
 *
 * 功能:
 * 1. 每天凌晨2点自动执行权重调整
 * 2. 遍历所有启用自适应学习的工厂
 * 3. 根据过去7天的排产效果调整策略权重
 * 4. 记录调整日志和异常
 *
 * @author Cretas APS Team
 * @since 2026-01-21
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WeightAdjustmentScheduler {

    private final StrategyWeightAdaptationService adaptationService;
    private final FactoryRepository factoryRepository;
    private final FactorySchedulingConfigRepository configRepository;

    @Value("${aps.weight-adjustment.enabled:true}")
    private boolean adjustmentEnabled;

    @Value("${aps.weight-adjustment.min-adaptation-interval-hours:12}")
    private int minAdaptationIntervalHours;

    /**
     * 每天凌晨2点执行权重调整
     * cron: 秒 分 时 日 月 周
     */
    @Scheduled(cron = "${aps.weight-adjustment.schedule:0 0 2 * * ?}")
    public void dailyWeightAdjustment() {
        if (!adjustmentEnabled) {
            log.debug("权重自适应调整已禁用，跳过定时任务");
            return;
        }

        log.info("开始执行每日APS策略权重自适应调整...");
        long startTime = System.currentTimeMillis();

        try {
            executeWeightAdjustment();
        } catch (Exception e) {
            log.error("每日权重调整任务失败: {}", e.getMessage(), e);
        }

        long duration = System.currentTimeMillis() - startTime;
        log.info("每日权重调整任务完成，耗时: {}ms", duration);
    }

    /**
     * 执行权重调整
     */
    public Map<String, Object> executeWeightAdjustment() {
        Map<String, Object> result = new HashMap<>();
        List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();

        log.info("发现 {} 个活跃工厂", factoryIds.size());
        result.put("totalFactories", factoryIds.size());

        int successCount = 0;
        int skippedCount = 0;
        int failedCount = 0;
        Map<String, String> factoryResults = new HashMap<>();

        for (String factoryId : factoryIds) {
            try {
                // 检查是否需要调整
                if (!needsAdjustment(factoryId)) {
                    log.debug("工厂 {} 不需要调整权重，跳过", factoryId);
                    factoryResults.put(factoryId, "skipped");
                    skippedCount++;
                    continue;
                }

                // 执行权重调整
                WeightAdjustmentResult adjustResult = adaptationService.adjustWeights(factoryId);

                if (adjustResult.isApplied()) {
                    log.info("工厂 {} 权重调整成功", factoryId);
                    factoryResults.put(factoryId, "success");
                    successCount++;
                } else {
                    log.debug("工厂 {} 权重未变化", factoryId);
                    factoryResults.put(factoryId, "no_change");
                    skippedCount++;
                }

            } catch (Exception e) {
                log.error("工厂 {} 权重调整失败: {}", factoryId, e.getMessage());
                factoryResults.put(factoryId, "failed: " + e.getMessage());
                failedCount++;
            }
        }

        result.put("successCount", successCount);
        result.put("skippedCount", skippedCount);
        result.put("failedCount", failedCount);
        result.put("factoryResults", factoryResults);

        log.info("权重调整汇总: 成功={}, 跳过={}, 失败={}", successCount, skippedCount, failedCount);
        return result;
    }

    /**
     * 判断工厂是否需要调整权重
     */
    private boolean needsAdjustment(String factoryId) {
        // 获取工厂配置
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(null);

        // 没有配置则创建并需要调整
        if (config == null) {
            log.debug("工厂 {} 无配置，将创建默认配置并调整", factoryId);
            return true;
        }

        // 检查是否启用自适应学习
        if (config.getAdaptiveLearningEnabled() == null || !config.getAdaptiveLearningEnabled()) {
            log.debug("工厂 {} 未启用自适应学习", factoryId);
            return false;
        }

        // 检查距离上次调整的时间间隔
        if (config.getLastAdaptationAt() != null) {
            LocalDateTime cutoff = LocalDateTime.now().minusHours(minAdaptationIntervalHours);
            if (config.getLastAdaptationAt().isAfter(cutoff)) {
                log.debug("工厂 {} 距上次调整不足 {} 小时", factoryId, minAdaptationIntervalHours);
                return false;
            }
        }

        return true;
    }

    /**
     * 手动触发单个工厂的权重调整
     *
     * @param factoryId 工厂ID
     * @return 调整结果
     */
    public WeightAdjustmentResult triggerAdjustment(String factoryId) {
        log.info("手动触发工厂 {} 的权重调整", factoryId);
        return adaptationService.adjustWeights(factoryId);
    }

    /**
     * 手动触发所有工厂的权重调整
     *
     * @return 调整结果汇总
     */
    public Map<String, Object> triggerAllAdjustments() {
        log.info("手动触发所有工厂的权重调整");
        return executeWeightAdjustment();
    }

    /**
     * 获取调度器状态
     */
    public Map<String, Object> getSchedulerStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("enabled", adjustmentEnabled);
        status.put("minIntervalHours", minAdaptationIntervalHours);
        status.put("totalActiveFactories", factoryRepository.findAllActiveFactoryIds().size());

        // 统计各工厂的调整状态
        List<FactorySchedulingConfig> configs = configRepository.findByAdaptiveLearningEnabledTrue();
        status.put("adaptiveLearningEnabledFactories", configs.size());

        long recentlyAdjusted = configs.stream()
                .filter(c -> c.getLastAdaptationAt() != null
                        && c.getLastAdaptationAt().isAfter(LocalDateTime.now().minusDays(1)))
                .count();
        status.put("adjustedLast24Hours", recentlyAdjusted);

        return status;
    }
}
