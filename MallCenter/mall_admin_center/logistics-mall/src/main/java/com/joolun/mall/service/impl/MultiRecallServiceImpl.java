package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.service.MultiRecallService;
import com.joolun.mall.service.UserBehaviorTrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
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
 * 实现6路召回策略并行执行:
 * 1. 热度召回 (30%) - 基于销量和浏览量
 * 2. 协同过滤 (25%) - 基于相似用户行为
 * 3. 品类召回 (20%) - 用户偏好品类的热门商品
 * 4. 时间衰减 (15%) - 最近浏览的相似商品
 * 5. 新品召回 (5%) - 7天内上架的商品
 * 6. 高评分商家 (5%) - 高评分商家的商品
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

    // 召回统计
    private final ConcurrentHashMap<String, AtomicInteger> recallStats = new ConcurrentHashMap<>();

    // 召回权重配置
    private final ConcurrentHashMap<String, Double> recallWeights = new ConcurrentHashMap<>();

    // 并行执行线程池
    private ExecutorService recallExecutor;

    // 召回策略名称常量
    private static final String RECALL_POPULARITY = "popularity";
    private static final String RECALL_COLLABORATIVE = "collaborative";
    private static final String RECALL_CATEGORY = "category";
    private static final String RECALL_RECENT_VIEW = "recent_view";
    private static final String RECALL_NEW_ARRIVAL = "new_arrival";
    private static final String RECALL_HIGH_RATING = "high_rating";

    // 默认权重配置
    private static final double DEFAULT_WEIGHT_POPULARITY = 0.30;
    private static final double DEFAULT_WEIGHT_COLLABORATIVE = 0.25;
    private static final double DEFAULT_WEIGHT_CATEGORY = 0.20;
    private static final double DEFAULT_WEIGHT_RECENT_VIEW = 0.15;
    private static final double DEFAULT_WEIGHT_NEW_ARRIVAL = 0.05;
    private static final double DEFAULT_WEIGHT_HIGH_RATING = 0.05;

    // 新品定义：7天内上架
    private static final int NEW_ARRIVAL_DAYS = 7;

    // 高评分商家阈值
    private static final BigDecimal HIGH_RATING_THRESHOLD = new BigDecimal("4.5");

    // 并行召回超时时间(毫秒)
    private static final long RECALL_TIMEOUT_MS = 3000;

    // Redis 缓存键前缀
    private static final String RECALL_CACHE_PREFIX = "multi_recall:";
    private static final long CACHE_TTL_MINUTES = 10;

    @PostConstruct
    public void init() {
        // 初始化线程池
        recallExecutor = Executors.newFixedThreadPool(6);

        // 初始化默认权重
        recallWeights.put(RECALL_POPULARITY, DEFAULT_WEIGHT_POPULARITY);
        recallWeights.put(RECALL_COLLABORATIVE, DEFAULT_WEIGHT_COLLABORATIVE);
        recallWeights.put(RECALL_CATEGORY, DEFAULT_WEIGHT_CATEGORY);
        recallWeights.put(RECALL_RECENT_VIEW, DEFAULT_WEIGHT_RECENT_VIEW);
        recallWeights.put(RECALL_NEW_ARRIVAL, DEFAULT_WEIGHT_NEW_ARRIVAL);
        recallWeights.put(RECALL_HIGH_RATING, DEFAULT_WEIGHT_HIGH_RATING);

        // 初始化统计计数器
        recallStats.put(RECALL_POPULARITY, new AtomicInteger(0));
        recallStats.put(RECALL_COLLABORATIVE, new AtomicInteger(0));
        recallStats.put(RECALL_CATEGORY, new AtomicInteger(0));
        recallStats.put(RECALL_RECENT_VIEW, new AtomicInteger(0));
        recallStats.put(RECALL_NEW_ARRIVAL, new AtomicInteger(0));
        recallStats.put(RECALL_HIGH_RATING, new AtomicInteger(0));

        log.info("多路召回服务初始化完成，权重配置: {}", recallWeights);
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
            // 并行执行6路召回
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

            // 等待所有召回完成（带超时）
            CompletableFuture.allOf(
                    popularityFuture, collaborativeFuture, categoryFuture,
                    recentViewFuture, newArrivalFuture, highRatingFuture
            ).get(RECALL_TIMEOUT_MS, TimeUnit.MILLISECONDS);

            // 融合各路召回结果
            mergeRecallResults(recallItems, popularityFuture.get(), RECALL_POPULARITY);
            mergeRecallResults(recallItems, collaborativeFuture.get(), RECALL_COLLABORATIVE);
            mergeRecallResults(recallItems, categoryFuture.get(), RECALL_CATEGORY);
            mergeRecallResults(recallItems, recentViewFuture.get(), RECALL_RECENT_VIEW);
            mergeRecallResults(recallItems, newArrivalFuture.get(), RECALL_NEW_ARRIVAL);
            mergeRecallResults(recallItems, highRatingFuture.get(), RECALL_HIGH_RATING);

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
     * 融合召回结果
     * 如果商品已存在，累加得分；否则新增
     */
    private void mergeRecallResults(Map<String, RecallItem> recallItems,
                                    List<GoodsSpu> products,
                                    String source) {
        if (products == null || products.isEmpty()) {
            return;
        }

        double weight = recallWeights.getOrDefault(source, 0.1);
        int hitCount = 0;

        for (int i = 0; i < products.size(); i++) {
            GoodsSpu product = products.get(i);
            String productId = product.getId();

            // 计算位置得分 (越靠前得分越高)
            double positionScore = 1.0 - (double) i / products.size();
            double score = weight * positionScore;

            RecallItem existing = recallItems.get(productId);
            if (existing != null) {
                // 商品已存在，累加得分
                existing.weightedScore += score;
                existing.sources.add(source);
            } else {
                // 新商品
                RecallItem item = new RecallItem();
                item.product = product;
                item.weightedScore = score;
                item.sources = new HashSet<>();
                item.sources.add(source);
                item.firstSource = source;
                recallItems.put(productId, item);
                hitCount++;
            }
        }

        // 更新统计
        recallStats.get(source).addAndGet(hitCount);
        log.debug("召回融合 [{}]: 输入{}件，新增{}件", source, products.size(), hitCount);
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
