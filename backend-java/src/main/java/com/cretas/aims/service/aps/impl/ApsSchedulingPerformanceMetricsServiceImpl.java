package com.cretas.aims.service.aps.impl;

import com.cretas.aims.entity.LineSchedule;
import com.cretas.aims.entity.ProductionLine;
import com.cretas.aims.entity.SchedulingPlan;
import com.cretas.aims.repository.LineScheduleRepository;
import com.cretas.aims.repository.ProductionLineRepository;
import com.cretas.aims.repository.SchedulingPlanRepository;
import com.cretas.aims.service.aps.ApsSchedulingPerformanceMetricsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * APS排产性能指标计算服务实现
 *
 * 提供策略权重自适应调整所需的各类性能指标计算。
 * 基于产线排程数据和产线状态进行指标计算。
 *
 * @author Cretas APS Team
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApsSchedulingPerformanceMetricsServiceImpl implements ApsSchedulingPerformanceMetricsService {

    private final LineScheduleRepository lineScheduleRepository;
    private final ProductionLineRepository productionLineRepository;
    private final SchedulingPlanRepository schedulingPlanRepository;

    @Override
    @Transactional(readOnly = true)
    public double calculateOnTimeRate(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.debug("计算准时完成率: factoryId={}, {} - {}", factoryId, startDate, endDate);

        List<SchedulingPlan> plans = schedulingPlanRepository
                .findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (plans.isEmpty()) {
            log.debug("无排产计划数据，返回默认准时率 0.85");
            return 0.85; // 无数据时返回目标值
        }

        int totalCompleted = 0;
        int onTimeCompleted = 0;

        for (SchedulingPlan plan : plans) {
            List<LineSchedule> schedules = lineScheduleRepository.findByPlanId(plan.getId());
            for (LineSchedule schedule : schedules) {
                if (schedule.getStatus() == LineSchedule.ScheduleStatus.completed) {
                    totalCompleted++;

                    // 判断是否准时完成
                    if (schedule.getActualEndTime() != null && schedule.getPlannedEndTime() != null) {
                        if (!schedule.getActualEndTime().isAfter(schedule.getPlannedEndTime())) {
                            onTimeCompleted++;
                        }
                    } else if (schedule.getActualEndTime() == null) {
                        // 如果没有实际结束时间但状态是完成，认为准时
                        onTimeCompleted++;
                    }
                }
            }
        }

        if (totalCompleted == 0) {
            log.debug("无已完成任务，返回默认准时率 0.85");
            return 0.85;
        }

        double rate = (double) onTimeCompleted / totalCompleted;
        log.info("工厂 {} 准时完成率: {}/{} = {}", factoryId, onTimeCompleted, totalCompleted, rate);
        return rate;
    }

    @Override
    @Transactional(readOnly = true)
    public double calculateChangeoverRatio(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.debug("计算换型时间占比: factoryId={}, {} - {}", factoryId, startDate, endDate);

        List<SchedulingPlan> plans = schedulingPlanRepository
                .findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (plans.isEmpty()) {
            log.debug("无排产计划数据，返回默认换型占比 0.10");
            return 0.10; // 无数据时返回目标值附近
        }

        long totalProductionMinutes = 0;
        long totalChangeoverMinutes = 0;

        for (SchedulingPlan plan : plans) {
            List<LineSchedule> schedules = lineScheduleRepository.findByPlanIdOrderBySequenceOrder(plan.getId());

            // 按产线分组计算换型时间
            Map<String, List<LineSchedule>> byLine = schedules.stream()
                    .collect(Collectors.groupingBy(LineSchedule::getProductionLineId));

            for (Map.Entry<String, List<LineSchedule>> entry : byLine.entrySet()) {
                List<LineSchedule> lineSchedules = entry.getValue();

                for (int i = 0; i < lineSchedules.size(); i++) {
                    LineSchedule schedule = lineSchedules.get(i);

                    // 计算生产时间
                    if (schedule.getPlannedStartTime() != null && schedule.getPlannedEndTime() != null) {
                        totalProductionMinutes += ChronoUnit.MINUTES.between(
                                schedule.getPlannedStartTime(), schedule.getPlannedEndTime());
                    }

                    // 计算换型时间 (与前一个任务之间的间隔)
                    if (i > 0) {
                        LineSchedule prevSchedule = lineSchedules.get(i - 1);
                        if (prevSchedule.getPlannedEndTime() != null && schedule.getPlannedStartTime() != null) {
                            long gapMinutes = ChronoUnit.MINUTES.between(
                                    prevSchedule.getPlannedEndTime(), schedule.getPlannedStartTime());
                            // 假设间隔超过5分钟小于2小时的是换型时间
                            if (gapMinutes > 5 && gapMinutes < 120) {
                                totalChangeoverMinutes += gapMinutes;
                            }
                        }
                    }
                }
            }
        }

        if (totalProductionMinutes == 0) {
            log.debug("无生产时间数据，返回默认换型占比 0.10");
            return 0.10;
        }

        double ratio = (double) totalChangeoverMinutes / (totalProductionMinutes + totalChangeoverMinutes);
        log.info("工厂 {} 换型时间占比: {}min / {}min = {}", factoryId, totalChangeoverMinutes, totalProductionMinutes, ratio);
        return ratio;
    }

    @Override
    @Transactional(readOnly = true)
    public double calculateLoadBalanceCV(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.debug("计算产线负载均衡度: factoryId={}, {} - {}", factoryId, startDate, endDate);

        List<SchedulingPlan> plans = schedulingPlanRepository
                .findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (plans.isEmpty()) {
            log.debug("无排产计划数据，返回默认CV 0.20");
            return 0.20; // 无数据时返回目标值附近
        }

        // 统计每条产线的工作时间
        Map<String, Long> lineWorkMinutes = new HashMap<>();

        for (SchedulingPlan plan : plans) {
            List<LineSchedule> schedules = lineScheduleRepository.findByPlanId(plan.getId());
            for (LineSchedule schedule : schedules) {
                if (schedule.getPlannedStartTime() != null && schedule.getPlannedEndTime() != null) {
                    long minutes = ChronoUnit.MINUTES.between(
                            schedule.getPlannedStartTime(), schedule.getPlannedEndTime());
                    lineWorkMinutes.merge(schedule.getProductionLineId(), minutes, Long::sum);
                }
            }
        }

        if (lineWorkMinutes.isEmpty() || lineWorkMinutes.size() < 2) {
            log.debug("产线数据不足，返回默认CV 0.20");
            return 0.20;
        }

        // 计算变异系数 (CV = std / mean)
        double[] values = lineWorkMinutes.values().stream().mapToDouble(Long::doubleValue).toArray();
        double mean = calculateMean(values);
        double stdDev = calculateStdDev(values, mean);

        if (mean == 0) {
            return 0.20;
        }

        double cv = stdDev / mean;
        log.info("工厂 {} 产线负载均衡度CV: {} (mean={}, std={})", factoryId, cv, mean, stdDev);
        return cv;
    }

    @Override
    @Transactional(readOnly = true)
    public double calculateThroughputRatio(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.debug("计算吞吐量比率: factoryId={}, {} - {}", factoryId, startDate, endDate);

        List<SchedulingPlan> plans = schedulingPlanRepository
                .findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (plans.isEmpty()) {
            log.debug("无排产计划数据，返回默认吞吐量比率 1.0");
            return 1.0;
        }

        long totalPlannedQuantity = 0;
        long totalActualQuantity = 0;

        for (SchedulingPlan plan : plans) {
            List<LineSchedule> schedules = lineScheduleRepository.findByPlanId(plan.getId());
            for (LineSchedule schedule : schedules) {
                if (schedule.getPlannedQuantity() != null) {
                    totalPlannedQuantity += schedule.getPlannedQuantity();
                }
                if (schedule.getCompletedQuantity() != null) {
                    totalActualQuantity += schedule.getCompletedQuantity();
                }
            }
        }

        if (totalPlannedQuantity == 0) {
            log.debug("无计划产量数据，返回默认吞吐量比率 1.0");
            return 1.0;
        }

        double ratio = (double) totalActualQuantity / totalPlannedQuantity;
        log.info("工厂 {} 吞吐量比率: {}/{} = {}", factoryId, totalActualQuantity, totalPlannedQuantity, ratio);
        return ratio;
    }

    @Override
    @Transactional(readOnly = true)
    public double calculateMaterialWaitRatio(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.debug("计算物料等待时间占比: factoryId={}, {} - {}", factoryId, startDate, endDate);

        List<SchedulingPlan> plans = schedulingPlanRepository
                .findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (plans.isEmpty()) {
            log.debug("无排产计划数据，返回默认物料等待占比 0.08");
            return 0.08; // 无数据时返回目标值附近
        }

        long totalProductionMinutes = 0;
        long totalWaitMinutes = 0;

        for (SchedulingPlan plan : plans) {
            List<LineSchedule> schedules = lineScheduleRepository.findByPlanId(plan.getId());
            for (LineSchedule schedule : schedules) {
                // 计算生产时间
                if (schedule.getPlannedStartTime() != null && schedule.getPlannedEndTime() != null) {
                    totalProductionMinutes += ChronoUnit.MINUTES.between(
                            schedule.getPlannedStartTime(), schedule.getPlannedEndTime());
                }

                // 计算等待时间 (实际开始时间 - 计划开始时间的延迟)
                if (schedule.getActualStartTime() != null && schedule.getPlannedStartTime() != null) {
                    long delayMinutes = ChronoUnit.MINUTES.between(
                            schedule.getPlannedStartTime(), schedule.getActualStartTime());
                    if (delayMinutes > 0) {
                        // 假设延迟中有50%是物料等待造成的
                        totalWaitMinutes += delayMinutes / 2;
                    }
                }

                // 如果有延迟原因包含"物料"，增加等待时间
                if (schedule.getDelayReason() != null && schedule.getDelayReason().contains("物料")) {
                    totalWaitMinutes += 30; // 假设额外30分钟
                }
            }
        }

        if (totalProductionMinutes == 0) {
            log.debug("无生产时间数据，返回默认物料等待占比 0.08");
            return 0.08;
        }

        double ratio = (double) totalWaitMinutes / totalProductionMinutes;
        log.info("工厂 {} 物料等待时间占比: {}min / {}min = {}", factoryId, totalWaitMinutes, totalProductionMinutes, ratio);
        return Math.min(ratio, 1.0); // 限制在 [0, 1] 范围内
    }

    @Override
    @Transactional(readOnly = true)
    public double calculateUrgentOnTimeRate(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.debug("计算紧急订单准时率: factoryId={}, {} - {}", factoryId, startDate, endDate);

        List<SchedulingPlan> plans = schedulingPlanRepository
                .findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (plans.isEmpty()) {
            log.debug("无排产计划数据，返回默认紧急订单准时率 0.95");
            return 0.95;
        }

        int totalUrgent = 0;
        int onTimeUrgent = 0;

        for (SchedulingPlan plan : plans) {
            List<LineSchedule> schedules = lineScheduleRepository.findByPlanId(plan.getId());
            for (LineSchedule schedule : schedules) {
                // 判断是否为紧急任务 (风险等级为high或critical，或者已被调整过)
                boolean isUrgent = "high".equals(schedule.getRiskLevel())
                        || "critical".equals(schedule.getRiskLevel())
                        || (schedule.getAdjustmentCount() != null && schedule.getAdjustmentCount() > 0);

                if (isUrgent && schedule.getStatus() == LineSchedule.ScheduleStatus.completed) {
                    totalUrgent++;

                    if (schedule.getActualEndTime() != null && schedule.getPlannedEndTime() != null) {
                        if (!schedule.getActualEndTime().isAfter(schedule.getPlannedEndTime())) {
                            onTimeUrgent++;
                        }
                    } else if (schedule.getActualEndTime() == null) {
                        onTimeUrgent++;
                    }
                }
            }
        }

        if (totalUrgent == 0) {
            log.debug("无紧急任务，返回默认紧急订单准时率 0.95");
            return 0.95;
        }

        double rate = (double) onTimeUrgent / totalUrgent;
        log.info("工厂 {} 紧急订单准时率: {}/{} = {}", factoryId, onTimeUrgent, totalUrgent, rate);
        return rate;
    }

    @Override
    @Transactional(readOnly = true)
    public PerformanceReport getPerformanceReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("生成性能报告: factoryId={}, {} - {}", factoryId, startDate, endDate);

        PerformanceReport report = new PerformanceReport();
        report.setFactoryId(factoryId);
        report.setStartDate(startDate);
        report.setEndDate(endDate);

        // 计算各项指标
        report.setOnTimeRate(calculateOnTimeRate(factoryId, startDate, endDate));
        report.setChangeoverRatio(calculateChangeoverRatio(factoryId, startDate, endDate));
        report.setLoadBalanceCV(calculateLoadBalanceCV(factoryId, startDate, endDate));
        report.setThroughputRatio(calculateThroughputRatio(factoryId, startDate, endDate));
        report.setMaterialWaitRatio(calculateMaterialWaitRatio(factoryId, startDate, endDate));
        report.setUrgentOnTimeRate(calculateUrgentOnTimeRate(factoryId, startDate, endDate));

        // 统计任务数
        List<SchedulingPlan> plans = schedulingPlanRepository
                .findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        int totalTasks = 0;
        int completedTasks = 0;
        int urgentTasks = 0;

        for (SchedulingPlan plan : plans) {
            List<LineSchedule> schedules = lineScheduleRepository.findByPlanId(plan.getId());
            totalTasks += schedules.size();
            completedTasks += (int) schedules.stream()
                    .filter(s -> s.getStatus() == LineSchedule.ScheduleStatus.completed)
                    .count();
            urgentTasks += (int) schedules.stream()
                    .filter(s -> "high".equals(s.getRiskLevel()) || "critical".equals(s.getRiskLevel()))
                    .count();
        }

        report.setTotalTasks(totalTasks);
        report.setCompletedTasks(completedTasks);
        report.setUrgentTasks(urgentTasks);

        return report;
    }

    // ==================== 私有辅助方法 ====================

    private double calculateMean(double[] values) {
        if (values.length == 0) {
            return 0;
        }
        double sum = 0;
        for (double v : values) {
            sum += v;
        }
        return sum / values.length;
    }

    private double calculateStdDev(double[] values, double mean) {
        if (values.length < 2) {
            return 0;
        }
        double sumSquaredDiff = 0;
        for (double v : values) {
            sumSquaredDiff += Math.pow(v - mean, 2);
        }
        return Math.sqrt(sumSquaredDiff / values.length);
    }
}
