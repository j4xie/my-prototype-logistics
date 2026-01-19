package com.joolun.mall.service.impl;

import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.service.FrequencyCapService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 频控服务实现
 *
 * 频控规则:
 * - 同一商品24小时内最多曝光1次
 * - 同一商品7天内最多曝光3次
 *
 * Redis存储结构:
 * - Key: freq:cap:{wxUserId}:{productId}
 * - Type: Sorted Set
 * - Score: 曝光时间戳(毫秒)
 * - Member: 曝光记录标识(timestamp)
 * - TTL: 7天自动过期
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FrequencyCapServiceImpl implements FrequencyCapService {

    private final StringRedisTemplate redisTemplate;

    // Redis Key 前缀
    private static final String FREQ_CAP_PREFIX = "freq:cap:";

    // 时间窗口配置
    private static final long ONE_DAY_MS = 24 * 60 * 60 * 1000L;
    private static final long SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

    // 频控阈值
    private static final int MAX_EXPOSURE_24H = 1;   // 24小时内最多曝光1次
    private static final int MAX_EXPOSURE_7D = 3;    // 7天内最多曝光3次

    // Key TTL
    private static final long KEY_TTL_DAYS = 7;

    @Override
    public void recordExposure(String wxUserId, String productId) {
        if (wxUserId == null || wxUserId.isEmpty() || productId == null || productId.isEmpty()) {
            log.warn("记录曝光失败: 参数为空, wxUserId={}, productId={}", wxUserId, productId);
            return;
        }

        try {
            String key = buildKey(wxUserId, productId);
            long now = System.currentTimeMillis();

            // 使用ZADD记录曝光时间
            redisTemplate.opsForZSet().add(key, String.valueOf(now), now);

            // 设置Key过期时间
            redisTemplate.expire(key, KEY_TTL_DAYS, TimeUnit.DAYS);

            // 清理过期数据(7天前)
            long cutoffTime = now - SEVEN_DAYS_MS;
            redisTemplate.opsForZSet().removeRangeByScore(key, 0, cutoffTime);

            log.debug("记录商品曝光: wxUserId={}, productId={}, timestamp={}", wxUserId, productId, now);
        } catch (Exception e) {
            log.error("记录曝光异常: wxUserId={}, productId={}", wxUserId, productId, e);
        }
    }

    @Override
    public void recordExposures(String wxUserId, List<String> productIds) {
        if (wxUserId == null || wxUserId.isEmpty() || productIds == null || productIds.isEmpty()) {
            return;
        }

        try {
            long now = System.currentTimeMillis();
            long cutoffTime = now - SEVEN_DAYS_MS;

            // 使用Pipeline批量操作
            redisTemplate.executePipelined(new SessionCallback<Object>() {
                @Override
                @SuppressWarnings("unchecked")
                public Object execute(RedisOperations operations) throws DataAccessException {
                    ZSetOperations<String, String> zSetOps = operations.opsForZSet();

                    for (String productId : productIds) {
                        if (productId == null || productId.isEmpty()) {
                            continue;
                        }
                        String key = buildKey(wxUserId, productId);

                        // 添加曝光记录
                        zSetOps.add(key, String.valueOf(now), now);

                        // 清理过期数据
                        zSetOps.removeRangeByScore(key, 0, cutoffTime);
                    }
                    return null;
                }
            });

            // 批量设置过期时间
            for (String productId : productIds) {
                if (productId != null && !productId.isEmpty()) {
                    String key = buildKey(wxUserId, productId);
                    redisTemplate.expire(key, KEY_TTL_DAYS, TimeUnit.DAYS);
                }
            }

            log.debug("批量记录曝光: wxUserId={}, count={}", wxUserId, productIds.size());
        } catch (Exception e) {
            log.error("批量记录曝光异常: wxUserId={}, count={}", wxUserId, productIds.size(), e);
        }
    }

    @Override
    public boolean isInFrequencyCap(String wxUserId, String productId) {
        if (wxUserId == null || wxUserId.isEmpty() || productId == null || productId.isEmpty()) {
            return false;  // 参数无效时不限制
        }

        try {
            String key = buildKey(wxUserId, productId);
            long now = System.currentTimeMillis();

            // 检查24小时内曝光次数
            long twentyFourHoursAgo = now - ONE_DAY_MS;
            Long count24h = redisTemplate.opsForZSet().count(key, twentyFourHoursAgo, now);
            if (count24h != null && count24h >= MAX_EXPOSURE_24H) {
                log.debug("商品24小时频控: wxUserId={}, productId={}, count={}", wxUserId, productId, count24h);
                return true;
            }

            // 检查7天内曝光次数
            long sevenDaysAgo = now - SEVEN_DAYS_MS;
            Long count7d = redisTemplate.opsForZSet().count(key, sevenDaysAgo, now);
            if (count7d != null && count7d >= MAX_EXPOSURE_7D) {
                log.debug("商品7天频控: wxUserId={}, productId={}, count={}", wxUserId, productId, count7d);
                return true;
            }

            return false;
        } catch (Exception e) {
            log.error("检查频控异常: wxUserId={}, productId={}", wxUserId, productId, e);
            return false;  // 异常时不限制，保证推荐可用
        }
    }

    @Override
    public Set<String> getFrequencyCappedProducts(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return Collections.emptySet();
        }

        Set<String> cappedProducts = new HashSet<>();

        try {
            // 扫描用户所有频控Key
            String pattern = FREQ_CAP_PREFIX + wxUserId + ":*";
            Set<String> keys = redisTemplate.keys(pattern);

            if (keys == null || keys.isEmpty()) {
                return Collections.emptySet();
            }

            long now = System.currentTimeMillis();
            long twentyFourHoursAgo = now - ONE_DAY_MS;
            long sevenDaysAgo = now - SEVEN_DAYS_MS;

            for (String key : keys) {
                // 提取productId
                String productId = extractProductId(key, wxUserId);
                if (productId == null) {
                    continue;
                }

                // 检查是否被频控
                Long count24h = redisTemplate.opsForZSet().count(key, twentyFourHoursAgo, now);
                if (count24h != null && count24h >= MAX_EXPOSURE_24H) {
                    cappedProducts.add(productId);
                    continue;
                }

                Long count7d = redisTemplate.opsForZSet().count(key, sevenDaysAgo, now);
                if (count7d != null && count7d >= MAX_EXPOSURE_7D) {
                    cappedProducts.add(productId);
                }
            }

            log.debug("获取频控商品列表: wxUserId={}, count={}", wxUserId, cappedProducts.size());
        } catch (Exception e) {
            log.error("获取频控商品列表异常: wxUserId={}", wxUserId, e);
        }

        return cappedProducts;
    }

    @Override
    public List<GoodsSpu> filterByFrequencyCap(String wxUserId, List<GoodsSpu> products) {
        if (products == null || products.isEmpty()) {
            return products;
        }

        if (wxUserId == null || wxUserId.isEmpty()) {
            return products;  // 匿名用户不限制
        }

        try {
            // 获取频控商品集合
            Set<String> cappedProducts = getFrequencyCappedProducts(wxUserId);

            if (cappedProducts.isEmpty()) {
                return products;
            }

            // 过滤掉频控商品
            List<GoodsSpu> filtered = products.stream()
                    .filter(product -> product != null &&
                            product.getId() != null &&
                            !cappedProducts.contains(product.getId()))
                    .collect(Collectors.toList());

            int removedCount = products.size() - filtered.size();
            if (removedCount > 0) {
                log.info("频控过滤: wxUserId={}, 原数量={}, 过滤后={}, 移除={}",
                        wxUserId, products.size(), filtered.size(), removedCount);
            }

            return filtered;
        } catch (Exception e) {
            log.error("频控过滤异常: wxUserId={}", wxUserId, e);
            return products;  // 异常时返回原列表，保证推荐可用
        }
    }

    @Override
    public int getRecentExposureCount(String wxUserId, int days) {
        if (wxUserId == null || wxUserId.isEmpty() || days <= 0) {
            return 0;
        }

        try {
            // 扫描用户所有频控Key
            String pattern = FREQ_CAP_PREFIX + wxUserId + ":*";
            Set<String> keys = redisTemplate.keys(pattern);

            if (keys == null || keys.isEmpty()) {
                return 0;
            }

            long now = System.currentTimeMillis();
            long startTime = now - (long) days * ONE_DAY_MS;
            int totalCount = 0;

            for (String key : keys) {
                Long count = redisTemplate.opsForZSet().count(key, startTime, now);
                if (count != null) {
                    totalCount += count.intValue();
                }
            }

            log.debug("获取近期曝光统计: wxUserId={}, days={}, count={}", wxUserId, days, totalCount);
            return totalCount;
        } catch (Exception e) {
            log.error("获取曝光统计异常: wxUserId={}, days={}", wxUserId, days, e);
            return 0;
        }
    }

    @Override
    public long cleanupExpiredExposures(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return 0;
        }

        try {
            String pattern = FREQ_CAP_PREFIX + wxUserId + ":*";
            Set<String> keys = redisTemplate.keys(pattern);

            if (keys == null || keys.isEmpty()) {
                return 0;
            }

            long now = System.currentTimeMillis();
            long cutoffTime = now - SEVEN_DAYS_MS;
            long totalRemoved = 0;

            for (String key : keys) {
                Long removed = redisTemplate.opsForZSet().removeRangeByScore(key, 0, cutoffTime);
                if (removed != null) {
                    totalRemoved += removed;
                }

                // 如果Key为空则删除
                Long size = redisTemplate.opsForZSet().zCard(key);
                if (size == null || size == 0) {
                    redisTemplate.delete(key);
                }
            }

            log.info("清理过期曝光数据: wxUserId={}, removed={}", wxUserId, totalRemoved);
            return totalRemoved;
        } catch (Exception e) {
            log.error("清理过期数据异常: wxUserId={}", wxUserId, e);
            return 0;
        }
    }

    /**
     * 构建Redis Key
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @return Redis Key
     */
    private String buildKey(String wxUserId, String productId) {
        return FREQ_CAP_PREFIX + wxUserId + ":" + productId;
    }

    /**
     * 从Key中提取商品ID
     *
     * @param key Redis Key
     * @param wxUserId 用户ID
     * @return 商品ID
     */
    private String extractProductId(String key, String wxUserId) {
        String prefix = FREQ_CAP_PREFIX + wxUserId + ":";
        if (key.startsWith(prefix)) {
            return key.substring(prefix.length());
        }
        return null;
    }
}
