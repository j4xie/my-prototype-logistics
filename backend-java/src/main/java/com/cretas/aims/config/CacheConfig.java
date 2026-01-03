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
                new ConcurrentMapCache("intentCategories")
        ));
        return cacheManager;
    }
}
