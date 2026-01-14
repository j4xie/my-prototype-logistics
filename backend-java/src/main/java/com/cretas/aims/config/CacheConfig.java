package com.cretas.aims.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * 缓存配置 - 支持 Redis 和内存缓存降级
 *
 * 当 Redis 可用时使用 Redis 缓存，否则降级到内存缓存
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Configuration
@EnableCaching
public class CacheConfig {

    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    /**
     * Redis 缓存管理器 - 当 Redis 可用时使用
     *
     * 缓存名称及其过期时间:
     * - aiAnalysisResults: AI分析结果缓存，7天过期
     * - aiIntents: AI意图缓存，1小时过期
     * - aiQuota: AI配额缓存，1小时过期
     * - dashboardStats: 仪表盘统计缓存，5分钟过期
     *
     * @param connectionFactory Redis连接工厂
     * @return 缓存管理器
     */
    @Bean
    @Primary
    @ConditionalOnBean(RedisConnectionFactory.class)
    public CacheManager redisCacheManager(RedisConnectionFactory connectionFactory) {
        log.info("使用 Redis 缓存管理器");

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new GenericJackson2JsonRedisSerializer()));

        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
        cacheConfigurations.put("aiAnalysisResults", defaultConfig.entryTtl(Duration.ofDays(7)));
        cacheConfigurations.put("aiIntents", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("aiQuota", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("dashboardStats", defaultConfig.entryTtl(Duration.ofMinutes(5)));
        // AI意图服务缓存
        cacheConfigurations.put("allIntents", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("intentsByCategory", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("intentCategories", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("intentsBySensitivity", defaultConfig.entryTtl(Duration.ofHours(1)));
        // Legacy 缓存（向后兼容）
        cacheConfigurations.put("allIntents_legacy", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("intentsByCategory_legacy", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("intentCategories_legacy", defaultConfig.entryTtl(Duration.ofHours(1)));
        // AI Tool 数据查询缓存 - 提升 SSE 流式响应性能
        cacheConfigurations.put("qualityStats", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("shipmentStats", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("customerStats", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        cacheConfigurations.put("alertStats", defaultConfig.entryTtl(Duration.ofMinutes(5)));
        cacheConfigurations.put("equipmentStats", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        cacheConfigurations.put("productTypes", defaultConfig.entryTtl(Duration.ofHours(4)));
        cacheConfigurations.put("materialTypes", defaultConfig.entryTtl(Duration.ofHours(6)));
        cacheConfigurations.put("equipmentList", defaultConfig.entryTtl(Duration.ofHours(2)));
        cacheConfigurations.put("customerList", defaultConfig.entryTtl(Duration.ofHours(2)));
        // AI 报告缓存
        cacheConfigurations.put("dailySummary", defaultConfig.entryTtl(Duration.ofHours(24)));
        cacheConfigurations.put("weeklySummary", defaultConfig.entryTtl(Duration.ofDays(7)));
        cacheConfigurations.put("aiToolResult", defaultConfig.entryTtl(Duration.ofMinutes(10)));

        // ========== 报表缓存 (2026-01-14) ==========
        // 实时性要求高的报表
        cacheConfigurations.put("realtimeReport", defaultConfig.entryTtl(Duration.ofMinutes(1)));
        // 中等实时性报表
        cacheConfigurations.put("oeeReport", defaultConfig.entryTtl(Duration.ofMinutes(5)));
        cacheConfigurations.put("kpiMetrics", defaultConfig.entryTtl(Duration.ofMinutes(5)));
        cacheConfigurations.put("costVarianceReport", defaultConfig.entryTtl(Duration.ofMinutes(10)));
        cacheConfigurations.put("capacityUtilization", defaultConfig.entryTtl(Duration.ofMinutes(10)));
        cacheConfigurations.put("onTimeDelivery", defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigurations.put("productionByProduct", defaultConfig.entryTtl(Duration.ofMinutes(5)));
        // 稳定数据报表
        cacheConfigurations.put("monthlyReport", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigurations.put("yearlyReport", defaultConfig.entryTtl(Duration.ofHours(24)));
        cacheConfigurations.put("inventoryReport", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        cacheConfigurations.put("financeReport", defaultConfig.entryTtl(Duration.ofHours(1)));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .build();
    }

    /**
     * 内存缓存管理器 - 当 Redis 不可用时作为降级方案
     *
     * @return 简单内存缓存管理器
     */
    @Bean
    @ConditionalOnMissingBean(RedisConnectionFactory.class)
    public CacheManager simpleCacheManager() {
        log.warn("Redis 不可用，使用内存缓存作为降级方案");

        SimpleCacheManager cacheManager = new SimpleCacheManager();
        cacheManager.setCaches(Arrays.asList(
                new ConcurrentMapCache("aiAnalysisResults"),
                new ConcurrentMapCache("aiIntents"),
                new ConcurrentMapCache("aiQuota"),
                new ConcurrentMapCache("dashboardStats"),
                // AI意图服务缓存
                new ConcurrentMapCache("allIntents"),
                new ConcurrentMapCache("intentsByCategory"),
                new ConcurrentMapCache("intentCategories"),
                new ConcurrentMapCache("intentsBySensitivity"),
                // Legacy 缓存（向后兼容）
                new ConcurrentMapCache("allIntents_legacy"),
                new ConcurrentMapCache("intentsByCategory_legacy"),
                new ConcurrentMapCache("intentCategories_legacy"),
                // AI Tool 数据查询缓存 - 提升 SSE 流式响应性能
                new ConcurrentMapCache("qualityStats"),
                new ConcurrentMapCache("shipmentStats"),
                new ConcurrentMapCache("customerStats"),
                new ConcurrentMapCache("alertStats"),
                new ConcurrentMapCache("equipmentStats"),
                new ConcurrentMapCache("productTypes"),
                new ConcurrentMapCache("materialTypes"),
                new ConcurrentMapCache("equipmentList"),
                new ConcurrentMapCache("customerList"),
                // AI 报告缓存
                new ConcurrentMapCache("dailySummary"),
                new ConcurrentMapCache("weeklySummary"),
                new ConcurrentMapCache("aiToolResult"),
                // 报表缓存 (2026-01-14)
                new ConcurrentMapCache("realtimeReport"),
                new ConcurrentMapCache("oeeReport"),
                new ConcurrentMapCache("kpiMetrics"),
                new ConcurrentMapCache("costVarianceReport"),
                new ConcurrentMapCache("capacityUtilization"),
                new ConcurrentMapCache("onTimeDelivery"),
                new ConcurrentMapCache("productionByProduct"),
                new ConcurrentMapCache("monthlyReport"),
                new ConcurrentMapCache("yearlyReport"),
                new ConcurrentMapCache("inventoryReport"),
                new ConcurrentMapCache("financeReport")
        ));
        return cacheManager;
    }
}
