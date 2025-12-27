package com.joolun.mall.service;

import com.joolun.mall.mapper.UserInterestTagMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 推荐系统定时任务
 *
 * 包含以下任务:
 * 1. 动态时间衰减 - 每小时更新用户兴趣标签的衰减因子
 * 2. 低权重标签清理 - 每天清理无效标签
 * 3. 分类统计缓存刷新 - 每小时刷新活跃分类缓存
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationScheduledTasks {

    private final UserInterestTagMapper interestTagMapper;

    // 半衰期配置（天）- 7天后权重衰减到50%
    private static final double HALF_LIFE_DAYS = 7.0;

    // 低权重阈值（有效权重低于此值的标签将被清理）
    private static final double LOW_WEIGHT_THRESHOLD = 0.05;

    // 标签清理天数（超过此天数的低权重标签将被删除）
    private static final int CLEANUP_DAYS = 30;

    /**
     * 动态时间衰减任务
     * 每小时执行一次
     *
     * 使用指数衰减公式: decay = 0.5^(hours / (24 * halfLifeDays))
     * 7天半衰期意味着:
     * - 1天后: 衰减到 90.6%
     * - 3天后: 衰减到 74.1%
     * - 7天后: 衰减到 50.0%
     * - 14天后: 衰减到 25.0%
     * - 21天后: 衰减到 12.5%
     * - 28天后: 衰减到 6.25%
     */
    @Scheduled(cron = "0 0 * * * ?")  // 每小时的第0分钟执行
    public void updateTimeDecay() {
        log.info("开始执行动态时间衰减任务...");
        long startTime = System.currentTimeMillis();

        try {
            int updatedCount = interestTagMapper.batchUpdateExponentialDecay(HALF_LIFE_DAYS);
            long duration = System.currentTimeMillis() - startTime;
            log.info("动态时间衰减完成: 更新 {} 条标签, 耗时 {} ms, 半衰期 {} 天",
                    updatedCount, duration, HALF_LIFE_DAYS);
        } catch (Exception e) {
            log.error("动态时间衰减任务失败", e);
        }
    }

    /**
     * 低权重标签清理任务
     * 每天凌晨3点执行
     *
     * 清理条件:
     * - 有效权重 (weight * decay_factor) 低于阈值
     * - 超过30天未更新
     */
    @Scheduled(cron = "0 0 3 * * ?")  // 每天凌晨3点执行
    public void cleanupInactiveTags() {
        log.info("开始执行低权重标签清理任务...");
        long startTime = System.currentTimeMillis();

        try {
            int deletedCount = interestTagMapper.deleteInactiveTags(LOW_WEIGHT_THRESHOLD, CLEANUP_DAYS);
            long duration = System.currentTimeMillis() - startTime;
            log.info("低权重标签清理完成: 删除 {} 条标签, 耗时 {} ms, 阈值 {}, 天数 {}",
                    deletedCount, duration, LOW_WEIGHT_THRESHOLD, CLEANUP_DAYS);
        } catch (Exception e) {
            log.error("低权重标签清理任务失败", e);
        }
    }

    /**
     * 手动触发衰减更新（用于测试或管理）
     */
    public int manualUpdateDecay() {
        log.info("手动触发衰减更新...");
        return interestTagMapper.batchUpdateExponentialDecay(HALF_LIFE_DAYS);
    }

    /**
     * 手动触发标签清理（用于测试或管理）
     */
    public int manualCleanupTags() {
        log.info("手动触发标签清理...");
        return interestTagMapper.deleteInactiveTags(LOW_WEIGHT_THRESHOLD, CLEANUP_DAYS);
    }

    /**
     * 获取衰减统计信息（用于监控）
     */
    public DecayStats getDecayStats() {
        // 可以扩展查询统计信息
        return new DecayStats(HALF_LIFE_DAYS, LOW_WEIGHT_THRESHOLD, CLEANUP_DAYS);
    }

    /**
     * 衰减统计信息
     */
    public static class DecayStats {
        public final double halfLifeDays;
        public final double lowWeightThreshold;
        public final int cleanupDays;

        public DecayStats(double halfLifeDays, double lowWeightThreshold, int cleanupDays) {
            this.halfLifeDays = halfLifeDays;
            this.lowWeightThreshold = lowWeightThreshold;
            this.cleanupDays = cleanupDays;
        }
    }
}
