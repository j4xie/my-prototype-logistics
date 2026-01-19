package com.cretas.aims.service.impl;

import com.cretas.aims.dto.metrics.SchedulingMetricsDTO.*;
import com.cretas.aims.entity.enums.ProcessingStageType;
import com.cretas.aims.entity.ml.WorkerAllocationFeedback;
import com.cretas.aims.repository.WorkerAllocationFeedbackRepository;
import com.cretas.aims.service.SchedulingMetricsService;
import com.cretas.aims.service.TaskDiversityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 排班指标监控服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingMetricsServiceImpl implements SchedulingMetricsService {

    private final WorkerAllocationFeedbackRepository feedbackRepository;
    private final TaskDiversityService taskDiversityService;

    private static final int DEFAULT_DAYS = 30;
    private static final int DIVERSITY_ANALYSIS_DAYS = 14;

    @Override
    @Transactional(readOnly = true)
    public SchedulingOverview getSchedulingOverview(String factoryId) {
        return getSchedulingOverview(factoryId, DEFAULT_DAYS);
    }

    @Override
    @Transactional(readOnly = true)
    public SchedulingOverview getSchedulingOverview(String factoryId, int days) {
        log.info("获取排班总览指标: factoryId={}, days={}", factoryId, days);

        LocalDateTime startTime = LocalDate.now().minusDays(days).atStartOfDay();
        LocalDateTime endTime = LocalDateTime.now();

        List<WorkerAllocationFeedback> feedbacks = feedbackRepository
                .findByFactoryIdAndCompletedAtBetween(factoryId, startTime, endTime);

        // 总分配数
        long totalAllocations = feedbacks.size();

        // 计算平均效率
        BigDecimal avgEfficiency = calculateAverageEfficiency(feedbacks);

        // 计算预测准确率
        BigDecimal predictionAccuracy = calculatePredictionAccuracy(feedbacks);

        // 活跃工人数
        Set<Long> activeWorkerIds = feedbacks.stream()
                .map(WorkerAllocationFeedback::getWorkerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        int activeWorkers = activeWorkerIds.size();

        // 计算任务多样性分数 (工厂平均)
        BigDecimal taskDiversityScore = calculateFactoryDiversityScore(factoryId, activeWorkerIds);

        // 计算接受率和完成率
        BigDecimal acceptanceRate = calculateAcceptanceRate(feedbacks);
        BigDecimal completionRate = calculateCompletionRate(factoryId, startTime, endTime);

        // 未处理反馈数
        long pendingFeedbacks = feedbackRepository.countUnprocessedFeedbacks(factoryId);

        return SchedulingOverview.builder()
                .totalAllocations(totalAllocations)
                .avgEfficiency(avgEfficiency)
                .predictionAccuracy(predictionAccuracy)
                .activeWorkers(activeWorkers)
                .taskDiversityScore(taskDiversityScore)
                .acceptanceRate(acceptanceRate)
                .completionRate(completionRate)
                .periodDays(days)
                .pendingFeedbacks(pendingFeedbacks)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SchedulingTrend> getSchedulingTrends(String factoryId, int days) {
        log.info("获取排班趋势: factoryId={}, days={}", factoryId, days);

        LocalDateTime startTime = LocalDate.now().minusDays(days).atStartOfDay();
        LocalDateTime endTime = LocalDateTime.now();

        List<WorkerAllocationFeedback> feedbacks = feedbackRepository
                .findByFactoryIdAndCompletedAtBetween(factoryId, startTime, endTime);

        // 按日期分组
        Map<LocalDate, List<WorkerAllocationFeedback>> byDate = feedbacks.stream()
                .filter(f -> f.getCompletedAt() != null)
                .collect(Collectors.groupingBy(f -> f.getCompletedAt().toLocalDate()));

        List<SchedulingTrend> trends = new ArrayList<>();

        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            List<WorkerAllocationFeedback> dailyFeedbacks = byDate.getOrDefault(date, Collections.emptyList());

            SchedulingTrend trend = SchedulingTrend.builder()
                    .date(date)
                    .allocations(dailyFeedbacks.size())
                    .avgEfficiency(calculateAverageEfficiency(dailyFeedbacks))
                    .predictionError(calculateAveragePredictionError(dailyFeedbacks))
                    .activeWorkers(countActiveWorkers(dailyFeedbacks))
                    .completedTasks(countCompletedTasks(dailyFeedbacks))
                    .avgQuality(calculateAverageQuality(dailyFeedbacks))
                    .build();

            trends.add(trend);
        }

        return trends;
    }

    @Override
    @Transactional(readOnly = true)
    public PredictionAccuracyDTO getPredictionAccuracy(String factoryId, int days) {
        log.info("获取预测准确率: factoryId={}, days={}", factoryId, days);

        LocalDateTime startTime = LocalDate.now().minusDays(days).atStartOfDay();
        LocalDateTime endTime = LocalDateTime.now();

        List<WorkerAllocationFeedback> feedbacks = feedbackRepository
                .findByFactoryIdAndCompletedAtBetween(factoryId, startTime, endTime)
                .stream()
                .filter(f -> f.getPredictedScore() != null && f.getActualEfficiency() != null)
                .collect(Collectors.toList());

        // 整体准确率
        BigDecimal overallAccuracy = calculatePredictionAccuracy(feedbacks);

        // 按工艺类型分解
        Map<ProcessingStageType, StageAccuracy> byStageType = calculateAccuracyByStage(feedbacks);

        // 准确率趋势
        List<AccuracyTrend> trend = calculateAccuracyTrend(feedbacks, days);

        // 计算预测误差统计
        List<BigDecimal> errors = feedbacks.stream()
                .map(this::calculateSinglePredictionError)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        BigDecimal avgError = calculateMean(errors);
        BigDecimal stdDev = calculateStdDev(errors, avgError);

        return PredictionAccuracyDTO.builder()
                .overallAccuracy(overallAccuracy)
                .sampleCount((long) feedbacks.size())
                .byStageType(byStageType)
                .trend(trend)
                .avgPredictionError(avgError)
                .predictionErrorStdDev(stdDev)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public DiversityMetricsDTO getDiversityMetrics(String factoryId) {
        return getDiversityMetrics(factoryId, DIVERSITY_ANALYSIS_DAYS);
    }

    @Override
    @Transactional(readOnly = true)
    public DiversityMetricsDTO getDiversityMetrics(String factoryId, int days) {
        log.info("获取多样性指标: factoryId={}, days={}", factoryId, days);

        LocalDateTime startTime = LocalDate.now().minusDays(days).atStartOfDay();
        LocalDateTime endTime = LocalDateTime.now();

        List<WorkerAllocationFeedback> feedbacks = feedbackRepository
                .findByFactoryIdAndCompletedAtBetween(factoryId, startTime, endTime);

        // 获取所有活跃工人
        Set<Long> workerIds = feedbacks.stream()
                .map(WorkerAllocationFeedback::getWorkerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // 计算每个工人的多样性分析
        List<TaskDiversityService.TaskDiversityAnalysis> analyses = new ArrayList<>();
        int workersNeedingRotation = 0;
        List<RotationSuggestion> rotationSuggestions = new ArrayList<>();

        for (Long workerId : workerIds) {
            TaskDiversityService.TaskDiversityAnalysis analysis =
                    taskDiversityService.getWorkerTaskDiversityAnalysis(factoryId, workerId, days);
            analyses.add(analysis);

            if (analysis.isNeedsRotation()) {
                workersNeedingRotation++;

                // 获取建议工序
                List<String> suggested = taskDiversityService.recommendSkillDevelopmentTasks(factoryId, workerId, 3);

                rotationSuggestions.add(RotationSuggestion.builder()
                        .workerId(workerId)
                        .dominantProcess(analysis.getDominantProcessType())
                        .dominantRatio(BigDecimal.valueOf(analysis.getDominantProcessRatio())
                                .setScale(4, RoundingMode.HALF_UP))
                        .suggestedProcesses(suggested)
                        .build());
            }
        }

        // 计算工厂整体多样性分数
        BigDecimal factoryDiversityScore = calculateFactoryDiversityScore(analyses);

        // 计算工序覆盖统计
        Map<String, ProcessCoverage> processCoverageStats = calculateProcessCoverage(feedbacks);

        // 计算技能覆盖率
        BigDecimal skillCoverage = calculateSkillCoverage(processCoverageStats, workerIds.size());

        // 计算多样性分布
        Map<String, Integer> diversityDistribution = calculateDiversityDistribution(analyses);

        return DiversityMetricsDTO.builder()
                .factoryDiversityScore(factoryDiversityScore)
                .workersNeedingRotation(workersNeedingRotation)
                .totalWorkers(workerIds.size())
                .skillCoverage(skillCoverage)
                .processCoverageStats(processCoverageStats)
                .rotationSuggestions(rotationSuggestions)
                .diversityDistribution(diversityDistribution)
                .build();
    }

    // ==================== 私有计算方法 ====================

    private BigDecimal calculateAverageEfficiency(List<WorkerAllocationFeedback> feedbacks) {
        if (feedbacks.isEmpty()) {
            return BigDecimal.ZERO;
        }

        double sum = feedbacks.stream()
                .filter(f -> f.getActualEfficiency() != null)
                .mapToDouble(f -> f.getActualEfficiency().doubleValue())
                .sum();

        long count = feedbacks.stream()
                .filter(f -> f.getActualEfficiency() != null)
                .count();

        if (count == 0) {
            return BigDecimal.ZERO;
        }

        return BigDecimal.valueOf(sum / count).setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateAverageQuality(List<WorkerAllocationFeedback> feedbacks) {
        if (feedbacks.isEmpty()) {
            return BigDecimal.ZERO;
        }

        double sum = feedbacks.stream()
                .filter(f -> f.getActualQuality() != null)
                .mapToDouble(f -> f.getActualQuality().doubleValue())
                .sum();

        long count = feedbacks.stream()
                .filter(f -> f.getActualQuality() != null)
                .count();

        if (count == 0) {
            return BigDecimal.ZERO;
        }

        return BigDecimal.valueOf(sum / count).setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * 计算预测准确率
     * 准确率 = 1 - abs(predictedScore - actualEfficiency) / predictedScore
     */
    private BigDecimal calculatePredictionAccuracy(List<WorkerAllocationFeedback> feedbacks) {
        List<BigDecimal> accuracies = feedbacks.stream()
                .filter(f -> f.getPredictedScore() != null && f.getActualEfficiency() != null)
                .filter(f -> f.getPredictedScore().compareTo(BigDecimal.ZERO) > 0)
                .map(f -> {
                    BigDecimal error = f.getPredictedScore().subtract(f.getActualEfficiency()).abs();
                    BigDecimal relativeError = error.divide(f.getPredictedScore(), 4, RoundingMode.HALF_UP);
                    return BigDecimal.ONE.subtract(relativeError).max(BigDecimal.ZERO);
                })
                .collect(Collectors.toList());

        if (accuracies.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal sum = accuracies.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(accuracies.size()), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateSinglePredictionError(WorkerAllocationFeedback f) {
        if (f.getPredictedScore() == null || f.getActualEfficiency() == null) {
            return null;
        }
        return f.getActualEfficiency().subtract(f.getPredictedScore());
    }

    private BigDecimal calculateAveragePredictionError(List<WorkerAllocationFeedback> feedbacks) {
        List<BigDecimal> errors = feedbacks.stream()
                .map(this::calculateSinglePredictionError)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        return calculateMean(errors);
    }

    private BigDecimal calculateMean(List<BigDecimal> values) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateStdDev(List<BigDecimal> values, BigDecimal mean) {
        if (values.size() < 2) {
            return BigDecimal.ZERO;
        }

        double variance = values.stream()
                .mapToDouble(v -> Math.pow(v.subtract(mean).doubleValue(), 2))
                .sum() / values.size();

        return BigDecimal.valueOf(Math.sqrt(variance)).setScale(4, RoundingMode.HALF_UP);
    }

    private int countActiveWorkers(List<WorkerAllocationFeedback> feedbacks) {
        return (int) feedbacks.stream()
                .map(WorkerAllocationFeedback::getWorkerId)
                .filter(Objects::nonNull)
                .distinct()
                .count();
    }

    private int countCompletedTasks(List<WorkerAllocationFeedback> feedbacks) {
        return (int) feedbacks.stream()
                .filter(f -> f.getCompletedAt() != null)
                .count();
    }

    private BigDecimal calculateAcceptanceRate(List<WorkerAllocationFeedback> feedbacks) {
        if (feedbacks.isEmpty()) {
            return BigDecimal.ONE;
        }

        long completed = feedbacks.stream()
                .filter(f -> f.getCompletedAt() != null)
                .count();

        return BigDecimal.valueOf((double) completed / feedbacks.size())
                .setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateCompletionRate(String factoryId, LocalDateTime startTime, LocalDateTime endTime) {
        // 使用已完成的任务数除以总分配数
        List<WorkerAllocationFeedback> allFeedbacks = feedbackRepository
                .findByFactoryIdAndCompletedAtBetween(factoryId, startTime, endTime);

        if (allFeedbacks.isEmpty()) {
            return BigDecimal.ONE;
        }

        long completed = allFeedbacks.stream()
                .filter(f -> f.getCompletedAt() != null && f.getActualEfficiency() != null)
                .count();

        return BigDecimal.valueOf((double) completed / allFeedbacks.size())
                .setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateFactoryDiversityScore(String factoryId, Set<Long> workerIds) {
        if (workerIds.isEmpty()) {
            return BigDecimal.ZERO;
        }

        double totalScore = 0.0;
        for (Long workerId : workerIds) {
            TaskDiversityService.TaskDiversityAnalysis analysis =
                    taskDiversityService.getWorkerTaskDiversityAnalysis(factoryId, workerId, DIVERSITY_ANALYSIS_DAYS);
            totalScore += analysis.getDiversityScore();
        }

        return BigDecimal.valueOf(totalScore / workerIds.size())
                .setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateFactoryDiversityScore(List<TaskDiversityService.TaskDiversityAnalysis> analyses) {
        if (analyses.isEmpty()) {
            return BigDecimal.ZERO;
        }

        double totalScore = analyses.stream()
                .mapToDouble(TaskDiversityService.TaskDiversityAnalysis::getDiversityScore)
                .sum();

        return BigDecimal.valueOf(totalScore / analyses.size())
                .setScale(4, RoundingMode.HALF_UP);
    }

    private Map<ProcessingStageType, StageAccuracy> calculateAccuracyByStage(List<WorkerAllocationFeedback> feedbacks) {
        Map<ProcessingStageType, List<WorkerAllocationFeedback>> byStage = feedbacks.stream()
                .filter(f -> f.getStageType() != null)
                .collect(Collectors.groupingBy(WorkerAllocationFeedback::getStageType));

        Map<ProcessingStageType, StageAccuracy> result = new HashMap<>();

        for (Map.Entry<ProcessingStageType, List<WorkerAllocationFeedback>> entry : byStage.entrySet()) {
            ProcessingStageType stageType = entry.getKey();
            List<WorkerAllocationFeedback> stageFeedbacks = entry.getValue();

            result.put(stageType, StageAccuracy.builder()
                    .stageType(stageType)
                    .accuracy(calculatePredictionAccuracy(stageFeedbacks))
                    .sampleCount((long) stageFeedbacks.size())
                    .avgEfficiency(calculateAverageEfficiency(stageFeedbacks))
                    .build());
        }

        return result;
    }

    private List<AccuracyTrend> calculateAccuracyTrend(List<WorkerAllocationFeedback> feedbacks, int days) {
        Map<LocalDate, List<WorkerAllocationFeedback>> byDate = feedbacks.stream()
                .filter(f -> f.getCompletedAt() != null)
                .collect(Collectors.groupingBy(f -> f.getCompletedAt().toLocalDate()));

        List<AccuracyTrend> trends = new ArrayList<>();

        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            List<WorkerAllocationFeedback> dailyFeedbacks = byDate.getOrDefault(date, Collections.emptyList());

            trends.add(AccuracyTrend.builder()
                    .date(date)
                    .accuracy(calculatePredictionAccuracy(dailyFeedbacks))
                    .sampleCount(dailyFeedbacks.size())
                    .build());
        }

        return trends;
    }

    private Map<String, ProcessCoverage> calculateProcessCoverage(List<WorkerAllocationFeedback> feedbacks) {
        // 优先使用 stageType，如果为空则使用 taskType
        Map<String, List<WorkerAllocationFeedback>> byProcess = feedbacks.stream()
                .filter(f -> f.getStageType() != null || f.getTaskType() != null)
                .collect(Collectors.groupingBy(f ->
                    f.getStageType() != null ? f.getStageType().name() : f.getTaskType()));

        Map<String, ProcessCoverage> result = new HashMap<>();

        for (Map.Entry<String, List<WorkerAllocationFeedback>> entry : byProcess.entrySet()) {
            String processType = entry.getKey();
            List<WorkerAllocationFeedback> processFeedbacks = entry.getValue();

            int skilledWorkers = (int) processFeedbacks.stream()
                    .filter(f -> f.getActualEfficiency() != null &&
                            f.getActualEfficiency().compareTo(new BigDecimal("0.7")) >= 0)
                    .map(WorkerAllocationFeedback::getWorkerId)
                    .distinct()
                    .count();

            result.put(processType, ProcessCoverage.builder()
                    .processType(processType)
                    .skilledWorkers(skilledWorkers)
                    .totalAllocations(processFeedbacks.size())
                    .avgEfficiency(calculateAverageEfficiency(processFeedbacks))
                    .build());
        }

        return result;
    }

    private BigDecimal calculateSkillCoverage(Map<String, ProcessCoverage> coverage, int totalWorkers) {
        if (totalWorkers == 0 || coverage.isEmpty()) {
            return BigDecimal.ZERO;
        }

        // 计算每个工序被多少比例的工人覆盖的平均值
        double totalCoverage = coverage.values().stream()
                .mapToDouble(c -> (double) c.getSkilledWorkers() / totalWorkers)
                .sum();

        return BigDecimal.valueOf(totalCoverage / coverage.size())
                .setScale(4, RoundingMode.HALF_UP);
    }

    private Map<String, Integer> calculateDiversityDistribution(
            List<TaskDiversityService.TaskDiversityAnalysis> analyses) {

        Map<String, Integer> distribution = new LinkedHashMap<>();
        distribution.put("0.0-0.2", 0);
        distribution.put("0.2-0.4", 0);
        distribution.put("0.4-0.6", 0);
        distribution.put("0.6-0.8", 0);
        distribution.put("0.8-1.0", 0);

        for (TaskDiversityService.TaskDiversityAnalysis analysis : analyses) {
            double score = analysis.getDiversityScore();
            String bucket;
            if (score < 0.2) {
                bucket = "0.0-0.2";
            } else if (score < 0.4) {
                bucket = "0.2-0.4";
            } else if (score < 0.6) {
                bucket = "0.4-0.6";
            } else if (score < 0.8) {
                bucket = "0.6-0.8";
            } else {
                bucket = "0.8-1.0";
            }
            distribution.merge(bucket, 1, Integer::sum);
        }

        return distribution;
    }
}
