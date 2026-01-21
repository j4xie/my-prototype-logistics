package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.service.MultiRecallService;
import com.joolun.mall.service.UserBehaviorTrackingService;
import com.joolun.mall.service.UserClusterService;
import com.joolun.mall.service.VectorSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * 多路召回服务实现
 *
 * 实现7路召回策略并行执行:
 * 1. 热度召回 (25%) - 基于销量和浏览量
 * 2. 协同过滤 (22%) - 基于相似用户行为
 * 3. 品类召回 (18%) - 用户偏好品类的热门商品
 * 4. 时间衰减 (15%) - 最近浏览的相似商品
 * 5. 语义召回 (10%) - 基于用户兴趣的向量相似度
 * 6. 新品召回 (5%) - 7天内上架的商品
 * 7. 高评分商家 (5%) - 高评分商家的商品
 *
 * 特性:
 * - CompletableFuture 并行召回
 * - Set 去重，保留最早出现的来源
 * - 支持动态调整各路召回权重
 * - 记录每路召回的命中数用于监控
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MultiRecallServiceImpl implements MultiRecallService {

    private final GoodsSpuMapper goodsSpuMapper;
    private final MerchantMapper merchantMapper;
    private final UserBehaviorTrackingService behaviorTrackingService;
    private final StringRedisTemplate redisTemplate;
    private final VectorSearchService vectorSearchService;
    private final UserClusterService userClusterService;

    // 召回统计
    private final ConcurrentHashMap<String, AtomicInteger> recallStats = new ConcurrentHashMap<>();

    // 召回权重配置
    private final ConcurrentHashMap<String, Double> recallWeights = new ConcurrentHashMap<>();

    // 并行执行线程池
    private ExecutorService recallExecutor;

    // 品类名称到ID的映射缓存 (优化点P2)
    private Map<String, String> categoryNameToIdMap = new ConcurrentHashMap<>();
    private volatile boolean categoryMapInitialized = false;

    // 召回策略名称常量
    private static final String RECALL_POPULARITY = "popularity";
    private static final String RECALL_COLLABORATIVE = "collaborative";
    private static final String RECALL_CATEGORY = "category";
    private static final String RECALL_RECENT_VIEW = "recent_view";
    private static final String RECALL_NEW_ARRIVAL = "new_arrival";
    private static final String RECALL_HIGH_RATING = "high_rating";
    private static final String RECALL_SEMANTIC = "semantic";
    private static final String RECALL_CLUSTER_RULE = "cluster_rule";

    // 默认权重配置 (V2.2 调整: 增强聚类规则差异化)
    private static final double DEFAULT_WEIGHT_POPULARITY = 0.18;      // -3% (原0.21)
    private static final double DEFAULT_WEIGHT_COLLABORATIVE = 0.15;   // -3% (原0.18)
    private static final double DEFAULT_WEIGHT_CATEGORY = 0.18;
    private static final double DEFAULT_WEIGHT_RECENT_VIEW = 0.15;
    private static final double DEFAULT_WEIGHT_NEW_ARRIVAL = 0.05;
    private static final double DEFAULT_WEIGHT_HIGH_RATING = 0.04;     // -1% (原0.05)
    private static final double DEFAULT_WEIGHT_SEMANTIC = 0.10;
    private static final double DEFAULT_WEIGHT_CLUSTER_RULE = 0.15;    // +7% (原0.08) 增强差异化

    // 新品定义：7天内上架
    private static final int NEW_ARRIVAL_DAYS = 7;

    // 高评分商家阈值
    private static final BigDecimal HIGH_RATING_THRESHOLD = new BigDecimal("4.5");

    // 并行召回超时时间(毫秒)
    private static final long RECALL_TIMEOUT_MS = 3000;

    // Redis 缓存键前缀
    private static final String RECALL_CACHE_PREFIX = "multi_recall:";
    private static final long CACHE_TTL_MINUTES = 10;

    // 聚类策略配置 (优化点9)
    private static final Map<String, ClusterRecallStrategy> CLUSTER_STRATEGIES = new HashMap<>();
    static {
        CLUSTER_STRATEGIES.put("火锅店采购", new ClusterRecallStrategy(0.20,
                Arrays.asList("肉类", "火锅底料", "蔬菜", "豆制品"), 0.8));
        CLUSTER_STRATEGIES.put("快餐店采购", new ClusterRecallStrategy(0.15,
                Arrays.asList("速食", "调味品", "粮油", "方便食品"), 0.7));
        CLUSTER_STRATEGIES.put("烘焙店采购", new ClusterRecallStrategy(0.18,
                Arrays.asList("烘焙原料", "乳制品", "糖类", "面粉"), 0.75));
        CLUSTER_STRATEGIES.put("高端餐厅", new ClusterRecallStrategy(0.22,
                Arrays.asList("进口食材", "海鲜", "高端肉类", "有机蔬菜"), 0.85));
        CLUSTER_STRATEGIES.put("社区团购", new ClusterRecallStrategy(0.15,
                Arrays.asList("蔬菜", "水果", "日用品", "鸡蛋"), 0.65));
        CLUSTER_STRATEGIES.put("新用户群", new ClusterRecallStrategy(0.10,
                Arrays.asList("热门商品", "新品推荐", "优惠商品"), 0.5));
    }

    /**
     * 聚类召回策略内部类
     */
    private static class ClusterRecallStrategy {
        final double recallWeight;           // 该聚类的召回权重
        final List<String> priorityCategories;  // 优先品类
        final double categoryAffinity;       // 品类亲和度阈值

        ClusterRecallStrategy(double recallWeight, List<String> priorityCategories, double categoryAffinity) {
            this.recallWeight = recallWeight;
            this.priorityCategories = priorityCategories;
            this.categoryAffinity = categoryAffinity;
        }
    }

    @PostConstruct
    public void init() {
        // 初始化线程池 (8路召回)
        recallExecutor = Executors.newFixedThreadPool(8);

        // 初始化默认权重
        recallWeights.put(RECALL_POPULARITY, DEFAULT_WEIGHT_POPULARITY);
        recallWeights.put(RECALL_COLLABORATIVE, DEFAULT_WEIGHT_COLLABORATIVE);
        recallWeights.put(RECALL_CATEGORY, DEFAULT_WEIGHT_CATEGORY);
        recallWeights.put(RECALL_RECENT_VIEW, DEFAULT_WEIGHT_RECENT_VIEW);
        recallWeights.put(RECALL_NEW_ARRIVAL, DEFAULT_WEIGHT_NEW_ARRIVAL);
        recallWeights.put(RECALL_HIGH_RATING, DEFAULT_WEIGHT_HIGH_RATING);
        recallWeights.put(RECALL_SEMANTIC, DEFAULT_WEIGHT_SEMANTIC);
        recallWeights.put(RECALL_CLUSTER_RULE, DEFAULT_WEIGHT_CLUSTER_RULE);

        // 初始化统计计数器
        recallStats.put(RECALL_POPULARITY, new AtomicInteger(0));
        recallStats.put(RECALL_COLLABORATIVE, new AtomicInteger(0));
        recallStats.put(RECALL_CATEGORY, new AtomicInteger(0));
        recallStats.put(RECALL_RECENT_VIEW, new AtomicInteger(0));
        recallStats.put(RECALL_NEW_ARRIVAL, new AtomicInteger(0));
        recallStats.put(RECALL_HIGH_RATING, new AtomicInteger(0));
        recallStats.put(RECALL_SEMANTIC, new AtomicInteger(0));
        recallStats.put(RECALL_CLUSTER_RULE, new AtomicInteger(0));

        log.info("多路召回服务初始化完成，权重配置: {}", recallWeights);
    }

    /**
     * 初始化品类映射缓存 (优化点P2)
     */
    private void initCategoryMapIfNeeded() {
        if (categoryMapInitialized) {
            return;
        }
        synchronized (this) {
            if (categoryMapInitialized) {
                return;
            }
            try {
                // 从商品表获取所有品类
                List<GoodsSpu> allProducts = goodsSpuMapper.selectList(
                    new LambdaQueryWrapper<GoodsSpu>()
                        .select(GoodsSpu::getCategoryFirst, GoodsSpu::getCategorySecond)
                        .eq(GoodsSpu::getShelf, "1")
                        .groupBy(GoodsSpu::getCategoryFirst)
                );

                for (GoodsSpu product : allProducts) {
                    if (product.getCategoryFirst() != null) {
                        categoryNameToIdMap.put(product.getCategoryFirst(), product.getCategoryFirst());
                    }
                }

                categoryMapInitialized = true;
                log.info("品类映射缓存初始化完成: {} 个品类", categoryNameToIdMap.size());
            } catch (Exception e) {
                log.warn("品类映射初始化失败: {}", e.getMessage());
            }
        }
    }

    @Override
    public List<GoodsSpu> multiRecall(String wxUserId, int limit) {
        log.info("开始多路召回: wxUserId={}, limit={}", wxUserId, limit);
        long startTime = System.currentTimeMillis();

        // 每路召回的数量 (多取一些用于融合筛选)
        int perRecallLimit = Math.max(50, limit);

        // 记录每个商品的召回来源和得分
        Map<String, RecallItem> recallItems = new ConcurrentHashMap<>();

        try {
            // 并行执行8路召回
            CompletableFuture<List<GoodsSpu>> popularityFuture = CompletableFuture.supplyAsync(
                    () -> recallByPopularity(perRecallLimit), recallExecutor);

            CompletableFuture<List<GoodsSpu>> collaborativeFuture = CompletableFuture.supplyAsync(
                    () -> recallByCollaborativeFiltering(wxUserId, perRecallLimit), recallExecutor);

            CompletableFuture<List<GoodsSpu>> categoryFuture = CompletableFuture.supplyAsync(
                    () -> recallByCategory(wxUserId, perRecallLimit), recallExecutor);

            CompletableFuture<List<GoodsSpu>> recentViewFuture = CompletableFuture.supplyAsync(
                    () -> recallByRecentView(wxUserId, perRecallLimit), recallExecutor);

            CompletableFuture<List<GoodsSpu>> newArrivalFuture = CompletableFuture.supplyAsync(
                    () -> recallByNewArrival(perRecallLimit), recallExecutor);

            CompletableFuture<List<GoodsSpu>> highRatingFuture = CompletableFuture.supplyAsync(
                    () -> recallByHighRatingMerchant(perRecallLimit), recallExecutor);

            CompletableFuture<List<GoodsSpu>> semanticFuture = CompletableFuture.supplyAsync(
                    () -> recallBySemantic(wxUserId, perRecallLimit), recallExecutor);

            CompletableFuture<List<GoodsSpu>> clusterRuleFuture = CompletableFuture.supplyAsync(
                    () -> recallByClusterRule(wxUserId, perRecallLimit), recallExecutor);

            // 等待所有召回完成（带超时）
            CompletableFuture.allOf(
                    popularityFuture, collaborativeFuture, categoryFuture,
                    recentViewFuture, newArrivalFuture, highRatingFuture,
                    semanticFuture, clusterRuleFuture
            ).get(RECALL_TIMEOUT_MS, TimeUnit.MILLISECONDS);

            // 融合各路召回结果
            mergeRecallResults(recallItems, popularityFuture.get(), RECALL_POPULARITY);
            mergeRecallResults(recallItems, collaborativeFuture.get(), RECALL_COLLABORATIVE);
            mergeRecallResults(recallItems, categoryFuture.get(), RECALL_CATEGORY);
            mergeRecallResults(recallItems, recentViewFuture.get(), RECALL_RECENT_VIEW);
            mergeRecallResults(recallItems, newArrivalFuture.get(), RECALL_NEW_ARRIVAL);
            mergeRecallResults(recallItems, highRatingFuture.get(), RECALL_HIGH_RATING);
            mergeRecallResults(recallItems, semanticFuture.get(), RECALL_SEMANTIC);
            mergeRecallResults(recallItems, clusterRuleFuture.get(), RECALL_CLUSTER_RULE);

        } catch (Exception e) {
            log.warn("多路召回部分超时或异常，使用已完成的结果: {}", e.getMessage());
        }

        // 按加权得分排序
        List<GoodsSpu> results = recallItems.values().stream()
                .sorted((a, b) -> Double.compare(b.weightedScore, a.weightedScore))
                .limit(limit)
                .map(item -> item.product)
                .collect(Collectors.toList());

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("多路召回完成: 候选{}件，返回{}件，耗时{}ms", recallItems.size(), results.size(), elapsed);

        return results;
    }

    /**
     * 融合召回结果 (V4.0: RRF + 多来源置信度增强)
     *
     * RRF公式: score = Σ(weight / (k + rank))
     * 多来源增强: 出现在2+渠道的商品额外加分
     */
    private void mergeRecallResults(Map<String, RecallItem> recallItems,
                                    List<GoodsSpu> products,
                                    String source) {
        if (products == null || products.isEmpty()) {
            return;
        }

        double weight = recallWeights.getOrDefault(source, 0.1);
        int hitCount = 0;

        // RRF参数k (常用值60)
        final double RRF_K = 60.0;

        for (int i = 0; i < products.size(); i++) {
            GoodsSpu product = products.get(i);
            String productId = product.getId();

            // RRF公式: weight / (k + rank)
            double rrfScore = weight / (RRF_K + i);

            RecallItem existing = recallItems.get(productId);
            if (existing != null) {
                // 商品已存在，累加RRF得分
                existing.weightedScore += rrfScore;
                existing.sources.add(source);

                // 多来源置信度增强: 出现在2+渠道的商品额外加分
                if (existing.sources.size() == 2) {
                    existing.weightedScore *= 1.2;  // 首次多来源增强20%
                } else if (existing.sources.size() > 2) {
                    existing.weightedScore *= 1.05; // 后续每增加一个来源增强5%
                }
            } else {
                // 新商品
                RecallItem item = new RecallItem();
                item.product = product;
                item.weightedScore = rrfScore;
                item.sources = new HashSet<>();
                item.sources.add(source);
                item.firstSource = source;
                recallItems.put(productId, item);
                hitCount++;
            }
        }

        // 更新统计
        recallStats.get(source).addAndGet(hitCount);
        log.debug("召回融合 [{}]: 输入{}件，新增{}件，使用RRF(k={})",
                  source, products.size(), hitCount, RRF_K);
    }

    @Override
    public List<GoodsSpu> recallByPopularity(int limit) {
        log.debug("执行热度召回: limit={}", limit);

        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
                .isNull(GoodsSpu::getDelFlag)
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    @Override
    public List<GoodsSpu> recallByRecentView(String wxUserId, int limit) {
        log.debug("执行时间衰减召回: wxUserId={}, limit={}", wxUserId, limit);

        if (wxUserId == null || wxUserId.isEmpty()) {
            return Collections.emptyList();
        }

        // 获取用户最近浏览的商品
        List<String> recentViewedIds = behaviorTrackingService.getRecentViewedProducts(wxUserId, 10);
        if (recentViewedIds.isEmpty()) {
            return Collections.emptyList();
        }

        // 获取浏览商品的分类
        List<GoodsSpu> viewedProducts = goodsSpuMapper.selectBatchIds(recentViewedIds);
        Set<String> viewedCategories = viewedProducts.stream()
                .filter(p -> p.getCategoryFirst() != null)
                .map(GoodsSpu::getCategoryFirst)
                .collect(Collectors.toSet());

        if (viewedCategories.isEmpty()) {
            return Collections.emptyList();
        }

        // 查找同分类但未浏览的商品，按时间衰减排序
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
                .isNull(GoodsSpu::getDelFlag)
                .notIn(GoodsSpu::getId, recentViewedIds)
                .in(GoodsSpu::getCategoryFirst, viewedCategories)
                .orderByDesc(GoodsSpu::getUpdateTime)  // 按更新时间排序（时间衰减）
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    @Override
    public List<GoodsSpu> recallByCategory(String wxUserId, int limit) {
        log.debug("执行品类召回: wxUserId={}, limit={}", wxUserId, limit);

        if (wxUserId == null || wxUserId.isEmpty()) {
            return Collections.emptyList();
        }

        // 获取用户兴趣标签中的品类偏好
        List<UserInterestTag> userTags = behaviorTrackingService.getUserInterestTags(wxUserId, 20);
        List<String> preferredCategories = userTags.stream()
                .filter(tag -> "category".equals(tag.getTagType()))
                .sorted((a, b) -> {
                    // 按权重*衰减因子排序
                    double scoreA = (a.getWeight() != null ? a.getWeight().doubleValue() : 0) *
                            (a.getDecayFactor() != null ? a.getDecayFactor().doubleValue() : 1.0);
                    double scoreB = (b.getWeight() != null ? b.getWeight().doubleValue() : 0) *
                            (b.getDecayFactor() != null ? b.getDecayFactor().doubleValue() : 1.0);
                    return Double.compare(scoreB, scoreA);
                })
                .limit(5)  // 取前5个偏好品类
                .map(UserInterestTag::getTagValue)
                .collect(Collectors.toList());

        if (preferredCategories.isEmpty()) {
            return Collections.emptyList();
        }

        // 查询偏好品类的热门商品
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
                .isNull(GoodsSpu::getDelFlag)
                .in(GoodsSpu::getCategoryFirst, preferredCategories)
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    @Override
    public List<GoodsSpu> recallByCollaborativeFiltering(String wxUserId, int limit) {
        log.debug("执行协同过滤召回: wxUserId={}, limit={}", wxUserId, limit);

        if (wxUserId == null || wxUserId.isEmpty()) {
            return Collections.emptyList();
        }

        // 获取用户浏览历史
        List<String> viewedIds = behaviorTrackingService.getRecentViewedProducts(wxUserId, 30);
        if (viewedIds.isEmpty()) {
            return Collections.emptyList();
        }

        // 基于浏览历史获取分类和商户偏好
        List<GoodsSpu> viewedProducts = goodsSpuMapper.selectBatchIds(viewedIds);

        Set<String> viewedCategories = new HashSet<>();
        Set<Long> viewedMerchants = new HashSet<>();

        for (GoodsSpu product : viewedProducts) {
            if (product.getCategoryFirst() != null) {
                viewedCategories.add(product.getCategoryFirst());
            }
            if (product.getMerchantId() != null) {
                viewedMerchants.add(product.getMerchantId());
            }
        }

        if (viewedCategories.isEmpty()) {
            return Collections.emptyList();
        }

        // 查找同分类或同商户但未浏览的商品
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
                .isNull(GoodsSpu::getDelFlag)
                .notIn(GoodsSpu::getId, viewedIds)
                .and(w -> {
                    w.in(GoodsSpu::getCategoryFirst, viewedCategories);
                    if (!viewedMerchants.isEmpty()) {
                        w.or().in(GoodsSpu::getMerchantId, viewedMerchants);
                    }
                })
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    @Override
    public List<GoodsSpu> recallByNewArrival(int limit) {
        log.debug("执行新品召回: limit={}", limit);

        LocalDateTime cutoffTime = LocalDateTime.now().minusDays(NEW_ARRIVAL_DAYS);

        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
                .isNull(GoodsSpu::getDelFlag)
                .ge(GoodsSpu::getCreateTime, cutoffTime)
                .orderByDesc(GoodsSpu::getCreateTime)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    @Override
    public List<GoodsSpu> recallByHighRatingMerchant(int limit) {
        log.debug("执行高评分商家召回: limit={}", limit);

        // 查询高评分商家
        LambdaQueryWrapper<Merchant> merchantWrapper = new LambdaQueryWrapper<>();
        merchantWrapper.ge(Merchant::getRating, HIGH_RATING_THRESHOLD)
                .eq(Merchant::getStatus, 1)  // 已认证状态
                .orderByDesc(Merchant::getRating)
                .last("LIMIT 20");

        List<Merchant> highRatingMerchants = merchantMapper.selectList(merchantWrapper);
        if (highRatingMerchants.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> merchantIds = highRatingMerchants.stream()
                .map(Merchant::getId)
                .collect(Collectors.toList());

        // 查询这些商家的商品
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
                .isNull(GoodsSpu::getDelFlag)
                .in(GoodsSpu::getMerchantId, merchantIds)
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    @Override
    public List<GoodsSpu> recallBySemantic(String wxUserId, int limit) {
        log.debug("执行语义召回: wxUserId={}, limit={}", wxUserId, limit);

        if (wxUserId == null || wxUserId.isEmpty()) {
            return Collections.emptyList();
        }

        // 检查向量搜索服务是否可用
        if (!vectorSearchService.isAvailable()) {
            log.warn("向量搜索服务不可用，跳过语义召回");
            return Collections.emptyList();
        }

        try {
            // 1. 获取用户兴趣标签中的品类偏好（前5个）
            List<UserInterestTag> userTags = behaviorTrackingService.getUserInterestTags(wxUserId, 20);
            List<String> preferredCategories = userTags.stream()
                    .filter(tag -> "category".equals(tag.getTagType()))
                    .sorted((a, b) -> {
                        double scoreA = (a.getWeight() != null ? a.getWeight().doubleValue() : 0) *
                                (a.getDecayFactor() != null ? a.getDecayFactor().doubleValue() : 1.0);
                        double scoreB = (b.getWeight() != null ? b.getWeight().doubleValue() : 0) *
                                (b.getDecayFactor() != null ? b.getDecayFactor().doubleValue() : 1.0);
                        return Double.compare(scoreB, scoreA);
                    })
                    .limit(5)
                    .map(UserInterestTag::getTagValue)
                    .collect(Collectors.toList());

            // 2. 获取用户最近搜索关键词
            List<String> recentKeywords = userTags.stream()
                    .filter(tag -> "keyword".equals(tag.getTagType()))
                    .sorted((a, b) -> {
                        // 按更新时间降序
                        if (a.getUpdateTime() == null || b.getUpdateTime() == null) {
                            return 0;
                        }
                        return b.getUpdateTime().compareTo(a.getUpdateTime());
                    })
                    .limit(3)
                    .map(UserInterestTag::getTagValue)
                    .collect(Collectors.toList());

            // 如果没有用户兴趣数据，返回空
            if (preferredCategories.isEmpty() && recentKeywords.isEmpty()) {
                log.debug("用户无兴趣标签数据，跳过语义召回");
                return Collections.emptyList();
            }

            // 3. 构建查询文本
            StringBuilder queryBuilder = new StringBuilder();
            if (!preferredCategories.isEmpty()) {
                queryBuilder.append("用户喜欢");
                queryBuilder.append(String.join("、", preferredCategories));
            }
            if (!recentKeywords.isEmpty()) {
                if (queryBuilder.length() > 0) {
                    queryBuilder.append("，");
                }
                queryBuilder.append("最近搜索");
                queryBuilder.append(String.join("、", recentKeywords));
            }

            String queryText = queryBuilder.toString();
            log.debug("语义召回查询文本: {}", queryText);

            // 4. 调用向量搜索服务
            List<GoodsSpu> results = vectorSearchService.searchSimilarProducts(queryText, limit);

            log.debug("语义召回结果: {} 件商品", results.size());
            return results;

        } catch (Exception e) {
            log.warn("语义召回执行异常: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    @Override
    public List<GoodsSpu> recallByClusterRule(String wxUserId, int limit) {
        log.debug("执行聚类规则召回: wxUserId={}, limit={}", wxUserId, limit);

        if (wxUserId == null || wxUserId.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            // 1. 获取用户聚类分配
            com.joolun.mall.entity.UserClusterAssignment assignment =
                    userClusterService.getUserClusterAssignment(wxUserId);

            if (assignment == null) {
                log.debug("用户无聚类分配，跳过聚类规则召回: wxUserId={}", wxUserId);
                return Collections.emptyList();
            }

            // 2. 获取聚类信息
            com.joolun.mall.entity.UserCluster cluster =
                    userClusterService.getClusterById(assignment.getClusterId());

            if (cluster == null) {
                log.warn("聚类不存在: clusterId={}", assignment.getClusterId());
                return Collections.emptyList();
            }

            String clusterName = cluster.getClusterName();

            // 3. 获取聚类特定策略 (优化点9)
            ClusterRecallStrategy strategy = CLUSTER_STRATEGIES.get(clusterName);
            if (strategy != null) {
                log.debug("使用聚类策略: cluster={}, weight={}, categories={}",
                        clusterName, strategy.recallWeight, strategy.priorityCategories);
                return recallWithClusterStrategy(wxUserId, strategy, limit);
            }

            // 4. 无特定策略时，使用原有逻辑
            String recommendCategoriesJson = cluster.getRecommendCategories();
            if (recommendCategoriesJson == null || recommendCategoriesJson.isEmpty()) {
                log.debug("聚类无推荐品类配置: clusterName={}", clusterName);
                return Collections.emptyList();
            }

            // 解析推荐品类
            List<String> recommendCategories;
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper =
                        new com.fasterxml.jackson.databind.ObjectMapper();
                recommendCategories = mapper.readValue(recommendCategoriesJson,
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
            } catch (Exception e) {
                log.warn("解析推荐品类失败: {}", e.getMessage());
                return Collections.emptyList();
            }

            if (recommendCategories.isEmpty()) {
                return Collections.emptyList();
            }

            return recallByCategories(recommendCategories, limit);

        } catch (Exception e) {
            log.warn("聚类规则召回执行异常: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 基于聚类策略进行召回 (优化点9)
     * 不同聚类使用不同的召回权重和品类优先级
     */
    private List<GoodsSpu> recallWithClusterStrategy(String wxUserId, ClusterRecallStrategy strategy, int limit) {
        List<GoodsSpu> results = new ArrayList<>();
        Set<String> seenIds = new HashSet<>();

        // 根据亲和度分配各品类的召回数量
        int totalCategories = strategy.priorityCategories.size();
        if (totalCategories == 0) {
            return results;
        }

        // 品类权重递减：第一个品类最多，依次递减
        int remaining = limit;
        for (int i = 0; i < totalCategories && remaining > 0; i++) {
            String category = strategy.priorityCategories.get(i);
            // 权重递减：第1个品类占30%，第2个25%，第3个20%...
            double categoryWeight = Math.max(0.1, 0.30 - i * 0.05);
            int categoryLimit = (int) Math.ceil(limit * categoryWeight);
            categoryLimit = Math.min(categoryLimit, remaining);

            // 初始化品类映射 (优化点P2)
            initCategoryMapIfNeeded();

            // 收集匹配的品类
            Set<String> matchedCategories = new HashSet<>();
            for (String key : categoryNameToIdMap.keySet()) {
                if (key.contains(category) || category.contains(key)) {
                    matchedCategories.add(key);
                }
            }

            // 按品类查询 (优化: 优先使用精确匹配)
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            if (matchedCategories.isEmpty()) {
                // 没有匹配品类时使用like作为后备
                wrapper.eq(GoodsSpu::getShelf, "1")
                        .isNull(GoodsSpu::getDelFlag)
                        .and(w -> w.like(GoodsSpu::getCategoryFirst, category)
                                .or().like(GoodsSpu::getName, category));
            } else {
                // 使用精确匹配
                wrapper.eq(GoodsSpu::getShelf, "1")
                        .isNull(GoodsSpu::getDelFlag)
                        .in(GoodsSpu::getCategoryFirst, matchedCategories);
            }
            wrapper.orderByDesc(GoodsSpu::getSaleNum)
                    .last("LIMIT " + (categoryLimit * 2));  // 多取一些用于去重

            List<GoodsSpu> categoryProducts = goodsSpuMapper.selectList(wrapper);

            for (GoodsSpu product : categoryProducts) {
                if (seenIds.add(product.getId())) {
                    results.add(product);
                    remaining--;
                    if (remaining <= 0) break;
                }
            }
        }

        // 如果数量不足，用热门商品补充
        if (results.size() < limit) {
            List<GoodsSpu> popularProducts = recallByPopularity(limit - results.size());
            for (GoodsSpu product : popularProducts) {
                if (seenIds.add(product.getId())) {
                    results.add(product);
                    if (results.size() >= limit) break;
                }
            }
        }

        log.debug("聚类策略召回结果: {} 件商品", results.size());
        return results;
    }

    /**
     * 按品类列表召回 (优化点P2: 使用品类缓存进行精确匹配)
     */
    private List<GoodsSpu> recallByCategories(List<String> categories, int limit) {
        List<GoodsSpu> results = new ArrayList<>();
        Set<String> seenIds = new HashSet<>();
        int perCategoryLimit = (limit / categories.size()) + 1;

        // 初始化品类映射
        initCategoryMapIfNeeded();

        for (String category : categories) {
            // 收集匹配的品类
            Set<String> matchedCategories = new HashSet<>();
            for (String key : categoryNameToIdMap.keySet()) {
                if (key.contains(category) || category.contains(key)) {
                    matchedCategories.add(key);
                }
            }

            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            if (matchedCategories.isEmpty()) {
                // 没有匹配品类时使用like作为后备
                wrapper.eq(GoodsSpu::getShelf, "1")
                        .isNull(GoodsSpu::getDelFlag)
                        .and(w -> w.like(GoodsSpu::getCategoryFirst, category)
                                .or().like(GoodsSpu::getName, category));
            } else {
                // 使用精确匹配
                wrapper.eq(GoodsSpu::getShelf, "1")
                        .isNull(GoodsSpu::getDelFlag)
                        .in(GoodsSpu::getCategoryFirst, matchedCategories);
            }
            wrapper.orderByDesc(GoodsSpu::getSaleNum)
                    .last("LIMIT " + perCategoryLimit);

            List<GoodsSpu> categoryProducts = goodsSpuMapper.selectList(wrapper);
            for (GoodsSpu product : categoryProducts) {
                if (seenIds.add(product.getId())) {
                    results.add(product);
                    if (results.size() >= limit) break;
                }
            }
            if (results.size() >= limit) break;
        }

        return results;
    }

    @Override
    public Map<String, Integer> getRecallStats() {
        Map<String, Integer> stats = new HashMap<>();
        recallStats.forEach((key, value) -> stats.put(key, value.get()));
        return stats;
    }

    @Override
    public void updateRecallWeights(Map<String, Double> weights) {
        if (weights == null || weights.isEmpty()) {
            return;
        }

        // 验证权重总和为1
        double total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(total - 1.0) > 0.01) {
            log.warn("召回权重总和不为1: {}, 将进行归一化", total);
            // 归一化处理
            for (Map.Entry<String, Double> entry : weights.entrySet()) {
                weights.put(entry.getKey(), entry.getValue() / total);
            }
        }

        recallWeights.putAll(weights);
        log.info("召回权重配置已更新: {}", recallWeights);
    }

    @Override
    public Map<String, Double> getRecallWeights() {
        return new HashMap<>(recallWeights);
    }

    /**
     * 召回项内部类
     * 用于记录召回商品的得分和来源
     */
    private static class RecallItem {
        GoodsSpu product;
        double weightedScore;
        Set<String> sources;
        String firstSource;  // 最早出现的来源
    }
}
