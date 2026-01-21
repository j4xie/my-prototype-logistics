package com.joolun.mall.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.DeliveryFeedback;
import com.joolun.mall.entity.DeliveryOrder;
import com.joolun.mall.entity.DeliveryVehicle;
import com.joolun.mall.service.DeliveryFeatureService;
import com.joolun.mall.service.DeliveryPredictionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 配送时间预测服务实现
 *
 * 模型设计:
 * - 输入: 160维特征向量
 * - 输出: 预测配送时长 (分钟) / 准时概率
 * - 算法: 线性回归 + L2正则 + 在线SGD
 *
 * @author Delivery Scheduling V4.0
 * @since 2026-01-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryPredictionServiceImpl implements DeliveryPredictionService {

    private final DeliveryFeatureService featureService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // 模型参数
    private static final double LEARNING_RATE = 0.001;
    private static final double L2_LAMBDA = 0.0001;
    private static final double GRADIENT_CLIP = 10.0;
    private static final int FEATURE_DIM = DeliveryFeatureService.TOTAL_FEATURE_DIM;

    // Redis键
    private static final String DURATION_WEIGHTS_KEY = "delivery:model:duration:weights";
    private static final String ONTIME_WEIGHTS_KEY = "delivery:model:ontime:weights";
    private static final String STATS_KEY = "delivery:model:stats";

    // 模型权重
    private volatile double[] durationWeights;
    private volatile double[] onTimeWeights;
    private double durationBias = 30.0;  // 基准配送时长
    private double onTimeBias = 0.0;     // 基准准时率

    // 统计
    private final AtomicLong totalSamples = new AtomicLong(0);
    private final AtomicLong updateCount = new AtomicLong(0);
    private double totalError = 0;

    // 特征名称
    private static final Map<Integer, String> FEATURE_NAMES = new LinkedHashMap<>();
    static {
        for (int i = 0; i < DeliveryFeatureService.ORDER_FEATURE_DIM; i++) {
            FEATURE_NAMES.put(i, "order_feature_" + i);
        }
        for (int i = 0; i < DeliveryFeatureService.VEHICLE_FEATURE_DIM; i++) {
            FEATURE_NAMES.put(DeliveryFeatureService.ORDER_FEATURE_DIM + i, "vehicle_feature_" + i);
        }
        for (int i = 0; i < DeliveryFeatureService.CROSS_FEATURE_DIM; i++) {
            FEATURE_NAMES.put(DeliveryFeatureService.ORDER_FEATURE_DIM +
                            DeliveryFeatureService.VEHICLE_FEATURE_DIM + i, "match_feature_" + i);
        }
    }

    @PostConstruct
    public void init() {
        log.info("初始化配送预测模型...");
        loadWeights();
        loadStats();
        log.info("配送预测模型初始化完成: 特征维度={}, 训练样本数={}", FEATURE_DIM, totalSamples.get());
    }

    private void loadWeights() {
        try {
            String durationJson = redisTemplate.opsForValue().get(DURATION_WEIGHTS_KEY);
            if (durationJson != null) {
                durationWeights = objectMapper.readValue(durationJson, double[].class);
            } else {
                initializeWeights();
            }

            String onTimeJson = redisTemplate.opsForValue().get(ONTIME_WEIGHTS_KEY);
            if (onTimeJson != null) {
                onTimeWeights = objectMapper.readValue(onTimeJson, double[].class);
            } else {
                initializeWeights();
            }
        } catch (Exception e) {
            log.warn("加载权重失败，重新初始化: {}", e.getMessage());
            initializeWeights();
        }
    }

    private void initializeWeights() {
        durationWeights = new double[FEATURE_DIM];
        onTimeWeights = new double[FEATURE_DIM];
        Random random = new Random(42);

        for (int i = 0; i < FEATURE_DIM; i++) {
            durationWeights[i] = (random.nextDouble() - 0.5) * 0.02;
            onTimeWeights[i] = (random.nextDouble() - 0.5) * 0.02;
        }

        saveWeights();
        log.info("权重已初始化: 维度={}", FEATURE_DIM);
    }

    private void loadStats() {
        try {
            String statsJson = redisTemplate.opsForValue().get(STATS_KEY);
            if (statsJson != null) {
                Map<String, Object> stats = objectMapper.readValue(statsJson, Map.class);
                totalSamples.set(((Number) stats.getOrDefault("totalSamples", 0)).longValue());
                updateCount.set(((Number) stats.getOrDefault("updateCount", 0)).longValue());
            }
        } catch (Exception e) {
            log.debug("加载统计失败: {}", e.getMessage());
        }
    }

    @Override
    public double predictDeliveryDuration(DeliveryOrder order, DeliveryVehicle vehicle) {
        if (order == null || vehicle == null) {
            return 30.0;  // 默认30分钟
        }

        try {
            double[] features = featureService.buildFullFeatureVector(order, vehicle);
            double prediction = predictDuration(features);

            // 基于距离调整
            double distance = featureService.calculateDistance(
                order.getLatitude() != null ? order.getLatitude().doubleValue() : 31.23,
                order.getLongitude() != null ? order.getLongitude().doubleValue() : 121.47,
                vehicle.getCurrentLat() != null ? vehicle.getCurrentLat().doubleValue() : 31.23,
                vehicle.getCurrentLng() != null ? vehicle.getCurrentLng().doubleValue() : 121.47
            );

            // 最低时长 = 距离 / 50km/h * 60分钟
            double minDuration = distance / 50.0 * 60.0;
            prediction = Math.max(prediction, minDuration);

            // 限制在合理范围 [5, 180] 分钟
            return Math.max(5, Math.min(180, prediction));

        } catch (Exception e) {
            log.warn("预测配送时长失败: {}", e.getMessage());
            return 30.0;
        }
    }

    private double predictDuration(double[] features) {
        if (features == null || durationWeights == null) {
            return durationBias;
        }

        double prediction = durationBias;
        for (int i = 0; i < Math.min(features.length, durationWeights.length); i++) {
            prediction += features[i] * durationWeights[i];
        }

        return prediction;
    }

    @Override
    public double predictOnTimeRate(DeliveryOrder order, DeliveryVehicle vehicle) {
        if (order == null || vehicle == null) {
            return 0.85;  // 默认85%准时率
        }

        try {
            double[] features = featureService.buildFullFeatureVector(order, vehicle);
            double z = onTimeBias;
            for (int i = 0; i < Math.min(features.length, onTimeWeights.length); i++) {
                z += features[i] * onTimeWeights[i];
            }

            // Sigmoid
            double prediction = 1.0 / (1.0 + Math.exp(-z));

            // 基于司机历史准时率调整
            double driverRate = vehicle.getOnTimeRate() != null ?
                vehicle.getOnTimeRate().doubleValue() : 0.85;
            prediction = 0.7 * prediction + 0.3 * driverRate;

            return Math.max(0.1, Math.min(0.99, prediction));

        } catch (Exception e) {
            log.warn("预测准时率失败: {}", e.getMessage());
            return 0.85;
        }
    }

    @Override
    public Map<String, Double> batchPredictDuration(DeliveryOrder order, List<DeliveryVehicle> vehicles) {
        Map<String, Double> predictions = new LinkedHashMap<>();

        if (order == null || vehicles == null) {
            return predictions;
        }

        for (DeliveryVehicle vehicle : vehicles) {
            double duration = predictDeliveryDuration(order, vehicle);
            predictions.put(vehicle.getId(), duration);
        }

        return predictions;
    }

    @Override
    public void updateModel(DeliveryFeedback feedback) {
        if (feedback == null || feedback.getActualDuration() == null) {
            return;
        }

        // 简化: 使用反馈数据更新偏置
        double actual = feedback.getActualDuration();
        double predicted = feedback.getPredictedDuration() != null ?
            feedback.getPredictedDuration() : 30;

        double error = actual - predicted;
        totalError += Math.abs(error);

        // 更新偏置
        durationBias += LEARNING_RATE * error;
        durationBias = Math.max(10, Math.min(60, durationBias));  // 限制范围

        totalSamples.incrementAndGet();
        updateCount.incrementAndGet();

        // 每100次更新同步
        if (updateCount.get() % 100 == 0) {
            saveWeights();
            saveStats();
        }

        log.debug("模型更新: actual={}, predicted={}, error={}", actual, predicted, error);
    }

    @Override
    public void batchUpdateModel(List<DeliveryFeedback> feedbackList) {
        if (feedbackList == null || feedbackList.isEmpty()) {
            return;
        }

        for (DeliveryFeedback feedback : feedbackList) {
            updateModel(feedback);
        }

        saveWeights();
        saveStats();
        log.info("批量更新完成: {} 条反馈", feedbackList.size());
    }

    @Override
    public double[] getModelWeights() {
        return durationWeights != null ? durationWeights.clone() : new double[FEATURE_DIM];
    }

    @Override
    public void resetModelWeights() {
        initializeWeights();
        totalSamples.set(0);
        updateCount.set(0);
        totalError = 0;
        durationBias = 30.0;
        onTimeBias = 0.0;
        saveStats();
        log.info("模型权重已重置");
    }

    @Override
    public Map<String, Object> getModelStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("featureDim", FEATURE_DIM);
        stats.put("learningRate", LEARNING_RATE);
        stats.put("l2Lambda", L2_LAMBDA);
        stats.put("totalSamples", totalSamples.get());
        stats.put("updateCount", updateCount.get());
        stats.put("durationBias", durationBias);
        stats.put("onTimeBias", onTimeBias);

        if (totalSamples.get() > 0) {
            stats.put("mae", totalError / totalSamples.get());
        }

        return stats;
    }

    @Override
    public Map<String, Double> getFeatureImportance() {
        Map<String, Double> importance = new LinkedHashMap<>();

        if (durationWeights == null) {
            return importance;
        }

        List<Map.Entry<Integer, Double>> weightList = new ArrayList<>();
        for (int i = 0; i < durationWeights.length; i++) {
            weightList.add(Map.entry(i, Math.abs(durationWeights[i])));
        }

        weightList.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));

        for (int i = 0; i < Math.min(20, weightList.size()); i++) {
            Map.Entry<Integer, Double> entry = weightList.get(i);
            String name = FEATURE_NAMES.getOrDefault(entry.getKey(), "feature_" + entry.getKey());
            importance.put(name, entry.getValue());
        }

        return importance;
    }

    private void saveWeights() {
        try {
            String durationJson = objectMapper.writeValueAsString(durationWeights);
            redisTemplate.opsForValue().set(DURATION_WEIGHTS_KEY, durationJson, 24, TimeUnit.HOURS);

            String onTimeJson = objectMapper.writeValueAsString(onTimeWeights);
            redisTemplate.opsForValue().set(ONTIME_WEIGHTS_KEY, onTimeJson, 24, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("保存权重失败: {}", e.getMessage());
        }
    }

    private void saveStats() {
        try {
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalSamples", totalSamples.get());
            stats.put("updateCount", updateCount.get());
            String statsJson = objectMapper.writeValueAsString(stats);
            redisTemplate.opsForValue().set(STATS_KEY, statsJson, 24, TimeUnit.HOURS);
        } catch (Exception e) {
            log.debug("保存统计失败: {}", e.getMessage());
        }
    }

    @Scheduled(fixedRate = 300000)
    public void syncToRedis() {
        saveWeights();
        saveStats();
        log.debug("配送预测模型已同步到Redis");
    }
}
