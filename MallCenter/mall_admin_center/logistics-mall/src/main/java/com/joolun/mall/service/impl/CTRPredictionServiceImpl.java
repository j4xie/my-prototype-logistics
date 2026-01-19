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

import javax.annotation.PostConstruct;
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
 * 特征维度设计 (160维):
 * - 用户特征 (0-63): 64维，来自FeatureEngineeringService
 * - 商品特征 (64-127): 64维，来自FeatureEngineeringService
 * - 交叉特征 (128-159): 32维，用户偏好与商品属性的交叉
 *
 * 交叉特征详解 (32维):
 * - 用户品类偏好 x 商品品类 (0-7): 8维
 * - 用户价格偏好 x 商品价格区间 (8-15): 8维
 * - 用户活跃度 x 商品新鲜度 (16-19): 4维
 * - 用户购买力 x 商品价格 (20-23): 4维
 * - 用户品牌偏好 x 商品品牌热度 (24-27): 4维
 * - 时间上下文 x 商品时段适配 (28-31): 4维
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

        // 交叉特征名称 (128-159)
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

        for (GoodsSpu product : products) {
            try {
                // 构建商品特征
                double[] productFeatures = featureEngineeringService.buildProductFeatureVector(product);

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
        stats.put("learningRate", LEARNING_RATE);
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

        for (int i = 0; i < features.length && i < weights.length; i++) {
            // 梯度
            double gradient = error * features[i];

            // 梯度裁剪
            gradient = Math.max(-GRADIENT_CLIP, Math.min(GRADIENT_CLIP, gradient));

            // SGD更新 + L2正则化
            weights[i] += LEARNING_RATE * gradient - LEARNING_RATE * LAMBDA * weights[i];
        }
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

        // 交叉特征 (128-159)
        if (crossFeatures != null) {
            System.arraycopy(crossFeatures, 0, features, USER_FEATURE_DIM + ITEM_FEATURE_DIM,
                    Math.min(crossFeatures.length, CROSS_FEATURE_DIM));
        }

        return features;
    }

    /**
     * 构建交叉特征 (32维)
     *
     * 交叉特征设计:
     * - 用户品类偏好 x 商品品类匹配度 (0-7): 8维
     * - 用户价格偏好 x 商品价格区间匹配度 (8-15): 8维
     * - 用户活跃度 x 商品新鲜度 (16-19): 4维
     * - 用户购买力 x 商品价格 (20-23): 4维
     * - 用户品牌偏好 x 商品品牌热度 (24-27): 4维
     * - 时间上下文 x 商品时段适配 (28-31): 4维
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

        } catch (Exception e) {
            log.debug("构建交叉特征失败: {}", e.getMessage());
        }

        return crossFeatures;
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
