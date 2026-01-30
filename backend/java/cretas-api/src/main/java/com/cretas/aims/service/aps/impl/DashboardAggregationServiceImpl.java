package com.cretas.aims.service.aps.impl;

import com.cretas.aims.dto.aps.GlobalDashboard;
import com.cretas.aims.dto.aps.GlobalDashboard.*;
import com.cretas.aims.dto.aps.RescheduleCheckResult;
import com.cretas.aims.entity.LineSchedule;
import com.cretas.aims.entity.ProductionLine;
import com.cretas.aims.repository.LineScheduleRepository;
import com.cretas.aims.repository.ProductionLineRepository;
import com.cretas.aims.service.aps.APSAdaptiveSchedulingService;
import com.cretas.aims.service.aps.DashboardAggregationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * APS 仪表盘数据聚合服务实现
 *
 * @author Cretas APS
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardAggregationServiceImpl implements DashboardAggregationService {

    private final LineScheduleRepository lineScheduleRepository;
    private final ProductionLineRepository productionLineRepository;
    private final APSAdaptiveSchedulingService adaptiveService;

    /**
     * 完成概率阈值定义
     */
    private static final double PROB_ON_TRACK = 0.8;
    private static final double PROB_AT_RISK = 0.5;

    @Override
    public GlobalDashboard generateDashboard(String factoryId) {
        log.debug("Generating dashboard for factory: {}", factoryId);

        GlobalDashboard dashboard = new GlobalDashboard();
        dashboard.setUpdateTime(LocalDateTime.now());

        // 1. 任务汇总
        dashboard.setSummary(aggregateTaskSummary(factoryId));

        // 2. 性能指标
        dashboard.setMetrics(aggregatePerformanceMetrics(factoryId));

        // 3. 产线状态
        dashboard.setLines(aggregateLinesSummary(factoryId));

        // 4. 高风险任务 (Top 5)
        dashboard.setTopRisks(getTopRiskTasks(factoryId, 5));

        // 5. 重排建议
        RescheduleRecommendation recommendation = buildRescheduleRecommendation(factoryId);
        dashboard.setRescheduleRecommendation(recommendation);

        return dashboard;
    }

    @Override
    public List<RiskTask> getTopRiskTasks(String factoryId, int limit) {
        // 获取所有活跃任务 (SCHEDULED/IN_PROGRESS)
        List<LineSchedule> activeTasks = getActiveTasksByFactory(factoryId);

        return activeTasks.stream()
                .filter(t -> t.getPredictedCompletionProb() != null && t.getPredictedCompletionProb().doubleValue() < PROB_ON_TRACK)
                .sorted(Comparator.comparing(t -> t.getPredictedCompletionProb().doubleValue()))
                .limit(limit)
                .map(this::toRiskTask)
                .collect(Collectors.toList());
    }

    @Override
    public TaskSummary aggregateTaskSummary(String factoryId) {
        TaskSummary summary = new TaskSummary();

        List<LineSchedule> activeTasks = getActiveTasksByFactory(factoryId);

        summary.setTotalActiveTasks(activeTasks.size());
        summary.setOnTrackTasks((int) activeTasks.stream()
                .filter(t -> getProbability(t) >= PROB_ON_TRACK)
                .count());
        summary.setAtRiskTasks((int) activeTasks.stream()
                .filter(t -> getProbability(t) >= PROB_AT_RISK && getProbability(t) < PROB_ON_TRACK)
                .count());
        summary.setDelayedTasks((int) activeTasks.stream()
                .filter(t -> getProbability(t) < PROB_AT_RISK)
                .count());

        return summary;
    }

    @Override
    public PerformanceMetrics aggregatePerformanceMetrics(String factoryId) {
        PerformanceMetrics metrics = new PerformanceMetrics();

        List<LineSchedule> activeTasks = getActiveTasksByFactory(factoryId);
        List<LineSchedule> completedTasks = getCompletedTasksByFactory(factoryId);

        // 计算平均完成概率
        metrics.setAverageCompletionProbability(activeTasks.stream()
                .mapToDouble(this::getProbability)
                .average()
                .orElse(0.0));

        // 计算平均效率
        metrics.setAverageEfficiency(activeTasks.stream()
                .filter(t -> t.getActualEfficiency() != null)
                .mapToDouble(t -> t.getActualEfficiency().doubleValue())
                .average()
                .orElse(0.0));

        // 计算总体准时率 (基于已完成任务)
        if (!completedTasks.isEmpty()) {
            long onTimeTasks = completedTasks.stream()
                    .filter(t -> t.getActualEndTime() != null && t.getPlannedEndTime() != null
                            && !t.getActualEndTime().isAfter(t.getPlannedEndTime()))
                    .count();
            metrics.setOverallOnTimeRate((double) onTimeTasks / completedTasks.size());
        } else {
            metrics.setOverallOnTimeRate(0.0);
        }

        // 计算换型时间占比 (简化计算)
        metrics.setChangeoverTimeRatio(calculateChangeoverTimeRatio(factoryId));

        // 计算负载均衡系数 (CV = 标准差/均值)
        metrics.setLoadBalanceCV(calculateLoadBalanceCV(factoryId));

        return metrics;
    }

    @Override
    public LinesSummary aggregateLinesSummary(String factoryId) {
        LinesSummary lines = new LinesSummary();

        List<ProductionLine> allLines = productionLineRepository.findByFactoryIdAndDeletedAtIsNull(factoryId);

        lines.setTotal(allLines.size());
        lines.setActive((int) allLines.stream()
                .filter(l -> l.getStatus() == ProductionLine.LineStatus.active)
                .count());
        lines.setIdle((int) allLines.stream()
                .filter(l -> l.getStatus() == ProductionLine.LineStatus.inactive)
                .count());
        lines.setMaintenance((int) allLines.stream()
                .filter(l -> l.getStatus() == ProductionLine.LineStatus.maintenance)
                .count());

        // 故障产线 - 暂时没有 fault 状态，使用 maintenance 统计
        lines.setFault(0);

        return lines;
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 获取工厂的活跃任务 (pending 和 in_progress)
     */
    private List<LineSchedule> getActiveTasksByFactory(String factoryId) {
        List<LineSchedule> pendingTasks = lineScheduleRepository.findByFactoryIdAndStatus(
                factoryId, LineSchedule.ScheduleStatus.pending);
        List<LineSchedule> inProgressTasks = lineScheduleRepository.findByFactoryIdAndStatus(
                factoryId, LineSchedule.ScheduleStatus.in_progress);

        List<LineSchedule> activeTasks = new ArrayList<>();
        activeTasks.addAll(pendingTasks);
        activeTasks.addAll(inProgressTasks);
        return activeTasks;
    }

    /**
     * 获取工厂的已完成任务
     */
    private List<LineSchedule> getCompletedTasksByFactory(String factoryId) {
        return lineScheduleRepository.findByFactoryIdAndStatus(
                factoryId, LineSchedule.ScheduleStatus.completed);
    }

    /**
     * 获取任务的完成概率
     */
    private double getProbability(LineSchedule task) {
        return task.getPredictedCompletionProb() != null
                ? task.getPredictedCompletionProb().doubleValue()
                : 0.8; // 默认值
    }

    /**
     * 转换为风险任务 DTO
     */
    private RiskTask toRiskTask(LineSchedule task) {
        RiskTask risk = new RiskTask();
        risk.setTaskId(task.getId());
        risk.setTaskNo(task.getId()); // 使用 ID 作为任务编号

        // 获取产线名称
        productionLineRepository.findById(task.getProductionLineId())
                .ifPresent(line -> risk.setLineName(line.getName()));

        risk.setCompletionProbability(getProbability(task));
        risk.setRiskLevel(determineRiskLevel(getProbability(task)));
        risk.setDeadline(task.getPlannedEndTime());

        // 计算预计延迟
        if (task.getPredictedEnd() != null && task.getPlannedEndTime() != null) {
            long delayMinutes = Duration.between(task.getPlannedEndTime(), task.getPredictedEnd()).toMinutes();
            risk.setEstimatedDelayMinutes(Math.max(0, (int) delayMinutes));
        }

        // 生成建议动作
        risk.setSuggestedActions(generateSuggestedActions(task));

        return risk;
    }

    /**
     * 确定风险等级
     */
    private String determineRiskLevel(double probability) {
        if (probability >= PROB_ON_TRACK) return "low";
        if (probability >= 0.6) return "medium";
        if (probability >= 0.4) return "high";
        return "critical";
    }

    /**
     * 生成建议动作
     */
    private List<String> generateSuggestedActions(LineSchedule task) {
        List<String> actions = new ArrayList<>();
        double prob = getProbability(task);

        if (prob < 0.5) {
            actions.add("考虑重新排产");
            actions.add("检查是否可转移到其他产线");
        }
        if (prob < 0.7) {
            actions.add("增派工人");
            actions.add("延长工作时间");
        }
        if (task.getActualEfficiency() != null && task.getPlanEfficiency() != null
                && task.getActualEfficiency().compareTo(task.getPlanEfficiency().multiply(BigDecimal.valueOf(0.8))) < 0) {
            actions.add("检查设备状态");
        }

        return actions;
    }

    /**
     * 构建重排建议
     */
    private RescheduleRecommendation buildRescheduleRecommendation(String factoryId) {
        RescheduleRecommendation recommendation = new RescheduleRecommendation();

        // 使用现有的 checkRescheduleNeed 方法
        APSAdaptiveSchedulingService.RescheduleRecommendation serviceRecommendation =
                adaptiveService.checkRescheduleNeed();

        recommendation.setNeedReschedule(serviceRecommendation.isNeedReschedule());
        recommendation.setUrgencyLevel(serviceRecommendation.getUrgencyLevel());
        recommendation.setReasons(serviceRecommendation.getReasons());
        recommendation.setAffectedTaskIds(serviceRecommendation.getAffectedTaskIds());
        recommendation.setExpectedImprovement(serviceRecommendation.getExpectedOnTimeRateImprovement());

        return recommendation;
    }

    /**
     * 计算换型时间占比 (简化实现)
     */
    private double calculateChangeoverTimeRatio(String factoryId) {
        // 简化实现: 返回估算值
        // 实际应该基于换型记录计算
        return 0.10; // 假设换型时间占 10%
    }

    /**
     * 计算负载均衡系数 (CV = 标准差/均值)
     */
    private double calculateLoadBalanceCV(String factoryId) {
        List<ProductionLine> activeLines = productionLineRepository.findByFactoryIdAndStatusAndDeletedAtIsNull(
                factoryId, ProductionLine.LineStatus.active);

        if (activeLines.size() < 2) {
            return 0.0; // 产线数太少，无法计算
        }

        // 统计每条产线的任务数
        Map<String, Long> lineTaskCounts = new HashMap<>();
        for (ProductionLine line : activeLines) {
            List<LineSchedule> pendingTasks = lineScheduleRepository.findByProductionLineIdAndStatus(
                    line.getId(), LineSchedule.ScheduleStatus.pending);
            List<LineSchedule> inProgressTasks = lineScheduleRepository.findByProductionLineIdAndStatus(
                    line.getId(), LineSchedule.ScheduleStatus.in_progress);
            lineTaskCounts.put(line.getId(), (long) (pendingTasks.size() + inProgressTasks.size()));
        }

        // 计算 CV
        double[] counts = lineTaskCounts.values().stream().mapToDouble(Long::doubleValue).toArray();
        double mean = Arrays.stream(counts).average().orElse(0);
        if (mean == 0) return 0;

        double variance = Arrays.stream(counts)
                .map(c -> Math.pow(c - mean, 2))
                .average()
                .orElse(0);
        double stdDev = Math.sqrt(variance);

        return stdDev / mean;
    }
}
