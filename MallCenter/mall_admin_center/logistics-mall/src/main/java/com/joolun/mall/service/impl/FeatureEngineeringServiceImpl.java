package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.UserBehaviorEvent;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.OrderItemMapper;
import com.joolun.mall.mapper.UserBehaviorEventMapper;
import com.joolun.mall.mapper.UserInterestTagMapper;
import com.joolun.mall.service.FeatureEngineeringService;
import com.joolun.mall.service.VectorSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 特征工程服务实现
 * 为 LinUCB 推荐算法提供 128 维特征向量
 *
 * 实现了以下特征提取:
 * - 用户特征 64维: 基础属性 + 行为序列 + 偏好特征 + 时间特征
 * - 商品特征 64维: 基础属性 + 向量嵌入 + 统计特征 + 上下文特征
 *
 * @author LinUCB Enhancement
 * @since 2026-01-10
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeatureEngineeringServiceImpl implements FeatureEngineeringService {

    private final UserInterestTagMapper userInterestTagMapper;
    private final UserBehaviorEventMapper userBehaviorEventMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final OrderItemMapper orderItemMapper;
    private final VectorSearchService vectorSearchService;
    private final StringRedisTemplate redisTemplate;

    // 缓存配置
    private static final String FEATURE_CACHE_PREFIX = "linucb:feature:";
    private static final long FEATURE_CACHE_TTL_MINUTES = 30;

    // 特征归一化参数
    private static final double MAX_PRICE = 10000.0;  // 最大价格（用于归一化）
    private static final double MAX_SALES = 10000.0;  // 最大销量
    private static final int MAX_BEHAVIOR_DAYS = 30;  // 行为分析天数
    private static final int EMBEDDING_COMPRESS_DIM = 32;  // 压缩后的embedding维度

    // 品类统计缓存配置 (优化点5)
    private static final String CATEGORY_STATS_CACHE_PREFIX = "feature:category:stats:";
    private static final long CATEGORY_STATS_TTL_MINUTES = 60;  // 1小时缓存

    private final ObjectMapper objectMapper = new ObjectMapper();

    // 中国节假日简化判断（实际项目应使用节假日API）
    private static final Set<String> HOLIDAYS = Set.of(
            "01-01", "01-28", "01-29", "01-30", "02-14", "04-05",
            "05-01", "06-22", "09-29", "10-01", "10-02", "10-03",
            "11-11", "12-12", "12-25"
    );

    @Override
    public double[] buildUserFeatureVector(String wxUserId) {
        double[] features = new double[USER_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (wxUserId == null || wxUserId.isEmpty()) {
            return features;
        }

        try {
            // 尝试从缓存获取
            String cacheKey = FEATURE_CACHE_PREFIX + "user:" + wxUserId;
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return parseFeatureVector(cached);
            }

            // 基础属性特征 (0-7): 8维
            double[] basicFeatures = extractUserBasicFeatures(wxUserId);
            System.arraycopy(basicFeatures, 0, features, 0, Math.min(basicFeatures.length, 8));

            // 行为序列特征 (8-31): 24维
            double[] behaviorFeatures = extractBehaviorSequenceFeatures(wxUserId);
            System.arraycopy(behaviorFeatures, 0, features, 8, Math.min(behaviorFeatures.length, 24));

            // 偏好特征 (32-47): 16维
            double[] preferenceFeatures = extractPreferenceFeatures(wxUserId);
            System.arraycopy(preferenceFeatures, 0, features, 32, Math.min(preferenceFeatures.length, 16));

            // 时间上下文特征 (48-63): 16维
            double[] timeFeatures = extractTimeContextFeatures();
            System.arraycopy(timeFeatures, 0, features, 48, Math.min(timeFeatures.length, 16));

            // 归一化
            features = normalizeFeatures(features);

            // 缓存结果
            redisTemplate.opsForValue().set(cacheKey, serializeFeatureVector(features),
                    FEATURE_CACHE_TTL_MINUTES, TimeUnit.MINUTES);

            return features;

        } catch (Exception e) {
            log.warn("构建用户特征向量失败: wxUserId={}, error={}", wxUserId, e.getMessage());
            return features;
        }
    }

    @Override
    public double[] buildProductFeatureVector(GoodsSpu product) {
        double[] features = new double[ITEM_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (product == null) {
            return features;
        }

        try {
            // 尝试从缓存获取
            String cacheKey = FEATURE_CACHE_PREFIX + "product:" + product.getId();
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return parseFeatureVector(cached);
            }

            // 基础属性特征 (0-7): 8维
            double[] basicFeatures = extractProductBasicFeatures(product);
            System.arraycopy(basicFeatures, 0, features, 0, Math.min(basicFeatures.length, 8));

            // 向量嵌入特征 (8-39): 32维
            double[] embeddingFeatures = extractProductEmbeddingFeatures(product);
            System.arraycopy(embeddingFeatures, 0, features, 8, Math.min(embeddingFeatures.length, 32));

            // 统计特征 (40-55): 16维
            double[] statisticsFeatures = extractProductStatisticsFeatures(product);
            System.arraycopy(statisticsFeatures, 0, features, 40, Math.min(statisticsFeatures.length, 16));

            // 上下文特征 (56-63): 8维
            double[] contextFeatures = extractProductContextFeatures(product);
            System.arraycopy(contextFeatures, 0, features, 56, Math.min(contextFeatures.length, 8));

            // 归一化
            features = normalizeFeatures(features);

            // 缓存结果
            redisTemplate.opsForValue().set(cacheKey, serializeFeatureVector(features),
                    FEATURE_CACHE_TTL_MINUTES, TimeUnit.MINUTES);

            return features;

        } catch (Exception e) {
            log.warn("构建商品特征向量失败: productId={}, error={}", product.getId(), e.getMessage());
            return features;
        }
    }

    @Override
    public double[] buildCategoryFeatureVector(String category, List<String> allCategories) {
        double[] features = new double[ITEM_FEATURE_DIM];
        Arrays.fill(features, 0);

        if (category == null || allCategories == null || allCategories.isEmpty()) {
            return features;
        }

        try {
            // One-hot 编码分类 (0-15): 16维
            int index = allCategories.indexOf(category);
            if (index >= 0 && index < 16) {
                features[index] = 1.0;
            } else if (index >= 16) {
                // 超过16个分类使用hash编码
                features[index % 16] = 1.0;
            }

            // 分类热度特征 (16-23): 8维
            double[] categoryHeatFeatures = extractCategoryHeatFeatures(category);
            System.arraycopy(categoryHeatFeatures, 0, features, 16, Math.min(categoryHeatFeatures.length, 8));

            // 分类位置特征 (24-31): 8维
            features[24] = allCategories.isEmpty() ? 0 : (double) index / allCategories.size();
            features[25] = index < allCategories.size() / 3 ? 1.0 : 0;  // 热门分类
            features[26] = index >= allCategories.size() * 2 / 3 ? 1.0 : 0;  // 冷门分类
            features[27] = allCategories.size() > 10 && index < 10 ? 1.0 : 0;  // top10分类

            // 分类统计特征 (32-47): 16维
            double[] categoryStats = extractCategoryStatisticsFeatures(category);
            System.arraycopy(categoryStats, 0, features, 32, Math.min(categoryStats.length, 16));

            // 时间相关特征 (48-55): 8维
            double[] timeFeatures = extractTimeContextFeatures();
            System.arraycopy(timeFeatures, 0, features, 48, 8);

            // 保留 (56-63): 8维，置零

            return normalizeFeatures(features);

        } catch (Exception e) {
            log.warn("构建分类特征向量失败: category={}, error={}", category, e.getMessage());
            return features;
        }
    }

    @Override
    public double[] concatenateFeatures(double[] userFeatures, double[] itemFeatures) {
        double[] combined = new double[TOTAL_FEATURE_DIM];
        Arrays.fill(combined, 0);

        if (userFeatures != null) {
            System.arraycopy(userFeatures, 0, combined, 0,
                    Math.min(userFeatures.length, USER_FEATURE_DIM));
        }
        if (itemFeatures != null) {
            System.arraycopy(itemFeatures, 0, combined, USER_FEATURE_DIM,
                    Math.min(itemFeatures.length, ITEM_FEATURE_DIM));
        }

        return combined;
    }

    @Override
    public Map<String, double[]> batchBuildProductFeatures(List<GoodsSpu> products) {
        Map<String, double[]> result = new HashMap<>();
        if (products == null || products.isEmpty()) {
            return result;
        }

        for (GoodsSpu product : products) {
            result.put(product.getId(), buildProductFeatureVector(product));
        }

        return result;
    }

    // ==================== 用户特征提取 ====================

    /**
     * 提取用户基础属性特征 (8维)
     * - 0: 用户等级归一化 (0-1)
     * - 1: 注册天数归一化
     * - 2: 最近7天活跃度
     * - 3: 最近30天活跃度
     * - 4: 是否新用户
     * - 5: 是否活跃用户
     * - 6: 是否高价值用户
     * - 7: 用户成熟度
     */
    private double[] extractUserBasicFeatures(String wxUserId) {
        double[] features = new double[8];

        try {
            // 获取用户兴趣标签数量作为成熟度指标
            List<UserInterestTag> tags = userInterestTagMapper.selectTopTags(wxUserId, 50);
            int tagCount = tags.size();

            // 获取用户行为统计
            int behaviorCount = userBehaviorEventMapper.countByWxUserId(wxUserId);

            // 获取最近活动
            List<UserBehaviorEvent> recentEvents = userBehaviorEventMapper.selectRecentEvents(wxUserId, 100);

            // 特征计算
            features[0] = Math.min(1.0, tagCount / 20.0);  // 标签数量作为等级代理
            features[1] = Math.min(1.0, behaviorCount / 500.0);  // 行为数量归一化
            features[2] = calculateTimeDecayedActivityRate(recentEvents, 7);  // 7天时间衰减活跃度
            features[3] = calculateTimeDecayedActivityRate(recentEvents, 30);  // 30天时间衰减活跃度
            features[4] = behaviorCount < 10 ? 1.0 : 0;  // 新用户
            features[5] = features[2] > 0.3 ? 1.0 : 0;  // 活跃用户
            features[6] = calculateHighValueScore(tags);  // 高价值用户
            features[7] = calculateUserMaturity(tagCount, behaviorCount);  // 用户成熟度

        } catch (Exception e) {
            log.debug("提取用户基础特征失败: {}", e.getMessage());
        }

        return features;
    }

    @Override
    public double[] extractBehaviorSequenceFeatures(String wxUserId) {
        double[] features = new double[24];
        Arrays.fill(features, 0);

        try {
            // 获取用户最近行为
            List<UserBehaviorEvent> events = userBehaviorEventMapper.selectRecentEvents(wxUserId, 100);
            if (events.isEmpty()) {
                return features;
            }

            // 提取不同类型行为的商品ID
            List<String> viewedProducts = new ArrayList<>();
            List<String> clickedProducts = new ArrayList<>();
            List<String> purchasedProducts = new ArrayList<>();

            for (UserBehaviorEvent event : events) {
                if ("product".equals(event.getTargetType()) && event.getTargetId() != null) {
                    switch (event.getEventType()) {
                        case "view":
                            viewedProducts.add(event.getTargetId());
                            break;
                        case "click":
                            clickedProducts.add(event.getTargetId());
                            break;
                        case "purchase":
                            purchasedProducts.add(event.getTargetId());
                            break;
                    }
                }
            }

            // 计算浏览商品的embedding均值 (0-7): 8维
            double[] viewEmbedding = calculateProductGroupEmbedding(viewedProducts, 8);
            System.arraycopy(viewEmbedding, 0, features, 0, 8);

            // 计算点击商品的embedding均值 (8-15): 8维
            double[] clickEmbedding = calculateProductGroupEmbedding(clickedProducts, 8);
            System.arraycopy(clickEmbedding, 0, features, 8, 8);

            // 计算购买商品的embedding均值 (16-23): 8维
            double[] purchaseEmbedding = calculateProductGroupEmbedding(purchasedProducts, 8);
            System.arraycopy(purchaseEmbedding, 0, features, 16, 8);

        } catch (Exception e) {
            log.debug("提取行为序列特征失败: {}", e.getMessage());
        }

        return features;
    }

    @Override
    public double[] extractPreferenceFeatures(String wxUserId) {
        double[] features = new double[16];
        Arrays.fill(features, 0);

        try {
            List<UserInterestTag> tags = userInterestTagMapper.selectTopTags(wxUserId, 30);
            if (tags.isEmpty()) {
                return features;
            }

            // 价格敏感度特征 (0-3): 4维
            List<UserInterestTag> priceTags = tags.stream()
                    .filter(t -> "price_range".equals(t.getTagType()))
                    .limit(4)
                    .collect(Collectors.toList());
            for (int i = 0; i < priceTags.size() && i < 4; i++) {
                features[i] = priceTags.get(i).getWeight().doubleValue();
            }

            // 品牌偏好特征 (4-7): 4维
            List<UserInterestTag> brandTags = tags.stream()
                    .filter(t -> "brand".equals(t.getTagType()))
                    .limit(4)
                    .collect(Collectors.toList());
            for (int i = 0; i < brandTags.size() && i < 4; i++) {
                features[4 + i] = brandTags.get(i).getWeight().doubleValue();
            }

            // 品类偏好特征 (8-15): 8维
            List<UserInterestTag> categoryTags = tags.stream()
                    .filter(t -> "category".equals(t.getTagType()))
                    .limit(8)
                    .collect(Collectors.toList());
            for (int i = 0; i < categoryTags.size() && i < 8; i++) {
                features[8 + i] = categoryTags.get(i).getWeight().doubleValue();
            }

        } catch (Exception e) {
            log.debug("提取偏好特征失败: {}", e.getMessage());
        }

        return features;
    }

    @Override
    public double[] extractTimeContextFeatures() {
        double[] features = new double[16];
        Arrays.fill(features, 0);

        LocalDateTime now = LocalDateTime.now();
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();

        // 周几 one-hot (0-6): 7维
        features[dayOfWeek.getValue() - 1] = 1.0;

        // 时段特征 (7-10): 4维
        int hour = time.getHour();
        if (hour >= 6 && hour < 12) {
            features[7] = 1.0;  // 上午
        } else if (hour >= 12 && hour < 14) {
            features[8] = 1.0;  // 午间
        } else if (hour >= 14 && hour < 18) {
            features[9] = 1.0;  // 下午
        } else if (hour >= 18 && hour < 22) {
            features[10] = 1.0;  // 晚间
        }
        // else 深夜/凌晨默认为0

        // 是否工作日 (11): 1维
        features[11] = (dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY) ? 1.0 : 0;

        // 是否周末 (12): 1维
        features[12] = (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) ? 1.0 : 0;

        // 是否节假日 (13): 1维
        String monthDay = String.format("%02d-%02d", now.getMonthValue(), now.getDayOfMonth());
        features[13] = HOLIDAYS.contains(monthDay) ? 1.0 : 0;

        // 月初/月中/月末 (14-15): 2维
        int dayOfMonth = now.getDayOfMonth();
        if (dayOfMonth <= 10) {
            features[14] = 1.0;  // 月初
        } else if (dayOfMonth >= 20) {
            features[15] = 1.0;  // 月末
        }
        // 月中默认为0

        return features;
    }

    @Override
    public double[] extractTransitionProbabilityFeatures(String wxUserId) {
        double[] features = new double[16];
        Arrays.fill(features, 0);

        if (wxUserId == null || wxUserId.isEmpty()) {
            return features;
        }

        try {
            // 获取用户最近30天的行为事件
            List<UserBehaviorEvent> events = userBehaviorEventMapper.selectRecentEvents(wxUserId, 500);
            if (events.size() < 2) {
                return features;
            }

            // 按时间排序（从旧到新）
            events.sort((a, b) -> {
                if (a.getEventTime() == null || b.getEventTime() == null) return 0;
                return a.getEventTime().compareTo(b.getEventTime());
            });

            // 统计转移次数
            Map<String, Map<String, Integer>> transitionCounts = new HashMap<>();
            Map<String, Integer> sourceCounts = new HashMap<>();

            // 初始化转移矩阵
            String[] eventTypes = {"view", "click", "cart", "purchase", "favorite", "remove", "checkout"};
            for (String type : eventTypes) {
                transitionCounts.put(type, new HashMap<>());
                sourceCounts.put(type, 0);
            }

            // 计算转移次数（相邻事件之间的转移）
            for (int i = 0; i < events.size() - 1; i++) {
                String sourceType = events.get(i).getEventType();
                String targetType = events.get(i + 1).getEventType();

                if (sourceType != null && targetType != null) {
                    sourceCounts.merge(sourceType, 1, Integer::sum);
                    transitionCounts.get(sourceType).merge(targetType, 1, Integer::sum);
                }
            }

            // 计算转移概率
            // [0-3]: view→click, view→cart, view→purchase, view→view
            int viewCount = sourceCounts.getOrDefault("view", 0);
            if (viewCount > 0) {
                features[0] = transitionCounts.get("view").getOrDefault("click", 0) / (double) viewCount;
                features[1] = transitionCounts.get("view").getOrDefault("cart", 0) / (double) viewCount;
                features[2] = transitionCounts.get("view").getOrDefault("purchase", 0) / (double) viewCount;
                features[3] = transitionCounts.get("view").getOrDefault("view", 0) / (double) viewCount;
            }

            // [4-7]: click→cart, click→purchase, click→favorite, click→click
            int clickCount = sourceCounts.getOrDefault("click", 0);
            if (clickCount > 0) {
                features[4] = transitionCounts.get("click").getOrDefault("cart", 0) / (double) clickCount;
                features[5] = transitionCounts.get("click").getOrDefault("purchase", 0) / (double) clickCount;
                features[6] = transitionCounts.get("click").getOrDefault("favorite", 0) / (double) clickCount;
                features[7] = transitionCounts.get("click").getOrDefault("click", 0) / (double) clickCount;
            }

            // [8-11]: cart→purchase, cart→remove, cart→checkout, cart→cart
            int cartCount = sourceCounts.getOrDefault("cart", 0);
            if (cartCount > 0) {
                features[8] = transitionCounts.get("cart").getOrDefault("purchase", 0) / (double) cartCount;
                features[9] = transitionCounts.get("cart").getOrDefault("remove", 0) / (double) cartCount;
                features[10] = transitionCounts.get("cart").getOrDefault("checkout", 0) / (double) cartCount;
                features[11] = transitionCounts.get("cart").getOrDefault("cart", 0) / (double) cartCount;
            }

            // [12-15]: 同品类复购率, 跨品类探索率, 品牌忠诚度, 价格一致性
            // 12: 同品类复购率
            features[12] = calculateSameCategoryRepurchaseRate(events);

            // 13: 跨品类探索率
            features[13] = calculateCrossCategoryExplorationRate(events);

            // 14: 品牌忠诚度
            features[14] = calculateBrandLoyalty(events);

            // 15: 价格一致性
            features[15] = calculatePriceConsistency(events);

        } catch (Exception e) {
            log.debug("提取转移概率特征失败: wxUserId={}, error={}", wxUserId, e.getMessage());
        }

        return features;
    }

    @Override
    public double[] extractSequencePatternFeatures(String wxUserId) {
        double[] features = new double[8];
        Arrays.fill(features, 0);

        if (wxUserId == null || wxUserId.isEmpty()) {
            return features;
        }

        try {
            // 获取用户最近30天的行为事件
            List<UserBehaviorEvent> events = userBehaviorEventMapper.selectRecentEvents(wxUserId, 500);
            if (events.isEmpty()) {
                return features;
            }

            // 按时间排序（从旧到新）
            events.sort((a, b) -> {
                if (a.getEventTime() == null || b.getEventTime() == null) return 0;
                return a.getEventTime().compareTo(b.getEventTime());
            });

            // [0]: 平均行为间隔时间（归一化到0-1，以小时为单位）
            features[0] = calculateAverageEventInterval(events);

            // [1]: Session深度（单次访问行为数，以30分钟无操作为session分隔）
            features[1] = calculateAverageSessionDepth(events);

            // [2]: 购买速度（日均购买数）
            features[2] = calculatePurchaseVelocity(events);

            // [3]: 探索率（浏览品类数/总浏览数）
            features[3] = calculateExplorationRate(events);

            // [4]: 近期活跃度变化（最近7天 vs 之前7天）
            features[4] = calculateActivityTrend(events);

            // [5]: 周期规律强度（基于星期几的分布）
            features[5] = calculatePeriodicityStrength(events);

            // [6]: 时间规律性（小时分布的集中度）
            features[6] = calculateTimeRegularity(events);

            // [7]: 漏斗完成率（购买数/浏览数）
            features[7] = calculateFunnelCompletionRate(events);

        } catch (Exception e) {
            log.debug("提取序列模式特征失败: wxUserId={}, error={}", wxUserId, e.getMessage());
        }

        return features;
    }

    // ==================== 序列特征辅助方法 ====================

    /**
     * 计算同品类复购率
     */
    private double calculateSameCategoryRepurchaseRate(List<UserBehaviorEvent> events) {
        List<String> purchasedCategories = events.stream()
                .filter(e -> "purchase".equals(e.getEventType()) && e.getTargetId() != null)
                .map(e -> getCategoryForProduct(e.getTargetId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (purchasedCategories.size() < 2) {
            return 0;
        }

        // 统计重复购买的品类数
        Set<String> uniqueCategories = new HashSet<>(purchasedCategories);
        int repeatPurchases = purchasedCategories.size() - uniqueCategories.size();

        return Math.min(1.0, repeatPurchases / (double) (purchasedCategories.size() - 1));
    }

    /**
     * 计算跨品类探索率
     */
    private double calculateCrossCategoryExplorationRate(List<UserBehaviorEvent> events) {
        List<String> viewedCategories = events.stream()
                .filter(e -> "view".equals(e.getEventType()) && e.getTargetId() != null)
                .map(e -> getCategoryForProduct(e.getTargetId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (viewedCategories.isEmpty()) {
            return 0;
        }

        Set<String> uniqueCategories = new HashSet<>(viewedCategories);
        return Math.min(1.0, uniqueCategories.size() / (double) viewedCategories.size());
    }

    /**
     * 计算品牌忠诚度
     */
    private double calculateBrandLoyalty(List<UserBehaviorEvent> events) {
        List<String> purchasedBrands = events.stream()
                .filter(e -> "purchase".equals(e.getEventType()) && e.getTargetId() != null)
                .map(e -> getBrandForProduct(e.getTargetId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (purchasedBrands.size() < 2) {
            return 0.5; // 数据不足时返回中性值
        }

        // 计算品牌集中度（最常购买品牌的比例）
        Map<String, Long> brandCounts = purchasedBrands.stream()
                .collect(Collectors.groupingBy(b -> b, Collectors.counting()));

        long maxCount = brandCounts.values().stream().mapToLong(Long::longValue).max().orElse(1);
        return Math.min(1.0, maxCount / (double) purchasedBrands.size());
    }

    /**
     * 计算价格一致性
     */
    private double calculatePriceConsistency(List<UserBehaviorEvent> events) {
        List<Double> prices = events.stream()
                .filter(e -> "purchase".equals(e.getEventType()) && e.getTargetId() != null)
                .map(e -> getPriceForProduct(e.getTargetId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (prices.size() < 2) {
            return 0.5; // 数据不足时返回中性值
        }

        // 计算价格的变异系数（CV = std / mean）
        double mean = prices.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        if (mean == 0) {
            return 0.5;
        }

        double variance = prices.stream()
                .mapToDouble(p -> Math.pow(p - mean, 2))
                .average()
                .orElse(0);
        double std = Math.sqrt(variance);
        double cv = std / mean;

        // CV越小，价格一致性越高
        return Math.max(0, 1.0 - cv);
    }

    /**
     * 计算平均行为间隔时间
     */
    private double calculateAverageEventInterval(List<UserBehaviorEvent> events) {
        if (events.size() < 2) {
            return 0.5;
        }

        List<Long> intervals = new ArrayList<>();
        for (int i = 1; i < events.size(); i++) {
            LocalDateTime t1 = events.get(i - 1).getEventTime();
            LocalDateTime t2 = events.get(i).getEventTime();
            if (t1 != null && t2 != null) {
                long minutes = ChronoUnit.MINUTES.between(t1, t2);
                if (minutes >= 0 && minutes < 60 * 24 * 7) { // 排除超过7天的异常间隔
                    intervals.add(minutes);
                }
            }
        }

        if (intervals.isEmpty()) {
            return 0.5;
        }

        double avgMinutes = intervals.stream().mapToLong(Long::longValue).average().orElse(60);
        // 归一化：1小时=1.0，越短越高
        return Math.min(1.0, 60.0 / (avgMinutes + 1));
    }

    /**
     * 计算平均Session深度
     */
    private double calculateAverageSessionDepth(List<UserBehaviorEvent> events) {
        if (events.isEmpty()) {
            return 0;
        }

        List<Integer> sessionSizes = new ArrayList<>();
        int currentSessionSize = 1;

        for (int i = 1; i < events.size(); i++) {
            LocalDateTime t1 = events.get(i - 1).getEventTime();
            LocalDateTime t2 = events.get(i).getEventTime();

            if (t1 != null && t2 != null) {
                long minutes = ChronoUnit.MINUTES.between(t1, t2);
                if (minutes <= 30) { // 30分钟内算同一session
                    currentSessionSize++;
                } else {
                    sessionSizes.add(currentSessionSize);
                    currentSessionSize = 1;
                }
            }
        }
        sessionSizes.add(currentSessionSize);

        double avgDepth = sessionSizes.stream().mapToInt(Integer::intValue).average().orElse(1);
        // 归一化：10次行为=1.0
        return Math.min(1.0, avgDepth / 10.0);
    }

    /**
     * 计算购买速度（日均购买数）
     */
    private double calculatePurchaseVelocity(List<UserBehaviorEvent> events) {
        long purchaseCount = events.stream()
                .filter(e -> "purchase".equals(e.getEventType()))
                .count();

        if (purchaseCount == 0) {
            return 0;
        }

        // 计算事件跨度天数
        LocalDateTime firstEvent = events.stream()
                .map(UserBehaviorEvent::getEventTime)
                .filter(Objects::nonNull)
                .min(LocalDateTime::compareTo)
                .orElse(null);

        LocalDateTime lastEvent = events.stream()
                .map(UserBehaviorEvent::getEventTime)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);

        if (firstEvent == null || lastEvent == null) {
            return 0;
        }

        long days = Math.max(1, ChronoUnit.DAYS.between(firstEvent, lastEvent) + 1);
        double purchasesPerDay = purchaseCount / (double) days;

        // 归一化：每天2次购买=1.0
        return Math.min(1.0, purchasesPerDay / 2.0);
    }

    /**
     * 计算探索率
     */
    private double calculateExplorationRate(List<UserBehaviorEvent> events) {
        List<String> viewedProducts = events.stream()
                .filter(e -> "view".equals(e.getEventType()) && e.getTargetId() != null)
                .map(UserBehaviorEvent::getTargetId)
                .collect(Collectors.toList());

        if (viewedProducts.isEmpty()) {
            return 0;
        }

        Set<String> uniqueProducts = new HashSet<>(viewedProducts);
        return (double) uniqueProducts.size() / viewedProducts.size();
    }

    /**
     * 计算活跃度趋势（近7天 vs 前7天）
     */
    private double calculateActivityTrend(List<UserBehaviorEvent> events) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime sevenDaysAgo = now.minusDays(7);
        LocalDateTime fourteenDaysAgo = now.minusDays(14);

        long recentCount = events.stream()
                .filter(e -> e.getEventTime() != null && e.getEventTime().isAfter(sevenDaysAgo))
                .count();

        long previousCount = events.stream()
                .filter(e -> e.getEventTime() != null
                        && e.getEventTime().isAfter(fourteenDaysAgo)
                        && e.getEventTime().isBefore(sevenDaysAgo))
                .count();

        if (previousCount == 0) {
            return recentCount > 0 ? 1.0 : 0.5;
        }

        double ratio = recentCount / (double) previousCount;
        // 归一化：ratio=2表示增长，ratio=0.5表示下降
        return Math.min(1.0, Math.max(0, (ratio - 0.5) / 1.5));
    }

    /**
     * 计算周期规律强度（基于星期几的分布）
     */
    private double calculatePeriodicityStrength(List<UserBehaviorEvent> events) {
        int[] dayOfWeekCounts = new int[7];

        for (UserBehaviorEvent event : events) {
            if (event.getEventTime() != null) {
                int dayIndex = event.getEventTime().getDayOfWeek().getValue() - 1;
                dayOfWeekCounts[dayIndex]++;
            }
        }

        // 计算分布的熵
        int total = Arrays.stream(dayOfWeekCounts).sum();
        if (total == 0) {
            return 0;
        }

        double entropy = 0;
        for (int count : dayOfWeekCounts) {
            if (count > 0) {
                double p = count / (double) total;
                entropy -= p * Math.log(p);
            }
        }

        // 最大熵 = log(7)，越集中熵越小，规律性越强
        double maxEntropy = Math.log(7);
        return 1.0 - (entropy / maxEntropy);
    }

    /**
     * 计算时间规律性（小时分布的集中度）
     */
    private double calculateTimeRegularity(List<UserBehaviorEvent> events) {
        int[] hourCounts = new int[24];

        for (UserBehaviorEvent event : events) {
            if (event.getEventTime() != null) {
                int hour = event.getEventTime().getHour();
                hourCounts[hour]++;
            }
        }

        // 计算方差
        int total = Arrays.stream(hourCounts).sum();
        if (total == 0) {
            return 0;
        }

        double mean = total / 24.0;
        double variance = Arrays.stream(hourCounts)
                .mapToDouble(c -> Math.pow(c - mean, 2))
                .average()
                .orElse(0);

        // 方差越大，分布越集中（规律性越强）
        // 归一化
        return Math.min(1.0, variance / (mean * mean + 1));
    }

    /**
     * 计算漏斗完成率
     */
    private double calculateFunnelCompletionRate(List<UserBehaviorEvent> events) {
        long viewCount = events.stream()
                .filter(e -> "view".equals(e.getEventType()))
                .count();

        long purchaseCount = events.stream()
                .filter(e -> "purchase".equals(e.getEventType()))
                .count();

        if (viewCount == 0) {
            return 0;
        }

        return Math.min(1.0, purchaseCount / (double) viewCount);
    }

    /**
     * 获取商品所属品类
     */
    private String getCategoryForProduct(String productId) {
        try {
            GoodsSpu product = goodsSpuMapper.selectById(productId);
            return product != null ? product.getCategoryFirst() : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 获取商品品牌
     */
    private String getBrandForProduct(String productId) {
        try {
            GoodsSpu product = goodsSpuMapper.selectById(productId);
            return product != null ? product.getCategorySecond() : null; // 使用二级分类作为品牌代理
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 获取商品价格
     */
    private Double getPriceForProduct(String productId) {
        try {
            GoodsSpu product = goodsSpuMapper.selectById(productId);
            return product != null && product.getSalesPrice() != null
                    ? product.getSalesPrice().doubleValue() : null;
        } catch (Exception e) {
            return null;
        }
    }

    // ==================== 商品特征提取 ====================

    /**
     * 提取商品基础属性特征 (8维)
     */
    private double[] extractProductBasicFeatures(GoodsSpu product) {
        double[] features = new double[8];

        // 价格归一化
        if (product.getSalesPrice() != null) {
            features[0] = Math.min(1.0, product.getSalesPrice().doubleValue() / MAX_PRICE);
        }

        // 市场价与销售价比率（折扣力度）
        if (product.getMarketPrice() != null && product.getSalesPrice() != null
                && product.getMarketPrice().compareTo(BigDecimal.ZERO) > 0) {
            features[1] = 1.0 - (product.getSalesPrice().doubleValue() / product.getMarketPrice().doubleValue());
        }

        // 库存状态
        if (product.getStock() != null) {
            features[2] = product.getStock() > 0 ? 1.0 : 0;  // 是否有库存
            features[3] = Math.min(1.0, product.getStock() / 1000.0);  // 库存量归一化
        }

        // 上架状态
        features[4] = "1".equals(product.getShelf()) ? 1.0 : 0;

        // 上架时间新鲜度
        if (product.getCreateTime() != null) {
            long daysSinceCreation = ChronoUnit.DAYS.between(product.getCreateTime(), LocalDateTime.now());
            features[5] = Math.max(0, 1.0 - daysSinceCreation / 365.0);  // 一年内的新鲜度
        }

        // 是否有促销（折扣超过10%）
        features[6] = features[1] > 0.1 ? 1.0 : 0;

        // 价格区间（低/中/高）
        if (product.getSalesPrice() != null) {
            double price = product.getSalesPrice().doubleValue();
            if (price < 50) {
                features[7] = 0.2;  // 低价
            } else if (price < 200) {
                features[7] = 0.5;  // 中价
            } else {
                features[7] = 0.8;  // 高价
            }
        }

        return features;
    }

    @Override
    public double[] extractProductEmbeddingFeatures(GoodsSpu product) {
        double[] features = new double[EMBEDDING_COMPRESS_DIM];
        Arrays.fill(features, 0);

        if (product == null || !vectorSearchService.isAvailable()) {
            return features;
        }

        try {
            // 获取商品的1536维向量
            float[] fullEmbedding = vectorSearchService.vectorizeProduct(product);

            if (fullEmbedding != null && fullEmbedding.length > 0) {
                // 使用加权池化压缩embedding (优化点3)
                int poolSize = fullEmbedding.length / EMBEDDING_COMPRESS_DIM;
                for (int i = 0; i < EMBEDDING_COMPRESS_DIM; i++) {
                    double weightedSum = 0;
                    double weightSum = 0;
                    int start = i * poolSize;
                    int end = Math.min(start + poolSize, fullEmbedding.length);
                    for (int j = start; j < end; j++) {
                        // 位置越靠前权重越高
                        double weight = 1.0 + 0.5 * (1.0 - (double)(j - start) / poolSize);
                        weightedSum += fullEmbedding[j] * weight;
                        weightSum += weight;
                    }
                    features[i] = weightSum > 0 ? weightedSum / weightSum : 0;
                }
            }

        } catch (Exception e) {
            log.debug("提取商品embedding特征失败: productId={}, error={}",
                    product.getId(), e.getMessage());
        }

        return features;
    }

    @Override
    public double[] extractProductStatisticsFeatures(GoodsSpu product) {
        double[] features = new double[16];
        Arrays.fill(features, 0);

        if (product == null) {
            return features;
        }

        // 销量特征 (0-3): 4维
        if (product.getSaleNum() != null) {
            int sales = product.getSaleNum();
            features[0] = Math.min(1.0, sales / MAX_SALES);  // 销量归一化
            features[1] = sales > 100 ? 1.0 : 0;  // 热销标记
            features[2] = sales > 500 ? 1.0 : 0;  // 爆款标记
            features[3] = Math.log1p(sales) / 10.0;  // 对数销量
        }

        // 排序特征 (4-7): 4维
        if (product.getSort() != null) {
            features[4] = Math.min(1.0, product.getSort() / 100.0);  // 排序值归一化
            features[5] = product.getSort() <= 10 ? 1.0 : 0;  // 是否置顶
        }

        // 版本/更新频率 (8-9): 2维
        if (product.getVersion() != null) {
            features[8] = Math.min(1.0, product.getVersion() / 50.0);  // 版本号归一化
        }
        if (product.getUpdateTime() != null) {
            long daysSinceUpdate = ChronoUnit.DAYS.between(product.getUpdateTime(), LocalDateTime.now());
            features[9] = Math.max(0, 1.0 - daysSinceUpdate / 30.0);  // 最近更新新鲜度
        }

        // 图片数量特征 (10-11): 2维
        if (product.getPicUrls() != null) {
            features[10] = Math.min(1.0, product.getPicUrls().length / 5.0);  // 图片数量归一化
            features[11] = product.getPicUrls().length >= 3 ? 1.0 : 0;  // 是否有足够图片
        }

        // 描述丰富度 (12-15): 4维
        if (product.getDescription() != null) {
            int descLen = product.getDescription().length();
            features[12] = Math.min(1.0, descLen / 500.0);  // 描述长度归一化
            features[13] = descLen > 100 ? 1.0 : 0;  // 有详细描述
        }
        if (product.getSellPoint() != null) {
            features[14] = Math.min(1.0, product.getSellPoint().length() / 100.0);
            features[15] = product.getSellPoint().length() > 10 ? 1.0 : 0;
        }

        return features;
    }

    /**
     * 提取商品上下文特征 (8维)
     */
    private double[] extractProductContextFeatures(GoodsSpu product) {
        double[] features = new double[8];
        Arrays.fill(features, 0);

        if (product == null) {
            return features;
        }

        try {
            String categoryFirst = product.getCategoryFirst();
            if (categoryFirst != null) {
                // 分类热度
                LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
                wrapper.eq(GoodsSpu::getCategoryFirst, categoryFirst)
                        .eq(GoodsSpu::getShelf, "1");
                Long categoryCount = goodsSpuMapper.selectCount(wrapper);

                features[0] = Math.min(1.0, categoryCount / 100.0);  // 同分类商品数
                features[1] = categoryCount > 20 ? 1.0 : 0;  // 热门分类
                features[2] = categoryCount < 5 ? 1.0 : 0;  // 稀缺分类

                // 竞品数量（同分类同价格区间）
                if (product.getSalesPrice() != null) {
                    double price = product.getSalesPrice().doubleValue();
                    double lowerBound = price * 0.8;
                    double upperBound = price * 1.2;

                    LambdaQueryWrapper<GoodsSpu> competitorWrapper = new LambdaQueryWrapper<>();
                    competitorWrapper.eq(GoodsSpu::getCategoryFirst, categoryFirst)
                            .eq(GoodsSpu::getShelf, "1")
                            .between(GoodsSpu::getSalesPrice, lowerBound, upperBound);
                    Long competitorCount = goodsSpuMapper.selectCount(competitorWrapper);

                    features[3] = Math.min(1.0, competitorCount / 50.0);  // 竞品数量
                    features[4] = competitorCount > 10 ? 1.0 : 0;  // 竞争激烈
                    features[5] = competitorCount < 3 ? 1.0 : 0;  // 蓝海市场
                }
            }

            // 二级分类特征
            if (product.getCategorySecond() != null) {
                features[6] = 1.0;  // 有二级分类
            }

            // SPU编码特征（是否有规范编码）
            if (product.getSpuCode() != null && !product.getSpuCode().isEmpty()) {
                features[7] = 1.0;
            }

        } catch (Exception e) {
            log.debug("提取商品上下文特征失败: {}", e.getMessage());
        }

        return features;
    }

    // ==================== 分类特征提取 ====================

    /**
     * 获取品类统计信息（带Redis缓存，优化点5）
     * 缓存1小时，避免重复计算品类级别的统计特征
     */
    private Map<String, CategoryStats> getCachedCategoryStats() {
        String cacheKey = CATEGORY_STATS_CACHE_PREFIX + "all";
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null && !cached.isEmpty()) {
                return objectMapper.readValue(cached,
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, CategoryStats>>() {});
            }
        } catch (Exception e) {
            log.debug("读取品类统计缓存失败: {}", e.getMessage());
        }

        // 计算并缓存
        Map<String, CategoryStats> stats = computeAllCategoryStats();
        try {
            redisTemplate.opsForValue().set(cacheKey,
                objectMapper.writeValueAsString(stats),
                CATEGORY_STATS_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.debug("写入品类统计缓存失败: {}", e.getMessage());
        }
        return stats;
    }

    /**
     * 计算所有品类的统计信息
     */
    private Map<String, CategoryStats> computeAllCategoryStats() {
        Map<String, CategoryStats> result = new HashMap<>();
        try {
            // 查询所有上架商品
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1");
            List<GoodsSpu> allProducts = goodsSpuMapper.selectList(wrapper);

            // 按品类分组计算统计
            Map<String, List<GoodsSpu>> byCategory = allProducts.stream()
                .filter(p -> p.getCategoryFirst() != null)
                .collect(Collectors.groupingBy(GoodsSpu::getCategoryFirst));

            for (Map.Entry<String, List<GoodsSpu>> entry : byCategory.entrySet()) {
                String category = entry.getKey();
                List<GoodsSpu> products = entry.getValue();

                CategoryStats stats = new CategoryStats();
                stats.productCount = products.size();
                stats.totalSales = products.stream()
                    .filter(p -> p.getSaleNum() != null)
                    .mapToInt(GoodsSpu::getSaleNum)
                    .sum();
                stats.avgPrice = products.stream()
                    .filter(p -> p.getSalesPrice() != null)
                    .mapToDouble(p -> p.getSalesPrice().doubleValue())
                    .average()
                    .orElse(0);
                stats.inStockRatio = products.stream()
                    .filter(p -> p.getStock() != null && p.getStock() > 0)
                    .count() / (double) products.size();

                result.put(category, stats);
            }
        } catch (Exception e) {
            log.warn("计算品类统计失败: {}", e.getMessage());
        }
        return result;
    }

    /**
     * 品类统计内部类
     */
    private static class CategoryStats {
        int productCount;
        int totalSales;
        double avgPrice;
        double inStockRatio;
    }

    /**
     * 提取分类热度特征 (8维)
     */
    private double[] extractCategoryHeatFeatures(String category) {
        double[] features = new double[8];
        Arrays.fill(features, 0);

        if (category == null) {
            return features;
        }

        try {
            // 尝试从缓存获取品类统计 (优化点5)
            Map<String, CategoryStats> cachedStats = getCachedCategoryStats();
            CategoryStats stats = cachedStats.get(category);
            if (stats != null) {
                features[0] = Math.min(1.0, stats.productCount / 50.0);
                features[1] = Math.min(1.0, stats.totalSales / 10000.0);
                features[2] = Math.min(1.0, stats.avgPrice / MAX_PRICE);
                features[4] = stats.inStockRatio;
                // 其他特征仍需计算，但避免了主要的重复查询
            }

            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getCategoryFirst, category)
                    .eq(GoodsSpu::getShelf, "1");
            List<GoodsSpu> products = goodsSpuMapper.selectList(wrapper);

            if (!products.isEmpty()) {
                // 如果没有缓存命中，使用原始计算
                if (stats == null) {
                    // 商品数量
                    features[0] = Math.min(1.0, products.size() / 50.0);

                    // 总销量
                    int totalSales = products.stream()
                            .filter(p -> p.getSaleNum() != null)
                            .mapToInt(GoodsSpu::getSaleNum)
                            .sum();
                    features[1] = Math.min(1.0, totalSales / 10000.0);

                    // 平均价格
                    double avgPrice = products.stream()
                            .filter(p -> p.getSalesPrice() != null)
                            .mapToDouble(p -> p.getSalesPrice().doubleValue())
                            .average()
                            .orElse(0);
                    features[2] = Math.min(1.0, avgPrice / MAX_PRICE);

                    // 有库存的商品比例
                    long inStockCount = products.stream()
                            .filter(p -> p.getStock() != null && p.getStock() > 0)
                            .count();
                    features[4] = (double) inStockCount / products.size();
                }

                // 价格方差（品类多样性）- 仍需每次计算
                double priceVariance = calculateVariance(
                        products.stream()
                                .filter(p -> p.getSalesPrice() != null)
                                .mapToDouble(p -> p.getSalesPrice().doubleValue())
                                .toArray()
                );
                features[3] = Math.min(1.0, priceVariance / 10000.0);

                // 新品比例（30天内上架）
                LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
                long newProductCount = products.stream()
                        .filter(p -> p.getCreateTime() != null && p.getCreateTime().isAfter(thirtyDaysAgo))
                        .count();
                features[5] = (double) newProductCount / products.size();

                // 热销品比例
                long hotProductCount = products.stream()
                        .filter(p -> p.getSaleNum() != null && p.getSaleNum() > 100)
                        .count();
                features[6] = (double) hotProductCount / products.size();

                // 有促销的比例
                long discountCount = products.stream()
                        .filter(p -> p.getMarketPrice() != null && p.getSalesPrice() != null
                                && p.getMarketPrice().compareTo(p.getSalesPrice()) > 0)
                        .count();
                features[7] = (double) discountCount / products.size();
            }

        } catch (Exception e) {
            log.debug("提取分类热度特征失败: {}", e.getMessage());
        }

        return features;
    }

    /**
     * 提取分类统计特征 (16维)
     */
    private double[] extractCategoryStatisticsFeatures(String category) {
        double[] features = new double[16];
        Arrays.fill(features, 0);

        if (category == null) {
            return features;
        }

        try {
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getCategoryFirst, category)
                    .eq(GoodsSpu::getShelf, "1");
            List<GoodsSpu> products = goodsSpuMapper.selectList(wrapper);

            if (!products.isEmpty()) {
                // 价格分布 (0-4): 5维
                double[] prices = products.stream()
                        .filter(p -> p.getSalesPrice() != null)
                        .mapToDouble(p -> p.getSalesPrice().doubleValue())
                        .toArray();

                if (prices.length > 0) {
                    Arrays.sort(prices);
                    features[0] = prices[0] / MAX_PRICE;  // 最低价
                    features[1] = prices[prices.length - 1] / MAX_PRICE;  // 最高价
                    features[2] = prices[prices.length / 2] / MAX_PRICE;  // 中位价
                    features[3] = Arrays.stream(prices).average().orElse(0) / MAX_PRICE;  // 平均价
                    features[4] = (prices[prices.length - 1] - prices[0]) / MAX_PRICE;  // 价格跨度
                }

                // 销量分布 (5-9): 5维
                int[] sales = products.stream()
                        .filter(p -> p.getSaleNum() != null)
                        .mapToInt(GoodsSpu::getSaleNum)
                        .toArray();

                if (sales.length > 0) {
                    Arrays.sort(sales);
                    features[5] = sales[0] / MAX_SALES;
                    features[6] = sales[sales.length - 1] / MAX_SALES;
                    features[7] = sales[sales.length / 2] / MAX_SALES;
                    features[8] = Arrays.stream(sales).average().orElse(0) / MAX_SALES;
                    features[9] = (double) Arrays.stream(sales).sum() / (products.size() * MAX_SALES);
                }

                // 库存分布 (10-12): 3维
                int totalStock = products.stream()
                        .filter(p -> p.getStock() != null)
                        .mapToInt(GoodsSpu::getStock)
                        .sum();
                features[10] = Math.min(1.0, totalStock / 10000.0);
                features[11] = products.stream().anyMatch(p -> p.getStock() != null && p.getStock() == 0) ? 1.0 : 0;
                features[12] = products.stream().allMatch(p -> p.getStock() != null && p.getStock() > 0) ? 1.0 : 0;

                // 更新活跃度 (13-15): 3维
                LocalDateTime now = LocalDateTime.now();
                long recentlyUpdated = products.stream()
                        .filter(p -> p.getUpdateTime() != null
                                && ChronoUnit.DAYS.between(p.getUpdateTime(), now) < 7)
                        .count();
                features[13] = (double) recentlyUpdated / products.size();

                long recentlyCreated = products.stream()
                        .filter(p -> p.getCreateTime() != null
                                && ChronoUnit.DAYS.between(p.getCreateTime(), now) < 7)
                        .count();
                features[14] = (double) recentlyCreated / products.size();

                features[15] = Math.min(1.0, products.size() / 100.0);  // 分类规模
            }

        } catch (Exception e) {
            log.debug("提取分类统计特征失败: {}", e.getMessage());
        }

        return features;
    }

    // ==================== 工具方法 ====================

    @Override
    public double[] normalizeFeatures(double[] features) {
        if (features == null || features.length == 0) {
            return features;
        }

        double[] normalized = new double[features.length];
        for (int i = 0; i < features.length; i++) {
            // 将特征值限制在 [0, 1] 区间
            normalized[i] = Math.max(0, Math.min(1, features[i]));

            // 处理 NaN 和 Infinity
            if (Double.isNaN(normalized[i]) || Double.isInfinite(normalized[i])) {
                normalized[i] = 0;
            }
        }
        return normalized;
    }

    @Override
    public boolean isAvailable() {
        return true;  // 基础特征提取始终可用
    }

    /**
     * 计算商品组的embedding均值
     */
    private double[] calculateProductGroupEmbedding(List<String> productIds, int outputDim) {
        double[] result = new double[outputDim];
        Arrays.fill(result, 0);

        if (productIds == null || productIds.isEmpty() || !vectorSearchService.isAvailable()) {
            return result;
        }

        try {
            // 限制处理数量
            List<String> limitedIds = productIds.stream().limit(10).collect(Collectors.toList());

            List<double[]> embeddings = new ArrayList<>();
            for (String productId : limitedIds) {
                GoodsSpu product = goodsSpuMapper.selectById(productId);
                if (product != null) {
                    float[] embedding = vectorSearchService.vectorizeProduct(product);
                    if (embedding != null && embedding.length > 0) {
                        // 压缩embedding
                        double[] compressed = compressEmbedding(embedding, outputDim);
                        embeddings.add(compressed);
                    }
                }
            }

            // 计算均值
            if (!embeddings.isEmpty()) {
                for (int i = 0; i < outputDim; i++) {
                    double sum = 0;
                    for (double[] emb : embeddings) {
                        sum += emb[i];
                    }
                    result[i] = sum / embeddings.size();
                }
            }

        } catch (Exception e) {
            log.debug("计算商品组embedding失败: {}", e.getMessage());
        }

        return result;
    }

    /**
     * 加权池化压缩Embedding向量 (优化点3)
     * 位置越靠前权重越高 (前面的维度通常包含更重要的语义信息)
     */
    private double[] compressEmbedding(float[] embedding, int targetDim) {
        double[] compressed = new double[targetDim];
        if (embedding == null || embedding.length == 0) {
            return compressed;
        }

        int poolSize = embedding.length / targetDim;
        for (int i = 0; i < targetDim; i++) {
            double weightedSum = 0;
            double weightSum = 0;
            int start = i * poolSize;
            int end = Math.min(start + poolSize, embedding.length);

            for (int j = start; j < end; j++) {
                // 位置越靠前权重越高 (1.0 到 1.5)
                double weight = 1.0 + 0.5 * (1.0 - (double)(j - start) / poolSize);
                weightedSum += embedding[j] * weight;
                weightSum += weight;
            }
            compressed[i] = weightSum > 0 ? weightedSum / weightSum : 0;
        }
        return compressed;
    }

    /**
     * 计算最近活跃度
     */
    private double calculateRecentActivityRate(List<UserBehaviorEvent> events, int days) {
        if (events == null || events.isEmpty()) {
            return 0;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        long recentCount = events.stream()
                .filter(e -> e.getEventTime() != null && e.getEventTime().isAfter(cutoff))
                .count();

        return Math.min(1.0, recentCount / (days * 3.0));  // 假设每天3次活动为满分
    }

    /**
     * 计算带时间衰减的活跃度 (优化点4)
     * 使用指数衰减: score = exp(-daysAgo / HALF_LIFE)
     * HALF_LIFE = 7天，即7天前的事件权重降为50%
     */
    private double calculateTimeDecayedActivityRate(List<UserBehaviorEvent> events, int days) {
        if (events == null || events.isEmpty()) {
            return 0;
        }

        final double HALF_LIFE = 7.0;  // 7天半衰期
        double score = 0;
        LocalDateTime now = LocalDateTime.now();

        for (UserBehaviorEvent event : events) {
            if (event.getEventTime() == null) continue;
            long daysAgo = ChronoUnit.DAYS.between(event.getEventTime(), now);
            if (daysAgo >= 0 && daysAgo <= days) {
                // 指数衰减: 越近的事件权重越高
                double decay = Math.exp(-daysAgo / HALF_LIFE);
                score += decay;
            }
        }

        // 归一化: 假设每天1次活动（带满衰减）为满分
        double maxExpectedScore = days * 0.5;  // 考虑衰减后的期望最大值
        return Math.min(1.0, score / maxExpectedScore);
    }

    /**
     * 计算高价值用户分数
     */
    private double calculateHighValueScore(List<UserInterestTag> tags) {
        if (tags == null || tags.isEmpty()) {
            return 0;
        }

        // 基于标签权重和交互次数判断
        double totalWeight = tags.stream()
                .mapToDouble(t -> t.getWeight().doubleValue())
                .sum();

        int totalInteractions = tags.stream()
                .filter(t -> t.getInteractionCount() != null)
                .mapToInt(UserInterestTag::getInteractionCount)
                .sum();

        return Math.min(1.0, (totalWeight / 5.0 + totalInteractions / 100.0) / 2);
    }

    /**
     * 计算用户成熟度
     */
    private double calculateUserMaturity(int tagCount, int behaviorCount) {
        // 综合标签数和行为数
        double tagScore = Math.min(1.0, tagCount / 20.0);
        double behaviorScore = Math.min(1.0, behaviorCount / 200.0);
        return (tagScore + behaviorScore) / 2;
    }

    /**
     * 计算方差
     */
    private double calculateVariance(double[] values) {
        if (values == null || values.length == 0) {
            return 0;
        }
        double mean = Arrays.stream(values).average().orElse(0);
        double variance = Arrays.stream(values)
                .map(v -> Math.pow(v - mean, 2))
                .average()
                .orElse(0);
        return variance;
    }

    /**
     * 序列化特征向量
     */
    private String serializeFeatureVector(double[] features) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < features.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(String.format("%.6f", features[i]));
        }
        return sb.toString();
    }

    /**
     * 反序列化特征向量
     */
    private double[] parseFeatureVector(String str) {
        if (str == null || str.isEmpty()) {
            return new double[0];
        }
        String[] parts = str.split(",");
        double[] features = new double[parts.length];
        for (int i = 0; i < parts.length; i++) {
            try {
                features[i] = Double.parseDouble(parts[i]);
            } catch (NumberFormatException e) {
                features[i] = 0;
            }
        }
        return features;
    }
}
