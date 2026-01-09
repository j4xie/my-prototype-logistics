package com.joolun.mall.job;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Set;

/**
 * 实时特征维护定时任务
 * 负责清理过期数据、衰减热度分数等
 */
@Slf4j
@Component
public class RealtimeFeatureMaintenanceJob {

    private final RedisTemplate<String, Object> redisTemplate;

    public RealtimeFeatureMaintenanceJob(
            @Qualifier("stringObjectRedisTemplate") RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private static final String PRODUCT_HOT_KEY = "mall:realtime:product:hot";
    private static final String GLOBAL_STATS_PREFIX = "mall:realtime:stats:";

    /**
     * 每小时衰减商品热度分数
     * 让热度分数逐渐降低，使新商品有机会上榜
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void decayProductHotScores() {
        log.info("开始衰减商品热度分数");

        try {
            // 获取所有热门商品
            Set<Object> products = redisTemplate.opsForZSet().range(PRODUCT_HOT_KEY, 0, -1);
            if (products == null || products.isEmpty()) {
                log.info("无热门商品需要衰减");
                return;
            }

            int decayCount = 0;
            for (Object productId : products) {
                Double currentScore = redisTemplate.opsForZSet().score(PRODUCT_HOT_KEY, productId);
                if (currentScore != null && currentScore > 0) {
                    // 衰减系数: 每小时衰减5%
                    double newScore = currentScore * 0.95;

                    // 如果分数低于阈值，移除
                    if (newScore < 0.1) {
                        redisTemplate.opsForZSet().remove(PRODUCT_HOT_KEY, productId);
                    } else {
                        redisTemplate.opsForZSet().add(PRODUCT_HOT_KEY, productId, newScore);
                    }
                    decayCount++;
                }
            }

            log.info("商品热度衰减完成: 处理{}个商品", decayCount);

        } catch (Exception e) {
            log.error("商品热度衰减失败", e);
        }
    }

    /**
     * 每天凌晨清理过期的统计数据
     * 保留最近30天的数据
     */
    @Scheduled(cron = "0 30 3 * * ?")
    public void cleanupOldStats() {
        log.info("开始清理过期统计数据");

        try {
            int cleanedCount = 0;
            LocalDate thirtyDaysAgo = LocalDate.now().minusDays(30);

            // 清理30天前的日统计数据
            for (int i = 31; i <= 60; i++) {
                String dateKey = LocalDate.now().minusDays(i).format(DateTimeFormatter.ISO_DATE);
                String statsKey = GLOBAL_STATS_PREFIX + dateKey;

                Boolean deleted = redisTemplate.delete(statsKey);
                if (Boolean.TRUE.equals(deleted)) {
                    cleanedCount++;
                }
            }

            log.info("过期统计数据清理完成: 清理{}个key", cleanedCount);

        } catch (Exception e) {
            log.error("清理过期统计数据失败", e);
        }
    }

    /**
     * 每天凌晨归档昨日数据
     * 将热点数据汇总保存
     */
    @Scheduled(cron = "0 0 4 * * ?")
    public void archiveDailyData() {
        log.info("开始归档昨日数据");

        try {
            String yesterdayKey = LocalDate.now().minusDays(1).format(DateTimeFormatter.ISO_DATE);
            String statsKey = GLOBAL_STATS_PREFIX + yesterdayKey;

            // 获取昨日统计
            Object stats = redisTemplate.opsForHash().entries(statsKey);
            log.info("昨日统计数据: date={}, stats={}", yesterdayKey, stats);

            // 可以在这里将数据写入数据库进行持久化存储
            // 例如: statsRepository.save(new DailyStats(yesterdayKey, stats));

            log.info("昨日数据归档完成: {}", yesterdayKey);

        } catch (Exception e) {
            log.error("归档昨日数据失败", e);
        }
    }

    /**
     * 每5分钟更新实时统计缓存
     * 用于仪表盘展示
     */
    @Scheduled(fixedRate = 300000)
    public void updateRealtimeDashboardCache() {
        try {
            String todayKey = LocalDate.now().format(DateTimeFormatter.ISO_DATE);
            String statsKey = GLOBAL_STATS_PREFIX + todayKey;

            // 计算今日各项指标
            Object totalViews = redisTemplate.opsForHash().get(statsKey, "totalViews");
            Object totalClicks = redisTemplate.opsForHash().get(statsKey, "totalClicks");
            Object totalPurchases = redisTemplate.opsForHash().get(statsKey, "totalPurchases");
            Object totalGMV = redisTemplate.opsForHash().get(statsKey, "totalGMV");

            // 更新仪表盘缓存
            String dashboardKey = "mall:dashboard:realtime";
            redisTemplate.opsForHash().put(dashboardKey, "todayViews", totalViews != null ? totalViews : 0);
            redisTemplate.opsForHash().put(dashboardKey, "todayClicks", totalClicks != null ? totalClicks : 0);
            redisTemplate.opsForHash().put(dashboardKey, "todayPurchases", totalPurchases != null ? totalPurchases : 0);
            redisTemplate.opsForHash().put(dashboardKey, "todayGMV", totalGMV != null ? totalGMV : 0);
            redisTemplate.opsForHash().put(dashboardKey, "lastUpdated", System.currentTimeMillis());

            log.debug("实时仪表盘缓存已更新");

        } catch (Exception e) {
            log.warn("更新实时仪表盘缓存失败", e);
        }
    }
}
