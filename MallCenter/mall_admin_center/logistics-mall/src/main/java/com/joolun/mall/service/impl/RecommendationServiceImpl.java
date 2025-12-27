package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.*;
import com.joolun.mall.mapper.*;
import com.joolun.mall.service.RecommendationService;
import com.joolun.mall.service.UserBehaviorTrackingService;
import com.joolun.mall.service.BanditExplorer;
import com.joolun.mall.service.ThompsonSamplingExplorer;
import com.joolun.mall.service.LinUCBExplorer;
import com.joolun.mall.service.TriggerInterestBooster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 推荐服务实现
 * 混合推荐策略: 基于内容 + 协同过滤 + 热门推荐 + 强化学习探索
 *
 * 优化点（融合行业最佳实践）:
 * 1. Thompson Sampling 探索机制 - 平衡探索与利用
 * 2. 动态时间衰减 - 近期行为权重更高
 * 3. 实时触发加成 - 即时兴趣强化
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationServiceImpl implements RecommendationService {

    private final UserBehaviorTrackingService behaviorTrackingService;
    private final UserInterestTagMapper interestTagMapper;
    private final UserRecommendationProfileMapper profileMapper;
    private final ProductFeatureTagMapper productTagMapper;
    private final RecommendationLogMapper recommendationLogMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final ThompsonSamplingExplorer thompsonSamplingExplorer;
    private final LinUCBExplorer linUCBExplorer;
    private final TriggerInterestBooster triggerInterestBooster;

    // A/B 测试随机器
    private final Random abTestRandom = new Random();

    // 缓存配置
    private static final String RECOMMENDATION_CACHE_PREFIX = "recommendation:";
    private static final long CACHE_TTL_MINUTES = 30;

    // 推荐策略权重 (调整为: 30% 内容 + 25% 协同 + 25% 热门 + 20% 探索)
    private static final double CONTENT_BASED_WEIGHT = 0.30;   // 基于内容
    private static final double COLLABORATIVE_WEIGHT = 0.25;   // 协同过滤
    private static final double POPULAR_WEIGHT = 0.25;         // 热门推荐
    private static final double EXPLORATION_WEIGHT = 0.20;     // 强化学习探索 (10% TS + 10% LinUCB)

    // A/B 测试: LinUCB 流量比例 (50% 使用 LinUCB, 50% 使用 Thompson Sampling)
    private static final double LINUCB_AB_RATIO = 0.5;

    @Override
    public List<GoodsSpu> getHomeRecommendations(String wxUserId, int limit) {
        log.info("获取首页推荐: wxUserId={}, limit={}", wxUserId, limit);

        // P0修复: 缓存key防null - 匿名用户不缓存，避免数据混淆
        String cacheKey = null;
        if (wxUserId != null && !wxUserId.isEmpty()) {
            cacheKey = RECOMMENDATION_CACHE_PREFIX + "home:" + wxUserId;
            List<GoodsSpu> cached = getCachedRecommendations(cacheKey);
            if (cached != null && !cached.isEmpty()) {
                return cached.stream().limit(limit).collect(Collectors.toList());
            }
        }

        // 获取用户画像 (P0修复: 空值保护)
        UserRecommendationProfile profile = null;
        try {
            profile = behaviorTrackingService.getUserProfile(wxUserId);
        } catch (Exception e) {
            log.warn("获取用户画像失败: wxUserId={}, error={}", wxUserId, e.getMessage());
        }

        List<GoodsSpu> recommendations;
        // P0修复: profile为null或cold_start时走冷启动
        if (profile == null || "cold_start".equals(profile.getProfileStatus())) {
            // 冷启动策略
            recommendations = getColdStartRecommendations(profile, limit);
        } else {
            // 混合推荐策略
            recommendations = getHybridRecommendations(wxUserId, limit);
        }

        // 缓存结果 (仅对已登录用户缓存)
        if (cacheKey != null) {
            cacheRecommendations(cacheKey, recommendations);
        }

        // 记录推荐日志
        logRecommendations(wxUserId, "home_feed", recommendations);

        return recommendations;
    }

    @Override
    public List<GoodsSpu> reorderSearchResults(String wxUserId, String keyword, List<GoodsSpu> products) {
        if (products == null || products.isEmpty()) {
            return products;
        }

        log.info("个性化搜索排序: wxUserId={}, keyword={}, count={}", wxUserId, keyword, products.size());

        // 获取用户兴趣标签
        List<UserInterestTag> userTags = behaviorTrackingService.getUserInterestTags(wxUserId, 20);
        if (userTags.isEmpty()) {
            return products; // 无用户画像，返回原始排序
        }

        // 创建兴趣权重映射
        Map<String, Double> interestWeights = new HashMap<>();
        for (UserInterestTag tag : userTags) {
            // P0修复: 添加weight空值保护，避免NPE
            if (tag.getWeight() == null) {
                continue;
            }
            double effectiveWeight = tag.getWeight().doubleValue() *
                    (tag.getDecayFactor() != null ? tag.getDecayFactor().doubleValue() : 1.0);
            interestWeights.put(tag.getTagType() + ":" + tag.getTagValue(), effectiveWeight);
        }

        // 计算每个商品的个性化得分（含触发加成）
        List<ScoredProduct> scoredProducts = new ArrayList<>();
        for (int i = 0; i < products.size(); i++) {
            GoodsSpu product = products.get(i);
            double score = calculatePersonalizedScore(product, interestWeights, i, products.size(), wxUserId);
            scoredProducts.add(new ScoredProduct(product, score));
        }

        // 按得分排序
        scoredProducts.sort((a, b) -> Double.compare(b.score, a.score));

        return scoredProducts.stream()
                .map(sp -> sp.product)
                .collect(Collectors.toList());
    }

    @Override
    public List<GoodsSpu> getSimilarProducts(String wxUserId, String productId, int limit) {
        log.info("获取相似商品: productId={}, limit={}", productId, limit);

        // 获取当前商品
        GoodsSpu currentProduct = goodsSpuMapper.selectById(productId);
        if (currentProduct == null) {
            return Collections.emptyList();
        }

        // 基于分类查找相似商品
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.ne(GoodsSpu::getId, productId)
                .eq(GoodsSpu::getShelf, "1"); // 只查上架商品

        if (currentProduct.getCategoryFirst() != null) {
            wrapper.eq(GoodsSpu::getCategoryFirst, currentProduct.getCategoryFirst());
        }

        wrapper.orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit * 2);

        List<GoodsSpu> candidates = goodsSpuMapper.selectList(wrapper);

        // 如果有用户画像，进行个性化排序
        if (wxUserId != null && !wxUserId.isEmpty()) {
            candidates = reorderSearchResults(wxUserId, "", candidates);
        }

        return candidates.stream().limit(limit).collect(Collectors.toList());
    }

    @Override
    public List<GoodsSpu> getCartRecommendations(String wxUserId, List<String> cartProductIds, int limit) {
        if (cartProductIds == null || cartProductIds.isEmpty()) {
            return getPopularProducts(null, limit);
        }

        log.info("获取购物车推荐: wxUserId={}, cartSize={}", wxUserId, cartProductIds.size());

        // P1修复: 批量查询购物车商品，避免N+1问题
        Set<String> categories = new HashSet<>();
        List<GoodsSpu> cartProducts = goodsSpuMapper.selectBatchIds(cartProductIds);
        for (GoodsSpu product : cartProducts) {
            if (product != null && product.getCategoryFirst() != null) {
                categories.add(product.getCategoryFirst());
            }
        }

        if (categories.isEmpty()) {
            return getPopularProducts(null, limit);
        }

        // 查找同分类但不在购物车中的商品
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.notIn(GoodsSpu::getId, cartProductIds)
                .in(GoodsSpu::getCategoryFirst, categories)
                .eq(GoodsSpu::getShelf, "1")
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit * 2);

        List<GoodsSpu> candidates = goodsSpuMapper.selectList(wrapper);

        // 个性化排序
        if (wxUserId != null) {
            candidates = reorderSearchResults(wxUserId, "", candidates);
        }

        return candidates.stream().limit(limit).collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> getYouMayLike(String wxUserId, int page, int size) {
        log.info("获取猜你喜欢: wxUserId={}, page={}, size={}", wxUserId, page, size);

        int offset = page * size;
        int totalLimit = offset + size;

        // 获取推荐列表（多获取一些用于分页）
        List<GoodsSpu> allRecommendations = getHybridRecommendations(wxUserId, totalLimit);

        // 分页处理
        List<GoodsSpu> pageData = allRecommendations.stream()
                .skip(offset)
                .limit(size)
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("content", pageData);
        result.put("page", page);
        result.put("size", size);
        result.put("hasMore", allRecommendations.size() > offset + size);

        return result;
    }

    @Override
    public List<GoodsSpu> getPopularProducts(String category, int limit) {
        log.info("获取热门商品: category={}, limit={}", category, limit);

        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1");

        if (category != null && !category.isEmpty()) {
            wrapper.eq(GoodsSpu::getCategoryFirst, category);
        }

        wrapper.orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    @Override
    public void refreshRecommendationCache(String wxUserId) {
        String homeKey = RECOMMENDATION_CACHE_PREFIX + "home:" + wxUserId;
        redisTemplate.delete(homeKey);
        log.info("已刷新用户推荐缓存: wxUserId={}", wxUserId);
    }

    /**
     * 冷启动推荐策略
     * P0修复: 增加profile空值保护
     */
    private List<GoodsSpu> getColdStartRecommendations(UserRecommendationProfile profile, int limit) {
        // P0修复: profile可能为null，需要空值保护
        String strategy = (profile != null) ? profile.getColdStartStrategy() : null;
        if (strategy == null) {
            strategy = "popular";
        }

        switch (strategy) {
            case "category_based":
                // 基于某个默认分类推荐（获取热门分类）
                // P2修复: 移除硬编码，使用热门商品
                return getPopularProducts(null, limit);
            case "similar_user":
                // 基于相似用户（暂不实现）
                return getPopularProducts(null, limit);
            case "popular":
            default:
                // 热门商品推荐
                return getPopularProducts(null, limit);
        }
    }

    /**
     * 混合推荐策略（集成 Thompson Sampling + LinUCB 双探索器 A/B 测试）
     *
     * 策略分配:
     * - 30% 基于内容推荐（用户已知兴趣）
     * - 25% 协同过滤推荐（相似用户行为）
     * - 25% 热门推荐（填充兜底）
     * - 20% 强化学习探索（A/B 测试: 50% LinUCB + 50% Thompson Sampling）
     *
     * A/B 测试设计:
     * - 基于用户ID哈希稳定分流，同一用户永远在同一组
     * - 50% 用户使用 LinUCB，50% 使用 Thompson Sampling
     * - 两种算法的探索率均为 20%
     * - 便于对比两种算法的实际效果 (CTR, CVR)
     */
    private List<GoodsSpu> getHybridRecommendations(String wxUserId, int limit) {
        Set<String> recommendedIds = new HashSet<>();
        List<GoodsSpu> results = new ArrayList<>();

        // 获取用户已知兴趣分类（用于探索过滤）
        Set<String> knownCategories = getUserKnownCategories(wxUserId);

        // 1. 强化学习探索推荐 (20%) - A/B 测试选择算法
        String abTestGroup = getUserABTestGroup(wxUserId);
        BanditExplorer selectedExplorer = selectExplorerForABTest(wxUserId);
        String algorithmName = selectedExplorer.getAlgorithmName();

        if (selectedExplorer.shouldExplore(EXPLORATION_WEIGHT)) {
            int explorationLimit = (int) (limit * EXPLORATION_WEIGHT);
            List<GoodsSpu> explorations = selectedExplorer.getExplorationRecommendations(
                    wxUserId, knownCategories, explorationLimit * 2);

            for (GoodsSpu product : explorations) {
                if (!recommendedIds.contains(product.getId()) && results.size() < explorationLimit) {
                    results.add(product);
                    recommendedIds.add(product.getId());
                }
            }
            log.info("探索推荐 [{}]: {} 件商品", algorithmName, results.size());
        }

        // 2. 基于内容的推荐 (30%)
        int contentLimit = (int) (limit * CONTENT_BASED_WEIGHT);
        int currentSize = results.size();
        List<GoodsSpu> contentBased = getContentBasedRecommendations(wxUserId, contentLimit * 2);
        for (GoodsSpu product : contentBased) {
            if (!recommendedIds.contains(product.getId()) && results.size() < currentSize + contentLimit) {
                results.add(product);
                recommendedIds.add(product.getId());
            }
        }

        // 3. 协同过滤推荐 (25%)
        int collabLimit = (int) (limit * COLLABORATIVE_WEIGHT);
        currentSize = results.size();
        List<GoodsSpu> collaborative = getCollaborativeRecommendations(wxUserId, collabLimit * 2);
        for (GoodsSpu product : collaborative) {
            if (!recommendedIds.contains(product.getId()) && results.size() < currentSize + collabLimit) {
                results.add(product);
                recommendedIds.add(product.getId());
            }
        }

        // 4. 热门推荐填充 (25% + 剩余)
        List<GoodsSpu> popular = getPopularProducts(null, limit);
        for (GoodsSpu product : popular) {
            if (!recommendedIds.contains(product.getId()) && results.size() < limit) {
                results.add(product);
                recommendedIds.add(product.getId());
            }
        }

        return results;
    }

    /**
     * 获取用户的A/B测试分组
     * 基于用户ID哈希确保同一用户永远在同一组
     *
     * @param wxUserId 用户微信ID
     * @return "linucb" 或 "thompson"
     */
    private String getUserABTestGroup(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            // 无用户ID时随机分配（匿名用户）
            return abTestRandom.nextDouble() < LINUCB_AB_RATIO ? "linucb" : "thompson";
        }
        // 使用用户ID哈希确保稳定分组
        int hash = Math.abs(wxUserId.hashCode() % 100);
        return hash < (int) (LINUCB_AB_RATIO * 100) ? "linucb" : "thompson";
    }

    /**
     * A/B 测试: 选择探索算法
     * 基于用户ID稳定分流，50% 用户使用 LinUCB，50% 使用 Thompson Sampling
     *
     * @param wxUserId 用户微信ID
     * @return 选中的探索器实例
     */
    private BanditExplorer selectExplorerForABTest(String wxUserId) {
        String group = getUserABTestGroup(wxUserId);
        log.debug("用户 {} A/B分组: {}", wxUserId, group);
        return "linucb".equals(group) ? linUCBExplorer : thompsonSamplingExplorer;
    }

    /**
     * 获取用户已知兴趣分类
     */
    private Set<String> getUserKnownCategories(String wxUserId) {
        Set<String> categories = new HashSet<>();
        try {
            List<UserInterestTag> tags = behaviorTrackingService.getUserInterestTags(wxUserId, 20);
            for (UserInterestTag tag : tags) {
                if ("category".equals(tag.getTagType())) {
                    categories.add(tag.getTagValue());
                }
            }
        } catch (Exception e) {
            log.warn("获取用户兴趣分类失败: wxUserId={}", wxUserId, e);
        }
        return categories;
    }

    /**
     * 基于内容的推荐
     */
    private List<GoodsSpu> getContentBasedRecommendations(String wxUserId, int limit) {
        // 获取用户兴趣标签
        List<UserInterestTag> userTags = behaviorTrackingService.getUserInterestTags(wxUserId, 10);
        if (userTags.isEmpty()) {
            return Collections.emptyList();
        }

        // 提取用户感兴趣的分类
        List<String> categories = userTags.stream()
                .filter(tag -> "category".equals(tag.getTagType()))
                .map(UserInterestTag::getTagValue)
                .collect(Collectors.toList());

        if (categories.isEmpty()) {
            return Collections.emptyList();
        }

        // 查找这些分类的商品
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(GoodsSpu::getCategoryFirst, categories)
                .eq(GoodsSpu::getShelf, "1")
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    /**
     * 协同过滤推荐 (简化版: 基于浏览历史)
     */
    private List<GoodsSpu> getCollaborativeRecommendations(String wxUserId, int limit) {
        // 获取用户浏览过的商品
        List<String> viewedIds = behaviorTrackingService.getRecentViewedProducts(wxUserId, 20);
        if (viewedIds.isEmpty()) {
            return Collections.emptyList();
        }

        // P1修复: 批量查询浏览过的商品，避免N+1问题
        Set<String> categories = new HashSet<>();
        List<GoodsSpu> viewedProducts = goodsSpuMapper.selectBatchIds(viewedIds);
        for (GoodsSpu product : viewedProducts) {
            if (product != null && product.getCategoryFirst() != null) {
                categories.add(product.getCategoryFirst());
            }
        }

        if (categories.isEmpty()) {
            return Collections.emptyList();
        }

        // 推荐同分类但未浏览的商品
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.notIn(GoodsSpu::getId, viewedIds)
                .in(GoodsSpu::getCategoryFirst, categories)
                .eq(GoodsSpu::getShelf, "1")
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    /**
     * 计算商品的个性化得分
     */
    private double calculatePersonalizedScore(GoodsSpu product, Map<String, Double> interestWeights,
                                               int originalRank, int totalCount) {
        return calculatePersonalizedScore(product, interestWeights, originalRank, totalCount, null);
    }

    /**
     * 计算商品的个性化得分（含触发加成）
     */
    private double calculatePersonalizedScore(GoodsSpu product, Map<String, Double> interestWeights,
                                               int originalRank, int totalCount, String wxUserId) {
        double score = 0.0;

        // 分类匹配得分
        if (product.getCategoryFirst() != null) {
            Double weight = interestWeights.get("category:" + product.getCategoryFirst());
            if (weight != null) {
                score += weight * 0.35;  // 调整为35%
            }
        }

        // 价格区间匹配
        if (product.getSalesPrice() != null) {
            String priceRange = getPriceRange(product.getSalesPrice().doubleValue());
            Double weight = interestWeights.get("price_range:" + priceRange);
            if (weight != null) {
                score += weight * 0.15;  // 调整为15%
            }
        }

        // 保留原始搜索相关性 (排名越靠前分数越高)
        double rankScore = 1.0 - (double) originalRank / totalCount;
        score += rankScore * 0.25;  // 调整为25%

        // 销量因素
        if (product.getSaleNum() != null && product.getSaleNum() > 0) {
            score += Math.min(0.1, Math.log10(product.getSaleNum()) / 100);
        }

        // 实时触发加成 (10%) - 淘宝 Trigger Tower 设计
        if (wxUserId != null && triggerInterestBooster.hasActiveTrigger(wxUserId)) {
            double triggerBoost = triggerInterestBooster.calculateTriggerBoost(wxUserId, product);
            score += triggerBoost * 0.15;  // 触发加成最高15%
        }

        return score;
    }

    /**
     * 获取价格区间
     */
    private String getPriceRange(double price) {
        if (price < 50) return "低价";
        if (price < 150) return "中低价";
        if (price < 300) return "中等";
        if (price < 500) return "中高价";
        return "高价";
    }

    /**
     * 获取缓存的推荐
     */
    private List<GoodsSpu> getCachedRecommendations(String cacheKey) {
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return objectMapper.readValue(cached,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, GoodsSpu.class));
            }
        } catch (Exception e) {
            log.warn("读取推荐缓存失败", e);
        }
        return null;
    }

    /**
     * 缓存推荐结果
     */
    private void cacheRecommendations(String cacheKey, List<GoodsSpu> recommendations) {
        try {
            String json = objectMapper.writeValueAsString(recommendations);
            redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.warn("缓存推荐结果失败", e);
        }
    }

    /**
     * 记录推荐日志
     * P0性能优化: 使用批量插入，将 N 次 INSERT 合并为 1 次
     */
    private void logRecommendations(String wxUserId, String type, List<GoodsSpu> products) {
        if (products == null || products.isEmpty()) {
            return;
        }

        try {
            // 获取用户A/B分组信息 (用于追踪探索算法效果)
            String abGroup = getUserABTestGroup(wxUserId);
            BanditExplorer explorer = selectExplorerForABTest(wxUserId);
            String algorithmName = explorer.getAlgorithmName();

            // 构建批量插入列表
            List<RecommendationLog> logs = new ArrayList<>();
            for (int i = 0; i < products.size(); i++) {
                GoodsSpu product = products.get(i);
                RecommendationLog recLog = new RecommendationLog();
                recLog.setWxUserId(wxUserId);
                recLog.setRecommendationType(type);
                recLog.setRecommendationPosition(i);
                recLog.setProductId(product.getId());
                recLog.setAlgorithmType("hybrid");
                recLog.setAlgorithmVersion("1.0");
                recLog.setAbTestGroup(abGroup);
                recLog.setExplorerAlgorithm(algorithmName);
                recLog.setIsClicked(false);
                recLog.setIsPurchased(false);
                logs.add(recLog);
            }

            // P0性能优化: 批量插入，减少 N 次数据库往返为 1 次
            recommendationLogMapper.insertBatch(logs);
            log.debug("批量记录推荐日志: {} 条, A/B组: {}, 算法: {}", logs.size(), abGroup, algorithmName);
        } catch (Exception e) {
            log.warn("记录推荐日志失败: {}", e.getMessage());
        }
    }

    /**
     * 带得分的商品封装
     */
    private static class ScoredProduct {
        GoodsSpu product;
        double score;

        ScoredProduct(GoodsSpu product, double score) {
            this.product = product;
            this.score = score;
        }
    }
}
