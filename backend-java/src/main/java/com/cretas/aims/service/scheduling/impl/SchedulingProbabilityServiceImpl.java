package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.dto.scheduling.CompletionProbabilityResponse;
import com.cretas.aims.entity.production.ProductionPlan;
import com.cretas.aims.entity.scheduling.LineSchedule;
import com.cretas.aims.repository.production.ProductionPlanRepository;
import com.cretas.aims.repository.scheduling.LineScheduleRepository;
import com.cretas.aims.service.scheduling.SchedulingProbabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * 调度概率预测服务实现
 *
 * 负责完成概率计算和风险评估
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingProbabilityServiceImpl implements SchedulingProbabilityService {

    private final ProductionPlanRepository productionPlanRepository;
    private final LineScheduleRepository scheduleRepository;

    // 12维特征权重（基于逻辑回归）
    private static final double[] FEATURE_WEIGHTS = {
            0.15,  // 进度百分比
            -0.20, // 时间紧迫度
            0.10,  // 效率偏差
            0.12,  // 工人配置满足度
            0.18,  // 历史完成率
            -0.15, // 当前延迟程度
            0.10,  // 物料齐套率
            0.05,  // 是否紧急订单
            0.08,  // 时间窗口宽度
            0.05,  // 偏置项
            0.07,  // 效率趋势
            -0.10  // 冲突数
    };

    @Override
    public CompletableFuture<BigDecimal> calculatePlanProbability(ProductionPlan plan) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                double[] features = buildFeatureVector(plan);
                double probability = sigmoid(dotProduct(features, FEATURE_WEIGHTS));
                return BigDecimal.valueOf(probability).setScale(4, RoundingMode.HALF_UP);
            } catch (Exception e) {
                log.error("Failed to calculate plan probability: {}", e.getMessage());
                return BigDecimal.valueOf(0.5);
            }
        });
    }

    @Override
    public CompletionProbabilityResponse calculateCompletionProbability(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository
                .findByFactoryIdAndScheduleIdAndDeletedAtIsNull(factoryId, scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("排程不存在: " + scheduleId));

        double[] features = buildFeatureVectorFromSchedule(schedule);
        double probability = sigmoid(dotProduct(features, FEATURE_WEIGHTS));

        // 分析风险因素
        Map<String, Object> riskFactors = analyzeRiskFactors(features);

        return CompletionProbabilityResponse.builder()
                .scheduleId(scheduleId)
                .probability(BigDecimal.valueOf(probability).setScale(4, RoundingMode.HALF_UP))
                .confidence(calculateConfidence(features))
                .riskLevel(determineRiskLevel(probability))
                .riskFactors(riskFactors)
                .predictedCompletionTime(predictCompletionTime(schedule, probability))
                .build();
    }

    @Override
    public List<CompletionProbabilityResponse> calculateBatchProbabilities(String factoryId, String planId) {
        List<LineSchedule> schedules = scheduleRepository
                .findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, planId);

        return schedules.stream()
                .map(schedule -> calculateCompletionProbability(factoryId, schedule.getScheduleId()))
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> assessRisks(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository
                .findByFactoryIdAndScheduleIdAndDeletedAtIsNull(factoryId, scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("排程不存在: " + scheduleId));

        double[] features = buildFeatureVectorFromSchedule(schedule);
        return analyzeRiskFactors(features);
    }

    @Override
    public double getUrgentThreshold(String factoryId) {
        // 从配置中读取，默认 0.3
        return 0.3;
    }

    @Override
    public double getEfficiencyThreshold(String factoryId) {
        // 从配置中读取，默认 0.7
        return 0.7;
    }

    /**
     * 构建生产计划的特征向量
     */
    private double[] buildFeatureVector(ProductionPlan plan) {
        double[] features = new double[12];

        // 进度百分比
        features[0] = plan.getCompletedQuantity() != null && plan.getPlannedQuantity() != null ?
                plan.getCompletedQuantity().doubleValue() / plan.getPlannedQuantity().doubleValue() : 0;

        // 时间紧迫度
        if (plan.getDeadline() != null) {
            long hoursRemaining = Duration.between(LocalDateTime.now(), plan.getDeadline()).toHours();
            features[1] = Math.max(0, 1 - (hoursRemaining / 24.0)); // 归一化到 0-1
        } else {
            features[1] = 0.5;
        }

        // 效率偏差
        features[2] = 0.85; // 默认效率

        // 工人配置满足度
        features[3] = 0.9;

        // 历史完成率
        features[4] = 0.8;

        // 当前延迟程度
        features[5] = plan.getIsDelayed() != null && plan.getIsDelayed() ? 0.3 : 0;

        // 物料齐套率
        features[6] = 0.95;

        // 是否紧急订单
        features[7] = plan.getIsUrgent() != null && plan.getIsUrgent() ? 1.0 : 0;

        // 时间窗口宽度
        features[8] = 0.7;

        // 偏置项
        features[9] = 1.0;

        // 效率趋势
        features[10] = 0.02;

        // 冲突数
        features[11] = 0;

        return features;
    }

    /**
     * 从排程构建特征向量
     */
    private double[] buildFeatureVectorFromSchedule(LineSchedule schedule) {
        double[] features = new double[12];

        // 进度百分比
        features[0] = schedule.getCompletedQuantity() != null && schedule.getPlannedQuantity() != null ?
                schedule.getCompletedQuantity().doubleValue() / schedule.getPlannedQuantity().doubleValue() : 0;

        // 时间紧迫度
        if (schedule.getExpectedEndTime() != null) {
            long hoursRemaining = Duration.between(LocalDateTime.now(), schedule.getExpectedEndTime()).toHours();
            features[1] = Math.max(0, Math.min(1, 1 - (hoursRemaining / 8.0)));
        } else {
            features[1] = 0.5;
        }

        // 效率偏差
        features[2] = schedule.getActualEfficiency() != null ?
                schedule.getActualEfficiency().doubleValue() : 0.85;

        // 工人配置满足度
        features[3] = schedule.getWorkerCount() != null && schedule.getRequiredWorkerCount() != null ?
                Math.min(1, schedule.getWorkerCount().doubleValue() / schedule.getRequiredWorkerCount()) : 0.9;

        // 历史完成率
        features[4] = 0.82;

        // 当前延迟程度
        features[5] = schedule.getDelayMinutes() != null ?
                Math.min(1, schedule.getDelayMinutes() / 60.0) : 0;

        // 物料齐套率
        features[6] = schedule.getMaterialReadyRate() != null ?
                schedule.getMaterialReadyRate().doubleValue() : 0.95;

        // 是否紧急
        features[7] = schedule.getIsUrgent() != null && schedule.getIsUrgent() ? 1.0 : 0;

        // 时间窗口宽度
        features[8] = 0.7;

        // 偏置项
        features[9] = 1.0;

        // 效率趋势
        features[10] = 0.01;

        // 冲突数
        features[11] = schedule.getConflictCount() != null ? schedule.getConflictCount() : 0;

        return features;
    }

    /**
     * Sigmoid 函数
     */
    private double sigmoid(double x) {
        return 1.0 / (1.0 + Math.exp(-x));
    }

    /**
     * 点积计算
     */
    private double dotProduct(double[] a, double[] b) {
        double sum = 0;
        for (int i = 0; i < Math.min(a.length, b.length); i++) {
            sum += a[i] * b[i];
        }
        return sum;
    }

    /**
     * 计算置信度
     */
    private BigDecimal calculateConfidence(double[] features) {
        // 基于特征完整性和数据质量计算置信度
        int nonZeroCount = 0;
        for (double f : features) {
            if (f != 0) nonZeroCount++;
        }
        double confidence = 0.5 + 0.5 * (nonZeroCount / (double) features.length);
        return BigDecimal.valueOf(confidence).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 确定风险等级
     */
    private String determineRiskLevel(double probability) {
        if (probability >= 0.8) return "LOW";
        if (probability >= 0.6) return "MEDIUM";
        if (probability >= 0.4) return "HIGH";
        return "CRITICAL";
    }

    /**
     * 分析风险因素
     */
    private Map<String, Object> analyzeRiskFactors(double[] features) {
        Map<String, Object> risks = new HashMap<>();

        if (features[1] > 0.7) {
            risks.put("时间紧迫", "剩余时间不足");
        }
        if (features[3] < 0.8) {
            risks.put("人员不足", "工人配置未达标");
        }
        if (features[5] > 0.2) {
            risks.put("进度延迟", "当前进度落后");
        }
        if (features[6] < 0.9) {
            risks.put("物料风险", "物料齐套率偏低");
        }
        if (features[11] > 0) {
            risks.put("资源冲突", "存在资源或时间冲突");
        }

        return risks;
    }

    /**
     * 预测完成时间
     */
    private LocalDateTime predictCompletionTime(LineSchedule schedule, double probability) {
        if (schedule.getExpectedEndTime() == null) {
            return LocalDateTime.now().plusHours(4);
        }

        // 根据概率调整预测时间
        long originalMinutes = Duration.between(LocalDateTime.now(), schedule.getExpectedEndTime()).toMinutes();
        long adjustedMinutes = (long) (originalMinutes / probability);

        return LocalDateTime.now().plusMinutes(adjustedMinutes);
    }
}
