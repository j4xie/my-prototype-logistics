package com.joolun.mall.service.impl;

import com.joolun.mall.service.RealtimeFeatureService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 实时特征服务实现
 * 基于 Redis 实现用户和商品的实时特征计算
 */
@Slf4j
@Service
public class RealtimeFeatureServiceImpl implements RealtimeFeatureService {

    private final RedisTemplate<String, Object> redisTemplate;

    public RealtimeFeatureServiceImpl(
            @Qualifier("stringObjectRedisTemplate") RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // Redis Key 前缀
    private static final String USER_FEATURE_KEY = "mall:realtime:user:";
    private static final String USER_VIEWS_KEY = "mall:realtime:user:views:";
    private static final String USER_CLICKS_KEY = "mall:realtime:user:clicks:";
    private static final String USER_SEARCHES_KEY = "mall:realtime:user:searches:";
    private static final String USER_PURCHASES_KEY = "mall:realtime:user:purchases:";
    private static final String USER_FAVORITES_KEY = "mall:realtime:user:favorites:";

    private static final String PRODUCT_FEATURE_KEY = "mall:realtime:product:";
    private static final String PRODUCT_HOT_KEY = "mall:realtime:product:hot";

    private static final String GLOBAL_STATS_KEY = "mall:realtime:stats:";

    // TTL 配置
    private static final int USER_FEATURE_TTL_DAYS = 7;
    private static final int PRODUCT_FEATURE_TTL_HOURS = 24;

    // ==================== 用户实时特征 ====================

    @Override
    public Map<String, Object> getUserRealtimeFeatures(Long userId) {
        Map<String, Object> features = new HashMap<>();
        String key = USER_FEATURE_KEY + userId;

        // 获取基础特征
        Map<Object, Object> storedFeatures = redisTemplate.opsForHash().entries(key);
        storedFeatures.forEach((k, v) -> features.put(k.toString(), v));

        // 计算派生特征
        features.put("activityScore", getUserActivityScore(userId));
        features.put("priceSensitivity", getUserPriceSensitivity(userId));
        features.put("recentViewCount", getRecentViewedProducts(userId, 100).size());
        features.put("recentSearchCount", getRecentSearchQueries(userId, 50).size());

        // 时间特征
        LocalDateTime now = LocalDateTime.now();
        features.put("hourOfDay", now.getHour());
        features.put("dayOfWeek", now.getDayOfWeek().getValue());
        features.put("isWeekend", now.getDayOfWeek().getValue() >= 6);

        return features;
    }

    @Override
    public void recordView(Long userId, String productId, int duration) {
        String userKey = USER_FEATURE_KEY + userId;
        String viewsKey = USER_VIEWS_KEY + userId;
        String dateKey = getDateKey();

        // 更新用户浏览计数
        redisTemplate.opsForHash().increment(userKey, "totalViews", 1);
        redisTemplate.opsForHash().increment(userKey, "totalViewDuration", duration);
        redisTemplate.opsForHash().put(userKey, "lastViewTime", System.currentTimeMillis());
        setExpire(userKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        // 记录浏览的商品 (ZSet, score为时间戳)
        redisTemplate.opsForZSet().add(viewsKey, productId, System.currentTimeMillis());
        redisTemplate.opsForZSet().removeRange(viewsKey, 0, -101); // 只保留最近100个
        setExpire(viewsKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        // 更新商品实时特征
        incrementProductView(productId);

        // 更新全局统计
        redisTemplate.opsForHash().increment(GLOBAL_STATS_KEY + dateKey, "totalViews", 1);

        log.debug("记录浏览: userId={}, productId={}, duration={}s", userId, productId, duration);
    }

    @Override
    public void recordClick(Long userId, String productId, String source) {
        String userKey = USER_FEATURE_KEY + userId;
        String clicksKey = USER_CLICKS_KEY + userId;
        String dateKey = getDateKey();

        // 更新用户点击计数
        redisTemplate.opsForHash().increment(userKey, "totalClicks", 1);
        redisTemplate.opsForHash().increment(userKey, "clicks_" + source, 1);
        redisTemplate.opsForHash().put(userKey, "lastClickTime", System.currentTimeMillis());
        setExpire(userKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        // 记录点击的商品
        redisTemplate.opsForZSet().add(clicksKey, productId, System.currentTimeMillis());
        redisTemplate.opsForZSet().removeRange(clicksKey, 0, -51); // 只保留最近50个
        setExpire(clicksKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        // 更新商品实时特征
        incrementProductClick(productId);

        // 更新全局统计
        redisTemplate.opsForHash().increment(GLOBAL_STATS_KEY + dateKey, "totalClicks", 1);

        log.debug("记录点击: userId={}, productId={}, source={}", userId, productId, source);
    }

    @Override
    public void recordSearch(Long userId, String query, int resultCount) {
        String userKey = USER_FEATURE_KEY + userId;
        String searchesKey = USER_SEARCHES_KEY + userId;
        String dateKey = getDateKey();

        // 更新用户搜索计数
        redisTemplate.opsForHash().increment(userKey, "totalSearches", 1);
        if (resultCount == 0) {
            redisTemplate.opsForHash().increment(userKey, "noResultSearches", 1);
        }
        redisTemplate.opsForHash().put(userKey, "lastSearchTime", System.currentTimeMillis());
        setExpire(userKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        // 记录搜索词
        redisTemplate.opsForZSet().add(searchesKey, query, System.currentTimeMillis());
        redisTemplate.opsForZSet().removeRange(searchesKey, 0, -31); // 只保留最近30个
        setExpire(searchesKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        // 更新全局统计
        redisTemplate.opsForHash().increment(GLOBAL_STATS_KEY + dateKey, "totalSearches", 1);

        log.debug("记录搜索: userId={}, query={}, resultCount={}", userId, query, resultCount);
    }

    @Override
    public void recordPurchase(Long userId, String productId, double amount) {
        String userKey = USER_FEATURE_KEY + userId;
        String purchasesKey = USER_PURCHASES_KEY + userId;
        String dateKey = getDateKey();

        // 更新用户购买计数
        redisTemplate.opsForHash().increment(userKey, "totalPurchases", 1);
        redisTemplate.opsForHash().increment(userKey, "totalSpent", (long) (amount * 100));
        redisTemplate.opsForHash().put(userKey, "lastPurchaseTime", System.currentTimeMillis());

        // 更新价格偏好统计
        updatePricePreference(userId, amount);

        setExpire(userKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        // 记录购买的商品
        redisTemplate.opsForZSet().add(purchasesKey, productId, System.currentTimeMillis());
        setExpire(purchasesKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        // 更新商品销量
        incrementProductSales(productId, 1);

        // 更新全局统计
        redisTemplate.opsForHash().increment(GLOBAL_STATS_KEY + dateKey, "totalPurchases", 1);
        redisTemplate.opsForHash().increment(GLOBAL_STATS_KEY + dateKey, "totalGMV", (long) (amount * 100));

        log.debug("记录购买: userId={}, productId={}, amount={}", userId, productId, amount);
    }

    @Override
    public void recordFavorite(Long userId, String productId, boolean isFavorite) {
        String userKey = USER_FEATURE_KEY + userId;
        String favoritesKey = USER_FAVORITES_KEY + userId;

        if (isFavorite) {
            redisTemplate.opsForHash().increment(userKey, "totalFavorites", 1);
            redisTemplate.opsForSet().add(favoritesKey, productId);
        } else {
            redisTemplate.opsForHash().increment(userKey, "totalFavorites", -1);
            redisTemplate.opsForSet().remove(favoritesKey, productId);
        }

        setExpire(userKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);
        setExpire(favoritesKey, USER_FEATURE_TTL_DAYS, TimeUnit.DAYS);

        log.debug("记录收藏: userId={}, productId={}, isFavorite={}", userId, productId, isFavorite);
    }

    @Override
    public List<String> getRecentViewedProducts(Long userId, int limit) {
        String viewsKey = USER_VIEWS_KEY + userId;
        Set<Object> products = redisTemplate.opsForZSet().reverseRange(viewsKey, 0, limit - 1);
        if (products == null) {
            return new ArrayList<>();
        }
        return products.stream().map(Object::toString).collect(Collectors.toList());
    }

    @Override
    public List<String> getRecentSearchQueries(Long userId, int limit) {
        String searchesKey = USER_SEARCHES_KEY + userId;
        Set<Object> queries = redisTemplate.opsForZSet().reverseRange(searchesKey, 0, limit - 1);
        if (queries == null) {
            return new ArrayList<>();
        }
        return queries.stream().map(Object::toString).collect(Collectors.toList());
    }

    // ==================== 商品实时特征 ====================

    @Override
    public Map<String, Object> getProductRealtimeFeatures(String productId) {
        Map<String, Object> features = new HashMap<>();
        String key = PRODUCT_FEATURE_KEY + productId;

        // 获取存储的特征
        Map<Object, Object> storedFeatures = redisTemplate.opsForHash().entries(key);
        storedFeatures.forEach((k, v) -> features.put(k.toString(), v));

        // 添加热度分数
        features.put("hotScore", getProductHotScore(productId));

        return features;
    }

    @Override
    public void incrementProductView(String productId) {
        String key = PRODUCT_FEATURE_KEY + productId;
        String dateKey = getDateKey();

        redisTemplate.opsForHash().increment(key, "views_" + dateKey, 1);
        redisTemplate.opsForHash().increment(key, "totalViews", 1);
        setExpire(key, PRODUCT_FEATURE_TTL_HOURS, TimeUnit.HOURS);

        // 更新热度排行
        updateProductHotScore(productId, 1);
    }

    @Override
    public void incrementProductClick(String productId) {
        String key = PRODUCT_FEATURE_KEY + productId;
        String dateKey = getDateKey();

        redisTemplate.opsForHash().increment(key, "clicks_" + dateKey, 1);
        redisTemplate.opsForHash().increment(key, "totalClicks", 1);
        setExpire(key, PRODUCT_FEATURE_TTL_HOURS, TimeUnit.HOURS);

        // 更新热度排行 (点击权重更高)
        updateProductHotScore(productId, 3);
    }

    @Override
    public void incrementProductSales(String productId, int quantity) {
        String key = PRODUCT_FEATURE_KEY + productId;
        String dateKey = getDateKey();

        redisTemplate.opsForHash().increment(key, "sales_" + dateKey, quantity);
        redisTemplate.opsForHash().increment(key, "totalSales", quantity);
        setExpire(key, PRODUCT_FEATURE_TTL_HOURS, TimeUnit.HOURS);

        // 更新热度排行 (销量权重最高)
        updateProductHotScore(productId, 10 * quantity);
    }

    @Override
    public double getProductHotScore(String productId) {
        Double score = redisTemplate.opsForZSet().score(PRODUCT_HOT_KEY, productId);
        return score != null ? Math.min(score, 100) : 0;
    }

    @Override
    public List<String> getHotProducts(int limit) {
        Set<Object> products = redisTemplate.opsForZSet().reverseRange(PRODUCT_HOT_KEY, 0, limit - 1);
        if (products == null) {
            return new ArrayList<>();
        }
        return products.stream().map(Object::toString).collect(Collectors.toList());
    }

    // ==================== 实时统计 ====================

    @Override
    public Map<String, Object> getRealtimeStats() {
        Map<String, Object> stats = new HashMap<>();
        String dateKey = getDateKey();

        Map<Object, Object> todayStats = redisTemplate.opsForHash().entries(GLOBAL_STATS_KEY + dateKey);
        todayStats.forEach((k, v) -> stats.put("today_" + k.toString(), v));

        // 热门商品
        stats.put("hotProducts", getHotProducts(10));

        // 活跃用户数（近1小时有行为的用户）
        stats.put("generatedAt", LocalDateTime.now().toString());

        return stats;
    }

    @Override
    public double getUserActivityScore(Long userId) {
        String userKey = USER_FEATURE_KEY + userId;
        Map<Object, Object> features = redisTemplate.opsForHash().entries(userKey);

        if (features.isEmpty()) {
            return 0;
        }

        // 基于行为计算活跃度分数
        double score = 0;

        // 浏览贡献
        long views = getLongValue(features, "totalViews");
        score += Math.min(views * 0.5, 20);

        // 点击贡献
        long clicks = getLongValue(features, "totalClicks");
        score += Math.min(clicks * 1, 25);

        // 搜索贡献
        long searches = getLongValue(features, "totalSearches");
        score += Math.min(searches * 2, 20);

        // 购买贡献
        long purchases = getLongValue(features, "totalPurchases");
        score += Math.min(purchases * 5, 25);

        // 收藏贡献
        long favorites = getLongValue(features, "totalFavorites");
        score += Math.min(favorites * 2, 10);

        // 时间衰减 (最近活跃加分)
        Long lastActivity = getLastActivityTime(features);
        if (lastActivity != null) {
            long hoursSinceLastActivity = (System.currentTimeMillis() - lastActivity) / (1000 * 60 * 60);
            if (hoursSinceLastActivity < 1) {
                score *= 1.2;
            } else if (hoursSinceLastActivity < 24) {
                score *= 1.1;
            } else if (hoursSinceLastActivity > 168) { // 7天
                score *= 0.5;
            }
        }

        return Math.min(score, 100);
    }

    @Override
    public double getUserPriceSensitivity(Long userId) {
        String userKey = USER_FEATURE_KEY + userId;
        Map<Object, Object> features = redisTemplate.opsForHash().entries(userKey);

        if (features.isEmpty()) {
            return 0.5; // 默认中等敏感度
        }

        // 基于购买行为计算价格敏感度
        long totalPurchases = getLongValue(features, "totalPurchases");
        if (totalPurchases == 0) {
            return 0.5;
        }

        long totalSpent = getLongValue(features, "totalSpent") / 100; // 分转元
        double avgOrderValue = (double) totalSpent / totalPurchases;

        // 获取价格区间偏好
        long lowPriceCount = getLongValue(features, "priceRange_low");
        long midPriceCount = getLongValue(features, "priceRange_mid");
        long highPriceCount = getLongValue(features, "priceRange_high");
        long total = lowPriceCount + midPriceCount + highPriceCount;

        if (total == 0) {
            return 0.5;
        }

        // 低价购买比例越高，价格敏感度越高
        double lowRatio = (double) lowPriceCount / total;
        double highRatio = (double) highPriceCount / total;

        // 敏感度 = 低价偏好 - 高价偏好，归一化到 0-1
        double sensitivity = (lowRatio - highRatio + 1) / 2;

        return Math.max(0, Math.min(1, sensitivity));
    }

    // ==================== 辅助方法 ====================

    private void updateProductHotScore(String productId, double increment) {
        redisTemplate.opsForZSet().incrementScore(PRODUCT_HOT_KEY, productId, increment);
        // 设置过期时间
        redisTemplate.expire(PRODUCT_HOT_KEY, 24, TimeUnit.HOURS);
    }

    private void updatePricePreference(Long userId, double amount) {
        String userKey = USER_FEATURE_KEY + userId;

        // 简单的价格区间划分
        String priceRange;
        if (amount < 50) {
            priceRange = "priceRange_low";
        } else if (amount < 200) {
            priceRange = "priceRange_mid";
        } else {
            priceRange = "priceRange_high";
        }

        redisTemplate.opsForHash().increment(userKey, priceRange, 1);
    }

    private String getDateKey() {
        return LocalDate.now().format(DateTimeFormatter.ISO_DATE);
    }

    private void setExpire(String key, long timeout, TimeUnit unit) {
        redisTemplate.expire(key, timeout, unit);
    }

    private long getLongValue(Map<Object, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return 0;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Long getLastActivityTime(Map<Object, Object> features) {
        Long lastView = getLongOrNull(features, "lastViewTime");
        Long lastClick = getLongOrNull(features, "lastClickTime");
        Long lastSearch = getLongOrNull(features, "lastSearchTime");
        Long lastPurchase = getLongOrNull(features, "lastPurchaseTime");

        return Stream.of(lastView, lastClick, lastSearch, lastPurchase)
                .filter(Objects::nonNull)
                .max(Long::compareTo)
                .orElse(null);
    }

    private Long getLongOrNull(Map<Object, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // 需要导入 Stream
    private static class Stream {
        @SafeVarargs
        static <T> java.util.stream.Stream<T> of(T... values) {
            return java.util.Arrays.stream(values);
        }
    }
}
