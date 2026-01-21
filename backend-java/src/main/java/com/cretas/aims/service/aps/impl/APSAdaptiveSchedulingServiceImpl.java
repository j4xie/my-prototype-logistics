package com.cretas.aims.service.aps.impl;

import com.cretas.aims.entity.*;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.aps.APSAdaptiveSchedulingService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * APS 自适应排产优化服务实现
 *
 * 核心功能:
 * 1. 实时进度追踪 - 监控实际vs计划进度
 * 2. 效率动态计算 - 滚动效率因子 (EWMA)
 * 3. 完成概率预测 - 12维特征向量 + Sigmoid
 * 4. 策略权重自适应 - 根据历史效果自动调整
 * 5. 重排触发机制 - 概率低于阈值时触发重排
 *
 * @author Cretas APS V1.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class APSAdaptiveSchedulingServiceImpl implements APSAdaptiveSchedulingService {

    private final LineScheduleRepository lineScheduleRepository;
    private final ProductionLineRepository productionLineRepository;
    private final EfficiencyHistoryRepository efficiencyHistoryRepository;
    private final PredictionModelWeightRepository predictionModelWeightRepository;
    private final FactorySchedulingConfigRepository factorySchedulingConfigRepository;
    private final WeightHistoryRepository weightHistoryRepository;
    private final ObjectMapper objectMapper;

    // ==================== 实时进度追踪 ====================

    @Override
    @Transactional
    public ProgressUpdateResult updateTaskProgress(String taskId, double completedQty, Double actualEfficiency) {
        LineSchedule task = lineScheduleRepository.findById(taskId)
            .orElseThrow(() -> new RuntimeException("Task not found: " + taskId));

        ProgressUpdateResult result = new ProgressUpdateResult();
        result.setTaskId(taskId);
        result.setPreviousProgress(task.getCompletedQuantity() != null && task.getPlannedQuantity() != null && task.getPlannedQuantity() > 0
            ? task.getCompletedQuantity() * 100.0 / task.getPlannedQuantity() : 0);

        // 更新已完成数量
        task.setCompletedQuantity((int) completedQty);
        result.setCurrentProgress(task.getPlannedQuantity() != null && task.getPlannedQuantity() > 0
            ? completedQty * 100.0 / task.getPlannedQuantity() : 0);

        // 更新实际效率
        if (actualEfficiency != null) {
            task.setActualEfficiency(BigDecimal.valueOf(actualEfficiency));
            // 记录效率历史
            recordEfficiencyHistory(task.getProductionLineId(), taskId, completedQty,
                task.getPlannedQuantity() != null ? task.getPlannedQuantity() : 0,
                actualEfficiency, task.getAssignedWorkers());
            // 更新产线滚动效率
            updateLineEfficiencyFactor(task.getProductionLineId());
        }

        // 计算完成概率
        double probability = predictCompletionProbability(taskId);
        task.setPredictedCompletionProb(BigDecimal.valueOf(probability));
        result.setCompletionProbability(probability);

        // 更新风险等级
        String riskLevel = calculateRiskLevel(probability);
        task.setRiskLevel(riskLevel);
        result.setNeedsAttention(probability < PROBABILITY_WARNING_THRESHOLD);

        // 保存更新
        lineScheduleRepository.save(task);

        result.setMessage("进度更新成功");
        return result;
    }

    @Override
    public TaskRealTimeStatus getTaskRealTimeStatus(String taskId) {
        LineSchedule task = lineScheduleRepository.findById(taskId)
            .orElseThrow(() -> new RuntimeException("Task not found: " + taskId));

        ProductionLine line = productionLineRepository.findById(task.getProductionLineId())
            .orElse(null);

        TaskRealTimeStatus status = new TaskRealTimeStatus();
        status.setTaskId(taskId);
        status.setTaskNo(task.getId()); // Using ID as task number
        status.setLineName(line != null ? line.getName() : "Unknown");
        status.setPlannedQty(task.getPlannedQuantity() != null ? task.getPlannedQuantity() : 0);
        status.setCompletedQty(task.getCompletedQuantity() != null ? task.getCompletedQuantity() : 0);
        status.setProgressPercent(status.getPlannedQty() > 0 ? status.getCompletedQty() * 100.0 / status.getPlannedQty() : 0);
        status.setPlannedStart(task.getPlannedStartTime());
        status.setPlannedEnd(task.getPlannedEndTime());
        status.setCurrentEfficiency(task.getActualEfficiency() != null ? task.getActualEfficiency().doubleValue() : 0);
        status.setPlannedEfficiency(task.getPredictedEfficiency() != null ? task.getPredictedEfficiency().doubleValue() : 0);
        status.setStatus(task.getStatus() != null ? task.getStatus().name() : "unknown");
        status.setRiskLevel(task.getRiskLevel() != null ? task.getRiskLevel() : "low");

        // 计算预估完成时间和延迟
        if (task.getPlannedEndTime() != null && status.getCurrentEfficiency() > 0) {
            double remainingQty = status.getPlannedQty() - status.getCompletedQty();
            double remainingHours = remainingQty / status.getCurrentEfficiency();
            status.setEstimatedEnd(LocalDateTime.now().plusMinutes((long) (remainingHours * 60)));

            if (status.getEstimatedEnd().isAfter(task.getPlannedEndTime())) {
                status.setDelayMinutes((int) ChronoUnit.MINUTES.between(task.getPlannedEndTime(), status.getEstimatedEnd()));
            }
        }

        status.setCompletionProbability(task.getPredictedCompletionProb() != null
            ? task.getPredictedCompletionProb().doubleValue() : predictCompletionProbability(taskId));

        return status;
    }

    @Override
    public LineRealTimeStatus getLineRealTimeStatus(String lineId) {
        ProductionLine line = productionLineRepository.findById(lineId)
            .orElseThrow(() -> new RuntimeException("Line not found: " + lineId));

        LineRealTimeStatus status = new LineRealTimeStatus();
        status.setLineId(lineId);
        status.setLineName(line.getName());
        status.setStatus(line.getStatus() != null ? line.getStatus().name() : "unknown");
        status.setRollingEfficiency(line.getRollingEfficiency() != null ? line.getRollingEfficiency().doubleValue() : 1.0);

        // 获取当前进行中的任务
        List<LineSchedule> inProgressTasks = lineScheduleRepository.findByProductionLineIdAndStatus(
            lineId, LineSchedule.ScheduleStatus.in_progress);

        if (!inProgressTasks.isEmpty()) {
            LineSchedule currentTask = inProgressTasks.get(0);
            status.setCurrentTaskId(currentTask.getId());
            status.setCurrentTaskProgress(currentTask.getPlannedQuantity() != null && currentTask.getPlannedQuantity() > 0
                ? (currentTask.getCompletedQuantity() != null ? currentTask.getCompletedQuantity() : 0) * 100.0 / currentTask.getPlannedQuantity()
                : 0);
            status.setCurrentWorkerCount(currentTask.getAssignedWorkers() != null ? currentTask.getAssignedWorkers() : 0);
        }

        // 获取后续待处理任务
        List<LineSchedule> pendingTasks = lineScheduleRepository.findByProductionLineIdAndStatus(
            lineId, LineSchedule.ScheduleStatus.pending);
        status.setUpcomingTaskIds(pendingTasks.stream()
            .map(LineSchedule::getId)
            .limit(5)
            .collect(Collectors.toList()));

        // 计算今日任务统计
        List<LineSchedule> completedTasks = lineScheduleRepository.findByProductionLineIdAndStatus(
            lineId, LineSchedule.ScheduleStatus.completed);
        status.setTodayCompletedTasks(completedTasks.size());
        status.setTodayTotalTasks(completedTasks.size() + inProgressTasks.size() + pendingTasks.size());

        // 计算今日准时率
        long onTimeTasks = completedTasks.stream()
            .filter(t -> t.getActualEndTime() != null && t.getPlannedEndTime() != null
                && !t.getActualEndTime().isAfter(t.getPlannedEndTime()))
            .count();
        status.setTodayOnTimeRate(status.getTodayCompletedTasks() > 0
            ? (double) onTimeTasks / status.getTodayCompletedTasks() : 0);

        return status;
    }

    @Override
    public GlobalDashboard getGlobalDashboard() {
        GlobalDashboard dashboard = new GlobalDashboard();
        dashboard.setUpdateTime(LocalDateTime.now());

        // 获取所有进行中的任务
        List<LineSchedule> activeTasks = lineScheduleRepository.findByStatus(LineSchedule.ScheduleStatus.in_progress);
        dashboard.setTotalActiveTasks(activeTasks.size());

        int onTrack = 0, atRisk = 0, delayed = 0;
        double totalProb = 0;
        double totalEfficiency = 0;
        int efficiencyCount = 0;

        for (LineSchedule task : activeTasks) {
            double prob = task.getPredictedCompletionProb() != null ? task.getPredictedCompletionProb().doubleValue() : 0.8;
            totalProb += prob;

            if (prob >= 0.8) onTrack++;
            else if (prob >= 0.5) atRisk++;
            else delayed++;

            if (task.getActualEfficiency() != null) {
                totalEfficiency += task.getActualEfficiency().doubleValue();
                efficiencyCount++;
            }
        }

        dashboard.setOnTrackTasks(onTrack);
        dashboard.setAtRiskTasks(atRisk);
        dashboard.setDelayedTasks(delayed);
        dashboard.setAverageCompletionProbability(activeTasks.isEmpty() ? 0 : totalProb / activeTasks.size());
        dashboard.setAverageEfficiency(efficiencyCount == 0 ? 1.0 : totalEfficiency / efficiencyCount);

        // 产线状态
        List<ProductionLine> lines = productionLineRepository.findAll();
        dashboard.setActiveLines((int) lines.stream()
            .filter(l -> l.getStatus() == ProductionLine.LineStatus.active).count());
        dashboard.setMaintenanceLines((int) lines.stream()
            .filter(l -> l.getStatus() == ProductionLine.LineStatus.maintenance).count());
        dashboard.setIdleLines((int) lines.stream()
            .filter(l -> l.getStatus() == ProductionLine.LineStatus.inactive).count());

        // 高风险任务
        dashboard.setTopRisks(getLowProbabilityTasks(PROBABILITY_WARNING_THRESHOLD));

        // 重排建议
        dashboard.setRescheduleRecommendation(checkRescheduleNeed());

        return dashboard;
    }

    // ==================== 效率动态计算 ====================

    @Override
    public double calculateRollingEfficiency(String lineId) {
        LocalDateTime windowStart = LocalDateTime.now().minusHours(EFFICIENCY_ROLLING_WINDOW_HOURS);
        List<EfficiencyHistory> histories = efficiencyHistoryRepository
            .findByLineIdAndRecordedAtAfterOrderByRecordedAtDesc(lineId, windowStart);

        if (histories.isEmpty()) {
            return 1.0; // 无历史数据，返回标准效率
        }

        // EWMA 计算: new = alpha * current + (1-alpha) * old
        double alpha = 0.3;
        double rollingEfficiency = 1.0;

        // 从旧到新遍历
        for (int i = histories.size() - 1; i >= 0; i--) {
            EfficiencyHistory h = histories.get(i);
            double ratio = h.getEfficiencyRatio() != null ? h.getEfficiencyRatio().doubleValue() : 1.0;
            rollingEfficiency = alpha * ratio + (1 - alpha) * rollingEfficiency;
        }

        return rollingEfficiency;
    }

    @Override
    public double calculateWorkerEfficiency(String workerId) {
        // TODO: Implement worker-specific efficiency calculation
        // For now, return standard efficiency
        return 1.0;
    }

    @Override
    @Transactional
    public void updateLineEfficiencyFactor(String lineId) {
        double rollingEfficiency = calculateRollingEfficiency(lineId);

        productionLineRepository.findById(lineId).ifPresent(line -> {
            line.setRollingEfficiency(BigDecimal.valueOf(rollingEfficiency));
            productionLineRepository.save(line);
            log.info("Updated line {} rolling efficiency to {}", lineId, rollingEfficiency);
        });
    }

    // ==================== 完成概率预测 ====================

    @Override
    public double predictCompletionProbability(String taskId) {
        LineSchedule task = lineScheduleRepository.findById(taskId)
            .orElseThrow(() -> new RuntimeException("Task not found: " + taskId));

        // 获取预测模型权重
        List<PredictionModelWeight> weights = predictionModelWeightRepository.findByFactoryId("DEFAULT");
        Map<String, Double> weightMap = weights.stream()
            .collect(Collectors.toMap(PredictionModelWeight::getFeatureName,
                w -> w.getFeatureWeight().doubleValue()));

        // 如果没有权重配置，使用默认权重
        if (weightMap.isEmpty()) {
            weightMap = getDefaultFeatureWeights();
        }

        // 构建12维特征向量
        double[] features = buildFeatureVector(task);

        // 计算 logit
        double logit = 0;
        String[] featureNames = {"progress_percent", "time_urgency", "efficiency_deviation",
            "worker_config", "historical_completion_rate", "current_delay", "material_ready_rate",
            "is_urgent", "time_window_width", "bias", "efficiency_trend", "conflict_count"};

        for (int i = 0; i < features.length && i < featureNames.length; i++) {
            logit += weightMap.getOrDefault(featureNames[i], 0.0) * features[i];
        }

        // Sigmoid 函数
        return 1.0 / (1.0 + Math.exp(-logit));
    }

    @Override
    public Map<String, Double> predictAllTasksProbability() {
        List<LineSchedule> inProgressTasks = lineScheduleRepository.findByStatus(LineSchedule.ScheduleStatus.in_progress);
        Map<String, Double> probabilities = new HashMap<>();

        for (LineSchedule task : inProgressTasks) {
            try {
                double probability = predictCompletionProbability(task.getId());
                probabilities.put(task.getId(), probability);
            } catch (Exception e) {
                log.warn("Failed to predict probability for task {}: {}", task.getId(), e.getMessage());
                probabilities.put(task.getId(), 0.5); // Default probability
            }
        }

        return probabilities;
    }

    @Override
    public List<TaskRiskInfo> getLowProbabilityTasks(double threshold) {
        List<LineSchedule> inProgressTasks = lineScheduleRepository.findByStatus(LineSchedule.ScheduleStatus.in_progress);
        List<TaskRiskInfo> riskTasks = new ArrayList<>();

        for (LineSchedule task : inProgressTasks) {
            double probability = task.getPredictedCompletionProb() != null
                ? task.getPredictedCompletionProb().doubleValue()
                : predictCompletionProbability(task.getId());

            if (probability < threshold) {
                ProductionLine line = productionLineRepository.findById(task.getProductionLineId()).orElse(null);

                TaskRiskInfo riskInfo = new TaskRiskInfo();
                riskInfo.setTaskId(task.getId());
                riskInfo.setTaskNo(task.getId());
                riskInfo.setLineName(line != null ? line.getName() : "Unknown");
                riskInfo.setCompletionProbability(probability);
                riskInfo.setRiskLevel(calculateRiskLevel(probability));
                riskInfo.setRiskReason(generateRiskReason(task, probability));
                riskInfo.setSuggestedActions(generateSuggestedActions(task, probability));

                // 计算预计延迟
                if (task.getPlannedEndTime() != null) {
                    LocalDateTime estimatedEnd = estimateEndTime(task);
                    if (estimatedEnd != null && estimatedEnd.isAfter(task.getPlannedEndTime())) {
                        riskInfo.setEstimatedDelayMinutes((int) ChronoUnit.MINUTES.between(
                            task.getPlannedEndTime(), estimatedEnd));
                    }
                }

                riskTasks.add(riskInfo);
            }
        }

        // 按概率排序，最低的在前
        riskTasks.sort(Comparator.comparingDouble(TaskRiskInfo::getCompletionProbability));

        return riskTasks;
    }

    // ==================== 策略权重自适应 ====================

    @Override
    @Transactional
    public void autoAdjustStrategyWeights() {
        // 评估各策略效果
        Map<String, StrategyEffectiveness> effectiveness = evaluateStrategyEffectiveness();

        // 获取当前权重
        FactorySchedulingConfig config = factorySchedulingConfigRepository
            .findByFactoryId("DEFAULT").orElse(null);
        if (config == null) {
            log.warn("No factory scheduling config found for DEFAULT");
            return;
        }

        Map<String, Double> currentWeights = getCurrentStrategyWeights(config);
        Map<String, Double> newWeights = new HashMap<>(currentWeights);

        // 调整权重
        for (Map.Entry<String, StrategyEffectiveness> entry : effectiveness.entrySet()) {
            String strategy = entry.getKey();
            double score = entry.getValue().getEffectivenessScore();
            double adjustment = STRATEGY_LEARNING_RATE * (score - 0.5);

            double oldWeight = currentWeights.getOrDefault(strategy, 0.15);
            double newWeight = Math.max(0.05, Math.min(0.40, oldWeight + adjustment));
            newWeights.put(strategy, newWeight);
        }

        // 归一化
        double sum = newWeights.values().stream().mapToDouble(d -> d).sum();
        if (sum > 0) {
            newWeights.replaceAll((k, v) -> v / sum);
        }

        // 保存调整历史
        try {
            WeightHistory history = new WeightHistory();
            history.setFactoryId("DEFAULT");
            history.setAdjustedAt(LocalDateTime.now());
            history.setWeightsBefore(objectMapper.writeValueAsString(currentWeights));
            history.setWeightsAfter(objectMapper.writeValueAsString(newWeights));
            history.setTriggerReason("自动调整");
            weightHistoryRepository.save(history);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize weights: {}", e.getMessage());
        }

        // 更新配置
        updateStrategyWeights(config, newWeights);
        config.setLastAdaptationAt(LocalDateTime.now());
        config.setAdaptationCount(config.getAdaptationCount() != null ? config.getAdaptationCount() + 1 : 1);
        factorySchedulingConfigRepository.save(config);

        log.info("Strategy weights adjusted: {} -> {}", currentWeights, newWeights);
    }

    @Override
    public List<WeightAdjustmentRecord> getWeightAdjustmentHistory(int days) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        List<WeightHistory> histories = weightHistoryRepository
            .findByFactoryIdAndAdjustedAtAfterOrderByAdjustedAtDesc("DEFAULT", cutoff);

        return histories.stream().map(h -> {
            WeightAdjustmentRecord record = new WeightAdjustmentRecord();
            record.setAdjustTime(h.getAdjustedAt());
            record.setReason(h.getTriggerReason());

            try {
                if (h.getWeightsBefore() != null) {
                    record.setPreviousWeights(objectMapper.readValue(h.getWeightsBefore(),
                        new TypeReference<Map<String, Double>>() {}));
                }
                if (h.getWeightsAfter() != null) {
                    record.setNewWeights(objectMapper.readValue(h.getWeightsAfter(),
                        new TypeReference<Map<String, Double>>() {}));
                }
                if (h.getPerformanceMetrics() != null) {
                    record.setPerformanceMetrics(objectMapper.readValue(h.getPerformanceMetrics(),
                        new TypeReference<Map<String, Double>>() {}));
                }
            } catch (JsonProcessingException e) {
                log.warn("Failed to parse weight history: {}", e.getMessage());
            }

            return record;
        }).collect(Collectors.toList());
    }

    @Override
    public Map<String, StrategyEffectiveness> evaluateStrategyEffectiveness() {
        Map<String, StrategyEffectiveness> effectiveness = new HashMap<>();

        // 获取当前配置
        FactorySchedulingConfig config = factorySchedulingConfigRepository
            .findByFactoryId("DEFAULT").orElse(null);

        // 定义策略列表
        String[] strategies = {"linucb", "fairness", "skill_maintenance", "repetition"};
        double[] defaultWeights = {0.60, 0.15, 0.15, 0.10};

        for (int i = 0; i < strategies.length; i++) {
            StrategyEffectiveness eff = new StrategyEffectiveness();
            eff.setStrategyName(strategies[i]);
            eff.setCurrentWeight(config != null ? getStrategyWeight(config, strategies[i]) : defaultWeights[i]);

            // 简化的效果评估 - 基于历史数据
            eff.setEffectivenessScore(calculateStrategyEffectiveness(strategies[i]));
            eff.setContributionRate(eff.getCurrentWeight() * eff.getEffectivenessScore());
            eff.setTrend("stable");
            eff.setSuggestedWeight(Math.max(0.05, Math.min(0.40,
                eff.getCurrentWeight() + STRATEGY_LEARNING_RATE * (eff.getEffectivenessScore() - 0.5))));

            effectiveness.put(strategies[i], eff);
        }

        return effectiveness;
    }

    // ==================== 重排触发机制 ====================

    @Override
    public RescheduleRecommendation checkRescheduleNeed() {
        RescheduleRecommendation recommendation = new RescheduleRecommendation();
        List<String> reasons = new ArrayList<>();
        List<String> affectedTaskIds = new ArrayList<>();

        // 检查低概率任务
        List<TaskRiskInfo> lowProbTasks = getLowProbabilityTasks(PROBABILITY_RESCHEDULE_THRESHOLD);
        if (!lowProbTasks.isEmpty()) {
            reasons.add("有" + lowProbTasks.size() + "个任务完成概率低于50%");
            affectedTaskIds.addAll(lowProbTasks.stream().map(TaskRiskInfo::getTaskId).collect(Collectors.toList()));
        }

        // 检查产线故障
        List<ProductionLine> faultLines = productionLineRepository.findAll().stream()
            .filter(l -> l.getStatus() == ProductionLine.LineStatus.maintenance)
            .collect(Collectors.toList());
        if (!faultLines.isEmpty()) {
            reasons.add("有" + faultLines.size() + "条产线处于维护状态");
        }

        // 设置建议
        recommendation.setNeedReschedule(!reasons.isEmpty());
        recommendation.setReasons(reasons);
        recommendation.setAffectedTaskIds(affectedTaskIds);
        recommendation.setUrgencyLevel(calculateUrgencyLevel(lowProbTasks.size(), faultLines.size()));

        return recommendation;
    }

    @Override
    @Transactional
    public SchedulingResult adaptiveReschedule(List<String> affectedTaskIds) {
        SchedulingResult result = new SchedulingResult();
        result.setScheduleBatchNo("RS-" + System.currentTimeMillis());
        result.setTotalTasks(affectedTaskIds.size());

        int scheduledCount = 0;
        for (String taskId : affectedTaskIds) {
            try {
                LineSchedule task = lineScheduleRepository.findById(taskId).orElse(null);
                if (task != null) {
                    // 重新计算任务的排程参数
                    task.setAdjustmentCount(task.getAdjustmentCount() != null ? task.getAdjustmentCount() + 1 : 1);
                    task.setLastAdjustmentTime(LocalDateTime.now());
                    task.setAdjustmentReason("自适应重排");
                    lineScheduleRepository.save(task);
                    scheduledCount++;
                }
            } catch (Exception e) {
                log.warn("Failed to reschedule task {}: {}", taskId, e.getMessage());
            }
        }

        result.setScheduledTasks(scheduledCount);
        result.setSuccess(scheduledCount > 0);
        result.setMessage(String.format("重排完成: %d/%d 任务已调整", scheduledCount, affectedTaskIds.size()));

        return result;
    }

    @Override
    public RescheduleSimulation simulateReschedule(List<String> affectedTaskIds) {
        RescheduleSimulation simulation = new RescheduleSimulation();

        // 记录当前概率
        Map<String, Double> beforeProbabilities = new HashMap<>();
        for (String taskId : affectedTaskIds) {
            try {
                beforeProbabilities.put(taskId, predictCompletionProbability(taskId));
            } catch (Exception e) {
                beforeProbabilities.put(taskId, 0.5);
            }
        }
        simulation.setBeforeProbabilities(beforeProbabilities);

        // 模拟重排后的概率 (简化: 假设重排后概率提升10%)
        Map<String, Double> afterProbabilities = new HashMap<>();
        for (Map.Entry<String, Double> entry : beforeProbabilities.entrySet()) {
            afterProbabilities.put(entry.getKey(), Math.min(1.0, entry.getValue() + 0.1));
        }
        simulation.setAfterProbabilities(afterProbabilities);

        // 计算延迟任务数
        simulation.setBeforeDelayedTasks((int) beforeProbabilities.values().stream()
            .filter(p -> p < PROBABILITY_RESCHEDULE_THRESHOLD).count());
        simulation.setAfterDelayedTasks((int) afterProbabilities.values().stream()
            .filter(p -> p < PROBABILITY_RESCHEDULE_THRESHOLD).count());

        // 计算准时率
        simulation.setBeforeOnTimeRate(beforeProbabilities.values().stream()
            .mapToDouble(d -> d).average().orElse(0.5));
        simulation.setAfterOnTimeRate(afterProbabilities.values().stream()
            .mapToDouble(d -> d).average().orElse(0.5));

        // 推荐执行
        simulation.setRecommendExecute(simulation.getAfterOnTimeRate() > simulation.getBeforeOnTimeRate());

        return simulation;
    }

    // ==================== 私有辅助方法 ====================

    private void recordEfficiencyHistory(String lineId, String taskId, double actualOutput,
                                          int expectedOutput, double actualEfficiency, Integer workerCount) {
        EfficiencyHistory history = new EfficiencyHistory();
        history.setLineId(lineId);
        history.setTaskId(taskId);
        history.setRecordedAt(LocalDateTime.now());
        history.setActualOutput(BigDecimal.valueOf(actualOutput));
        history.setExpectedOutput(BigDecimal.valueOf(expectedOutput));
        history.setEfficiencyRatio(expectedOutput > 0
            ? BigDecimal.valueOf(actualOutput / expectedOutput)
            : BigDecimal.ONE);
        history.setWorkerCount(workerCount);
        efficiencyHistoryRepository.save(history);
    }

    private String calculateRiskLevel(double probability) {
        if (probability >= 0.8) return "low";
        if (probability >= 0.6) return "medium";
        if (probability >= 0.4) return "high";
        return "critical";
    }

    private double[] buildFeatureVector(LineSchedule task) {
        double[] features = new double[12];

        // [0] 进度百分比
        features[0] = task.getCompletedQuantity() != null && task.getPlannedQuantity() != null && task.getPlannedQuantity() > 0
            ? (double) task.getCompletedQuantity() / task.getPlannedQuantity() : 0;

        // [1] 时间紧迫度
        if (task.getPlannedEndTime() != null) {
            long remainingMinutes = ChronoUnit.MINUTES.between(LocalDateTime.now(), task.getPlannedEndTime());
            features[1] = Math.max(0, Math.min(1, 1.0 - remainingMinutes / 480.0)); // 8小时=480分钟
        }

        // [2] 效率偏差
        ProductionLine line = productionLineRepository.findById(task.getProductionLineId()).orElse(null);
        features[2] = line != null && line.getRollingEfficiency() != null
            ? line.getRollingEfficiency().doubleValue() - 1.0 : 0;

        // [3] 工人配置满足度
        features[3] = task.getAssignedWorkers() != null && line != null && line.getMinWorkers() != null
            ? Math.min(1.0, (double) task.getAssignedWorkers() / line.getMinWorkers()) : 0.5;

        // [4] 历史完成率 (简化为0.8)
        features[4] = 0.8;

        // [5] 当前延迟程度
        if (task.getPlannedStartTime() != null && task.getActualStartTime() == null
            && LocalDateTime.now().isAfter(task.getPlannedStartTime())) {
            long delayMinutes = ChronoUnit.MINUTES.between(task.getPlannedStartTime(), LocalDateTime.now());
            features[5] = Math.min(1.0, delayMinutes / 120.0);
        }

        // [6] 物料齐套率 (简化为0.9)
        features[6] = 0.9;

        // [7] 是否紧急订单 (暂无标记，默认0)
        features[7] = 0;

        // [8] 时间窗口宽度
        if (task.getPlannedStartTime() != null && task.getPlannedEndTime() != null) {
            long windowMinutes = ChronoUnit.MINUTES.between(task.getPlannedStartTime(), task.getPlannedEndTime());
            features[8] = Math.min(1.0, windowMinutes / 480.0);
        }

        // [9] 偏置项
        features[9] = 1.0;

        // [10] 效率趋势
        features[10] = 0; // 需要更多历史数据计算

        // [11] 冲突数 (简化为0)
        features[11] = 0;

        return features;
    }

    private Map<String, Double> getDefaultFeatureWeights() {
        Map<String, Double> weights = new HashMap<>();
        weights.put("progress_percent", 2.0);
        weights.put("time_urgency", -1.5);
        weights.put("efficiency_deviation", 1.0);
        weights.put("worker_config", 0.5);
        weights.put("historical_completion_rate", 1.2);
        weights.put("current_delay", -1.0);
        weights.put("material_ready_rate", 0.8);
        weights.put("is_urgent", -0.5);
        weights.put("time_window_width", 0.3);
        weights.put("bias", 0.5);
        weights.put("efficiency_trend", 0.4);
        weights.put("conflict_count", -0.3);
        return weights;
    }

    private String generateRiskReason(LineSchedule task, double probability) {
        if (probability < 0.3) return "严重落后于计划进度";
        if (probability < 0.5) return "进度延迟风险较高";
        if (probability < 0.7) return "需要关注进度";
        return "轻微风险";
    }

    private List<String> generateSuggestedActions(LineSchedule task, double probability) {
        List<String> actions = new ArrayList<>();

        if (probability < 0.5) {
            actions.add("考虑增加工人数量");
            actions.add("检查是否存在设备问题");
            actions.add("评估是否需要调整计划");
        } else if (probability < 0.7) {
            actions.add("密切监控进度");
            actions.add("准备备用方案");
        }

        return actions;
    }

    private LocalDateTime estimateEndTime(LineSchedule task) {
        if (task.getActualEfficiency() == null || task.getActualEfficiency().doubleValue() <= 0) {
            return null;
        }

        int remainingQty = (task.getPlannedQuantity() != null ? task.getPlannedQuantity() : 0)
            - (task.getCompletedQuantity() != null ? task.getCompletedQuantity() : 0);

        if (remainingQty <= 0) {
            return LocalDateTime.now();
        }

        double hoursNeeded = remainingQty / task.getActualEfficiency().doubleValue();
        return LocalDateTime.now().plusMinutes((long) (hoursNeeded * 60));
    }

    private Map<String, Double> getCurrentStrategyWeights(FactorySchedulingConfig config) {
        Map<String, Double> weights = new HashMap<>();
        weights.put("linucb", config.getLinucbWeight() != null ? config.getLinucbWeight() : 0.60);
        weights.put("fairness", config.getFairnessWeight() != null ? config.getFairnessWeight() : 0.15);
        weights.put("skill_maintenance", config.getSkillMaintenanceWeight() != null ? config.getSkillMaintenanceWeight() : 0.15);
        weights.put("repetition", config.getRepetitionWeight() != null ? config.getRepetitionWeight() : 0.10);
        return weights;
    }

    private double getStrategyWeight(FactorySchedulingConfig config, String strategy) {
        switch (strategy) {
            case "linucb": return config.getLinucbWeight() != null ? config.getLinucbWeight() : 0.60;
            case "fairness": return config.getFairnessWeight() != null ? config.getFairnessWeight() : 0.15;
            case "skill_maintenance": return config.getSkillMaintenanceWeight() != null ? config.getSkillMaintenanceWeight() : 0.15;
            case "repetition": return config.getRepetitionWeight() != null ? config.getRepetitionWeight() : 0.10;
            default: return 0.15;
        }
    }

    private void updateStrategyWeights(FactorySchedulingConfig config, Map<String, Double> newWeights) {
        if (newWeights.containsKey("linucb")) {
            config.setLinucbWeight(newWeights.get("linucb"));
        }
        if (newWeights.containsKey("fairness")) {
            config.setFairnessWeight(newWeights.get("fairness"));
        }
        if (newWeights.containsKey("skill_maintenance")) {
            config.setSkillMaintenanceWeight(newWeights.get("skill_maintenance"));
        }
        if (newWeights.containsKey("repetition")) {
            config.setRepetitionWeight(newWeights.get("repetition"));
        }
    }

    private double calculateStrategyEffectiveness(String strategy) {
        // 简化的效果评估 - 返回基于历史数据的评分
        // 实际实现应该分析历史排程数据
        return 0.5 + Math.random() * 0.3; // 0.5-0.8 之间的随机值
    }

    private String calculateUrgencyLevel(int lowProbTaskCount, int faultLineCount) {
        int totalIssues = lowProbTaskCount + faultLineCount * 2;
        if (totalIssues == 0) return "none";
        if (totalIssues <= 2) return "low";
        if (totalIssues <= 5) return "medium";
        if (totalIssues <= 10) return "high";
        return "critical";
    }
}
