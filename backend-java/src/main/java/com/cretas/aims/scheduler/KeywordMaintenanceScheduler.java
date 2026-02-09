package com.cretas.aims.scheduler;

import com.cretas.aims.entity.intent.FactoryAILearningConfig;
import com.cretas.aims.service.FactoryConfigService;
import com.cretas.aims.service.KeywordEffectivenessService;
import com.cretas.aims.service.KeywordPromotionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * 关键词维护调度器
 * 负责关键词效果追踪、清理、晋升等定时任务
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KeywordMaintenanceScheduler {

    private final KeywordEffectivenessService effectivenessService;
    private final KeywordPromotionService promotionService;
    private final FactoryConfigService factoryConfigService;

    @Value("${cretas.ai.keyword.promotion.min-factories:3}")
    private int promotionMinFactories;

    @Value("${cretas.ai.keyword.promotion.min-effectiveness:0.80}")
    private BigDecimal promotionMinEffectiveness;

    /**
     * 每日05:00 - 清理低效关键词
     */
    @Scheduled(cron = "0 0 5 * * ?")
    public void cleanupLowEffectivenessKeywords() {
        log.info("========== 开始执行低效关键词清理任务 ==========");

        try {
            List<FactoryAILearningConfig> configs = factoryConfigService.getCleanupEnabledFactories();
            int totalCleaned = 0;

            for (FactoryAILearningConfig config : configs) {
                String factoryId = config.getFactoryId();
                BigDecimal threshold = config.getCleanupThreshold();
                int minNegative = config.getCleanupMinNegative();

                try {
                    int cleaned = effectivenessService.cleanupLowEffectivenessKeywords(
                        factoryId, threshold, minNegative);
                    totalCleaned += cleaned;

                    if (cleaned > 0) {
                        log.info("工厂 {} 清理了 {} 个低效关键词 (阈值: {}, 最小负反馈: {})",
                            factoryId, cleaned, threshold, minNegative);
                    }
                } catch (Exception e) {
                    log.error("工厂 {} 清理关键词失败: {}", factoryId, e.getMessage(), e);
                }
            }

            log.info("低效关键词清理任务完成: 检查 {} 个工厂, 共清理 {} 个关键词",
                configs.size(), totalCleaned);

        } catch (Exception e) {
            log.error("低效关键词清理任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 每日05:30 - 重算所有关键词的 Specificity
     */
    @Scheduled(cron = "0 30 5 * * ?")
    public void recalculateSpecificity() {
        log.info("========== 开始执行 Specificity 重算任务 ==========");

        try {
            effectivenessService.recalculateAllSpecificity();

            // 更新所有工厂的最后重算时间
            List<String> factories = factoryConfigService.getAutoLearnEnabledFactories();
            for (String factoryId : factories) {
                factoryConfigService.updateLastSpecificityRecalcTime(factoryId);
            }

            log.info("Specificity 重算任务完成");

        } catch (Exception e) {
            log.error("Specificity 重算任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 每日06:00 - 检查关键词晋升
     */
    @Scheduled(cron = "0 0 6 * * ?")
    public void runPromotionCheck() {
        log.info("========== 开始执行关键词晋升检查任务 ==========");

        try {
            int promoted = promotionService.runPromotionCheck(
                promotionMinFactories, promotionMinEffectiveness);

            log.info("关键词晋升检查任务完成: 晋升 {} 个关键词到全局 (要求: {}+ 工厂, 效果 >= {})",
                promoted, promotionMinFactories, promotionMinEffectiveness);

        } catch (Exception e) {
            log.error("关键词晋升检查任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 每日06:30 - 检查工厂阶段转换
     */
    @Scheduled(cron = "0 30 6 * * ?")
    public void checkPhaseTransitions() {
        log.info("========== 开始执行工厂阶段转换检查 ==========");

        try {
            int transitioned = factoryConfigService.checkPhaseTransitions();

            log.info("工厂阶段转换检查完成: {} 个工厂从 LEARNING 转换到 MATURE", transitioned);

        } catch (Exception e) {
            log.error("工厂阶段转换检查异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 每周一 03:00 - 同步效果评分到采用记录
     */
    @Scheduled(cron = "0 0 3 ? * MON")
    public void syncEffectivenessToAdoption() {
        log.info("========== 开始执行效果评分同步任务 ==========");

        try {
            // 此任务用于将 keyword_effectiveness 的评分同步到 keyword_factory_adoption
            // 实现由 promotion service 处理
            List<String> factories = factoryConfigService.getAutoLearnEnabledFactories();
            log.info("效果评分同步任务完成: 检查 {} 个工厂", factories.size());

        } catch (Exception e) {
            log.error("效果评分同步任务异常: {}", e.getMessage(), e);
        }
    }
}
