package com.cretas.aims.service.aps.impl;

import com.cretas.aims.dto.aps.WeightAdjustmentResult;
import com.cretas.aims.dto.aps.WeightAdjustmentResult.AdjustmentDetail;
import com.cretas.aims.entity.FactorySchedulingConfig;
import com.cretas.aims.entity.WeightHistory;
import com.cretas.aims.repository.FactorySchedulingConfigRepository;
import com.cretas.aims.repository.WeightHistoryRepository;
import com.cretas.aims.service.aps.ApsSchedulingPerformanceMetricsService;
import com.cretas.aims.service.aps.StrategyWeightAdaptationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * APS 策略权重自适应调整服务实现
 *
 * 核心功能:
 * 1. 评估各排产策略的实际效果
 * 2. 根据效果自动调整策略权重
 * 3. 记录权重调整历史用于分析
 *
 * 策略权重调整算法:
 * new_weight = old_weight + learning_rate × (score - 0.5)
 * 归一化确保 Σ weights = 1.0
 *
 * @author Cretas APS Team
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StrategyWeightAdaptationServiceImpl implements StrategyWeightAdaptationService {

    private final FactorySchedulingConfigRepository configRepository;
    private final WeightHistoryRepository weightHistoryRepository;
    private final ApsSchedulingPerformanceMetricsService metricsService;
    private final ObjectMapper objectMapper;

    // ==================== 策略效果评估 ====================

    @Override
    @Transactional(readOnly = true)
    public Map<String, Double> evaluateStrategyEffectiveness(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("评估策略效果: factoryId={}, {} - {}", factoryId, startDate, endDate);

        Map<String, Double> scores = new LinkedHashMap<>();

        // 1. 准时完成率评估 (影响 earliest_deadline)
        // 目标 > 85%, 越高越好
        double onTimeRate = metricsService.calculateOnTimeRate(factoryId, startDate, endDate);
        scores.put("earliest_deadline", normalizeScore(onTimeRate, 0.85));

        // 2. 换型时间评估 (影响 min_changeover)
        // 目标 < 15%, 越低越好
        double changeoverRatio = metricsService.calculateChangeoverRatio(factoryId, startDate, endDate);
        scores.put("min_changeover", normalizeScoreInverse(changeoverRatio, 0.15));

        // 3. 负载均衡度评估 (影响 capacity_match)
        // 目标 CV < 0.3, 越低越好
        double loadCV = metricsService.calculateLoadBalanceCV(factoryId, startDate, endDate);
        scores.put("capacity_match", normalizeScoreInverse(loadCV, 0.3));

        // 4. 吞吐量评估 (影响 shortest_process)
        // 目标 >= 1.0, 越高越好
        double throughputRatio = metricsService.calculateThroughputRatio(factoryId, startDate, endDate);
        scores.put("shortest_process", normalizeScore(throughputRatio, 1.0));

        // 5. 物料等待评估 (影响 material_ready)
        // 目标 < 10%, 越低越好
        double materialWaitRatio = metricsService.calculateMaterialWaitRatio(factoryId, startDate, endDate);
        scores.put("material_ready", normalizeScoreInverse(materialWaitRatio, 0.10));

        // 6. 紧急订单准时率 (影响 urgency_first)
        // 目标 > 95%, 越高越好
        double urgentOnTimeRate = metricsService.calculateUrgentOnTimeRate(factoryId, startDate, endDate);
        scores.put("urgency_first", normalizeScore(urgentOnTimeRate, 0.95));

        log.info("策略效果评分: {}", scores);
        return scores;
    }

    // ==================== 权重调整 ====================

    @Override
    @Transactional
    public WeightAdjustmentResult adjustWeights(String factoryId) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(DEFAULT_EVALUATION_DAYS);
        return adjustWeights(factoryId, startDate, endDate);
    }

    @Override
    @Transactional
    public WeightAdjustmentResult adjustWeights(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("开始调整策略权重: factoryId={}, {} - {}", factoryId, startDate, endDate);

        // 1. 获取当前权重配置
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(FactorySchedulingConfig.createDefault(factoryId));

        Map<String, Double> currentWeights = config.getStrategyWeightsMap();
        log.debug("当前权重: {}", currentWeights);

        // 2. 评估策略效果
        Map<String, Double> scores = evaluateStrategyEffectiveness(factoryId, startDate, endDate);

        // 3. 计算调整量
        Map<String, Double> newWeights = new LinkedHashMap<>();
        Map<String, AdjustmentDetail> adjustmentDetails = new LinkedHashMap<>();

        for (String strategy : currentWeights.keySet()) {
            double oldWeight = currentWeights.get(strategy);
            double score = scores.getOrDefault(strategy, 0.5);

            // 调整公式: new_weight = old_weight + lr × (score - 0.5)
            double adjustment = LEARNING_RATE * (score - 0.5);
            double newWeight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, oldWeight + adjustment));
            newWeights.put(strategy, newWeight);

            // 记录调整详情
            AdjustmentDetail detail = AdjustmentDetail.builder()
                    .strategyName(strategy)
                    .previousWeight(oldWeight)
                    .newWeight(newWeight)
                    .score(score)
                    .adjustmentDelta(newWeight - oldWeight)
                    .adjustmentReason(generateAdjustmentReason(strategy, score, adjustment))
                    .build();
            adjustmentDetails.put(strategy, detail);
        }

        // 4. 归一化
        double sum = newWeights.values().stream().mapToDouble(Double::doubleValue).sum();
        if (sum > 0) {
            newWeights.replaceAll((k, v) -> v / sum);
        }

        // 更新调整详情中的归一化后权重
        for (String strategy : newWeights.keySet()) {
            adjustmentDetails.get(strategy).setNewWeight(newWeights.get(strategy));
            adjustmentDetails.get(strategy).setAdjustmentDelta(
                    newWeights.get(strategy) - currentWeights.get(strategy));
        }

        // 5. 保存新权重
        config.setStrategyWeightsFromMap(newWeights);
        config.setLastAdaptationAt(LocalDateTime.now());
        config.setAdaptationCount(config.getAdaptationCount() != null ? config.getAdaptationCount() + 1 : 1);

        // 如果是新配置，需要先保存
        if (config.getId() == null) {
            config = configRepository.save(config);
        } else {
            configRepository.save(config);
        }

        // 6. 记录调整历史
        saveWeightHistory(factoryId, currentWeights, newWeights, scores, "自动周期调整");

        // 7. 构建结果
        WeightAdjustmentResult result = WeightAdjustmentResult.builder()
                .adjustedAt(LocalDateTime.now())
                .factoryId(factoryId)
                .previousWeights(currentWeights)
                .newWeights(newWeights)
                .performanceScores(scores)
                .evaluationStartDate(startDate)
                .evaluationEndDate(endDate)
                .reason("自动周期调整")
                .applied(true)
                .adjustmentDetails(adjustmentDetails)
                .build();

        log.info("策略权重调整完成: {} -> {}", currentWeights, newWeights);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public WeightAdjustmentResult simulateWeightAdjustment(String factoryId) {
        log.info("模拟权重调整: factoryId={}", factoryId);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(DEFAULT_EVALUATION_DAYS);

        // 获取当前权重
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(FactorySchedulingConfig.createDefault(factoryId));

        Map<String, Double> currentWeights = config.getStrategyWeightsMap();

        // 评估策略效果
        Map<String, Double> scores = evaluateStrategyEffectiveness(factoryId, startDate, endDate);

        // 计算调整量 (不保存)
        Map<String, Double> newWeights = new LinkedHashMap<>();
        Map<String, AdjustmentDetail> adjustmentDetails = new LinkedHashMap<>();

        for (String strategy : currentWeights.keySet()) {
            double oldWeight = currentWeights.get(strategy);
            double score = scores.getOrDefault(strategy, 0.5);

            double adjustment = LEARNING_RATE * (score - 0.5);
            double newWeight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, oldWeight + adjustment));
            newWeights.put(strategy, newWeight);

            AdjustmentDetail detail = AdjustmentDetail.builder()
                    .strategyName(strategy)
                    .previousWeight(oldWeight)
                    .newWeight(newWeight)
                    .score(score)
                    .adjustmentDelta(newWeight - oldWeight)
                    .adjustmentReason(generateAdjustmentReason(strategy, score, adjustment))
                    .build();
            adjustmentDetails.put(strategy, detail);
        }

        // 归一化
        double sum = newWeights.values().stream().mapToDouble(Double::doubleValue).sum();
        if (sum > 0) {
            newWeights.replaceAll((k, v) -> v / sum);
            for (String strategy : newWeights.keySet()) {
                adjustmentDetails.get(strategy).setNewWeight(newWeights.get(strategy));
                adjustmentDetails.get(strategy).setAdjustmentDelta(
                        newWeights.get(strategy) - currentWeights.get(strategy));
            }
        }

        return WeightAdjustmentResult.builder()
                .adjustedAt(LocalDateTime.now())
                .factoryId(factoryId)
                .previousWeights(currentWeights)
                .newWeights(newWeights)
                .performanceScores(scores)
                .evaluationStartDate(startDate)
                .evaluationEndDate(endDate)
                .reason("模拟调整 (未保存)")
                .applied(false)
                .adjustmentDetails(adjustmentDetails)
                .build();
    }

    // ==================== 权重历史查询 ====================

    @Override
    @Transactional(readOnly = true)
    public List<WeightAdjustmentResult> getAdjustmentHistory(String factoryId, int days) {
        log.debug("获取权重调整历史: factoryId={}, days={}", factoryId, days);

        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        List<WeightHistory> histories = weightHistoryRepository
                .findByFactoryIdAndAdjustedAtAfterOrderByAdjustedAtDesc(factoryId, cutoff);

        return histories.stream()
                .map(this::convertToResult)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Double> getCurrentWeights(String factoryId) {
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(FactorySchedulingConfig.createDefault(factoryId));
        return config.getStrategyWeightsMap();
    }

    // ==================== 手动调整 ====================

    @Override
    @Transactional
    public WeightAdjustmentResult setWeights(String factoryId, Map<String, Double> weights, String reason) {
        log.info("手动设置策略权重: factoryId={}, reason={}", factoryId, reason);

        // 获取当前配置
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(FactorySchedulingConfig.createDefault(factoryId));

        Map<String, Double> currentWeights = config.getStrategyWeightsMap();

        // 归一化新权重
        Map<String, Double> normalizedWeights = normalizeWeights(weights);

        // 保存新权重
        config.setStrategyWeightsFromMap(normalizedWeights);
        config.setLastAdaptationAt(LocalDateTime.now());
        config.setAdaptationCount(config.getAdaptationCount() != null ? config.getAdaptationCount() + 1 : 1);

        if (config.getId() == null) {
            config = configRepository.save(config);
        } else {
            configRepository.save(config);
        }

        // 记录历史
        saveWeightHistory(factoryId, currentWeights, normalizedWeights, null, reason);

        return WeightAdjustmentResult.builder()
                .adjustedAt(LocalDateTime.now())
                .factoryId(factoryId)
                .previousWeights(currentWeights)
                .newWeights(normalizedWeights)
                .reason(reason)
                .applied(true)
                .build();
    }

    @Override
    @Transactional
    public WeightAdjustmentResult resetToDefaultWeights(String factoryId) {
        log.info("重置为默认权重: factoryId={}", factoryId);
        return setWeights(factoryId, FactorySchedulingConfig.getDefaultStrategyWeights(), "重置为默认权重");
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 正向指标归一化得分
     * 实际值越接近或超过目标值，得分越高
     *
     * @param actual 实际值
     * @param target 目标值
     * @return 归一化得分 [0, 1]
     */
    private double normalizeScore(double actual, double target) {
        if (target == 0) {
            return 0.5;
        }
        double ratio = actual / target;
        // 使用 Sigmoid 函数平滑映射到 [0, 1]
        return 1.0 / (1.0 + Math.exp(-3 * (ratio - 1)));
    }

    /**
     * 反向指标归一化得分
     * 实际值越低于目标值，得分越高
     *
     * @param actual 实际值
     * @param target 目标值
     * @return 归一化得分 [0, 1]
     */
    private double normalizeScoreInverse(double actual, double target) {
        if (target == 0) {
            return 0.5;
        }
        double ratio = actual / target;
        // 反向 Sigmoid: 越低越好
        return 1.0 / (1.0 + Math.exp(3 * (ratio - 1)));
    }

    /**
     * 归一化权重使其和为1
     */
    private Map<String, Double> normalizeWeights(Map<String, Double> weights) {
        Map<String, Double> normalized = new LinkedHashMap<>(weights);
        double sum = normalized.values().stream().mapToDouble(Double::doubleValue).sum();
        if (sum > 0) {
            normalized.replaceAll((k, v) -> v / sum);
        }
        return normalized;
    }

    /**
     * 生成调整原因描述
     */
    private String generateAdjustmentReason(String strategy, double score, double adjustment) {
        String scoreDesc;
        if (score >= 0.7) {
            scoreDesc = "效果良好";
        } else if (score >= 0.5) {
            scoreDesc = "效果中等";
        } else if (score >= 0.3) {
            scoreDesc = "效果欠佳";
        } else {
            scoreDesc = "效果较差";
        }

        String adjustDesc;
        if (adjustment > 0.01) {
            adjustDesc = "增加权重";
        } else if (adjustment < -0.01) {
            adjustDesc = "降低权重";
        } else {
            adjustDesc = "权重保持";
        }

        return String.format("%s (%.2f), %s (%.4f)", scoreDesc, score, adjustDesc, adjustment);
    }

    /**
     * 保存权重调整历史
     */
    private void saveWeightHistory(String factoryId, Map<String, Double> before,
                                    Map<String, Double> after, Map<String, Double> scores, String reason) {
        try {
            WeightHistory history = new WeightHistory();
            history.setFactoryId(factoryId);
            history.setAdjustedAt(LocalDateTime.now());
            history.setWeightsBefore(objectMapper.writeValueAsString(before));
            history.setWeightsAfter(objectMapper.writeValueAsString(after));
            history.setTriggerReason(reason);
            if (scores != null) {
                history.setPerformanceMetrics(objectMapper.writeValueAsString(scores));
            }
            weightHistoryRepository.save(history);
        } catch (JsonProcessingException e) {
            log.error("保存权重历史失败: {}", e.getMessage());
        }
    }

    /**
     * 将 WeightHistory 转换为 WeightAdjustmentResult
     */
    private WeightAdjustmentResult convertToResult(WeightHistory history) {
        WeightAdjustmentResult result = new WeightAdjustmentResult();
        result.setAdjustedAt(history.getAdjustedAt());
        result.setFactoryId(history.getFactoryId());
        result.setReason(history.getTriggerReason());
        result.setApplied(true);

        try {
            if (history.getWeightsBefore() != null) {
                result.setPreviousWeights(objectMapper.readValue(
                        history.getWeightsBefore(), new TypeReference<Map<String, Double>>() {}));
            }
            if (history.getWeightsAfter() != null) {
                result.setNewWeights(objectMapper.readValue(
                        history.getWeightsAfter(), new TypeReference<Map<String, Double>>() {}));
            }
            if (history.getPerformanceMetrics() != null) {
                result.setPerformanceScores(objectMapper.readValue(
                        history.getPerformanceMetrics(), new TypeReference<Map<String, Double>>() {}));
            }
        } catch (JsonProcessingException e) {
            log.warn("解析权重历史失败: {}", e.getMessage());
        }

        return result;
    }
}
