package com.joolun.mall.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.service.SessionProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 会话级实时画像服务实现
 * 使用Redis存储会话画像，支持秒级实时更新
 *
 * Redis Key 设计:
 * - session:profile:{wxUserId}:{sessionId}:categories - Hash (分类权重)
 * - session:profile:{wxUserId}:{sessionId}:prices - List (浏览价格列表)
 * - session:profile:{wxUserId}:{sessionId}:viewed - List (最近浏览商品)
 * - session:profile:{wxUserId}:{sessionId}:searches - List (搜索关键词)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionProfileServiceImpl implements SessionProfileService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // Redis Key 前缀
    private static final String SESSION_PREFIX = "session:profile:";
    private static final String CATEGORIES_SUFFIX = ":categories";
    private static final String PRICES_SUFFIX = ":prices";
    private static final String VIEWED_SUFFIX = ":viewed";
    private static final String SEARCHES_SUFFIX = ":searches";

    // 会话TTL: 30分钟
    private static final long SESSION_TTL_MINUTES = 30;

    // 学习率配置
    private static final double ETA_PURCHASE = 0.30;   // 强信号
    private static final double ETA_CART_ADD = 0.15;   // 中信号 - 加购
    private static final double ETA_FAVORITE = 0.15;   // 中信号 - 收藏
    private static final double ETA_VIEW_LONG = 0.05;  // 弱信号 - 浏览>10s
    private static final double ETA_VIEW_SHORT = 0.02; // 微弱信号 - 浏览<10s
    private static final double ETA_SEARCH = 0.10;     // 搜索信号

    // 最大记录数
    private static final int MAX_VIEWED = 50;
    private static final int MAX_SEARCHES = 20;
    private static final int MAX_PRICES = 100;

    // 时间衰减配置
    private static final double DECAY_FACTOR = 0.95;  // 每分钟衰减5%
    private static final String TIMESTAMPS_SUFFIX = ":timestamps";

    @Override
    public void recordView(String wxUserId, String sessionId, GoodsSpu product, int durationSeconds) {
        if (product == null) return;

        String baseKey = getBaseKey(wxUserId, sessionId);

        try {
            // 1. 更新分类权重
            double eta = durationSeconds >= 10 ? ETA_VIEW_LONG : ETA_VIEW_SHORT;
            updateCategoryWeight(baseKey, product.getCategoryFirst(), eta);

            // 2. 记录价格
            if (product.getSalesPrice() != null) {
                redisTemplate.opsForList().leftPush(baseKey + PRICES_SUFFIX,
                        product.getSalesPrice().toString());
                redisTemplate.opsForList().trim(baseKey + PRICES_SUFFIX, 0, MAX_PRICES - 1);
            }

            // 3. 记录浏览商品ID
            redisTemplate.opsForList().remove(baseKey + VIEWED_SUFFIX, 0, product.getId());
            redisTemplate.opsForList().leftPush(baseKey + VIEWED_SUFFIX, product.getId());
            redisTemplate.opsForList().trim(baseKey + VIEWED_SUFFIX, 0, MAX_VIEWED - 1);

            // 刷新TTL
            refreshSessionTTL(baseKey);

            log.debug("记录浏览: wxUserId={}, productId={}, duration={}s, eta={}",
                    wxUserId, product.getId(), durationSeconds, eta);
        } catch (Exception e) {
            log.warn("记录浏览行为失败: {}", e.getMessage());
        }
    }

    @Override
    public void recordCartAdd(String wxUserId, String sessionId, GoodsSpu product) {
        if (product == null) return;

        String baseKey = getBaseKey(wxUserId, sessionId);

        try {
            // 加购是中信号，权重更新更大
            updateCategoryWeight(baseKey, product.getCategoryFirst(), ETA_CART_ADD);

            if (product.getSalesPrice() != null) {
                // 加购的价格权重更高，记录两次
                redisTemplate.opsForList().leftPush(baseKey + PRICES_SUFFIX,
                        product.getSalesPrice().toString());
                redisTemplate.opsForList().leftPush(baseKey + PRICES_SUFFIX,
                        product.getSalesPrice().toString());
            }

            refreshSessionTTL(baseKey);

            log.debug("记录加购: wxUserId={}, productId={}", wxUserId, product.getId());
        } catch (Exception e) {
            log.warn("记录加购行为失败: {}", e.getMessage());
        }
    }

    @Override
    public void recordFavorite(String wxUserId, String sessionId, GoodsSpu product) {
        if (product == null) return;

        String baseKey = getBaseKey(wxUserId, sessionId);

        try {
            updateCategoryWeight(baseKey, product.getCategoryFirst(), ETA_FAVORITE);
            refreshSessionTTL(baseKey);

            log.debug("记录收藏: wxUserId={}, productId={}", wxUserId, product.getId());
        } catch (Exception e) {
            log.warn("记录收藏行为失败: {}", e.getMessage());
        }
    }

    @Override
    public void recordPurchase(String wxUserId, String sessionId, List<GoodsSpu> products) {
        if (products == null || products.isEmpty()) return;

        String baseKey = getBaseKey(wxUserId, sessionId);

        try {
            for (GoodsSpu product : products) {
                // 购买是强信号
                updateCategoryWeight(baseKey, product.getCategoryFirst(), ETA_PURCHASE);

                if (product.getSalesPrice() != null) {
                    // 购买的价格权重最高，记录三次
                    for (int i = 0; i < 3; i++) {
                        redisTemplate.opsForList().leftPush(baseKey + PRICES_SUFFIX,
                                product.getSalesPrice().toString());
                    }
                }
            }

            refreshSessionTTL(baseKey);

            log.debug("记录购买: wxUserId={}, productCount={}", wxUserId, products.size());
        } catch (Exception e) {
            log.warn("记录购买行为失败: {}", e.getMessage());
        }
    }

    @Override
    public void recordSearch(String wxUserId, String sessionId, String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) return;

        String baseKey = getBaseKey(wxUserId, sessionId);

        try {
            // 记录搜索关键词
            redisTemplate.opsForList().remove(baseKey + SEARCHES_SUFFIX, 0, keyword);
            redisTemplate.opsForList().leftPush(baseKey + SEARCHES_SUFFIX, keyword);
            redisTemplate.opsForList().trim(baseKey + SEARCHES_SUFFIX, 0, MAX_SEARCHES - 1);

            refreshSessionTTL(baseKey);

            log.debug("记录搜索: wxUserId={}, keyword={}", wxUserId, keyword);
        } catch (Exception e) {
            log.warn("记录搜索行为失败: {}", e.getMessage());
        }
    }

    @Override
    public Set<String> getSessionCategories(String wxUserId, String sessionId) {
        String key = getBaseKey(wxUserId, sessionId) + CATEGORIES_SUFFIX;

        try {
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(key);
            if (entries.isEmpty()) {
                return Collections.emptySet();
            }

            // 按权重排序返回
            return entries.entrySet().stream()
                    .sorted((a, b) -> Double.compare(
                            Double.parseDouble(b.getValue().toString()),
                            Double.parseDouble(a.getValue().toString())))
                    .map(e -> e.getKey().toString())
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        } catch (Exception e) {
            log.warn("获取会话分类失败: {}", e.getMessage());
            return Collections.emptySet();
        }
    }

    @Override
    public Map<String, Double> getSessionInterestWeights(String wxUserId, String sessionId) {
        String key = getBaseKey(wxUserId, sessionId) + CATEGORIES_SUFFIX;

        try {
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(key);
            Map<String, Double> weights = new HashMap<>();

            for (Map.Entry<Object, Object> entry : entries.entrySet()) {
                weights.put("category:" + entry.getKey().toString(),
                        Double.parseDouble(entry.getValue().toString()));
            }

            return weights;
        } catch (Exception e) {
            log.warn("获取会话兴趣权重失败: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    @Override
    public Map<String, Double> getSessionPricePreference(String wxUserId, String sessionId) {
        String key = getBaseKey(wxUserId, sessionId) + PRICES_SUFFIX;

        try {
            List<String> priceStrings = redisTemplate.opsForList().range(key, 0, -1);
            if (priceStrings == null || priceStrings.isEmpty()) {
                return Collections.emptyMap();
            }

            DoubleSummaryStatistics stats = priceStrings.stream()
                    .mapToDouble(Double::parseDouble)
                    .summaryStatistics();

            Map<String, Double> preference = new HashMap<>();
            preference.put("min", stats.getMin());
            preference.put("max", stats.getMax());
            preference.put("avg", stats.getAverage());

            return preference;
        } catch (Exception e) {
            log.warn("获取会话价格偏好失败: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    @Override
    public List<String> getRecentViewedInSession(String wxUserId, String sessionId, int limit) {
        String key = getBaseKey(wxUserId, sessionId) + VIEWED_SUFFIX;

        try {
            List<String> viewed = redisTemplate.opsForList().range(key, 0, limit - 1);
            return viewed != null ? viewed : Collections.emptyList();
        } catch (Exception e) {
            log.warn("获取会话浏览记录失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    @Override
    public double calculateSessionMatch(String wxUserId, String sessionId, GoodsSpu product) {
        if (product == null) {
            return 0.0;
        }

        double score = 0.0;

        // 1. 分类匹配
        Map<String, Double> weights = getSessionInterestWeights(wxUserId, sessionId);
        String categoryKey = "category:" + product.getCategoryFirst();
        if (weights.containsKey(categoryKey)) {
            score += weights.get(categoryKey) * 0.5;
        }

        // 2. 价格匹配
        Map<String, Double> pricePrefs = getSessionPricePreference(wxUserId, sessionId);
        if (!pricePrefs.isEmpty() && product.getSalesPrice() != null) {
            double price = product.getSalesPrice().doubleValue();
            double min = pricePrefs.getOrDefault("min", 0.0);
            double max = pricePrefs.getOrDefault("max", Double.MAX_VALUE);
            double avg = pricePrefs.getOrDefault("avg", price);

            // 价格在偏好范围内加分
            if (price >= min && price <= max) {
                // 越接近平均价格分数越高
                double priceDiff = Math.abs(price - avg) / avg;
                score += Math.max(0, 0.3 - priceDiff * 0.3);
            }
        }

        return Math.min(1.0, score);
    }

    @Override
    public Map<String, Double> mergeInterestWeights(
            Map<String, Double> longTermWeights,
            Map<String, Double> sessionWeights,
            double sessionWeight) {

        Map<String, Double> merged = new HashMap<>(longTermWeights);

        for (Map.Entry<String, Double> entry : sessionWeights.entrySet()) {
            String key = entry.getKey();
            double sessionValue = entry.getValue();
            double longTermValue = longTermWeights.getOrDefault(key, 0.0);

            // 加权融合
            double mergedValue = longTermValue * (1 - sessionWeight) + sessionValue * sessionWeight;
            merged.put(key, mergedValue);
        }

        return merged;
    }

    @Override
    public boolean isSessionActive(String wxUserId, String sessionId) {
        String key = getBaseKey(wxUserId, sessionId) + CATEGORIES_SUFFIX;
        Boolean exists = redisTemplate.hasKey(key);
        return Boolean.TRUE.equals(exists);
    }

    @Override
    public void clearSessionProfile(String wxUserId, String sessionId) {
        String baseKey = getBaseKey(wxUserId, sessionId);

        try {
            redisTemplate.delete(Arrays.asList(
                    baseKey + CATEGORIES_SUFFIX,
                    baseKey + PRICES_SUFFIX,
                    baseKey + VIEWED_SUFFIX,
                    baseKey + SEARCHES_SUFFIX,
                    baseKey + TIMESTAMPS_SUFFIX
            ));
            log.info("已清除会话画像: wxUserId={}, sessionId={}", wxUserId, sessionId);
        } catch (Exception e) {
            log.warn("清除会话画像失败: {}", e.getMessage());
        }
    }

    // ==================== 私有方法 ====================

    private String getBaseKey(String wxUserId, String sessionId) {
        return SESSION_PREFIX + wxUserId + ":" + sessionId;
    }

    /**
     * 更新分类权重 (在线学习 + 时间衰减)
     * 公式: decayedWeight = oldWeight * DECAY_FACTOR^decayMinutes
     *       newWeight = decayedWeight + η × (1 - decayedWeight)
     */
    private void updateCategoryWeight(String baseKey, String category, double eta) {
        if (category == null || category.isEmpty()) {
            return;
        }

        String weightKey = baseKey + CATEGORIES_SUFFIX;
        String timestampKey = baseKey + TIMESTAMPS_SUFFIX;

        try {
            // 获取旧权重
            Object oldValue = redisTemplate.opsForHash().get(weightKey, category);
            double oldWeight = oldValue != null ? Double.parseDouble(oldValue.toString()) : 0.0;

            // 获取上次更新时间戳
            Object lastTimestamp = redisTemplate.opsForHash().get(timestampKey, category);
            long lastUpdateTime = lastTimestamp != null ? Long.parseLong(lastTimestamp.toString()) : 0L;
            long currentTime = System.currentTimeMillis();

            // 计算时间衰减
            double decayedWeight = oldWeight;
            if (lastUpdateTime > 0 && oldWeight > 0) {
                long elapsedMinutes = (currentTime - lastUpdateTime) / 60000;
                if (elapsedMinutes > 0) {
                    // 应用指数衰减: weight * decay^minutes
                    decayedWeight = oldWeight * Math.pow(DECAY_FACTOR, elapsedMinutes);
                    log.debug("应用时间衰减: category={}, elapsed={}min, oldWeight={}, decayedWeight={}",
                            category, elapsedMinutes, oldWeight, decayedWeight);
                }
            }

            // 在线学习公式 (使用衰减后的权重)
            double newWeight = decayedWeight + eta * (1.0 - decayedWeight);
            newWeight = Math.min(1.0, newWeight); // 上限1.0

            // 更新权重和时间戳
            redisTemplate.opsForHash().put(weightKey, category, String.valueOf(newWeight));
            redisTemplate.opsForHash().put(timestampKey, category, String.valueOf(currentTime));
        } catch (Exception e) {
            log.warn("更新分类权重失败: category={}, error={}", category, e.getMessage());
        }
    }

    /**
     * 刷新会话TTL
     */
    private void refreshSessionTTL(String baseKey) {
        try {
            redisTemplate.expire(baseKey + CATEGORIES_SUFFIX, SESSION_TTL_MINUTES, TimeUnit.MINUTES);
            redisTemplate.expire(baseKey + PRICES_SUFFIX, SESSION_TTL_MINUTES, TimeUnit.MINUTES);
            redisTemplate.expire(baseKey + VIEWED_SUFFIX, SESSION_TTL_MINUTES, TimeUnit.MINUTES);
            redisTemplate.expire(baseKey + SEARCHES_SUFFIX, SESSION_TTL_MINUTES, TimeUnit.MINUTES);
            redisTemplate.expire(baseKey + TIMESTAMPS_SUFFIX, SESSION_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.warn("刷新会话TTL失败: {}", e.getMessage());
        }
    }
}
