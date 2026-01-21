package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.UserRecommendationProfile;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.service.ColdStartService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 冷启动服务实现
 *
 * 用户冷启动策略:
 * - Stage 1 (new): 0行为 → 40%热门 + 30%高评分 + 20%新品 + 10%探索
 * - Stage 2 (warming): 1-10行为 → 渐进融合个性化推荐
 * - Stage 3 (warm): >10行为 → 完全个性化
 *
 * 商品冷启动策略:
 * - 新商品7天内强制曝光配额
 * - 基于属性的初始分数估计
 * - 商家信誉加权
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ColdStartServiceImpl implements ColdStartService {

    private final GoodsSpuMapper goodsSpuMapper;
    private final StringRedisTemplate redisTemplate;

    // Redis Key 前缀
    private static final String USER_BEHAVIOR_COUNT_KEY = "user:behavior:count:";
    private static final String PRODUCT_INTERACTION_COUNT_KEY = "product:interaction:count:";
    private static final String USER_INTERESTS_KEY = "user:interests:";
    private static final String COLD_START_EXPOSURE_KEY = "coldstart:exposure:";

    // 冷启动阈值
    private static final int NEW_USER_THRESHOLD = 0;       // 0行为 = 新用户
    private static final int WARMING_USER_THRESHOLD = 10;  // 1-10行为 = 预热中
    private static final int NEW_PRODUCT_DAYS = 7;         // 7天内 = 新品
    private static final int NEW_PRODUCT_INTERACTION_THRESHOLD = 20;  // 少于20次交互 = 冷启动商品

    // 新用户推荐比例
    private static final double POPULAR_RATIO = 0.40;
    private static final double HIGH_RATING_RATIO = 0.30;
    private static final double NEW_PRODUCT_RATIO = 0.20;
    private static final double EXPLORE_RATIO = 0.10;

    // 新品配额比例
    private static final double NEW_PRODUCT_QUOTA_RATIO = 0.15;  // 推荐结果中15%为新品

    @Override
    public boolean isNewUser(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return true;
        }

        try {
            String key = USER_BEHAVIOR_COUNT_KEY + wxUserId;
            String countStr = redisTemplate.opsForValue().get(key);
            if (countStr == null) {
                // 从数据库查询行为数量
                // 这里简化处理，实际应该查询 user_behavior_events 表
                return true;
            }
            int count = Integer.parseInt(countStr);
            return count <= NEW_USER_THRESHOLD;
        } catch (Exception e) {
            log.warn("检查新用户失败: wxUserId={}", wxUserId, e);
            return true;
        }
    }

    @Override
    public List<GoodsSpu> getNewUserRecommendations(String wxUserId, int limit) {
        List<GoodsSpu> result = new ArrayList<>();

        try {
            int popularCount = (int) Math.ceil(limit * POPULAR_RATIO);
            int highRatingCount = (int) Math.ceil(limit * HIGH_RATING_RATIO);
            int newProductCount = (int) Math.ceil(limit * NEW_PRODUCT_RATIO);
            int exploreCount = limit - popularCount - highRatingCount - newProductCount;

            // 1. 热门商品 (销量Top)
            List<GoodsSpu> popularProducts = getPopularProducts(popularCount * 2);
            addUniqueProducts(result, popularProducts, popularCount);

            // 2. 高评分商品
            List<GoodsSpu> highRatingProducts = getHighRatingProducts(highRatingCount * 2);
            addUniqueProducts(result, highRatingProducts, highRatingCount);

            // 3. 新品
            List<GoodsSpu> newProducts = getNewProducts(newProductCount * 2);
            addUniqueProducts(result, newProducts, newProductCount);

            // 4. 随机探索
            List<GoodsSpu> exploreProducts = getRandomProducts(exploreCount * 3);
            addUniqueProducts(result, exploreProducts, exploreCount);

            // 打乱顺序，避免明显的分组
            Collections.shuffle(result);

            log.info("新用户冷启动推荐: wxUserId={}, 热门={}, 高评分={}, 新品={}, 探索={}, 总计={}",
                    wxUserId, popularCount, highRatingCount, newProductCount, exploreCount, result.size());

        } catch (Exception e) {
            log.error("获取新用户推荐失败: wxUserId={}", wxUserId, e);
        }

        return result.size() > limit ? result.subList(0, limit) : result;
    }

    @Override
    public String getColdStartStage(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return "new";
        }

        try {
            String key = USER_BEHAVIOR_COUNT_KEY + wxUserId;
            String countStr = redisTemplate.opsForValue().get(key);
            if (countStr == null) {
                return "new";
            }

            int count = Integer.parseInt(countStr);
            if (count <= NEW_USER_THRESHOLD) {
                return "new";
            } else if (count <= WARMING_USER_THRESHOLD) {
                return "warming";
            } else {
                return "warm";
            }
        } catch (Exception e) {
            log.warn("获取冷启动阶段失败: wxUserId={}", wxUserId, e);
            return "new";
        }
    }

    @Override
    public double getUserWarmthScore(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return 0.0;
        }

        try {
            String key = USER_BEHAVIOR_COUNT_KEY + wxUserId;
            String countStr = redisTemplate.opsForValue().get(key);
            if (countStr == null) {
                return 0.0;
            }

            int count = Integer.parseInt(countStr);
            // 使用sigmoid函数平滑过渡
            // warmth = 1 / (1 + e^(-(count-10)/5))
            // 在count=10时约0.5，count=20时约0.88，count=30时约0.98
            double warmth = 1.0 / (1.0 + Math.exp(-(count - 10.0) / 5.0));
            return Math.min(1.0, warmth);
        } catch (Exception e) {
            log.warn("计算用户热度失败: wxUserId={}", wxUserId, e);
            return 0.0;
        }
    }

    @Override
    public List<GoodsSpu> blendRecommendations(String wxUserId,
                                                List<GoodsSpu> personalizedProducts,
                                                List<GoodsSpu> coldStartProducts,
                                                int limit) {
        double warmth = getUserWarmthScore(wxUserId);

        if (warmth >= 0.95) {
            // 完全热启动，直接返回个性化推荐
            return personalizedProducts.size() > limit ?
                    personalizedProducts.subList(0, limit) : personalizedProducts;
        }

        if (warmth <= 0.05) {
            // 完全冷启动，直接返回冷启动推荐
            return coldStartProducts.size() > limit ?
                    coldStartProducts.subList(0, limit) : coldStartProducts;
        }

        // 计算融合比例
        int personalizedCount = (int) Math.round(limit * warmth);
        int coldStartCount = limit - personalizedCount;

        List<GoodsSpu> result = new ArrayList<>();
        Set<String> addedIds = new HashSet<>();

        // 先添加个性化推荐
        for (GoodsSpu product : personalizedProducts) {
            if (result.size() >= personalizedCount) break;
            if (product != null && product.getId() != null && !addedIds.contains(product.getId())) {
                result.add(product);
                addedIds.add(product.getId());
            }
        }

        // 再添加冷启动推荐
        for (GoodsSpu product : coldStartProducts) {
            if (result.size() >= limit) break;
            if (product != null && product.getId() != null && !addedIds.contains(product.getId())) {
                result.add(product);
                addedIds.add(product.getId());
            }
        }

        // 打乱顺序
        Collections.shuffle(result);

        log.debug("推荐融合: wxUserId={}, warmth={}, 个性化={}, 冷启动={}",
                wxUserId, warmth, personalizedCount, coldStartCount);

        return result;
    }

    @Override
    public boolean isNewProduct(String productId) {
        if (productId == null || productId.isEmpty()) {
            return false;
        }

        try {
            // 方法1: 检查交互次数
            String countKey = PRODUCT_INTERACTION_COUNT_KEY + productId;
            String countStr = redisTemplate.opsForValue().get(countKey);
            if (countStr != null) {
                int count = Integer.parseInt(countStr);
                if (count >= NEW_PRODUCT_INTERACTION_THRESHOLD) {
                    return false;
                }
            }

            // 方法2: 检查上架时间
            GoodsSpu product = goodsSpuMapper.selectById(productId);
            if (product != null && product.getCreateTime() != null) {
                LocalDateTime threshold = LocalDateTime.now().minusDays(NEW_PRODUCT_DAYS);
                return product.getCreateTime().isAfter(threshold);
            }

            return true;
        } catch (Exception e) {
            log.warn("检查新商品失败: productId={}", productId, e);
            return false;
        }
    }

    @Override
    public List<GoodsSpu> getColdStartProducts(int limit) {
        try {
            LocalDateTime threshold = LocalDateTime.now().minusDays(NEW_PRODUCT_DAYS);

            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1")  // 上架状态
                    .ge(GoodsSpu::getCreateTime, threshold)  // 7天内
                    .orderByDesc(GoodsSpu::getCreateTime)
                    .last("LIMIT " + limit);

            return goodsSpuMapper.selectList(wrapper);
        } catch (Exception e) {
            log.error("获取冷启动商品失败", e);
            return Collections.emptyList();
        }
    }

    @Override
    public double getProductWarmthScore(String productId) {
        if (productId == null || productId.isEmpty()) {
            return 0.0;
        }

        try {
            String countKey = PRODUCT_INTERACTION_COUNT_KEY + productId;
            String countStr = redisTemplate.opsForValue().get(countKey);
            if (countStr == null) {
                return 0.0;
            }

            int count = Integer.parseInt(countStr);
            // 使用sigmoid: warmth = 1 / (1 + e^(-(count-20)/10))
            double warmth = 1.0 / (1.0 + Math.exp(-(count - 20.0) / 10.0));
            return Math.min(1.0, warmth);
        } catch (Exception e) {
            log.warn("计算商品热度失败: productId={}", productId, e);
            return 0.0;
        }
    }

    @Override
    public double estimateColdStartScore(GoodsSpu product, UserRecommendationProfile userProfile) {
        if (product == null) {
            return 0.0;
        }

        double score = 0.5;  // 基础分

        try {
            // 1. 商家评分加成 (假设有merchant评分字段)
            // 这里简化处理，使用固定值
            score += 0.1;

            // 2. 价格匹配 (使用 pricePreferences 字段)
            if (userProfile != null && product.getSalesPrice() != null
                    && userProfile.getPricePreferences() != null) {
                // pricePreferences 是 JSON 字符串，这里简化处理
                String pricePrefs = userProfile.getPricePreferences();
                if (pricePrefs.contains("中等") || pricePrefs.contains("中低价")) {
                    double price = product.getSalesPrice().doubleValue();
                    if (price >= 50 && price <= 300) {
                        score += 0.15;  // 价格在偏好范围内
                    }
                }
            }

            // 3. 分类匹配 (使用 categoryPreferences 字段)
            if (userProfile != null && userProfile.getCategoryPreferences() != null
                    && product.getCategoryFirst() != null) {
                String categoryPrefs = userProfile.getCategoryPreferences();
                if (categoryPrefs.contains(product.getCategoryFirst())) {
                    score += 0.2;  // 分类匹配
                }
            }

            // 4. 促销加成
            if (product.getMarketPrice() != null && product.getSalesPrice() != null) {
                if (product.getMarketPrice().compareTo(product.getSalesPrice()) > 0) {
                    score += 0.1;  // 有折扣
                }
            }

            // 5. 新品加成
            if (product.getCreateTime() != null) {
                LocalDateTime threshold = LocalDateTime.now().minusDays(3);
                if (product.getCreateTime().isAfter(threshold)) {
                    score += 0.1;  // 3天内新品额外加分
                }
            }

        } catch (Exception e) {
            log.warn("估计冷启动分数失败: productId={}", product.getId(), e);
        }

        return Math.min(1.0, Math.max(0.0, score));
    }

    @Override
    public int getNewProductQuota(int totalLimit) {
        double dynamicRatio = calculateDynamicNewProductRatio();
        return (int) Math.ceil(totalLimit * dynamicRatio);
    }

    /**
     * 计算动态新品配额比例 (优化点7)
     * 根据新品销售速度动态调整:
     * - 新品销售好 (velocity > 1.5x baseline): 增加到20%
     * - 新品销售差 (velocity < 0.5x baseline): 减少到10%
     * - 正常: 维持15%
     */
    private double calculateDynamicNewProductRatio() {
        try {
            // 获取新品平均销售速度
            Double avgVelocity = getAverageNewProductVelocity();
            Double baselineVelocity = getBaselineVelocity();

            if (avgVelocity == null || baselineVelocity == null || baselineVelocity == 0) {
                return NEW_PRODUCT_QUOTA_RATIO;  // 默认15%
            }

            double velocityRatio = avgVelocity / baselineVelocity;

            if (velocityRatio > 1.5) {
                log.debug("新品销售表现好，配额提升至20%: velocityRatio={}", velocityRatio);
                return 0.20;  // 新品销售好，增加到20%
            } else if (velocityRatio < 0.5) {
                log.debug("新品销售表现差，配额降低至10%: velocityRatio={}", velocityRatio);
                return 0.10;  // 新品销售差，减少到10%
            }
            return NEW_PRODUCT_QUOTA_RATIO;  // 默认15%

        } catch (Exception e) {
            log.debug("计算动态新品配额失败: {}", e.getMessage());
            return NEW_PRODUCT_QUOTA_RATIO;
        }
    }

    /**
     * 获取新品平均销售速度 (7天内商品的日均销量)
     */
    private Double getAverageNewProductVelocity() {
        try {
            String cacheKey = "coldstart:velocity:new";
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return Double.parseDouble(cached);
            }

            // 计算新品销售速度
            List<GoodsSpu> newProducts = getColdStartProducts(100);
            if (newProducts.isEmpty()) {
                return null;
            }

            double totalVelocity = 0;
            int count = 0;
            for (GoodsSpu product : newProducts) {
                if (product.getSaleNum() != null && product.getCreateTime() != null) {
                    long days = ChronoUnit.DAYS.between(
                        product.getCreateTime(), LocalDateTime.now()) + 1;
                    double velocity = product.getSaleNum() / (double) days;
                    totalVelocity += velocity;
                    count++;
                }
            }

            double avgVelocity = count > 0 ? totalVelocity / count : 0;

            // 缓存1小时
            redisTemplate.opsForValue().set(cacheKey, String.valueOf(avgVelocity), 1, TimeUnit.HOURS);
            return avgVelocity;

        } catch (Exception e) {
            log.debug("获取新品销售速度失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 获取基准销售速度 (所有商品的平均日销量)
     */
    private Double getBaselineVelocity() {
        try {
            String cacheKey = "coldstart:velocity:baseline";
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return Double.parseDouble(cached);
            }

            // 计算基准：取热门商品的平均速度作为参考
            List<GoodsSpu> popularProducts = getPopularProducts(50);
            if (popularProducts.isEmpty()) {
                return 1.0;  // 默认基准
            }

            double totalVelocity = 0;
            int count = 0;
            for (GoodsSpu product : popularProducts) {
                if (product.getSaleNum() != null && product.getCreateTime() != null) {
                    long days = ChronoUnit.DAYS.between(
                        product.getCreateTime(), LocalDateTime.now()) + 1;
                    // 限制最大天数避免极端值
                    days = Math.min(days, 365);
                    double velocity = product.getSaleNum() / (double) days;
                    totalVelocity += velocity;
                    count++;
                }
            }

            double avgVelocity = count > 0 ? totalVelocity / count : 1.0;

            // 缓存1小时
            redisTemplate.opsForValue().set(cacheKey, String.valueOf(avgVelocity), 1, TimeUnit.HOURS);
            return avgVelocity;

        } catch (Exception e) {
            log.debug("获取基准销售速度失败: {}", e.getMessage());
            return 1.0;
        }
    }

    @Override
    public List<GoodsSpu> injectColdStartProducts(List<GoodsSpu> products,
                                                   List<GoodsSpu> coldStartProducts,
                                                   int quota) {
        if (coldStartProducts == null || coldStartProducts.isEmpty() || quota <= 0) {
            return products;
        }

        if (products == null || products.isEmpty()) {
            return coldStartProducts.size() > quota ?
                    coldStartProducts.subList(0, quota) : coldStartProducts;
        }

        List<GoodsSpu> result = new ArrayList<>(products);
        Set<String> existingIds = products.stream()
                .filter(p -> p != null && p.getId() != null)
                .map(GoodsSpu::getId)
                .collect(Collectors.toSet());

        int injected = 0;
        Random random = new Random();

        for (GoodsSpu coldProduct : coldStartProducts) {
            if (injected >= quota) break;
            if (coldProduct == null || existingIds.contains(coldProduct.getId())) {
                continue;
            }

            // 在随机位置插入，避免都在末尾
            int position = random.nextInt(Math.max(1, result.size()));
            result.add(position, coldProduct);
            existingIds.add(coldProduct.getId());
            injected++;
        }

        log.debug("注入冷启动商品: quota={}, 实际注入={}", quota, injected);
        return result;
    }

    @Override
    public Map<String, String> getInterestQuestions() {
        Map<String, String> questions = new LinkedHashMap<>();
        questions.put("q1", "您主要采购哪类食材？");
        questions.put("q2", "您的预算范围是？");
        questions.put("q3", "您更看重哪些因素？");
        questions.put("q4", "您的采购频率是？");
        return questions;
    }

    @Override
    public void processInterestAnswers(String wxUserId, Map<String, List<String>> answers) {
        if (wxUserId == null || answers == null || answers.isEmpty()) {
            return;
        }

        try {
            String key = USER_INTERESTS_KEY + wxUserId;
            // 将答案存储到Redis
            for (Map.Entry<String, List<String>> entry : answers.entrySet()) {
                String field = entry.getKey();
                String value = String.join(",", entry.getValue());
                redisTemplate.opsForHash().put(key, field, value);
            }
            redisTemplate.expire(key, 90, TimeUnit.DAYS);

            log.info("处理用户兴趣回答: wxUserId={}, questions={}", wxUserId, answers.size());
        } catch (Exception e) {
            log.error("处理兴趣回答失败: wxUserId={}", wxUserId, e);
        }
    }

    @Override
    public List<GoodsSpu> getInterestBasedRecommendations(String wxUserId, int limit) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return getNewUserRecommendations(null, limit);
        }

        try {
            String key = USER_INTERESTS_KEY + wxUserId;
            Map<Object, Object> interests = redisTemplate.opsForHash().entries(key);

            if (interests.isEmpty()) {
                return getNewUserRecommendations(wxUserId, limit);
            }

            // 根据兴趣筛选商品
            // 这里简化处理，实际应该根据答案匹配分类和价格
            String categoryAnswer = (String) interests.get("q1");
            if (categoryAnswer != null && !categoryAnswer.isEmpty()) {
                List<String> categories = Arrays.asList(categoryAnswer.split(","));
                return getProductsByCategories(categories, limit);
            }

        } catch (Exception e) {
            log.error("获取基于兴趣的推荐失败: wxUserId={}", wxUserId, e);
        }

        return getNewUserRecommendations(wxUserId, limit);
    }

    @Override
    public Map<String, Object> getColdStartStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        try {
            // 新品数量
            List<GoodsSpu> newProducts = getColdStartProducts(1000);
            stats.put("coldStartProductCount", newProducts.size());

            // 新品配额比例
            stats.put("newProductQuotaRatio", NEW_PRODUCT_QUOTA_RATIO);

            // 阈值配置
            stats.put("newUserBehaviorThreshold", NEW_USER_THRESHOLD);
            stats.put("warmingUserThreshold", WARMING_USER_THRESHOLD);
            stats.put("newProductDays", NEW_PRODUCT_DAYS);
            stats.put("newProductInteractionThreshold", NEW_PRODUCT_INTERACTION_THRESHOLD);

            // 推荐比例
            stats.put("popularRatio", POPULAR_RATIO);
            stats.put("highRatingRatio", HIGH_RATING_RATIO);
            stats.put("newProductRatio", NEW_PRODUCT_RATIO);
            stats.put("exploreRatio", EXPLORE_RATIO);

        } catch (Exception e) {
            log.error("获取冷启动统计失败", e);
            stats.put("error", e.getMessage());
        }

        return stats;
    }

    @Override
    public void recordColdStartExposure(String productId, String wxUserId, int position) {
        if (productId == null || wxUserId == null) {
            return;
        }

        try {
            String key = COLD_START_EXPOSURE_KEY + productId;
            String member = wxUserId + ":" + position + ":" + System.currentTimeMillis();
            redisTemplate.opsForZSet().add(key, member, System.currentTimeMillis());
            redisTemplate.expire(key, 30, TimeUnit.DAYS);

            // 增加商品交互计数
            String countKey = PRODUCT_INTERACTION_COUNT_KEY + productId;
            redisTemplate.opsForValue().increment(countKey);
            redisTemplate.expire(countKey, 90, TimeUnit.DAYS);

            log.debug("记录冷启动曝光: productId={}, wxUserId={}, position={}", productId, wxUserId, position);
        } catch (Exception e) {
            log.warn("记录冷启动曝光失败: productId={}", productId, e);
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 获取热门商品
     */
    private List<GoodsSpu> getPopularProducts(int limit) {
        try {
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1")
                    .orderByDesc(GoodsSpu::getSaleNum)
                    .last("LIMIT " + limit);
            return goodsSpuMapper.selectList(wrapper);
        } catch (Exception e) {
            log.error("获取热门商品失败", e);
            return Collections.emptyList();
        }
    }

    /**
     * 获取高评分商品
     */
    private List<GoodsSpu> getHighRatingProducts(int limit) {
        try {
            // 假设有评分字段，这里按销量和创建时间排序模拟
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1")
                    .orderByDesc(GoodsSpu::getSaleNum)
                    .orderByDesc(GoodsSpu::getCreateTime)
                    .last("LIMIT " + limit);
            return goodsSpuMapper.selectList(wrapper);
        } catch (Exception e) {
            log.error("获取高评分商品失败", e);
            return Collections.emptyList();
        }
    }

    /**
     * 获取新品
     */
    private List<GoodsSpu> getNewProducts(int limit) {
        return getColdStartProducts(limit);
    }

    /**
     * 获取随机商品
     */
    private List<GoodsSpu> getRandomProducts(int limit) {
        try {
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1")
                    .last("ORDER BY RAND() LIMIT " + limit);
            return goodsSpuMapper.selectList(wrapper);
        } catch (Exception e) {
            log.error("获取随机商品失败", e);
            return Collections.emptyList();
        }
    }

    /**
     * 根据分类获取商品
     */
    private List<GoodsSpu> getProductsByCategories(List<String> categories, int limit) {
        try {
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1")
                    .in(GoodsSpu::getCategoryFirst, categories)
                    .orderByDesc(GoodsSpu::getSaleNum)
                    .last("LIMIT " + limit);
            return goodsSpuMapper.selectList(wrapper);
        } catch (Exception e) {
            log.error("根据分类获取商品失败", e);
            return Collections.emptyList();
        }
    }

    /**
     * 添加不重复的商品到结果列表
     */
    private void addUniqueProducts(List<GoodsSpu> result, List<GoodsSpu> source, int maxCount) {
        Set<String> existingIds = result.stream()
                .filter(p -> p != null && p.getId() != null)
                .map(GoodsSpu::getId)
                .collect(Collectors.toSet());

        int added = 0;
        for (GoodsSpu product : source) {
            if (added >= maxCount) break;
            if (product != null && product.getId() != null && !existingIds.contains(product.getId())) {
                result.add(product);
                existingIds.add(product.getId());
                added++;
            }
        }
    }
}
