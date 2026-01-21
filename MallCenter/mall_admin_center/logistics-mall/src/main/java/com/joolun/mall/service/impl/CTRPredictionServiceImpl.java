package com.joolun.mall.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.UserInterestTagMapper;
import com.joolun.mall.service.CTRPredictionService;
import com.joolun.mall.service.FeatureEngineeringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * CTR预测服务实现
 * 基于逻辑回归 + 特征交叉的点击率预测模型
 *
 * 核心算法:
 * - 预测: P(click) = sigmoid(w·x) = 1 / (1 + exp(-w·x))
 * - 在线学习: SGD更新 w_i += lr * (label - prediction) * x_i - lr * lambda * w_i
 *
 * 特征维度设计 (168维):
 * - 用户特征 (0-63): 64维，来自FeatureEngineeringService
 * - 商品特征 (64-127): 64维，来自FeatureEngineeringService
 * - 交叉特征 (128-167): 40维，用户偏好与商品属性的交叉
 *
 * 交叉特征详解 (40维):
 * - 用户品类偏好 x 商品品类 (0-7): 8维
 * - 用户价格偏好 x 商品价格区间 (8-15): 8维
 * - 用户活跃度 x 商品新鲜度 (16-19): 4维
 * - 用户购买力 x 商品价格 (20-23): 4维
 * - 用户品牌偏好 x 商品品牌热度 (24-27): 4维
 * - 时间上下文 x 商品时段适配 (28-31): 4维
 * - 行为趋势交叉特征 (32-35): 4维
 * - 转化率交叉特征 (36-39): 4维
 *
 * @author CTR Enhancement
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CTRPredictionServiceImpl implements CTRPredictionService {

    private final FeatureEngineeringService featureEngineeringService;
    private final UserInterestTagMapper userInterestTagMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // ==================== 模型参数 ====================

    /**
     * 学习率
     */
    private static final double LEARNING_RATE = 0.01;

    /**
     * L2正则化系数
     */
    private static final double LAMBDA = 0.001;

    /**
     * 权重初始化范围
     */
    private static final double INIT_WEIGHT_RANGE = 0.01;

    /**
     * 梯度裁剪阈值 (防止梯度爆炸)
     */
    private static final double GRADIENT_CLIP = 5.0;

    // ==================== Redis Key ====================

    private static final String WEIGHTS_KEY = "ctr:model:weights";
    private static final String STATS_KEY = "ctr:model:stats";
    private static final String BACKUP_KEY_PREFIX = "ctr:model:backup:";
    private static final String FEATURE_CACHE_PREFIX = "ctr:feature:";

    // ==================== 缓存配置 ====================

    private static final long FEATURE_CACHE_TTL_MINUTES = 30;
    private static final long WEIGHTS_CACHE_TTL_HOURS = 24;

    // ==================== 内存缓存 ====================

    /**
     * 模型权重向量 (内存缓存，定期同步到Redis)
     */
    private volatile double[] weights;

    /**
     * 模型训练统计
     */
    private final AtomicLong totalSamples = new AtomicLong(0);
    private final AtomicLong positiveSamples = new AtomicLong(0);
    private final AtomicLong updateCount = new AtomicLong(0);

    /**
     * 特征名称映射 (用于解释特征重要性)
     */
    private static final Map<Integer, String> FEATURE_NAMES = new ConcurrentHashMap<>();

    static {
        // 用户特征名称 (0-63)
        FEATURE_NAMES.put(0, "user_level");
        FEATURE_NAMES.put(1, "user_behavior_count");
        FEATURE_NAMES.put(2, "user_7day_activity");
        FEATURE_NAMES.put(3, "user_30day_activity");
        FEATURE_NAMES.put(4, "user_is_new");
        FEATURE_NAMES.put(5, "user_is_active");
        FEATURE_NAMES.put(6, "user_high_value");
        FEATURE_NAMES.put(7, "user_maturity");
        // 8-31: 行为序列embedding
        for (int i = 8; i < 32; i++) {
            FEATURE_NAMES.put(i, "user_behavior_emb_" + (i - 8));
        }
        // 32-47: 偏好特征
        for (int i = 32; i < 48; i++) {
            FEATURE_NAMES.put(i, "user_preference_" + (i - 32));
        }
        // 48-63: 时间特征
        for (int i = 48; i < 64; i++) {
            FEATURE_NAMES.put(i, "user_time_context_" + (i - 48));
        }

        // 商品特征名称 (64-127)
        FEATURE_NAMES.put(64, "item_price_norm");
        FEATURE_NAMES.put(65, "item_discount_rate");
        FEATURE_NAMES.put(66, "item_in_stock");
        FEATURE_NAMES.put(67, "item_stock_level");
        FEATURE_NAMES.put(68, "item_on_shelf");
        FEATURE_NAMES.put(69, "item_freshness");
        FEATURE_NAMES.put(70, "item_has_promotion");
        FEATURE_NAMES.put(71, "item_price_tier");
        // 72-103: 商品embedding
        for (int i = 72; i < 104; i++) {
            FEATURE_NAMES.put(i, "item_emb_" + (i - 72));
        }
        // 104-119: 统计特征
        for (int i = 104; i < 120; i++) {
            FEATURE_NAMES.put(i, "item_stats_" + (i - 104));
        }
        // 120-127: 上下文特征
        for (int i = 120; i < 128; i++) {
            FEATURE_NAMES.put(i, "item_context_" + (i - 120));
        }

        // 交叉特征名称 (128-167)
        for (int i = 0; i < 8; i++) {
            FEATURE_NAMES.put(128 + i, "cross_category_" + i);
        }
        for (int i = 0; i < 8; i++) {
            FEATURE_NAMES.put(136 + i, "cross_price_" + i);
        }
        for (int i = 0; i < 4; i++) {
            FEATURE_NAMES.put(144 + i, "cross_activity_freshness_" + i);
        }
        for (int i = 0; i < 4; i++) {
            FEATURE_NAMES.put(148 + i, "cross_purchasing_power_" + i);
        }
        for (int i = 0; i < 4; i++) {
            FEATURE_NAMES.put(152 + i, "cross_brand_" + i);
        }
        for (int i = 0; i < 4; i++) {
            FEATURE_NAMES.put(156 + i, "cross_time_" + i);
        }
        // 新增: 行为趋势交叉特征 (160-163)
        FEATURE_NAMES.put(160, "cross_user_item_trend");
        FEATURE_NAMES.put(161, "cross_user_trend_positive");
        FEATURE_NAMES.put(162, "cross_item_trend_positive");
        FEATURE_NAMES.put(163, "cross_trend_diff");
        // 新增: 转化率交叉特征 (164-167)
        FEATURE_NAMES.put(164, "cross_cvr_ctr");
        FEATURE_NAMES.put(165, "cross_user_cvr");
        FEATURE_NAMES.put(166, "cross_item_ctr");
        FEATURE_NAMES.put(167, "cross_high_conversion");

        // ==================== V3.0 新增特征 (168-199) ====================

        // 用户-商品深度交叉特征 (168-183)
        FEATURE_NAMES.put(168, "cross_purchase_freq_x_popularity");
        FEATURE_NAMES.put(169, "cross_user_avg_price_div_item_price");
        FEATURE_NAMES.put(170, "cross_user_category_depth");
        FEATURE_NAMES.put(171, "cross_user_merchant_loyalty");
        FEATURE_NAMES.put(172, "cross_user_repurchase_x_item_repurchase");
        FEATURE_NAMES.put(173, "cross_user_basket_x_item_combo");
        FEATURE_NAMES.put(174, "cross_user_diversity_x_item_niche");
        FEATURE_NAMES.put(175, "cross_user_promo_sensitivity_x_item_discount");
        FEATURE_NAMES.put(176, "cross_user_new_product_affinity");
        FEATURE_NAMES.put(177, "cross_user_brand_preference");
        FEATURE_NAMES.put(178, "cross_user_seasonal_pattern");
        FEATURE_NAMES.put(179, "cross_user_time_preference_match");
        FEATURE_NAMES.put(180, "cross_user_cluster_x_item_cluster_affinity");
        FEATURE_NAMES.put(181, "cross_user_mature_x_item_complexity");
        FEATURE_NAMES.put(182, "cross_user_active_x_item_freshness_deep");
        FEATURE_NAMES.put(183, "cross_user_value_x_item_margin");

        // 行为序列特征 (184-191)
        FEATURE_NAMES.put(184, "seq_last_view_similarity");
        FEATURE_NAMES.put(185, "seq_last_purchase_similarity");
        FEATURE_NAMES.put(186, "seq_browse_entropy");
        FEATURE_NAMES.put(187, "seq_category_transition_prob");
        FEATURE_NAMES.put(188, "seq_repurchase_probability");
        FEATURE_NAMES.put(189, "seq_session_depth");
        FEATURE_NAMES.put(190, "seq_cart_abandon_rate");
        FEATURE_NAMES.put(191, "seq_view_to_purchase_rate");

        // 上下文特征 (192-199)
        FEATURE_NAMES.put(192, "ctx_hour_normalized");
        FEATURE_NAMES.put(193, "ctx_day_of_week_normalized");
        FEATURE_NAMES.put(194, "ctx_is_weekend");
        FEATURE_NAMES.put(195, "ctx_is_promotion_period");
        FEATURE_NAMES.put(196, "ctx_is_peak_hour");
        FEATURE_NAMES.put(197, "ctx_season_indicator");
        FEATURE_NAMES.put(198, "ctx_holiday_proximity");
        FEATURE_NAMES.put(199, "ctx_session_duration_normalized");
    }

    // ==================== 初始化 ====================

    @PostConstruct
    public void init() {
        log.info("初始化CTR预测模型...");
        loadWeightsFromRedis();
        loadStatsFromRedis();
        log.info("CTR模型初始化完成: 权重维度={}, 训练样本数={}, 正样本率={:.4f}",
                TOTAL_FEATURE_DIM, totalSamples.get(),
                totalSamples.get() > 0 ? (double) positiveSamples.get() / totalSamples.get() : 0);
    }

    /**
     * 从Redis加载权重
     */
    private void loadWeightsFromRedis() {
        try {
            String weightsJson = redisTemplate.opsForValue().get(WEIGHTS_KEY);
            if (weightsJson != null && !weightsJson.isEmpty()) {
                weights = objectMapper.readValue(weightsJson, double[].class);
                if (weights.length != TOTAL_FEATURE_DIM) {
                    log.warn("Redis中权重维度不匹配: expected={}, actual={}, 重新初始化",
                            TOTAL_FEATURE_DIM, weights.length);
                    initializeWeights();
                }
            } else {
                initializeWeights();
            }
        } catch (Exception e) {
            log.warn("从Redis加载权重失败: {}, 重新初始化", e.getMessage());
            initializeWeights();
        }
    }

    /**
     * 从Redis加载统计信息
     */
    private void loadStatsFromRedis() {
        try {
            String statsJson = redisTemplate.opsForValue().get(STATS_KEY);
            if (statsJson != null && !statsJson.isEmpty()) {
                Map<String, Long> stats = objectMapper.readValue(statsJson, Map.class);
                totalSamples.set(stats.getOrDefault("totalSamples", 0L));
                positiveSamples.set(stats.getOrDefault("positiveSamples", 0L));
                updateCount.set(stats.getOrDefault("updateCount", 0L));
            }
        } catch (Exception e) {
            log.debug("从Redis加载统计信息失败: {}", e.getMessage());
        }
    }

    /**
     * 初始化权重为小随机值
     */
    private void initializeWeights() {
        weights = new double[TOTAL_FEATURE_DIM];
        Random random = new Random(42);  // 固定种子保证可复现
        for (int i = 0; i < TOTAL_FEATURE_DIM; i++) {
            weights[i] = (random.nextDouble() - 0.5) * 2 * INIT_WEIGHT_RANGE;
        }
        saveWeightsToRedis();
        log.info("权重已初始化: 维度={}", TOTAL_FEATURE_DIM);
    }

    // ==================== 核心预测方法 ====================

    @Override
    public double predictCTR(String wxUserId, GoodsSpu product) {
        if (product == null) {
            return 0.0;
        }

        try {
            // 构建特征向量
            double[] features = buildFeatureVector(wxUserId, product);

            // 计算点击概率
            double prediction = predict(features, weights);

            log.debug("CTR预测: userId={}, productId={}, ctr={:.4f}",
                    wxUserId, product.getId(), prediction);

            return prediction;

        } catch (Exception e) {
            log.warn("CTR预测失败: userId={}, productId={}, error={}",
                    wxUserId, product.getId(), e.getMessage());
            return 0.5;  // 失败时返回中性值
        }
    }

    @Override
    public Map<String, Double> batchPredictCTR(String wxUserId, List<GoodsSpu> products) {
        Map<String, Double> predictions = new LinkedHashMap<>();

        if (products == null || products.isEmpty()) {
            return predictions;
        }

        // 预先构建用户特征 (所有商品共享)
        double[] userFeatures = featureEngineeringService.buildUserFeatureVector(wxUserId);

        // 获取用户偏好 (用于交叉特征)
        Map<String, Double> userPreferences = getUserPreferences(wxUserId);

        // 预构建商品特征向量缓存 (优化点1: 避免循环内重复构建)
        Map<String, double[]> productFeaturesCache = new HashMap<>();
        for (GoodsSpu product : products) {
            productFeaturesCache.put(product.getId(),
                featureEngineeringService.buildProductFeatureVector(product));
        }

        // 在循环中使用缓存进行CTR预测
        for (GoodsSpu product : products) {
            try {
                // 从缓存获取商品特征
                double[] productFeatures = productFeaturesCache.get(product.getId());

                // 构建交叉特征
                double[] crossFeatures = buildCrossFeatures(userFeatures, productFeatures, userPreferences, product);

                // 拼接完整特征向量
                double[] features = concatenateAllFeatures(userFeatures, productFeatures, crossFeatures);

                // 预测
                double ctr = predict(features, weights);
                predictions.put(product.getId(), ctr);

            } catch (Exception e) {
                log.debug("批量CTR预测失败: productId={}", product.getId());
                predictions.put(product.getId(), 0.5);
            }
        }

        return predictions;
    }

    @Override
    public List<GoodsSpu> rerankByCTR(String wxUserId, List<GoodsSpu> products) {
        if (products == null || products.isEmpty()) {
            return products;
        }

        // 批量预测CTR
        Map<String, Double> ctrScores = batchPredictCTR(wxUserId, products);

        // 按CTR降序排序
        List<GoodsSpu> sorted = new ArrayList<>(products);
        sorted.sort((a, b) -> {
            double ctrA = ctrScores.getOrDefault(a.getId(), 0.0);
            double ctrB = ctrScores.getOrDefault(b.getId(), 0.0);
            return Double.compare(ctrB, ctrA);  // 降序
        });

        log.info("CTR重排序完成: userId={}, count={}", wxUserId, sorted.size());
        return sorted;
    }

    // ==================== 在线学习 ====================

    @Override
    public void updateModel(String wxUserId, String productId, boolean clicked) {
        try {
            // 获取商品
            GoodsSpu product = goodsSpuMapper.selectById(productId);
            if (product == null) {
                log.warn("更新模型失败: 商品不存在, productId={}", productId);
                return;
            }

            // 构建特征向量
            double[] features = buildFeatureVector(wxUserId, product);

            // 当前预测值
            double prediction = predict(features, weights);

            // 标签 (点击=1, 未点击=0)
            double label = clicked ? 1.0 : 0.0;

            // SGD更新
            updateWeights(features, label, prediction);

            // 更新统计
            totalSamples.incrementAndGet();
            if (clicked) {
                positiveSamples.incrementAndGet();
            }
            updateCount.incrementAndGet();

            // 每100次更新同步到Redis
            if (updateCount.get() % 100 == 0) {
                saveWeightsToRedis();
                saveStatsToRedis();
            }

            log.debug("模型更新: userId={}, productId={}, clicked={}, prediction={:.4f}, label={}",
                    wxUserId, productId, clicked, prediction, label);

        } catch (Exception e) {
            log.warn("模型更新失败: userId={}, productId={}, error={}",
                    wxUserId, productId, e.getMessage());
        }
    }

    @Override
    public void batchUpdateModel(List<CTRFeedback> feedbackList) {
        if (feedbackList == null || feedbackList.isEmpty()) {
            return;
        }

        int successCount = 0;
        for (CTRFeedback feedback : feedbackList) {
            try {
                updateModel(feedback.getWxUserId(), feedback.getProductId(), feedback.isClicked());
                successCount++;
            } catch (Exception e) {
                log.debug("批量更新单条失败: {}", e.getMessage());
            }
        }

        // 批量更新后立即同步
        saveWeightsToRedis();
        saveStatsToRedis();

        log.info("批量模型更新完成: total={}, success={}", feedbackList.size(), successCount);
    }

    // ==================== 模型管理 ====================

    @Override
    public Map<String, Double> getFeatureImportance() {
        Map<String, Double> importance = new LinkedHashMap<>();

        if (weights == null) {
            return importance;
        }

        // 计算权重绝对值作为重要性
        List<Map.Entry<Integer, Double>> weightList = new ArrayList<>();
        for (int i = 0; i < weights.length; i++) {
            weightList.add(Map.entry(i, Math.abs(weights[i])));
        }

        // 按重要性降序排序
        weightList.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));

        // 取Top 20
        for (int i = 0; i < Math.min(20, weightList.size()); i++) {
            Map.Entry<Integer, Double> entry = weightList.get(i);
            String featureName = FEATURE_NAMES.getOrDefault(entry.getKey(), "feature_" + entry.getKey());
            importance.put(featureName, entry.getValue());
        }

        return importance;
    }

    @Override
    public double[] getModelWeights() {
        return weights != null ? weights.clone() : new double[TOTAL_FEATURE_DIM];
    }

    @Override
    public void resetModelWeights() {
        initializeWeights();
        totalSamples.set(0);
        positiveSamples.set(0);
        updateCount.set(0);
        saveStatsToRedis();
        log.info("模型权重已重置");
    }

    @Override
    public Map<String, Object> getModelStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalFeatureDim", TOTAL_FEATURE_DIM);
        stats.put("userFeatureDim", USER_FEATURE_DIM);
        stats.put("itemFeatureDim", ITEM_FEATURE_DIM);
        stats.put("crossFeatureDim", CROSS_FEATURE_DIM);
        stats.put("baseLearningRate", LEARNING_RATE);
        stats.put("currentLearningRate", getAdaptiveLearningRate());  // 当前自适应学习率
        stats.put("l2Lambda", LAMBDA);
        stats.put("totalSamples", totalSamples.get());
        stats.put("positiveSamples", positiveSamples.get());
        stats.put("positiveRate", totalSamples.get() > 0 ?
                (double) positiveSamples.get() / totalSamples.get() : 0.0);
        stats.put("updateCount", updateCount.get());

        // 权重统计
        if (weights != null) {
            double weightSum = 0, weightSumSq = 0;
            double maxWeight = Double.MIN_VALUE, minWeight = Double.MAX_VALUE;
            for (double w : weights) {
                weightSum += w;
                weightSumSq += w * w;
                maxWeight = Math.max(maxWeight, w);
                minWeight = Math.min(minWeight, w);
            }
            double weightMean = weightSum / weights.length;
            double weightStd = Math.sqrt(weightSumSq / weights.length - weightMean * weightMean);

            stats.put("weightMean", weightMean);
            stats.put("weightStd", weightStd);
            stats.put("weightMax", maxWeight);
            stats.put("weightMin", minWeight);
        }

        return stats;
    }

    // ==================== 定时任务 ====================

    /**
     * 每天凌晨2点备份模型到MySQL (通过Redis持久化)
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void dailyBackup() {
        try {
            String backupKey = BACKUP_KEY_PREFIX + java.time.LocalDate.now().toString();
            String weightsJson = objectMapper.writeValueAsString(weights);

            // 备份权重
            redisTemplate.opsForValue().set(backupKey, weightsJson, 30, TimeUnit.DAYS);

            // 备份统计
            Map<String, Long> stats = new HashMap<>();
            stats.put("totalSamples", totalSamples.get());
            stats.put("positiveSamples", positiveSamples.get());
            stats.put("updateCount", updateCount.get());
            String statsJson = objectMapper.writeValueAsString(stats);
            redisTemplate.opsForValue().set(backupKey + ":stats", statsJson, 30, TimeUnit.DAYS);

            log.info("CTR模型每日备份完成: key={}", backupKey);

        } catch (Exception e) {
            log.error("CTR模型备份失败", e);
        }
    }

    /**
     * 每5分钟同步权重到Redis
     */
    @Scheduled(fixedRate = 300000)
    public void syncWeightsToRedis() {
        saveWeightsToRedis();
        saveStatsToRedis();
        log.debug("CTR模型权重已同步到Redis");
    }

    // ==================== 核心算法 ====================

    /**
     * Sigmoid函数
     * P(click) = 1 / (1 + exp(-z))
     */
    private double sigmoid(double z) {
        // 防止数值溢出
        if (z > 500) return 1.0;
        if (z < -500) return 0.0;
        return 1.0 / (1.0 + Math.exp(-z));
    }

    /**
     * 预测函数
     * P(click) = sigmoid(w·x)
     */
    private double predict(double[] features, double[] w) {
        if (features == null || w == null || features.length != w.length) {
            return 0.5;
        }

        double z = 0.0;
        for (int i = 0; i < features.length; i++) {
            z += features[i] * w[i];
        }

        return sigmoid(z);
    }

    /**
     * SGD权重更新
     * w_i += lr * (label - prediction) * x_i - lr * lambda * w_i
     */
    private void updateWeights(double[] features, double label, double prediction) {
        if (features == null || weights == null) {
            return;
        }

        double error = label - prediction;
        double lr = getAdaptiveLearningRate();  // 使用自适应学习率

        for (int i = 0; i < features.length && i < weights.length; i++) {
            // 梯度
            double gradient = error * features[i];

            // 梯度裁剪
            gradient = Math.max(-GRADIENT_CLIP, Math.min(GRADIENT_CLIP, gradient));

            // SGD更新 + L2正则化
            weights[i] += lr * gradient - lr * LAMBDA * weights[i];
        }
    }

    /**
     * 获取自适应学习率
     * 实现学习率调度策略:
     * - Warm-up阶段: 前1000次更新逐步增加学习率
     * - 衰减阶段: 每10000次更新衰减10%
     * - 最小学习率: 0.001
     *
     * @return 当前自适应学习率
     */
    private double getAdaptiveLearningRate() {
        long updates = updateCount.get();
        double baseLr = LEARNING_RATE;  // 0.01

        // Warm-up: 前1000次更新逐步增加学习率
        if (updates < 1000) {
            return baseLr * (updates + 1) / 1000.0;
        }

        // 衰减: 每10000次更新衰减10%
        double decay = Math.pow(0.9, updates / 10000);
        return Math.max(0.001, baseLr * decay);  // 最小学习率0.001
    }

    // ==================== 特征工程 ====================

    /**
     * 构建完整特征向量 (160维)
     */
    private double[] buildFeatureVector(String wxUserId, GoodsSpu product) {
        // 用户特征 (64维)
        double[] userFeatures = featureEngineeringService.buildUserFeatureVector(wxUserId);

        // 商品特征 (64维)
        double[] productFeatures = featureEngineeringService.buildProductFeatureVector(product);

        // 用户偏好
        Map<String, Double> userPreferences = getUserPreferences(wxUserId);

        // 交叉特征 (32维)
        double[] crossFeatures = buildCrossFeatures(userFeatures, productFeatures, userPreferences, product);

        // 拼接
        return concatenateAllFeatures(userFeatures, productFeatures, crossFeatures);
    }

    /**
     * 拼接所有特征
     */
    private double[] concatenateAllFeatures(double[] userFeatures, double[] productFeatures, double[] crossFeatures) {
        double[] features = new double[TOTAL_FEATURE_DIM];
        Arrays.fill(features, 0);

        // 用户特征 (0-63)
        if (userFeatures != null) {
            System.arraycopy(userFeatures, 0, features, 0,
                    Math.min(userFeatures.length, USER_FEATURE_DIM));
        }

        // 商品特征 (64-127)
        if (productFeatures != null) {
            System.arraycopy(productFeatures, 0, features, USER_FEATURE_DIM,
                    Math.min(productFeatures.length, ITEM_FEATURE_DIM));
        }

        // 交叉特征 (128-167)
        if (crossFeatures != null) {
            System.arraycopy(crossFeatures, 0, features, USER_FEATURE_DIM + ITEM_FEATURE_DIM,
                    Math.min(crossFeatures.length, CROSS_FEATURE_DIM));
        }

        return features;
    }

    /**
     * 构建交叉特征 (40维)
     *
     * 交叉特征设计:
     * - 用户品类偏好 x 商品品类匹配度 (0-7): 8维
     * - 用户价格偏好 x 商品价格区间匹配度 (8-15): 8维
     * - 用户活跃度 x 商品新鲜度 (16-19): 4维
     * - 用户购买力 x 商品价格 (20-23): 4维
     * - 用户品牌偏好 x 商品品牌热度 (24-27): 4维
     * - 时间上下文 x 商品时段适配 (28-31): 4维
     * - 行为趋势交叉特征 (32-35): 4维
     * - 转化率交叉特征 (36-39): 4维
     */
    private double[] buildCrossFeatures(double[] userFeatures, double[] productFeatures,
                                         Map<String, Double> userPreferences, GoodsSpu product) {
        double[] crossFeatures = new double[CROSS_FEATURE_DIM];
        Arrays.fill(crossFeatures, 0);

        try {
            // 1. 用户品类偏好 x 商品品类匹配 (0-7)
            String productCategory = product.getCategoryFirst();
            if (productCategory != null) {
                double categoryPref = userPreferences.getOrDefault("category:" + productCategory, 0.0);
                // 不同维度表示不同强度的匹配
                crossFeatures[0] = categoryPref;  // 原始偏好值
                crossFeatures[1] = categoryPref > 0 ? 1.0 : 0;  // 是否有偏好
                crossFeatures[2] = categoryPref > 0.3 ? 1.0 : 0;  // 中等偏好
                crossFeatures[3] = categoryPref > 0.6 ? 1.0 : 0;  // 强偏好
                // 与商品热度的交叉
                if (productFeatures != null && productFeatures.length > 40) {
                    crossFeatures[4] = categoryPref * productFeatures[40];  // 品类偏好 x 销量
                    crossFeatures[5] = categoryPref * productFeatures[56];  // 品类偏好 x 分类热度
                }
                // 二级分类匹配
                String categorySecond = product.getCategorySecond();
                if (categorySecond != null) {
                    double subCategoryPref = userPreferences.getOrDefault("category:" + categorySecond, 0.0);
                    crossFeatures[6] = subCategoryPref;
                    crossFeatures[7] = categoryPref * subCategoryPref;  // 一二级品类偏好乘积
                }
            }

            // 2. 用户价格偏好 x 商品价格区间匹配 (8-15)
            if (product.getSalesPrice() != null) {
                double price = product.getSalesPrice().doubleValue();
                String priceRange = getPriceRange(price);
                double pricePref = userPreferences.getOrDefault("price:" + priceRange, 0.0);

                crossFeatures[8] = pricePref;  // 价格区间偏好
                crossFeatures[9] = pricePref > 0 ? 1.0 : 0;  // 是否有价格偏好
                crossFeatures[10] = pricePref * (price / 1000.0);  // 偏好 x 归一化价格

                // 折扣敏感度
                double discountSensitivity = userPreferences.getOrDefault("discount_sensitivity", 0.5);
                if (productFeatures != null && productFeatures.length > 1) {
                    crossFeatures[11] = discountSensitivity * productFeatures[1];  // 折扣敏感度 x 折扣率
                }

                // 价格弹性
                double avgPrice = userPreferences.getOrDefault("avg_price", 100.0);
                crossFeatures[12] = avgPrice > 0 ? price / avgPrice : 1.0;  // 相对价格比
                crossFeatures[13] = price < avgPrice * 0.8 ? 1.0 : 0;  // 低于平均价格
                crossFeatures[14] = price > avgPrice * 1.2 ? 1.0 : 0;  // 高于平均价格
                crossFeatures[15] = Math.abs(price - avgPrice) / Math.max(avgPrice, 1);  // 价格偏差
            }

            // 3. 用户活跃度 x 商品新鲜度 (16-19)
            if (userFeatures != null && productFeatures != null) {
                double userActivity = userFeatures.length > 2 ? userFeatures[2] : 0;  // 7天活跃度
                double itemFreshness = productFeatures.length > 5 ? productFeatures[5] : 0;  // 商品新鲜度

                crossFeatures[16] = userActivity * itemFreshness;  // 活跃度 x 新鲜度
                crossFeatures[17] = userActivity > 0.5 && itemFreshness > 0.5 ? 1.0 : 0;  // 活跃用户+新品
                crossFeatures[18] = userActivity < 0.3 ? itemFreshness : 0;  // 低活跃用户偏好新品
                crossFeatures[19] = userActivity > 0.7 ? 1.0 - itemFreshness : 0;  // 高活跃用户偏好经典款
            }

            // 4. 用户购买力 x 商品价格 (20-23)
            double purchasingPower = userPreferences.getOrDefault("purchasing_power", 0.5);
            if (product.getSalesPrice() != null) {
                double normalizedPrice = Math.min(1.0, product.getSalesPrice().doubleValue() / 1000.0);
                crossFeatures[20] = purchasingPower * normalizedPrice;  // 购买力 x 价格
                crossFeatures[21] = purchasingPower > 0.6 && normalizedPrice > 0.5 ? 1.0 : 0;  // 高购买力+高价商品
                crossFeatures[22] = purchasingPower < 0.4 && normalizedPrice < 0.3 ? 1.0 : 0;  // 低购买力+低价商品
                crossFeatures[23] = Math.abs(purchasingPower - normalizedPrice);  // 购买力与价格差异
            }

            // 5. 用户品牌偏好 x 商品品牌热度 (24-27)
            // (简化版: 使用商户作为品牌代理)
            if (product.getMerchantId() != null) {
                double brandPref = userPreferences.getOrDefault("merchant:" + product.getMerchantId(), 0.0);
                crossFeatures[24] = brandPref;
                crossFeatures[25] = brandPref > 0 ? 1.0 : 0;
                crossFeatures[26] = brandPref > 0.5 ? 1.0 : 0;  // 强品牌偏好
                // 商户多样性偏好
                double diversityPref = userPreferences.getOrDefault("merchant_diversity", 0.5);
                crossFeatures[27] = diversityPref * (brandPref > 0 ? 0 : 1);  // 多样性偏好 x 新商户
            }

            // 6. 时间上下文 x 商品时段适配 (28-31)
            if (userFeatures != null && userFeatures.length > 48) {
                // 工作日/周末
                double isWeekday = userFeatures[59] > 0.5 ? 1.0 : 0;  // 时间特征中的工作日标记
                double isWeekend = 1.0 - isWeekday;

                // 商品时段适配度 (简化: 基于商品销量分布推断)
                if (productFeatures != null && productFeatures.length > 40) {
                    double itemPopularity = productFeatures[40];  // 销量特征
                    crossFeatures[28] = isWeekday * itemPopularity;  // 工作日热销
                    crossFeatures[29] = isWeekend * itemPopularity;  // 周末热销
                }

                // 时段特征 (上午/下午/晚间)
                double isMorning = userFeatures[55] > 0.5 ? 1.0 : 0;
                double isEvening = userFeatures[58] > 0.5 ? 1.0 : 0;
                crossFeatures[30] = isMorning;  // 上午购物
                crossFeatures[31] = isEvening;  // 晚间购物
            }

            // 7. 行为趋势交叉特征 (32-35) - 新增
            String wxUserId = userPreferences.containsKey("wx_user_id") ?
                    String.valueOf(userPreferences.get("wx_user_id")) : null;
            double userTrend = getUserActivityTrend(wxUserId);
            double itemTrend = getItemSalesTrend(product);
            crossFeatures[32] = userTrend * itemTrend;
            crossFeatures[33] = userTrend > 0 ? 1.0 : 0;
            crossFeatures[34] = itemTrend > 0 ? 1.0 : 0;
            crossFeatures[35] = Math.abs(userTrend - itemTrend);

            // 8. 转化率交叉特征 (36-39) - 新增
            double userCVR = getUserConversionRate(wxUserId);
            double itemCTR = getItemClickRate(product);
            crossFeatures[36] = userCVR * itemCTR;
            crossFeatures[37] = userCVR;
            crossFeatures[38] = itemCTR;
            crossFeatures[39] = (userCVR > 0.1 && itemCTR > 0.05) ? 1.0 : 0;

            // ==================== V3.0 新增特征 (40-71) ====================

            // 9. 用户-商品深度交叉特征 (40-55)
            double userPurchaseFreq = safeGet(userFeatures, 15);
            double itemPopularity = safeGet(productFeatures, 9);
            double userAvgPrice = safeGet(userFeatures, 10);
            double itemPrice = safeGet(productFeatures, 3);
            double userCategoryCount = safeGet(userFeatures, 25);
            double userMerchantLoyalty = safeGet(userFeatures, 26);
            double userRepurchaseRate = safeGet(userFeatures, 21);
            double itemRepurchaseRate = safeGet(productFeatures, 12);
            double userBasketSize = safeGet(userFeatures, 22);
            double itemComboScore = safeGet(productFeatures, 13);
            double userDiversity = safeGet(userFeatures, 27);
            double itemNiche = 1.0 - itemPopularity;
            double userPromoSensitivity = safeGet(userFeatures, 28);
            double itemDiscount = safeGet(productFeatures, 15);
            double userNewProductAffinity = safeGet(userFeatures, 29);
            double itemFreshness2 = safeGet(productFeatures, 8);
            double userActiveRecent = safeGet(userFeatures, 2);

            crossFeatures[40] = userPurchaseFreq * itemPopularity;                      // 购买频率×热度
            crossFeatures[41] = itemPrice > 0 ? userAvgPrice / (itemPrice + 0.001) : 0; // 价格匹配度
            crossFeatures[42] = userCategoryCount;                                      // 用户品类深度
            crossFeatures[43] = userMerchantLoyalty;                                    // 用户商户忠诚度
            crossFeatures[44] = userRepurchaseRate * itemRepurchaseRate;                // 复购交叉
            crossFeatures[45] = userBasketSize * itemComboScore;                        // 篮子×组合
            crossFeatures[46] = userDiversity * itemNiche;                              // 多样性×小众
            crossFeatures[47] = userPromoSensitivity * itemDiscount;                    // 促销敏感度×折扣
            crossFeatures[48] = userNewProductAffinity * itemFreshness2;                // 新品偏好×新鲜度
            crossFeatures[49] = safeGet(userFeatures, 30);                              // 用户品牌偏好
            crossFeatures[50] = safeGet(userFeatures, 31);                              // 用户季节模式
            crossFeatures[51] = calculateTimePreferenceMatchV3(userFeatures);           // 时间偏好匹配
            crossFeatures[52] = safeGet(userFeatures, 7);                               // 聚类亲和度(从画像成熟度)
            crossFeatures[53] = safeGet(userFeatures, 18) * safeGet(productFeatures, 11); // 成熟度×复杂度
            crossFeatures[54] = userActiveRecent * itemFreshness2;                      // 活跃×新鲜深度交叉
            crossFeatures[55] = safeGet(userFeatures, 32) * safeGet(productFeatures, 16); // 价值×利润率

            // 10. 行为序列特征 (56-63)
            crossFeatures[56] = calculateCategorySimilarityV3(wxUserId, product);       // 最近浏览相似度
            crossFeatures[57] = calculatePurchaseSimilarityV3(wxUserId, product);       // 最近购买相似度
            crossFeatures[58] = calculateBrowseEntropyV3(wxUserId);                     // 浏览熵
            crossFeatures[59] = 0.5;                                                    // 品类转移概率(简化)
            crossFeatures[60] = userRepurchaseRate;                                     // 复购概率
            crossFeatures[61] = safeGet(userFeatures, 33);                              // 会话深度
            crossFeatures[62] = safeGet(userFeatures, 34);                              // 加购放弃率
            crossFeatures[63] = safeGet(userFeatures, 35);                              // 浏览到购买率

            // 11. 上下文特征 (64-71)
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            int hour = now.getHour();
            int dayOfWeek = now.getDayOfWeek().getValue();

            crossFeatures[64] = hour / 24.0;                                            // 小时归一化
            crossFeatures[65] = dayOfWeek / 7.0;                                        // 星期归一化
            crossFeatures[66] = (dayOfWeek >= 6) ? 1.0 : 0.0;                          // 是否周末
            crossFeatures[67] = isPromotionPeriodV3() ? 1.0 : 0.0;                     // 是否促销期
            crossFeatures[68] = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21) ? 1.0 : 0.0; // 高峰时段
            crossFeatures[69] = getSeasonIndicatorV3(now);                              // 季节指标
            crossFeatures[70] = getHolidayProximityV3(now);                             // 节日临近度
            crossFeatures[71] = safeGet(userFeatures, 36);                              // 会话时长归一化

        } catch (Exception e) {
            log.debug("构建交叉特征失败: {}", e.getMessage());
        }

        return crossFeatures;
    }

    // ==================== V3.0 新增辅助方法 ====================

    /**
     * 安全获取数组元素
     */
    private double safeGet(double[] arr, int index) {
        if (arr == null || index < 0 || index >= arr.length) {
            return 0.0;
        }
        return arr[index];
    }

    /**
     * V3.0: 计算时间偏好匹配度
     */
    private double calculateTimePreferenceMatchV3(double[] userFeatures) {
        int hour = java.time.LocalDateTime.now().getHour();
        double userMorningPref = safeGet(userFeatures, 40);
        double userEveningPref = safeGet(userFeatures, 41);

        if (hour >= 6 && hour <= 12) {
            return userMorningPref;
        } else if (hour >= 18 && hour <= 22) {
            return userEveningPref;
        }
        return 0.5;
    }

    /**
     * V3.0: 计算品类相似度
     * 基于Jaccard相似度计算用户浏览品类与商品品类的匹配程度
     *
     * @param wxUserId 用户ID
     * @param product 商品
     * @return 相似度值 [0, 1]
     *         - 1.0: 商品品类在用户最近浏览列表中
     *         - 0.7: 商品品类是用户浏览品类的子类
     *         - 0.3: 默认相似度
     */
    private double calculateCategorySimilarityV3(String wxUserId, GoodsSpu product) {
        if (wxUserId == null || product == null || product.getCategoryFirst() == null) {
            return 0.0;
        }

        try {
            // 获取用户最近浏览的品类列表 (从Redis缓存获取)
            String cacheKey = "user:recent:categories:" + wxUserId;
            String cachedCategories = redisTemplate.opsForValue().get(cacheKey);

            Set<String> userCategories = new HashSet<>();
            if (cachedCategories != null && !cachedCategories.isEmpty()) {
                // 解析品类列表 (格式: "cat1,cat2,cat3")
                String[] categories = cachedCategories.split(",");
                for (String cat : categories) {
                    if (cat != null && !cat.trim().isEmpty()) {
                        userCategories.add(cat.trim());
                    }
                }
            }

            // 如果没有缓存，尝试从用户兴趣标签获取
            if (userCategories.isEmpty()) {
                List<UserInterestTag> tags = userInterestTagMapper.selectTopTags(wxUserId, 30);
                for (UserInterestTag tag : tags) {
                    if ("category".equals(tag.getTagType()) && tag.getTagValue() != null) {
                        userCategories.add(tag.getTagValue());
                    }
                }
            }

            // 如果仍然没有数据，返回默认值
            if (userCategories.isEmpty()) {
                return 0.3;
            }

            String productCategory = product.getCategoryFirst();
            String productSubCategory = product.getCategorySecond();

            // 完全匹配: 商品一级品类在用户浏览列表中
            if (userCategories.contains(productCategory)) {
                return 1.0;
            }

            // 子类匹配: 商品二级品类在用户浏览列表中
            if (productSubCategory != null && userCategories.contains(productSubCategory)) {
                return 0.7;
            }

            // 计算Jaccard相似度 (商品品类集合与用户品类集合的交集/并集)
            Set<String> productCategories = new HashSet<>();
            productCategories.add(productCategory);
            if (productSubCategory != null) {
                productCategories.add(productSubCategory);
            }

            // 计算交集大小
            int intersection = 0;
            for (String cat : productCategories) {
                if (userCategories.contains(cat)) {
                    intersection++;
                }
            }

            // 计算并集大小
            Set<String> union = new HashSet<>(userCategories);
            union.addAll(productCategories);
            int unionSize = union.size();

            if (unionSize > 0 && intersection > 0) {
                double jaccard = (double) intersection / unionSize;
                // 将Jaccard相似度映射到 [0.3, 1.0] 范围
                return 0.3 + jaccard * 0.7;
            }

            return 0.3;  // 默认中等相似度

        } catch (Exception e) {
            log.debug("计算品类相似度失败: userId={}, error={}", wxUserId, e.getMessage());
            return 0.3;
        }
    }

    /**
     * V3.0: 计算购买相似度
     * 基于用户最近购买的商品品类与当前商品品类的匹配程度
     *
     * @param wxUserId 用户ID
     * @param product 商品
     * @return 相似度值
     *         - 1.0: 完全匹配 (一级和二级品类都匹配)
     *         - 0.6: 部分匹配 (一级品类匹配)
     *         - 0.2: 无匹配
     */
    private double calculatePurchaseSimilarityV3(String wxUserId, GoodsSpu product) {
        if (wxUserId == null || product == null) {
            return 0.2;
        }

        try {
            // 获取用户最近购买的品类列表 (从Redis缓存获取)
            String cacheKey = "user:purchase:categories:" + wxUserId;
            String cachedPurchases = redisTemplate.opsForValue().get(cacheKey);

            Map<String, Integer> purchaseCounts = new HashMap<>();
            if (cachedPurchases != null && !cachedPurchases.isEmpty()) {
                // 解析品类及购买次数 (格式: "cat1:5,cat2:3,cat3:1")
                String[] entries = cachedPurchases.split(",");
                for (String entry : entries) {
                    String[] parts = entry.split(":");
                    if (parts.length == 2) {
                        purchaseCounts.put(parts[0].trim(), Integer.parseInt(parts[1].trim()));
                    } else if (parts.length == 1 && !parts[0].trim().isEmpty()) {
                        purchaseCounts.put(parts[0].trim(), 1);
                    }
                }
            }

            // 如果没有缓存，尝试从用户兴趣标签获取购买相关标签
            if (purchaseCounts.isEmpty()) {
                List<UserInterestTag> tags = userInterestTagMapper.selectTopTags(wxUserId, 50);
                for (UserInterestTag tag : tags) {
                    if ("purchase_category".equals(tag.getTagType()) && tag.getTagValue() != null) {
                        int weight = tag.getWeight() != null ? tag.getWeight().intValue() : 1;
                        purchaseCounts.put(tag.getTagValue(), weight);
                    } else if ("category".equals(tag.getTagType()) && tag.getWeight() != null
                            && tag.getWeight().doubleValue() > 0.5) {
                        // 高权重品类标签也可能代表购买偏好
                        purchaseCounts.put(tag.getTagValue(), (int) (tag.getWeight().doubleValue() * 10));
                    }
                }
            }

            if (purchaseCounts.isEmpty()) {
                return 0.2;
            }

            String productCategory = product.getCategoryFirst();
            String productSubCategory = product.getCategorySecond();

            // 完全匹配: 一级和二级品类都在购买历史中
            boolean firstMatch = purchaseCounts.containsKey(productCategory);
            boolean secondMatch = productSubCategory != null && purchaseCounts.containsKey(productSubCategory);

            if (firstMatch && secondMatch) {
                return 1.0;  // 完全匹配
            } else if (firstMatch || secondMatch) {
                return 0.6;  // 部分匹配
            }

            return 0.2;  // 无匹配

        } catch (Exception e) {
            log.debug("计算购买相似度失败: userId={}, error={}", wxUserId, e.getMessage());
            return 0.2;
        }
    }

    /**
     * V3.0: 计算浏览熵
     * 基于Shannon熵衡量用户浏览行为的多样性
     * 熵越高表示用户浏览品类越分散，熵越低表示用户浏览品类越集中
     *
     * 公式: entropy = -Σ(p_i * log2(p_i))
     *
     * @param wxUserId 用户ID
     * @return 归一化熵值 [0, 1]
     *         - 0: 用户只浏览单一品类
     *         - 1: 用户浏览品类非常分散
     */
    private double calculateBrowseEntropyV3(String wxUserId) {
        if (wxUserId == null) {
            return 0.5;
        }

        try {
            // 先检查缓存
            String cacheKey = "user:browse:entropy:" + wxUserId;
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return Double.parseDouble(cached);
            }

            // 获取用户最近7天的浏览品类分布
            String distributionKey = "user:browse:distribution:" + wxUserId;
            String distributionData = redisTemplate.opsForValue().get(distributionKey);

            Map<String, Integer> categoryDistribution = new HashMap<>();

            if (distributionData != null && !distributionData.isEmpty()) {
                // 解析品类分布 (格式: "cat1:10,cat2:5,cat3:3")
                String[] entries = distributionData.split(",");
                for (String entry : entries) {
                    String[] parts = entry.split(":");
                    if (parts.length == 2) {
                        categoryDistribution.put(parts[0].trim(), Integer.parseInt(parts[1].trim()));
                    }
                }
            }

            // 如果没有分布数据，从用户兴趣标签估算
            if (categoryDistribution.isEmpty()) {
                List<UserInterestTag> tags = userInterestTagMapper.selectTopTags(wxUserId, 30);
                for (UserInterestTag tag : tags) {
                    if ("category".equals(tag.getTagType()) && tag.getTagValue() != null) {
                        int weight = tag.getWeight() != null ? (int) (tag.getWeight().doubleValue() * 100) : 1;
                        categoryDistribution.put(tag.getTagValue(), Math.max(1, weight));
                    }
                }
            }

            if (categoryDistribution.isEmpty()) {
                return 0.5;  // 默认中等熵值
            }

            // 计算总浏览次数
            int total = 0;
            for (int count : categoryDistribution.values()) {
                total += count;
            }

            if (total == 0) {
                return 0.5;
            }

            // 计算Shannon熵: entropy = -Σ(p_i * log2(p_i))
            double entropy = 0.0;
            for (int count : categoryDistribution.values()) {
                if (count > 0) {
                    double p = (double) count / total;
                    entropy -= p * (Math.log(p) / Math.log(2));  // log2(p) = ln(p) / ln(2)
                }
            }

            // 归一化到 [0, 1]: 最大熵 = log2(N), N为品类数量
            int numCategories = categoryDistribution.size();
            double maxEntropy = Math.log(numCategories) / Math.log(2);
            double normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0.0;

            // 确保在 [0, 1] 范围内
            normalizedEntropy = Math.max(0.0, Math.min(1.0, normalizedEntropy));

            // 缓存结果 (缓存1小时)
            redisTemplate.opsForValue().set(cacheKey, String.valueOf(normalizedEntropy), 1, TimeUnit.HOURS);

            return normalizedEntropy;

        } catch (Exception e) {
            log.debug("计算浏览熵失败: userId={}, error={}", wxUserId, e.getMessage());
            return 0.5;
        }
    }

    /**
     * V3.0: 判断是否促销期
     */
    private boolean isPromotionPeriodV3() {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        int day = now.getDayOfMonth();
        // 每月1号、11号、月末为促销日
        return day == 1 || day == 11 || day >= 28;
    }

    /**
     * V3.0: 获取季节指标
     */
    private double getSeasonIndicatorV3(java.time.LocalDateTime now) {
        int month = now.getMonthValue();
        if (month >= 3 && month <= 5) return 0.25;  // 春
        if (month >= 6 && month <= 8) return 0.50;  // 夏
        if (month >= 9 && month <= 11) return 0.75; // 秋
        return 1.0;  // 冬
    }

    /**
     * V3.0: 获取节日临近度
     */
    private double getHolidayProximityV3(java.time.LocalDateTime now) {
        int month = now.getMonthValue();
        int day = now.getDayOfMonth();

        // 主要节日
        if ((month == 1 || month == 2) && day <= 15) return 1.0;  // 春节
        if (month == 5 && day <= 7) return 0.8;                    // 五一
        if (month == 10 && day <= 7) return 0.8;                   // 十一
        if (month == 11 && day >= 1 && day <= 15) return 1.0;     // 双11
        if (month == 12 && day >= 1 && day <= 15) return 0.9;     // 双12

        return 0.0;
    }

    /**
     * 获取用户活跃度趋势 (7天环比)
     */
    private double getUserActivityTrend(String wxUserId) {
        if (wxUserId == null) return 0;
        try {
            String key = "user:trend:" + wxUserId;
            String cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                return Double.parseDouble(cached);
            }
        } catch (Exception e) {
            log.debug("获取用户趋势失败: {}", e.getMessage());
        }
        return 0;
    }

    /**
     * 获取商品销量趋势 (7天环比)
     */
    private double getItemSalesTrend(GoodsSpu product) {
        if (product == null || product.getSaleNum() == null) return 0;
        // 简化实现：基于销量估算趋势
        int sales = product.getSaleNum();
        if (sales > 100) return 0.2;
        if (sales > 50) return 0.1;
        if (sales > 10) return 0;
        return -0.1;
    }

    /**
     * 获取用户转化率
     */
    private double getUserConversionRate(String wxUserId) {
        if (wxUserId == null) return 0.05;  // 默认5%
        try {
            String key = "user:cvr:" + wxUserId;
            String cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                return Double.parseDouble(cached);
            }
        } catch (Exception e) {
            log.debug("获取用户CVR失败: {}", e.getMessage());
        }
        return 0.05;
    }

    /**
     * 获取商品点击率
     */
    private double getItemClickRate(GoodsSpu product) {
        if (product == null) return 0.05;
        // 简化实现：基于销量估算CTR
        int sales = product.getSaleNum() != null ? product.getSaleNum() : 0;
        return Math.min(0.3, 0.02 + sales / 5000.0);
    }

    /**
     * 获取用户偏好
     */
    private Map<String, Double> getUserPreferences(String wxUserId) {
        Map<String, Double> preferences = new HashMap<>();

        if (wxUserId == null || wxUserId.isEmpty()) {
            return preferences;
        }

        try {
            // 尝试从缓存获取
            String cacheKey = FEATURE_CACHE_PREFIX + "pref:" + wxUserId;
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return objectMapper.readValue(cached, Map.class);
            }

            // 从数据库获取用户兴趣标签
            List<UserInterestTag> tags = userInterestTagMapper.selectTopTags(wxUserId, 50);

            // 品类偏好
            double categorySum = 0;
            for (UserInterestTag tag : tags) {
                if ("category".equals(tag.getTagType()) && tag.getWeight() != null) {
                    preferences.put("category:" + tag.getTagValue(), tag.getWeight().doubleValue());
                    categorySum += tag.getWeight().doubleValue();
                }
            }

            // 价格偏好
            double avgPrice = 0;
            int priceCount = 0;
            for (UserInterestTag tag : tags) {
                if ("price_range".equals(tag.getTagType()) && tag.getWeight() != null) {
                    preferences.put("price:" + tag.getTagValue(), tag.getWeight().doubleValue());
                    // 估算平均价格
                    double midPrice = getPriceRangeMidpoint(tag.getTagValue());
                    avgPrice += midPrice * tag.getWeight().doubleValue();
                    priceCount++;
                }
            }
            if (priceCount > 0) {
                preferences.put("avg_price", avgPrice / priceCount);
            }

            // 商户偏好
            for (UserInterestTag tag : tags) {
                if ("merchant".equals(tag.getTagType()) && tag.getWeight() != null) {
                    preferences.put("merchant:" + tag.getTagValue(), tag.getWeight().doubleValue());
                }
            }

            // 购买力估算 (基于价格偏好)
            double highPricePref = preferences.getOrDefault("price:高价", 0.0) +
                    preferences.getOrDefault("price:中高价", 0.0);
            double lowPricePref = preferences.getOrDefault("price:低价", 0.0) +
                    preferences.getOrDefault("price:中低价", 0.0);
            double purchasingPower = 0.5 + (highPricePref - lowPricePref) * 0.3;
            preferences.put("purchasing_power", Math.max(0, Math.min(1, purchasingPower)));

            // 折扣敏感度 (简化估算)
            preferences.put("discount_sensitivity", 1.0 - purchasingPower * 0.5);

            // 商户多样性偏好
            long merchantCount = tags.stream()
                    .filter(t -> "merchant".equals(t.getTagType()))
                    .count();
            preferences.put("merchant_diversity", Math.min(1.0, merchantCount / 5.0));

            // 缓存结果
            redisTemplate.opsForValue().set(cacheKey, objectMapper.writeValueAsString(preferences),
                    FEATURE_CACHE_TTL_MINUTES, TimeUnit.MINUTES);

        } catch (Exception e) {
            log.debug("获取用户偏好失败: wxUserId={}, error={}", wxUserId, e.getMessage());
        }

        return preferences;
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
     * 获取价格区间中点
     */
    private double getPriceRangeMidpoint(String priceRange) {
        switch (priceRange) {
            case "低价": return 25;
            case "中低价": return 100;
            case "中等": return 225;
            case "中高价": return 400;
            case "高价": return 750;
            default: return 200;
        }
    }

    // ==================== Redis持久化 ====================

    /**
     * 保存权重到Redis
     */
    private void saveWeightsToRedis() {
        try {
            String weightsJson = objectMapper.writeValueAsString(weights);
            redisTemplate.opsForValue().set(WEIGHTS_KEY, weightsJson,
                    WEIGHTS_CACHE_TTL_HOURS, TimeUnit.HOURS);
        } catch (JsonProcessingException e) {
            log.warn("保存权重到Redis失败: {}", e.getMessage());
        }
    }

    /**
     * 保存统计到Redis
     */
    private void saveStatsToRedis() {
        try {
            Map<String, Long> stats = new HashMap<>();
            stats.put("totalSamples", totalSamples.get());
            stats.put("positiveSamples", positiveSamples.get());
            stats.put("updateCount", updateCount.get());
            String statsJson = objectMapper.writeValueAsString(stats);
            redisTemplate.opsForValue().set(STATS_KEY, statsJson,
                    WEIGHTS_CACHE_TTL_HOURS, TimeUnit.HOURS);
        } catch (JsonProcessingException e) {
            log.debug("保存统计到Redis失败: {}", e.getMessage());
        }
    }
}
