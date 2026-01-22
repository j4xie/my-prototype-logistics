package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.scheduling.LineSchedule;
import com.cretas.aims.entity.scheduling.SchedulingPlan;
import com.cretas.aims.repository.scheduling.LineScheduleRepository;
import com.cretas.aims.repository.scheduling.SchedulingPlanRepository;
import com.cretas.aims.repository.scheduling.SchedulingAlertRepository;
import com.cretas.aims.service.scheduling.SchedulingDashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 调度仪表盘服务实现
 *
 * 负责仪表盘数据聚合
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingDashboardServiceImpl implements SchedulingDashboardService {

    private final SchedulingPlanRepository planRepository;
    private final LineScheduleRepository scheduleRepository;
    private final SchedulingAlertRepository alertRepository;

    @Override
    public SchedulingDashboardDTO getDashboard(String factoryId, LocalDate date) {
        log.debug("Building dashboard for factory {} on date {}", factoryId, date);

        // 获取当天的排产计划
        List<SchedulingPlan> plans = planRepository
                .findByFactoryIdAndPlanDateAndDeletedAtIsNull(factoryId, date);

        // 获取当天的排程
        List<LineSchedule> schedules = scheduleRepository
                .findByFactoryIdAndScheduleDateAndDeletedAtIsNull(factoryId, date);

        // 统计数据
        SchedulingDashboardDTO.SchedulingSummary summary = buildSummary(plans, schedules);

        // 产线状态
        Map<String, LineStatusDTO> lineStatuses = buildLineStatuses(factoryId, schedules);

        // 未解决告警数
        long unresolvedAlerts = alertRepository.countByFactoryIdAndResolvedAtIsNullAndDeletedAtIsNull(factoryId);

        return SchedulingDashboardDTO.builder()
                .factoryId(factoryId)
                .date(date)
                .summary(summary)
                .lineStatuses(lineStatuses)
                .unresolvedAlertCount(unresolvedAlerts)
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    @Override
    public SchedulingDashboardDTO getRealtimeMonitor(String factoryId, String planId) {
        log.debug("Building realtime monitor for factory {} plan {}", factoryId, planId);

        SchedulingPlan plan = planRepository
                .findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, planId)
                .orElseThrow(() -> new IllegalArgumentException("计划不存在: " + planId));

        List<LineSchedule> schedules = scheduleRepository
                .findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, planId);

        // 构建实时监控数据
        SchedulingDashboardDTO.SchedulingSummary summary = buildRealtimeSummary(schedules);
        Map<String, LineStatusDTO> lineStatuses = buildRealtimeLineStatuses(schedules);

        return SchedulingDashboardDTO.builder()
                .factoryId(factoryId)
                .date(plan.getPlanDate())
                .planId(planId)
                .planNumber(plan.getPlanNumber())
                .summary(summary)
                .lineStatuses(lineStatuses)
                .isRealtime(true)
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    /**
     * 构建汇总数据
     */
    private SchedulingDashboardDTO.SchedulingSummary buildSummary(List<SchedulingPlan> plans, List<LineSchedule> schedules) {
        int totalPlans = plans.size();
        int confirmedPlans = (int) plans.stream()
                .filter(p -> p.getStatus() == SchedulingPlan.PlanStatus.confirmed ||
                        p.getStatus() == SchedulingPlan.PlanStatus.in_progress)
                .count();
        int completedPlans = (int) plans.stream()
                .filter(p -> p.getStatus() == SchedulingPlan.PlanStatus.completed)
                .count();

        int totalSchedules = schedules.size();
        int completedSchedules = (int) schedules.stream()
                .filter(s -> s.getStatus() == LineSchedule.ScheduleStatus.completed)
                .count();
        int inProgressSchedules = (int) schedules.stream()
                .filter(s -> s.getStatus() == LineSchedule.ScheduleStatus.in_progress)
                .count();
        int delayedSchedules = (int) schedules.stream()
                .filter(s -> s.getDelayMinutes() != null && s.getDelayMinutes() > 0)
                .count();

        // 计算平均效率
        BigDecimal avgEfficiency = schedules.stream()
                .filter(s -> s.getActualEfficiency() != null)
                .map(LineSchedule::getActualEfficiency)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long efficiencyCount = schedules.stream()
                .filter(s -> s.getActualEfficiency() != null)
                .count();

        if (efficiencyCount > 0) {
            avgEfficiency = avgEfficiency.divide(BigDecimal.valueOf(efficiencyCount), 2, RoundingMode.HALF_UP);
        } else {
            avgEfficiency = BigDecimal.valueOf(0.85);
        }

        // 计算整体完成率
        int totalPlanned = schedules.stream()
                .filter(s -> s.getPlannedQuantity() != null)
                .mapToInt(LineSchedule::getPlannedQuantity)
                .sum();
        int totalCompleted = schedules.stream()
                .filter(s -> s.getCompletedQuantity() != null)
                .mapToInt(LineSchedule::getCompletedQuantity)
                .sum();

        BigDecimal completionRate = totalPlanned > 0 ?
                BigDecimal.valueOf(totalCompleted).divide(BigDecimal.valueOf(totalPlanned), 4, RoundingMode.HALF_UP) :
                BigDecimal.ZERO;

        return SchedulingDashboardDTO.SchedulingSummary.builder()
                .totalPlans(totalPlans)
                .confirmedPlans(confirmedPlans)
                .completedPlans(completedPlans)
                .totalSchedules(totalSchedules)
                .completedSchedules(completedSchedules)
                .inProgressSchedules(inProgressSchedules)
                .delayedSchedules(delayedSchedules)
                .averageEfficiency(avgEfficiency)
                .completionRate(completionRate)
                .build();
    }

    /**
     * 构建产线状态
     */
    private Map<String, LineStatusDTO> buildLineStatuses(String factoryId, List<LineSchedule> schedules) {
        Map<String, LineStatusDTO> statuses = new HashMap<>();

        // 按产线分组
        Map<String, List<LineSchedule>> byLine = schedules.stream()
                .filter(s -> s.getLineId() != null)
                .collect(Collectors.groupingBy(LineSchedule::getLineId));

        for (Map.Entry<String, List<LineSchedule>> entry : byLine.entrySet()) {
            String lineId = entry.getKey();
            List<LineSchedule> lineSchedules = entry.getValue();

            LineSchedule current = lineSchedules.stream()
                    .filter(s -> s.getStatus() == LineSchedule.ScheduleStatus.in_progress)
                    .findFirst()
                    .orElse(null);

            int pendingCount = (int) lineSchedules.stream()
                    .filter(s -> s.getStatus() == LineSchedule.ScheduleStatus.pending)
                    .count();

            statuses.put(lineId, LineStatusDTO.builder()
                    .lineId(lineId)
                    .status(current != null ? "RUNNING" : "IDLE")
                    .currentScheduleId(current != null ? current.getScheduleId() : null)
                    .currentProgress(current != null ? current.getProgressPercentage() : null)
                    .pendingScheduleCount(pendingCount)
                    .build());
        }

        return statuses;
    }

    /**
     * 构建实时汇总
     */
    private SchedulingDashboardDTO.SchedulingSummary buildRealtimeSummary(List<LineSchedule> schedules) {
        int total = schedules.size();
        int completed = (int) schedules.stream()
                .filter(s -> s.getStatus() == LineSchedule.ScheduleStatus.completed)
                .count();
        int inProgress = (int) schedules.stream()
                .filter(s -> s.getStatus() == LineSchedule.ScheduleStatus.in_progress)
                .count();
        int delayed = (int) schedules.stream()
                .filter(s -> s.getDelayMinutes() != null && s.getDelayMinutes() > 0)
                .count();

        // 实时进度
        int totalPlanned = schedules.stream()
                .filter(s -> s.getPlannedQuantity() != null)
                .mapToInt(LineSchedule::getPlannedQuantity)
                .sum();
        int totalCompletedQty = schedules.stream()
                .filter(s -> s.getCompletedQuantity() != null)
                .mapToInt(LineSchedule::getCompletedQuantity)
                .sum();

        BigDecimal progress = totalPlanned > 0 ?
                BigDecimal.valueOf(totalCompletedQty * 100.0 / totalPlanned).setScale(1, RoundingMode.HALF_UP) :
                BigDecimal.ZERO;

        return SchedulingDashboardDTO.SchedulingSummary.builder()
                .totalSchedules(total)
                .completedSchedules(completed)
                .inProgressSchedules(inProgress)
                .delayedSchedules(delayed)
                .completionRate(progress.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP))
                .build();
    }

    /**
     * 构建实时产线状态
     */
    private Map<String, LineStatusDTO> buildRealtimeLineStatuses(List<LineSchedule> schedules) {
        Map<String, LineStatusDTO> statuses = new HashMap<>();

        for (LineSchedule schedule : schedules) {
            if (schedule.getLineId() == null) continue;

            String lineId = schedule.getLineId();
            if (!statuses.containsKey(lineId) ||
                    schedule.getStatus() == LineSchedule.ScheduleStatus.in_progress) {

                statuses.put(lineId, LineStatusDTO.builder()
                        .lineId(lineId)
                        .status(schedule.getStatus().name().toUpperCase())
                        .currentScheduleId(schedule.getScheduleId())
                        .currentProgress(schedule.getProgressPercentage())
                        .currentQuantity(schedule.getCompletedQuantity())
                        .targetQuantity(schedule.getPlannedQuantity())
                        .build());
            }
        }

        return statuses;
    }
}
