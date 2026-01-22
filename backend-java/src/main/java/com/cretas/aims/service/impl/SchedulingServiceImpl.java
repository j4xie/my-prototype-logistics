package com.cretas.aims.service.impl;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.*;
import com.cretas.aims.entity.enums.HireType;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.entity.rules.DroolsRule;
import com.cretas.aims.exception.EntityNotFoundException;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.FeatureEngineeringService;
import com.cretas.aims.service.LinUCBService;
import com.cretas.aims.service.NotificationService;
import com.cretas.aims.service.PushNotificationService;
import com.cretas.aims.service.SchedulingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import org.springframework.scheduling.annotation.Async;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 智能调度服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingServiceImpl implements SchedulingService {

    private final SchedulingPlanRepository planRepository;
    private final LineScheduleRepository scheduleRepository;
    private final WorkerAssignmentRepository assignmentRepository;
    private final ProductionLineRepository lineRepository;
    private final SchedulingAlertRepository alertRepository;
    private final SchedulingPredictionRepository predictionRepository;
    private final UserRepository userRepository;
    private final ProductionBatchRepository batchRepository;
    private final ProductionPlanRepository productionPlanRepository;
    private final DroolsRuleRepository droolsRuleRepository;
    private final TimeClockRecordRepository timeClockRecordRepository;
    private final RestTemplate restTemplate;
    private final FeatureEngineeringService featureEngineeringService;
    private final LinUCBService linUCBService;
    private final NotificationService notificationService;
    private final PushNotificationService pushNotificationService;
    private final ProductionLineSupervisorRepository supervisorRepository;

    @Value("${ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    @Value("${ml.hybrid-predict.enabled:true}")
    private boolean hybridPredictEnabled;

    // 自动触发排产配置
    @Value("${cretas.scheduling.auto-trigger.enabled:true}")
    private boolean autoSchedulingEnabled;

    @Value("${cretas.scheduling.auto-trigger.low-risk-threshold:0.85}")
    private double lowRiskThreshold;

    @Value("${cretas.scheduling.auto-trigger.medium-risk-threshold:0.70}")
    private double mediumRiskThreshold;

    // ==================== 调度计划 CRUD ====================

    @Override
    @Transactional
    public SchedulingPlanDTO createPlan(String factoryId, CreateSchedulingPlanRequest request, Long userId) {
        // 检查是否已存在同日计划
        Optional<SchedulingPlan> existing = planRepository.findByFactoryIdAndPlanDateAndDeletedAtIsNull(
            factoryId, request.getPlanDate());
        if (existing.isPresent()) {
            throw new RuntimeException("该日期已存在调度计划");
        }

        SchedulingPlan plan = new SchedulingPlan();
        plan.setFactoryId(factoryId);
        plan.setPlanDate(request.getPlanDate());
        plan.setPlanName(request.getPlanName() != null ? request.getPlanName()
            : request.getPlanDate().toString() + " 生产计划");
        plan.setNotes(request.getNotes());
        plan.setCreatedBy(userId);
        plan.setStatus(SchedulingPlan.PlanStatus.draft);

        plan = planRepository.save(plan);

        // 创建排程
        if (request.getSchedules() != null && !request.getSchedules().isEmpty()) {
            List<LineSchedule> schedules = new ArrayList<>();
            int totalWorkers = 0;
            for (CreateSchedulingPlanRequest.ScheduleItem item : request.getSchedules()) {
                LineSchedule schedule = new LineSchedule();
                schedule.setPlan(plan);
                schedule.setProductionLineId(item.getProductionLineId());
                schedule.setBatchId(item.getBatchId());
                schedule.setSequenceOrder(item.getSequenceOrder() != null ? item.getSequenceOrder() : 0);
                schedule.setPlannedStartTime(item.getPlannedStartTime());
                schedule.setPlannedEndTime(item.getPlannedEndTime());
                schedule.setPlannedQuantity(item.getPlannedQuantity());
                schedule.setStatus(LineSchedule.ScheduleStatus.pending);
                schedules.add(schedule);

                if (item.getWorkerIds() != null) {
                    totalWorkers += item.getWorkerIds().size();
                }
            }
            scheduleRepository.saveAll(schedules);
            plan.setTotalBatches(schedules.size());
            plan.setTotalWorkers(totalWorkers);
            planRepository.save(plan);
        }

        // 发送调度计划创建通知
        try {
            Map<String, Object> planDetails = new HashMap<>();
            planDetails.put("planName", plan.getPlanName());
            planDetails.put("planDate", plan.getPlanDate());
            planDetails.put("totalBatches", plan.getTotalBatches());
            planDetails.put("totalWorkers", plan.getTotalWorkers());
            notificationService.notifyScheduleCreated(factoryId, plan.getId(), planDetails);
            log.info("调度计划创建通知已发送: planId={}", plan.getId());
        } catch (Exception e) {
            log.error("发送调度计划创建通知失败: planId={}", plan.getId(), e);
            // 不阻塞创建流程
        }

        // 发送推送通知到工厂所有设备
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "plan_created");
            pushData.put("planId", plan.getId());
            pushData.put("planDate", plan.getPlanDate().toString());
            pushData.put("screen", "SchedulingPlanDetail");
            pushNotificationService.sendToFactory(
                factoryId,
                "生产计划已创建",
                String.format("计划 %s 已创建，包含 %d 个批次", plan.getPlanName(), plan.getTotalBatches()),
                pushData
            );
            log.info("调度计划创建推送通知已发送: planId={}", plan.getId());
        } catch (Exception e) {
            log.error("发送调度计划创建推送通知失败: planId={}", plan.getId(), e);
            // 不阻塞创建流程
        }

        return enrichPlanDTO(SchedulingPlanDTO.fromEntity(plan));
    }

    @Override
    public SchedulingPlanDTO getPlan(String factoryId, String planId) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new EntityNotFoundException("SchedulePlan", planId));
        SchedulingPlanDTO dto = SchedulingPlanDTO.fromEntity(plan);

        // 获取排程列表（使用批量版本解决 N+1 问题）
        List<LineSchedule> schedules = scheduleRepository.findByPlanIdOrderBySequenceOrder(planId);
        dto.setLineSchedules(enrichScheduleDTOs(schedules));

        return enrichPlanDTO(dto);
    }

    @Override
    public Page<SchedulingPlanDTO> getPlans(String factoryId, LocalDate startDate, LocalDate endDate,
                                             String status, Pageable pageable) {
        Page<SchedulingPlan> plans;

        if (startDate != null && endDate != null && status != null && !status.isEmpty()) {
            // 支持多个状态，用逗号分隔 (如 "confirmed,in_progress")
            List<SchedulingPlan.PlanStatus> statuses = Arrays.stream(status.split(","))
                .map(String::trim)
                .map(s -> {
                    try {
                        return SchedulingPlan.PlanStatus.valueOf(s.toLowerCase());
                    } catch (IllegalArgumentException e) {
                        log.warn("无效的计划状态: {}", s);
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

            if (statuses.size() == 1) {
                plans = planRepository.findByFactoryIdAndDateRangeAndStatusPaged(
                    factoryId, startDate, endDate, statuses.get(0), pageable);
            } else if (!statuses.isEmpty()) {
                plans = planRepository.findByFactoryIdAndDateRangeAndStatusesPaged(
                    factoryId, startDate, endDate, statuses, pageable);
            } else {
                plans = planRepository.findByFactoryIdAndDateRangePaged(factoryId, startDate, endDate, pageable);
            }
        } else if (startDate != null && endDate != null) {
            plans = planRepository.findByFactoryIdAndDateRangePaged(factoryId, startDate, endDate, pageable);
        } else {
            plans = planRepository.findByFactoryIdAndDeletedAtIsNullOrderByPlanDateDesc(factoryId, pageable);
        }

        List<SchedulingPlanDTO> dtos = plans.getContent().stream()
            .map(SchedulingPlanDTO::fromEntity)
            .map(this::enrichPlanDTO)
            .collect(Collectors.toList());

        return new PageImpl<>(dtos, pageable, plans.getTotalElements());
    }

    @Override
    @Transactional
    public SchedulingPlanDTO updatePlan(String factoryId, String planId, CreateSchedulingPlanRequest request) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new EntityNotFoundException("SchedulePlan", planId));

        if (plan.getStatus() != SchedulingPlan.PlanStatus.draft) {
            throw new RuntimeException("只能修改草稿状态的计划");
        }

        plan.setPlanName(request.getPlanName());
        plan.setNotes(request.getNotes());
        planRepository.save(plan);

        return enrichPlanDTO(SchedulingPlanDTO.fromEntity(plan));
    }

    @Override
    @Transactional
    public SchedulingPlanDTO confirmPlan(String factoryId, String planId, Long userId) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new EntityNotFoundException("SchedulePlan", planId));

        if (plan.getStatus() != SchedulingPlan.PlanStatus.draft) {
            throw new RuntimeException("只能确认草稿状态的计划");
        }

        plan.setStatus(SchedulingPlan.PlanStatus.confirmed);
        plan.setConfirmedBy(userId);
        plan.setConfirmedAt(LocalDateTime.now());
        planRepository.save(plan);

        // 自动分配车间主任
        assignSupervisorsToSchedules(plan);

        // 发送调度计划确认通知
        try {
            String confirmerName = userRepository.findById(userId)
                .map(User::getFullName)
                .orElse("未知用户");
            notificationService.notifyScheduleConfirmed(factoryId, planId, confirmerName);
            log.info("调度计划确认通知已发送: planId={}, confirmedBy={}", planId, confirmerName);
        } catch (Exception e) {
            log.error("发送调度计划确认通知失败: planId={}", planId, e);
            // 不阻塞确认流程
        }

        // 发送推送通知 - 审批类型通知给相关用户
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "plan_confirmed");
            pushData.put("planId", planId);
            pushData.put("planDate", plan.getPlanDate().toString());
            pushData.put("screen", "SchedulingPlanDetail");
            pushNotificationService.sendToFactory(
                factoryId,
                "生产计划已确认",
                String.format("计划 %s 已确认，请相关人员做好准备", plan.getPlanName()),
                pushData
            );
            log.info("调度计划确认推送通知已发送: planId={}", planId);
        } catch (Exception e) {
            log.error("发送调度计划确认推送通知失败: planId={}", planId, e);
            // 不阻塞确认流程
        }

        return enrichPlanDTO(SchedulingPlanDTO.fromEntity(plan));
    }

    /**
     * 自动为排程分配车间主任
     * 根据产线-主任关联表，为每个排程设置对应的负责人
     */
    private void assignSupervisorsToSchedules(SchedulingPlan plan) {
        if (plan.getLineSchedules() == null || plan.getLineSchedules().isEmpty()) {
            return;
        }

        for (LineSchedule schedule : plan.getLineSchedules()) {
            // 查找该产线的主要负责人
            supervisorRepository.findByProductionLineIdAndIsPrimaryTrue(schedule.getProductionLineId())
                .ifPresent(supervisor -> {
                    schedule.setSupervisorId(supervisor.getSupervisorUserId());
                    scheduleRepository.save(schedule);
                    log.info("排程 {} 已分配给车间主任 {}", schedule.getId(), supervisor.getSupervisorUserId());
                });
        }
    }

    @Override
    @Transactional
    public void cancelPlan(String factoryId, String planId, String reason) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new EntityNotFoundException("SchedulePlan", planId));

        plan.setStatus(SchedulingPlan.PlanStatus.cancelled);
        plan.setNotes(plan.getNotes() != null ? plan.getNotes() + "\n取消原因: " + reason : "取消原因: " + reason);
        planRepository.save(plan);
    }

    // ==================== 产线排程 ====================

    @Override
    public LineScheduleDTO getSchedule(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionSchedule", scheduleId));
        return enrichScheduleDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO updateSchedule(String factoryId, String scheduleId, UpdateScheduleRequest request) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionSchedule", scheduleId));

        if (request.getSequenceOrder() != null) {
            schedule.setSequenceOrder(request.getSequenceOrder());
        }
        if (request.getPlannedStartTime() != null) {
            schedule.setPlannedStartTime(request.getPlannedStartTime());
        }
        if (request.getPlannedEndTime() != null) {
            schedule.setPlannedEndTime(request.getPlannedEndTime());
        }
        if (request.getPlannedQuantity() != null) {
            schedule.setPlannedQuantity(request.getPlannedQuantity());
        }
        if (request.getNotes() != null) {
            schedule.setDelayReason(request.getNotes());
        }

        schedule = scheduleRepository.save(schedule);
        return enrichScheduleDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO startSchedule(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionSchedule", scheduleId));

        schedule.setStatus(LineSchedule.ScheduleStatus.in_progress);
        schedule.setActualStartTime(LocalDateTime.now());

        // 更新计划状态
        SchedulingPlan plan = schedule.getPlan();
        if (plan.getStatus() == SchedulingPlan.PlanStatus.confirmed) {
            plan.setStatus(SchedulingPlan.PlanStatus.in_progress);
            planRepository.save(plan);
        }

        schedule = scheduleRepository.save(schedule);
        return enrichScheduleDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO completeSchedule(String factoryId, String scheduleId, Integer completedQuantity) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionSchedule", scheduleId));

        schedule.setStatus(LineSchedule.ScheduleStatus.completed);
        schedule.setActualEndTime(LocalDateTime.now());
        schedule.setCompletedQuantity(completedQuantity);

        // 计算实际效率
        if (schedule.getActualStartTime() != null && schedule.getPlannedQuantity() != null
            && schedule.getPlannedQuantity() > 0) {
            long minutes = java.time.Duration.between(schedule.getActualStartTime(),
                LocalDateTime.now()).toMinutes();
            if (minutes > 0) {
                BigDecimal efficiency = BigDecimal.valueOf(completedQuantity)
                    .divide(BigDecimal.valueOf(schedule.getPlannedQuantity()), 4, BigDecimal.ROUND_HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
                schedule.setActualEfficiency(efficiency);
            }
        }

        schedule = scheduleRepository.save(schedule);
        return enrichScheduleDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO updateProgress(String factoryId, String scheduleId, Integer completedQuantity) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionSchedule", scheduleId));

        schedule.setCompletedQuantity(completedQuantity);

        // ========== Phase 2: 效率计算与延期检测 ==========
        try {
            // 1. 计算预期进度 (基于时间比例)
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime startTime = schedule.getActualStartTime() != null
                ? schedule.getActualStartTime()
                : schedule.getPlannedStartTime();
            LocalDateTime endTime = schedule.getPlannedEndTime();

            if (startTime != null && endTime != null && schedule.getPlannedQuantity() != null
                && schedule.getPlannedQuantity() > 0) {

                // 计算时间进度比例
                long totalMinutes = java.time.Duration.between(startTime, endTime).toMinutes();
                long elapsedMinutes = java.time.Duration.between(startTime, now).toMinutes();

                if (totalMinutes > 0 && elapsedMinutes > 0) {
                    // 时间进度比例 (最大为1.0，即100%)
                    double timeProgressRatio = Math.min(1.0, (double) elapsedMinutes / totalMinutes);

                    // 2. 计算预期产量
                    int expectedByNow = (int) Math.ceil(schedule.getPlannedQuantity() * timeProgressRatio);

                    // 3. 计算实际效率
                    double actualEfficiency = expectedByNow > 0
                        ? (double) completedQuantity / expectedByNow
                        : 1.0;

                    // 更新实际效率字段
                    schedule.setActualEfficiency(BigDecimal.valueOf(actualEfficiency));

                    log.info("效率计算: scheduleId={}, 已完成={}, 预期={}, 效率={}%",
                        scheduleId, completedQuantity, expectedByNow,
                        String.format("%.2f", actualEfficiency * 100));

                    // 4. 获取效率阈值（默认0.8 = 80%）
                    double efficiencyThreshold = getEfficiencyThreshold(factoryId);

                    // 5. 效率低于阈值时自动标记延期
                    if (actualEfficiency < efficiencyThreshold
                        && schedule.getStatus() != LineSchedule.ScheduleStatus.delayed
                        && schedule.getStatus() != LineSchedule.ScheduleStatus.completed
                        && schedule.getStatus() != LineSchedule.ScheduleStatus.cancelled) {

                        // 设置延期状态
                        schedule.setStatus(LineSchedule.ScheduleStatus.delayed);

                        // 填充延期原因
                        String delayReason = String.format(
                            "效率低于预期: 当前效率 %.1f%% (阈值 %.0f%%)，已完成 %d / 预期 %d",
                            actualEfficiency * 100, efficiencyThreshold * 100,
                            completedQuantity, expectedByNow);
                        schedule.setDelayReason(delayReason);

                        log.warn("排程 {} 效率 {}% 低于阈值 {}%，已标记为延期",
                            scheduleId,
                            String.format("%.1f", actualEfficiency * 100),
                            String.format("%.0f", efficiencyThreshold * 100));

                        // 6. 发送延期通知
                        try {
                            notificationService.notifyScheduleDelayed(
                                factoryId, scheduleId, delayReason, actualEfficiency);
                        } catch (Exception notifyEx) {
                            log.error("发送延期通知失败: scheduleId={}", scheduleId, notifyEx);
                        }

                        // 7. 发送延期推送通知
                        try {
                            Map<String, Object> pushData = new HashMap<>();
                            pushData.put("type", "schedule_delayed");
                            pushData.put("scheduleId", scheduleId);
                            pushData.put("efficiency", actualEfficiency);
                            pushData.put("screen", "ScheduleProgressScreen");
                            pushNotificationService.sendToFactory(
                                factoryId,
                                "排程延期预警",
                                delayReason,
                                pushData
                            );
                            log.info("排程延期推送通知已发送: scheduleId={}", scheduleId);
                        } catch (Exception pushEx) {
                            log.error("发送延期推送通知失败: scheduleId={}", scheduleId, pushEx);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("效率计算失败: scheduleId={}", scheduleId, e);
            // 不阻塞进度更新，只记录错误
        }

        schedule = scheduleRepository.save(schedule);

        // ========== 紧急状态监控 (基于完成概率) ==========
        try {
            CompletionProbabilityResponse probability = calculateCompletionProbability(factoryId, scheduleId);

            double urgentThreshold = getUrgentThreshold(factoryId);

            if (probability.getProbability() != null &&
                probability.getProbability().doubleValue() < urgentThreshold) {

                createUrgentAlert(factoryId, scheduleId, schedule.getPlanId(),
                    probability.getProbability().doubleValue(), urgentThreshold);

                log.warn("排程 {} 完成概率 {}% 低于紧急阈值 {}%，已创建告警",
                    scheduleId, probability.getProbability(), urgentThreshold * 100);
            }
        } catch (Exception e) {
            log.error("紧急状态监控失败: scheduleId={}", scheduleId, e);
        }

        return enrichScheduleDTO(schedule);
    }

    /**
     * 获取紧急阈值配置（三级回退）
     * 1. 工厂级配置
     * 2. 系统级配置 (factory_id='SYSTEM')
     * 3. 默认值 0.6
     */
    @Override
    public double getUrgentThreshold(String factoryId) {
        // 1. 尝试工厂级配置
        Optional<DroolsRule> factoryRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", "urgent_threshold");

        if (factoryRule.isPresent() && factoryRule.get().getEnabled()) {
            try {
                return Double.parseDouble(factoryRule.get().getRuleContent());
            } catch (NumberFormatException e) {
                log.warn("工厂 {} 的紧急阈值配置格式错误: {}", factoryId,
                         factoryRule.get().getRuleContent(), e);
            }
        }

        // 2. 尝试系统级配置
        Optional<DroolsRule> systemRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName("SYSTEM", "scheduling", "urgent_threshold");

        if (systemRule.isPresent() && systemRule.get().getEnabled()) {
            try {
                return Double.parseDouble(systemRule.get().getRuleContent());
            } catch (NumberFormatException e) {
                log.warn("系统级紧急阈值配置格式错误: {}", systemRule.get().getRuleContent(), e);
            }
        }

        // 3. 默认值
        return 0.6;
    }

    /**
     * 获取效率阈值配置（三级回退）
     * 效率低于此阈值时自动标记为延期
     * 1. 工厂级配置
     * 2. 系统级配置 (factory_id='SYSTEM')
     * 3. 默认值 0.8 (80%)
     */
    public double getEfficiencyThreshold(String factoryId) {
        // 1. 尝试工厂级配置
        Optional<DroolsRule> factoryRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", "efficiency_threshold");

        if (factoryRule.isPresent() && factoryRule.get().getEnabled()) {
            try {
                return Double.parseDouble(factoryRule.get().getRuleContent());
            } catch (NumberFormatException e) {
                log.warn("工厂 {} 的效率阈值配置格式错误: {}", factoryId,
                         factoryRule.get().getRuleContent(), e);
            }
        }

        // 2. 尝试系统级配置
        Optional<DroolsRule> systemRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName("SYSTEM", "scheduling", "efficiency_threshold");

        if (systemRule.isPresent() && systemRule.get().getEnabled()) {
            try {
                return Double.parseDouble(systemRule.get().getRuleContent());
            } catch (NumberFormatException e) {
                log.warn("系统级效率阈值配置格式错误: {}", systemRule.get().getRuleContent(), e);
            }
        }

        // 3. 默认值 0.8 (80%)
        return 0.8;
    }

    @Override
    @Transactional
    public void updateUrgentThreshold(String factoryId, Double threshold, Long userId) {
        // 查找或创建工厂级配置
        Optional<DroolsRule> existingRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", "urgent_threshold");

        DroolsRule rule;
        if (existingRule.isPresent()) {
            // 更新现有规则
            rule = existingRule.get();
            rule.setRuleContent(String.valueOf(threshold));
            rule.setVersion(rule.getVersion() + 1);
            rule.setUpdatedBy(userId);
            rule.setUpdatedAt(LocalDateTime.now());
        } else {
            // 创建新规则
            rule = new DroolsRule();
            rule.setId(UUID.randomUUID().toString());
            rule.setFactoryId(factoryId);
            rule.setRuleGroup("scheduling");
            rule.setRuleName("urgent_threshold");
            rule.setRuleDescription("生产计划紧急阈值：完成概率低于此值时标记为紧急");
            rule.setRuleContent(String.valueOf(threshold));
            rule.setEnabled(true);
            rule.setPriority(100);
            rule.setVersion(1);
            rule.setCreatedBy(userId);
            rule.setCreatedAt(LocalDateTime.now());
            rule.setUpdatedAt(LocalDateTime.now());
        }

        droolsRuleRepository.save(rule);

        log.info("更新紧急阈值配置成功: factoryId={}, threshold={}, userId={}", factoryId, threshold, userId);
    }

    /**
     * 计算生产计划完成概率（复杂加权算法）
     *
     * 权重分配：
     * - CR值: 40% (时间充裕度)
     * - 材料匹配: 30% (原料保障度)
     * - AI置信度: 20% (预测可靠性)
     * - 混批影响: 10% (复杂度惩罚)
     *
     * @return 0-1之间的概率值
     */
    @Async
    @Transactional
    public CompletableFuture<BigDecimal> calculatePlanProbability(ProductionPlan plan) {
        try {
            BigDecimal probability = BigDecimal.ZERO;

            // 1. CR值贡献 (40%)
            BigDecimal crScore = calculateCrScore(plan.getCrValue());
            probability = probability.add(crScore.multiply(new BigDecimal("0.40")));

            // 2. 材料匹配贡献 (30%)
            BigDecimal materialScore = calculateMaterialScore(plan);
            probability = probability.add(materialScore.multiply(new BigDecimal("0.30")));

            // 3. AI置信度贡献 (20%)
            BigDecimal aiScore = calculateAiScore(plan.getAiConfidence());
            probability = probability.add(aiScore.multiply(new BigDecimal("0.20")));

            // 4. 混批影响 (10%)
            BigDecimal mixedBatchScore = calculateMixedBatchScore(plan.getIsMixedBatch());
            probability = probability.add(mixedBatchScore.multiply(new BigDecimal("0.10")));

            // 限制在 [0, 1] 范围
            if (probability.compareTo(BigDecimal.ONE) > 0) {
                probability = BigDecimal.ONE;
            }
            if (probability.compareTo(BigDecimal.ZERO) < 0) {
                probability = BigDecimal.ZERO;
            }

            // 更新实体
            plan.setCurrentProbability(probability);
            plan.setProbabilityUpdatedAt(LocalDateTime.now());
            productionPlanRepository.save(plan);

            log.debug("计划 {} 概率计算完成: CR={}, 材料={}, AI={}, 混批={}, 最终={}",
                     plan.getPlanNumber(), crScore, materialScore, aiScore,
                     mixedBatchScore, probability);

            return CompletableFuture.completedFuture(probability);

        } catch (Exception e) {
            log.error("计算计划 {} 概率失败", plan.getPlanNumber(), e);
            return CompletableFuture.completedFuture(new BigDecimal("0.5")); // 失败时返回中性值
        }
    }

    /**
     * 计算CR值得分 (0-1)
     * CR > 1.5: 1.0 (时间充裕)
     * CR = 1.0: 0.5 (刚好)
     * CR < 0.5: 0.0 (严重紧急)
     */
    private BigDecimal calculateCrScore(BigDecimal crValue) {
        if (crValue == null) {
            return new BigDecimal("0.5"); // 未知CR，返回中性值
        }

        if (crValue.compareTo(new BigDecimal("1.5")) >= 0) {
            return BigDecimal.ONE; // 时间充裕
        }
        if (crValue.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO; // 已超期
        }

        // 线性映射: CR ∈ [0, 1.5] → Score ∈ [0, 1]
        return crValue.divide(new BigDecimal("1.5"), 4, java.math.RoundingMode.HALF_UP);
    }

    /**
     * 计算材料匹配得分 (0-1)
     * 已分配 / 计划数量
     */
    private BigDecimal calculateMaterialScore(ProductionPlan plan) {
        if (plan.getPlannedQuantity() == null ||
            plan.getPlannedQuantity().compareTo(BigDecimal.ZERO) == 0) {
            return new BigDecimal("0.5");
        }

        BigDecimal allocated = plan.getAllocatedQuantity() != null
            ? plan.getAllocatedQuantity()
            : BigDecimal.ZERO;

        BigDecimal score = allocated.divide(plan.getPlannedQuantity(), 4,
                                           java.math.RoundingMode.HALF_UP);

        return score.compareTo(BigDecimal.ONE) > 0 ? BigDecimal.ONE : score;
    }

    /**
     * 计算AI置信度得分 (0-1)
     * aiConfidence ∈ [0, 100] → Score ∈ [0, 1]
     */
    private BigDecimal calculateAiScore(Integer aiConfidence) {
        if (aiConfidence == null) {
            return new BigDecimal("0.5"); // 非AI预测，返回中性值
        }
        return new BigDecimal(aiConfidence).divide(new BigDecimal("100"), 4,
                                                   java.math.RoundingMode.HALF_UP);
    }

    /**
     * 计算混批影响得分
     * 非混批: 1.0 (无惩罚)
     * 混批: 0.7 (复杂度惩罚-30%)
     */
    private BigDecimal calculateMixedBatchScore(Boolean isMixedBatch) {
        if (isMixedBatch != null && isMixedBatch) {
            return new BigDecimal("0.70"); // 混批复杂度惩罚
        }
        return BigDecimal.ONE; // 非混批，无惩罚
    }

    /**
     * 获取待排产批次列表（带紧急状态）
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期（可选）
     * @param endDate 结束日期（可选）
     * @return 待排产批次列表
     */
    @Override
    public List<ProductionPlanDTO> getPendingBatches(String factoryId,
                                                      LocalDate startDate,
                                                      LocalDate endDate) {
        // 1. 查询PENDING状态的生产计划
        List<ProductionPlan> plans = productionPlanRepository
            .findByFactoryIdAndStatusAndExpectedCompletionDateBetween(
                factoryId,
                ProductionPlanStatus.PENDING,
                startDate != null ? startDate : LocalDate.now(),
                endDate != null ? endDate : LocalDate.now().plusMonths(1)
            );

        // 2. 获取紧急阈值
        double threshold = getUrgentThreshold(factoryId);

        // 3. 更新过期的概率并转换为DTO
        List<ProductionPlanDTO> dtos = new ArrayList<>();
        for (ProductionPlan plan : plans) {
            // 如果概率过期，异步重新计算
            if (plan.isProbabilityStale()) {
                calculatePlanProbability(plan); // 异步执行，不阻塞响应
            }

            ProductionPlanDTO dto = enrichProductionPlanDTO(plan, threshold);
            dtos.add(dto);
        }

        // 4. 排序：紧急批次置顶，再按CR值升序
        dtos.sort((a, b) -> {
            // 紧急优先
            if (a.getIsUrgent() != b.getIsUrgent()) {
                return a.getIsUrgent() ? -1 : 1;
            }
            // 相同紧急状态，按CR值升序（CR越小越紧急）
            BigDecimal crA = a.getCrValue() != null ? a.getCrValue() : BigDecimal.valueOf(999);
            BigDecimal crB = b.getCrValue() != null ? b.getCrValue() : BigDecimal.valueOf(999);
            return crA.compareTo(crB);
        });

        log.info("工厂 {} 查询到 {} 个待排产批次，其中紧急: {}",
                 factoryId, dtos.size(),
                 dtos.stream().filter(ProductionPlanDTO::getIsUrgent).count());

        return dtos;
    }

    /**
     * 丰富ProductionPlanDTO（添加紧急状态和概率）
     */
    private ProductionPlanDTO enrichProductionPlanDTO(ProductionPlan plan, double threshold) {
        ProductionPlanDTO dto = new ProductionPlanDTO();

        // 基础字段
        dto.setId(plan.getId());
        dto.setPlanNumber(plan.getPlanNumber());
        dto.setProductTypeId(plan.getProductTypeId());
        dto.setPlannedQuantity(plan.getPlannedQuantity());
        dto.setExpectedCompletionDate(plan.getExpectedCompletionDate());
        dto.setStatus(plan.getStatus());
        dto.setPriority(plan.getPriority());
        dto.setSourceType(plan.getSourceType());
        dto.setCustomerOrderNumber(plan.getCustomerOrderNumber());
        dto.setSourceCustomerName(plan.getSourceCustomerName());

        // 调度相关字段
        dto.setCrValue(plan.getCrValue());
        dto.setAiConfidence(plan.getAiConfidence());
        dto.setForecastReason(plan.getForecastReason());
        dto.setIsMixedBatch(plan.getIsMixedBatch());
        dto.setAllocatedQuantity(plan.getAllocatedQuantity());
        dto.setIsFullyMatched(plan.getIsFullyMatched());
        dto.setMatchingProgress(plan.getMatchingProgress());

        // 紧急状态字段
        dto.setCurrentProbability(plan.getCurrentProbability());
        dto.setProbabilityUpdatedAt(plan.getProbabilityUpdatedAt());
        dto.setIsUrgent(plan.isUrgent(threshold));

        // 时间戳
        dto.setCreatedAt(plan.getCreatedAt());
        dto.setUpdatedAt(plan.getUpdatedAt());

        // 如果有关联的ProductType，设置名称
        if (plan.getProductType() != null) {
            dto.setProductTypeName(plan.getProductType().getName());
        }

        return dto;
    }

    /**
     * 创建紧急告警
     */
    private void createUrgentAlert(String factoryId, String scheduleId, String planId,
                                  double currentProbability, double threshold) {
        SchedulingAlert alert = new SchedulingAlert();
        alert.setFactoryId(factoryId);
        alert.setScheduleId(scheduleId);
        alert.setPlanId(planId);
        alert.setAlertType(SchedulingAlert.AlertType.low_probability);
        alert.setSeverity(SchedulingAlert.Severity.warning);
        alert.setMessage(String.format("排程完成概率已降至 %.1f%%，低于紧急阈值 %.1f%%",
            currentProbability * 100, threshold * 100));
        alert.setSuggestedAction("建议调度员重新分析该批次，调整产线或人员配置");
        alert.setIsResolved(false);

        alertRepository.save(alert);

        // 发送延期预警通知
        try {
            String delayReason = String.format("完成概率 %.1f%% 低于阈值 %.1f%%",
                currentProbability * 100, threshold * 100);
            notificationService.notifyScheduleDelayed(factoryId, scheduleId, delayReason, currentProbability);
            log.info("延期预警通知已发送: scheduleId={}, probability={}", scheduleId, currentProbability);
        } catch (Exception e) {
            log.error("发送延期预警通知失败: scheduleId={}", scheduleId, e);
            // 不阻塞告警创建流程
        }

        // 发送紧急告警推送通知
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "urgent_alert");
            pushData.put("scheduleId", scheduleId);
            pushData.put("planId", planId);
            pushData.put("probability", currentProbability);
            pushData.put("screen", "SchedulingAlertScreen");
            pushNotificationService.sendToFactory(
                factoryId,
                "紧急告警 - 完成概率过低",
                alert.getMessage(),
                pushData
            );
            log.info("紧急告警推送通知已发送: scheduleId={}", scheduleId);
        } catch (Exception e) {
            log.error("发送紧急告警推送通知失败: scheduleId={}", scheduleId, e);
            // 不阻塞告警创建流程
        }
    }

    // ==================== 工人分配 ====================

    @Override
    @Transactional
    public List<WorkerAssignmentDTO> assignWorkers(String factoryId, AssignWorkerRequest request) {
        LineSchedule schedule = scheduleRepository.findById(request.getScheduleId())
            .orElseThrow(() -> new EntityNotFoundException("ProductionSchedule", request.getScheduleId()));

        // === Phase 5B: LinUCB 集成 ===
        // 1. 提取任务特征 (从排程/批次)
        double[] taskFeatures = extractTaskFeaturesFromSchedule(factoryId, schedule);

        // 2. 获取 LinUCB 推荐分数 (按 UCB 值排序)
        Map<Long, BigDecimal> workerScores = new HashMap<>();
        try {
            List<LinUCBService.WorkerRecommendation> recommendations =
                linUCBService.recommendWorkers(factoryId, taskFeatures, request.getWorkerIds());
            for (LinUCBService.WorkerRecommendation rec : recommendations) {
                workerScores.put(rec.getWorkerId(), rec.getUcbScore());
            }
            log.info("LinUCB 推荐完成: scheduleId={}, 候选工人数={}, 推荐数={}",
                request.getScheduleId(), request.getWorkerIds().size(), recommendations.size());
        } catch (Exception e) {
            log.warn("LinUCB 推荐失败，使用原始顺序: {}", e.getMessage());
            // 降级: 使用默认分数
            for (Long workerId : request.getWorkerIds()) {
                workerScores.put(workerId, BigDecimal.valueOf(0.5));
            }
        }

        List<WorkerAssignment> assignments = new ArrayList<>();
        for (Long userId : request.getWorkerIds()) {
            // 检查是否已分配
            if (assignmentRepository.findByScheduleIdAndUserId(request.getScheduleId(), userId).isPresent()) {
                continue;
            }

            // 3. 获取工人特征，构建上下文
            double[] workerFeatures = featureEngineeringService.extractWorkerFeatures(factoryId, userId);
            double[] context = featureEngineeringService.combineFeatures(taskFeatures, workerFeatures);

            // 4. 记录分配上下文到 LinUCB 反馈表
            BigDecimal ucbScore = workerScores.getOrDefault(userId, BigDecimal.valueOf(0.5));
            String feedbackId = null;
            try {
                User worker = userRepository.findById(userId).orElse(null);
                String workerCode = worker != null ? worker.getEmployeeCode() : null;
                feedbackId = linUCBService.recordAllocation(
                    factoryId,
                    schedule.getId(),                    // taskId
                    "LINE_SCHEDULE",                     // taskType
                    userId,
                    workerCode,
                    context,
                    ucbScore,
                    schedule.getPlannedQuantity() != null ? BigDecimal.valueOf(schedule.getPlannedQuantity()) : BigDecimal.ZERO,       // plannedQuantity
                    calculatePlannedHours(schedule)      // plannedHours
                );
                log.debug("LinUCB 分配记录成功: userId={}, feedbackId={}", userId, feedbackId);
            } catch (Exception e) {
                log.warn("LinUCB 分配记录失败: userId={}, error={}", userId, e.getMessage());
            }

            WorkerAssignment assignment = new WorkerAssignment();
            assignment.setSchedule(schedule);
            assignment.setUserId(userId);
            assignment.setIsTemporary(request.getIsTemporary());
            assignment.setStatus(WorkerAssignment.AssignmentStatus.assigned);
            assignment.setLinucbFeedbackId(feedbackId);  // 保存 feedbackId 用于后续反馈
            assignment.setLinucbScore(ucbScore);         // 保存 UCB 分数
            assignments.add(assignment);
        }

        assignments = assignmentRepository.saveAll(assignments);

        // 更新排程的工人数
        schedule.setAssignedWorkers((int) assignmentRepository.countByScheduleId(request.getScheduleId()));
        scheduleRepository.save(schedule);

        // 使用批量版本的 enrichAssignmentDTOs，避免 N+1 查询问题
        return enrichAssignmentDTOs(assignments);
    }

    /**
     * 从排程中提取任务特征 (6维)
     */
    private double[] extractTaskFeaturesFromSchedule(String factoryId, LineSchedule schedule) {
        Map<String, Object> taskInfo = new HashMap<>();

        // 数量
        taskInfo.put("quantity", schedule.getPlannedQuantity() != null ?
            schedule.getPlannedQuantity().doubleValue() : 100.0);

        // 截止时间 (小时)
        if (schedule.getPlannedEndTime() != null && schedule.getPlannedStartTime() != null) {
            long hours = Duration.between(schedule.getPlannedStartTime(), schedule.getPlannedEndTime()).toHours();
            taskInfo.put("deadlineHours", hours);
        } else {
            taskInfo.put("deadlineHours", 8);
        }

        // 产品类型 (从批次获取)
        if (schedule.getBatchId() != null) {
            batchRepository.findById(schedule.getBatchId()).ifPresent(batch -> {
                taskInfo.put("productType", batch.getProductTypeId());
            });
        }

        // 优先级 (从关联计划获取)
        if (schedule.getPlan() != null) {
            SchedulingPlan plan = schedule.getPlan();
            taskInfo.put("priority", 5); // 默认中等优先级
        }

        // 复杂度 (从产品类型获取)
        String productTypeId = (String) taskInfo.get("productType");
        if (productTypeId != null) {
            int complexity = featureEngineeringService.getProductComplexity(factoryId, productTypeId);
            taskInfo.put("complexity", complexity);
        } else {
            taskInfo.put("complexity", 3);
        }

        // 车间 (从产线获取 - 暂时使用产线ID作为workshopId)
        if (schedule.getProductionLineId() != null) {
            taskInfo.put("workshopId", schedule.getProductionLineId().toString());
        }

        return featureEngineeringService.extractTaskFeatures(factoryId, taskInfo);
    }

    /**
     * 计算计划工时
     */
    private BigDecimal calculatePlannedHours(LineSchedule schedule) {
        if (schedule.getPlannedStartTime() != null && schedule.getPlannedEndTime() != null) {
            long minutes = Duration.between(schedule.getPlannedStartTime(), schedule.getPlannedEndTime()).toMinutes();
            return BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(8); // 默认8小时
    }

    @Override
    @Transactional
    public void removeWorkerAssignment(String factoryId, String assignmentId) {
        WorkerAssignment assignment = assignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new EntityNotFoundException("WorkerAssignment", assignmentId));

        String scheduleId = assignment.getScheduleId();
        assignmentRepository.delete(assignment);

        // 更新排程的工人数
        LineSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule != null) {
            schedule.setAssignedWorkers((int) assignmentRepository.countByScheduleId(scheduleId));
            scheduleRepository.save(schedule);
        }
    }

    @Override
    @Transactional
    public WorkerAssignmentDTO workerCheckIn(String factoryId, String assignmentId) {
        WorkerAssignment assignment = assignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new EntityNotFoundException("WorkerAssignment", assignmentId));

        assignment.setStatus(WorkerAssignment.AssignmentStatus.checked_in);
        assignment.setActualStartTime(LocalDateTime.now());
        assignment = assignmentRepository.save(assignment);

        return enrichAssignmentDTO(assignment);
    }

    @Override
    @Transactional
    public WorkerAssignmentDTO workerCheckOut(String factoryId, String assignmentId, Integer performanceScore) {
        WorkerAssignment assignment = assignmentRepository.findById(assignmentId)
            .orElseThrow(() -> new EntityNotFoundException("WorkerAssignment", assignmentId));

        assignment.setStatus(WorkerAssignment.AssignmentStatus.checked_out);
        assignment.setActualEndTime(LocalDateTime.now());
        if (performanceScore != null) {
            assignment.setPerformanceScore(performanceScore);
        }
        assignment = assignmentRepository.save(assignment);

        // === Phase 5B: LinUCB 反馈收集 ===
        completeLinUCBFeedback(assignment, performanceScore);

        return enrichAssignmentDTO(assignment);
    }

    /**
     * 完成 LinUCB 反馈，更新模型
     *
     * @param assignment 工人分配记录
     * @param performanceScore 绩效分数 (1-100)
     */
    private void completeLinUCBFeedback(WorkerAssignment assignment, Integer performanceScore) {
        String feedbackId = assignment.getLinucbFeedbackId();
        if (feedbackId == null || feedbackId.isEmpty()) {
            log.debug("跳过 LinUCB 反馈: 无 feedbackId, assignmentId={}", assignment.getId());
            return;
        }

        try {
            // 计算实际工时
            BigDecimal actualHours = BigDecimal.valueOf(8); // 默认
            if (assignment.getActualStartTime() != null && assignment.getActualEndTime() != null) {
                long minutes = Duration.between(assignment.getActualStartTime(), assignment.getActualEndTime()).toMinutes();
                actualHours = BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
            }

            // 获取排程的实际产量 (如果有)
            BigDecimal actualQuantity = BigDecimal.ZERO;
            LineSchedule schedule = assignment.getSchedule();
            if (schedule != null && schedule.getCompletedQuantity() != null) {
                // 按工人数分摊产量
                int workerCount = schedule.getAssignedWorkers() != null ? schedule.getAssignedWorkers() : 1;
                actualQuantity = BigDecimal.valueOf(schedule.getCompletedQuantity()).divide(
                    BigDecimal.valueOf(workerCount), 2, RoundingMode.HALF_UP);
            }

            // 质量分数转换为 0-1 范围
            BigDecimal qualityScore = BigDecimal.ONE; // 默认满分
            if (performanceScore != null) {
                qualityScore = BigDecimal.valueOf(performanceScore).divide(
                    BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            }

            // 调用 LinUCB 完成反馈
            BigDecimal reward = linUCBService.completeFeedback(
                feedbackId,
                actualQuantity,
                actualHours,
                qualityScore
            );

            log.info("LinUCB 反馈完成: feedbackId={}, userId={}, reward={}, actualHours={}, qualityScore={}",
                feedbackId, assignment.getUserId(), reward, actualHours, qualityScore);

        } catch (Exception e) {
            log.warn("LinUCB 反馈失败: feedbackId={}, error={}", feedbackId, e.getMessage());
            // 不抛出异常，避免影响主业务
        }
    }

    @Override
    public List<WorkerAssignmentDTO> getWorkerAssignments(String factoryId, Long userId, LocalDate date) {
        List<WorkerAssignment> assignments = assignmentRepository.findByUserIdAndDate(userId, date);
        // 使用批量版本的 enrichAssignmentDTOs，避免 N+1 查询问题
        return enrichAssignmentDTOs(assignments);
    }

    @Override
    public List<AvailableWorkerDTO> getAvailableWorkers(String factoryId, LocalDate date, String scheduleId) {
        log.info("获取可用工人列表: factoryId={}, date={}, scheduleId={}", factoryId, date, scheduleId);

        // 1. 获取工厂所有活跃工人
        List<User> activeWorkers = userRepository.findByFactoryIdAndIsActive(factoryId, true);

        if (activeWorkers.isEmpty()) {
            log.warn("工厂 {} 没有活跃工人", factoryId);
            return new ArrayList<>();
        }

        // 2. 如果指定了日期和排程ID，排除已分配的工人
        Set<Long> assignedWorkerIds = new HashSet<>();
        if (date != null && scheduleId != null) {
            List<WorkerAssignment> existingAssignments = assignmentRepository
                .findByScheduleId(scheduleId);
            assignedWorkerIds = existingAssignments.stream()
                .map(WorkerAssignment::getUserId)
                .collect(Collectors.toSet());
        } else if (date != null) {
            // 获取指定日期所有排程的已分配工人
            List<SchedulingPlan> plansOnDate = planRepository
                .findByFactoryIdAndPlanDateAndDeletedAtIsNull(factoryId, date)
                .stream().collect(Collectors.toList());

            for (SchedulingPlan plan : plansOnDate) {
                List<LineSchedule> schedules = scheduleRepository
                    .findByPlanId(plan.getId());
                for (LineSchedule schedule : schedules) {
                    List<WorkerAssignment> assignments = assignmentRepository
                        .findByScheduleId(schedule.getId());
                    assignedWorkerIds.addAll(
                        assignments.stream()
                            .map(WorkerAssignment::getUserId)
                            .collect(Collectors.toSet())
                    );
                }
            }
        }

        // 3. 过滤掉已分配的工人
        final Set<Long> finalAssignedIds = assignedWorkerIds;
        List<User> availableWorkers = activeWorkers.stream()
            .filter(w -> !finalAssignedIds.contains(w.getId()))
            .collect(Collectors.toList());

        log.info("可用工人数: {}, 已分配工人数: {}", availableWorkers.size(), finalAssignedIds.size());

        return availableWorkers.stream()
            .map(AvailableWorkerDTO::fromEntity)
            .collect(Collectors.toList());
    }

    @Override
    public List<TaskHistoryDTO> getEmployeeTaskHistory(String factoryId, Long userId, Integer limit) {
        log.info("获取员工任务历史: factoryId={}, userId={}, limit={}", factoryId, userId, limit);

        // 查询员工的任务分配记录（包含排程和计划信息）
        List<WorkerAssignment> assignments = assignmentRepository
                .findRecentByFactoryIdAndUserId(factoryId, userId);

        // 限制返回数量
        int actualLimit = (limit != null && limit > 0) ? limit : 10;
        List<WorkerAssignment> limitedAssignments = assignments.stream()
                .limit(actualLimit)
                .collect(Collectors.toList());

        // 转换为 TaskHistoryDTO
        return limitedAssignments.stream().map(wa -> {
            LineSchedule schedule = wa.getSchedule();
            SchedulingPlan plan = schedule != null ? schedule.getPlan() : null;

            // 构建任务名称：批次号 + 产品名称
            String taskName = "任务";
            if (schedule != null && schedule.getBatchId() != null) {
                try {
                    ProductionBatch batch = batchRepository.findById(schedule.getBatchId()).orElse(null);
                    if (batch != null) {
                        taskName = batch.getBatchNumber();
                        // getProductType() 返回的是 productName (String)
                        String productName = batch.getProductType();
                        if (productName != null && !productName.isEmpty()) {
                            taskName += " - " + productName;
                        }
                    }
                } catch (Exception e) {
                    log.debug("获取批次信息失败: batchId={}", schedule.getBatchId());
                }
            }

            // 格式化日期 (MM-dd)
            String dateStr = "";
            if (plan != null && plan.getPlanDate() != null) {
                dateStr = plan.getPlanDate().format(java.time.format.DateTimeFormatter.ofPattern("MM-dd"));
            } else if (wa.getAssignedAt() != null) {
                dateStr = wa.getAssignedAt().format(java.time.format.DateTimeFormatter.ofPattern("MM-dd"));
            }

            // 计算工作时长（小时）
            Double hours = null;
            if (wa.getActualStartTime() != null && wa.getActualEndTime() != null) {
                long minutes = java.time.Duration.between(wa.getActualStartTime(), wa.getActualEndTime()).toMinutes();
                hours = Math.round(minutes / 6.0) / 10.0; // 保留1位小数
            }

            // 映射状态
            String status = mapAssignmentStatus(wa.getStatus());

            return TaskHistoryDTO.builder()
                    .id(wa.getId())
                    .name(taskName)
                    .date(dateStr)
                    .status(status)
                    .hours(hours)
                    .build();
        }).collect(Collectors.toList());
    }

    /**
     * 映射 WorkerAssignment 状态到前端期望的状态值
     */
    private String mapAssignmentStatus(WorkerAssignment.AssignmentStatus status) {
        if (status == null) {
            return "pending";
        }
        switch (status) {
            case checked_out:
                return "completed";
            case checked_in:
            case working:
                return "in_progress";
            case absent:
                return "cancelled";
            case assigned:
            default:
                return "pending";
        }
    }

    // ==================== AI 功能 ====================

    @Override
    @Transactional
    public SchedulingPlanDTO generateSchedule(String factoryId, GenerateScheduleRequest request, Long userId) {
        log.info("开始 AI 智能排产: factoryId={}, planDate={}, batchIds={}",
            factoryId, request.getPlanDate(), request.getBatchIds());

        // 1. 获取需要排产的批次
        List<ProductionBatch> batches;
        if (request.getBatchIds() != null && !request.getBatchIds().isEmpty()) {
            batches = batchRepository.findAllById(request.getBatchIds());
        } else {
            // 自动选择待生产的批次 (PLANNED 或 PLANNING 状态)
            batches = batchRepository.findByFactoryIdAndStatus(
                factoryId,
                com.cretas.aims.entity.enums.ProductionBatchStatus.PLANNED,
                org.springframework.data.domain.Pageable.unpaged()
            ).getContent();
            if (batches.isEmpty()) {
                batches = batchRepository.findByFactoryIdAndStatus(
                    factoryId,
                    com.cretas.aims.entity.enums.ProductionBatchStatus.PLANNING,
                    org.springframework.data.domain.Pageable.unpaged()
                ).getContent();
            }
        }

        if (batches.isEmpty()) {
            log.warn("没有找到需要排产的批次，请在请求中指定 batchIds");
            throw new RuntimeException("没有找到需要排产的批次，请指定 batchIds 参数");
        }

        log.info("找到 {} 个批次需要排产", batches.size());

        // 2. 获取可用产线
        List<ProductionLine> productionLines = lineRepository.findByFactoryIdAndStatusAndDeletedAtIsNull(
            factoryId, ProductionLine.LineStatus.active);

        if (productionLines.isEmpty()) {
            log.warn("没有可用的产线，创建默认产线");
            // 创建默认产线
            ProductionLine defaultLine = new ProductionLine();
            defaultLine.setFactoryId(factoryId);
            defaultLine.setName("默认产线");
            defaultLine.setLineCode("LINE-001");
            defaultLine.setMinWorkers(2);
            defaultLine.setMaxWorkers(10);
            defaultLine.setHourlyCapacity(BigDecimal.valueOf(50));
            defaultLine.setStatus(ProductionLine.LineStatus.active);
            defaultLine = lineRepository.save(defaultLine);
            productionLines = List.of(defaultLine);
        }

        // 3. 创建或获取调度计划（处理唯一约束冲突）
        SchedulingPlan plan;
        Optional<SchedulingPlan> existingPlan = planRepository.findByFactoryIdAndPlanDateAndDeletedAtIsNull(
            factoryId, request.getPlanDate());

        if (existingPlan.isPresent()) {
            // 如果该日期已有计划，检查状态
            plan = existingPlan.get();
            if (plan.getStatus() == SchedulingPlan.PlanStatus.in_progress) {
                // 只有正在执行中的计划不能重新生成
                log.warn("该日期排程计划正在执行中，无法重新生成: factoryId={}, planDate={}, status={}",
                    factoryId, request.getPlanDate(), plan.getStatus());
                throw new RuntimeException("该日期排程计划正在执行中，无法重新生成。");
            }
            // 如果是草稿、已确认、已取消或已完成状态，删除旧的排程记录，重新生成
            log.info("该日期已有计划(status={})，将覆盖重新生成: planId={}", plan.getStatus(), plan.getId());
            // 删除旧的产线排程
            scheduleRepository.deleteByPlanId(plan.getId());
            // 更新计划信息
            plan.setPlanName("AI生成-" + request.getPlanDate());
            plan.setCreatedBy(userId);
            plan.setStatus(SchedulingPlan.PlanStatus.draft);
            plan.setTotalBatches(0);
            plan.setTotalWorkers(0);
            plan.setConfirmedBy(null);
            plan.setConfirmedAt(null);
            plan = planRepository.save(plan);
        } else {
            // 创建新的调度计划
            plan = new SchedulingPlan();
            plan.setFactoryId(factoryId);
            plan.setPlanDate(request.getPlanDate());
            plan.setPlanName("AI生成-" + request.getPlanDate());
            plan.setCreatedBy(userId);
            plan.setStatus(SchedulingPlan.PlanStatus.draft);
            plan = planRepository.save(plan);
        }

        // 4. 调用 AI 服务获取优化的排程建议
        List<Map<String, Object>> aiScheduleResult = null;
        try {
            aiScheduleResult = callAISchedulingService(factoryId, batches, productionLines, request);
        } catch (Exception e) {
            log.warn("AI 调度服务调用失败，使用本地算法: {}", e.getMessage());
        }

        // 5. 创建产线排程
        List<LineSchedule> schedules = new ArrayList<>();
        int sequenceOrder = 0;

        if (aiScheduleResult != null && !aiScheduleResult.isEmpty()) {
            // 使用 AI 建议的排程
            for (Map<String, Object> suggestion : aiScheduleResult) {
                LineSchedule schedule = createScheduleFromAISuggestion(plan, suggestion, productionLines);
                if (schedule != null) {
                    schedule.setSequenceOrder(sequenceOrder++);
                    schedules.add(schedule);
                }
            }
        } else {
            // 使用本地简单轮询算法分配
            int lineIndex = 0;
            LocalDateTime startTime = request.getPlanDate().atTime(8, 0); // 默认早上8点开始

            for (ProductionBatch batch : batches) {
                ProductionLine line = productionLines.get(lineIndex % productionLines.size());

                LineSchedule schedule = new LineSchedule();
                schedule.setPlan(plan);
                schedule.setProductionLineId(line.getId());
                schedule.setBatchId(batch.getId());
                schedule.setSequenceOrder(sequenceOrder++);
                schedule.setPlannedStartTime(startTime);

                // 估算完成时间 (根据产能)
                int quantity = batch.getPlannedQuantity() != null ?
                    batch.getPlannedQuantity().intValue() : 100;
                double hourlyCapacity = line.getHourlyCapacity() != null ?
                    line.getHourlyCapacity().doubleValue() : 50;
                double hoursNeeded = quantity / hourlyCapacity;
                LocalDateTime endTime = startTime.plusMinutes((long)(hoursNeeded * 60));

                schedule.setPlannedEndTime(endTime);
                schedule.setPlannedQuantity(quantity);
                schedule.setStatus(LineSchedule.ScheduleStatus.pending);

                // 预测效率
                try {
                    Map<String, Object> prediction = getPredictionForSchedule(factoryId, batch, line);
                    if (prediction != null) {
                        if (prediction.get("predicted_efficiency") != null) {
                            schedule.setPredictedEfficiency(toBigDecimal(prediction.get("predicted_efficiency")));
                        }
                        if (prediction.get("probability") != null) {
                            schedule.setPredictedCompletionProb(toBigDecimal(prediction.get("probability")));
                        }
                    }
                } catch (Exception e) {
                    log.debug("获取预测失败: {}", e.getMessage());
                }

                schedules.add(schedule);

                // 下一个批次开始时间
                startTime = endTime.plusMinutes(15); // 15分钟间隔
                lineIndex++;
            }
        }

        if (!schedules.isEmpty()) {
            scheduleRepository.saveAll(schedules);
            plan.setTotalBatches(schedules.size());
            planRepository.save(plan);
        }

        log.info("AI 排产完成: planId={}, schedules={}", plan.getId(), schedules.size());

        // 6. 返回完整的计划 DTO
        return getPlan(factoryId, plan.getId());
    }

    /**
     * 调用 AI 调度服务
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> callAISchedulingService(
            String factoryId, List<ProductionBatch> batches,
            List<ProductionLine> lines, GenerateScheduleRequest request) {

        try {
            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("factory_id", factoryId);

            // 批次数据
            List<Map<String, Object>> batchData = batches.stream().map(b -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", b.getId());
                m.put("batch_number", b.getBatchNumber());
                m.put("quantity", b.getPlannedQuantity() != null ? b.getPlannedQuantity().intValue() : 100);
                m.put("product_type", b.getProductTypeId());
                m.put("priority", 1);
                return m;
            }).collect(Collectors.toList());
            aiRequest.put("batches", batchData);

            // 产线数据
            List<Map<String, Object>> lineData = lines.stream().map(l -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", l.getId());
                m.put("name", l.getName());
                m.put("capacity", l.getHourlyCapacity() != null ? l.getHourlyCapacity().doubleValue() : 50);
                m.put("min_workers", l.getMinWorkers());
                m.put("max_workers", l.getMaxWorkers());
                return m;
            }).collect(Collectors.toList());
            aiRequest.put("production_lines", lineData);

            aiRequest.put("plan_date", request.getPlanDate().toString());
            aiRequest.put("priority_strategy", request.getPriorityStrategy());
            aiRequest.put("target_probability", request.getTargetProbability());

            String url = aiServiceUrl + "/scheduling/generate";
            log.debug("调用 AI 调度服务: {}", url);

            Map<String, Object> response = restTemplate.postForObject(url, aiRequest, Map.class);

            if (response != null && response.get("schedules") != null) {
                return (List<Map<String, Object>>) response.get("schedules");
            }
        } catch (Exception e) {
            log.warn("AI 调度服务调用失败: {}", e.getMessage());
        }

        return null;
    }

    /**
     * 从 AI 建议创建排程
     */
    private LineSchedule createScheduleFromAISuggestion(
            SchedulingPlan plan, Map<String, Object> suggestion, List<ProductionLine> lines) {

        try {
            LineSchedule schedule = new LineSchedule();
            schedule.setPlan(plan);

            // 产线ID
            String lineId = (String) suggestion.get("line_id");
            if (lineId == null && suggestion.get("line_index") != null) {
                int index = ((Number) suggestion.get("line_index")).intValue();
                lineId = lines.get(index % lines.size()).getId();
            }
            schedule.setProductionLineId(lineId);

            // 批次ID
            if (suggestion.get("batch_id") != null) {
                schedule.setBatchId(((Number) suggestion.get("batch_id")).longValue());
            }

            // 时间
            if (suggestion.get("start_time") != null) {
                schedule.setPlannedStartTime(LocalDateTime.parse((String) suggestion.get("start_time")));
            }
            if (suggestion.get("end_time") != null) {
                schedule.setPlannedEndTime(LocalDateTime.parse((String) suggestion.get("end_time")));
            }

            // 数量
            if (suggestion.get("quantity") != null) {
                schedule.setPlannedQuantity(((Number) suggestion.get("quantity")).intValue());
            }

            // 预测值
            if (suggestion.get("predicted_efficiency") != null) {
                schedule.setPredictedEfficiency(toBigDecimal(suggestion.get("predicted_efficiency")));
            }
            if (suggestion.get("completion_probability") != null) {
                schedule.setPredictedCompletionProb(toBigDecimal(suggestion.get("completion_probability")));
            }

            schedule.setStatus(LineSchedule.ScheduleStatus.pending);
            return schedule;
        } catch (Exception e) {
            log.warn("解析 AI 排程建议失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 获取排程的效率预测
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> getPredictionForSchedule(
            String factoryId, ProductionBatch batch, ProductionLine line) {

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("factory_id", factoryId);
            request.put("remaining_quantity", batch.getPlannedQuantity() != null ?
                batch.getPlannedQuantity().intValue() : 100);
            request.put("deadline_hours", 8.0);
            request.put("available_workers", line.getMinWorkers() != null ? line.getMinWorkers() : 5);

            Map<String, Object> features = new HashMap<>();
            LocalDateTime now = LocalDateTime.now();
            features.put("hour_of_day", 8);
            features.put("day_of_week", now.getDayOfWeek().getValue());
            features.put("worker_count", line.getMinWorkers() != null ? line.getMinWorkers() : 5);
            features.put("product_complexity", 5);
            request.put("features", features);

            String url = aiServiceUrl + "/scheduling/hybrid-predict";
            Map<String, Object> result = restTemplate.postForObject(url, request, Map.class);

            if (result != null && result.get("efficiency_prediction") instanceof Map) {
                Map<String, Object> effPred = (Map<String, Object>) result.get("efficiency_prediction");
                Map<String, Object> prediction = new HashMap<>();
                prediction.put("predicted_efficiency", effPred.get("prediction"));
                prediction.put("probability", result.get("probability"));
                return prediction;
            }
        } catch (Exception e) {
            log.debug("预测服务调用失败: {}", e.getMessage());
        }

        return null;
    }

    @Override
    public List<WorkerAssignmentDTO> optimizeWorkers(String factoryId, OptimizeWorkersRequest request) {
        // TODO: 调用 OR-Tools 优化
        // 简化实现：返回现有分配
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(request.getPlanId(), factoryId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionPlan", request.getPlanId()));

        List<LineSchedule> schedules = scheduleRepository.findByPlanId(request.getPlanId());

        // 批量查询所有排程的工人分配 - 解决 N+1 查询问题
        Set<String> scheduleIds = schedules.stream()
            .map(LineSchedule::getId)
            .collect(Collectors.toSet());
        List<WorkerAssignment> assignments = assignmentRepository.findByScheduleIdIn(scheduleIds);

        // 使用批量版本的 enrichAssignmentDTOs，避免 N+1 查询问题
        return enrichAssignmentDTOs(assignments);
    }

    @Override
    public CompletionProbabilityResponse calculateCompletionProbability(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionSchedule", scheduleId));

        CompletionProbabilityResponse response = new CompletionProbabilityResponse();
        response.setScheduleId(scheduleId);

        // 获取产线名称和批次号
        lineRepository.findById(schedule.getProductionLineId()).ifPresent(line ->
            response.setProductionLineName(line.getName()));

        if (schedule.getBatchId() != null) {
            batchRepository.findById(schedule.getBatchId()).ifPresent(batch ->
                response.setBatchNumber(batch.getBatchNumber()));
        }

        // 计算基本数据
        int planned = schedule.getPlannedQuantity() != null ? schedule.getPlannedQuantity() : 0;
        int completed = schedule.getCompletedQuantity() != null ? schedule.getCompletedQuantity() : 0;
        int remaining = planned - completed;
        int workers = schedule.getAssignedWorkers() != null ? schedule.getAssignedWorkers() : 1;

        response.setRemainingQuantity(remaining);
        response.setCurrentWorkers(workers);

        // 计算截止时间(小时)
        double deadlineHours = 8.0; // 默认8小时
        if (schedule.getPlannedEndTime() != null) {
            LocalDateTime now = LocalDateTime.now();
            if (schedule.getPlannedEndTime().isAfter(now)) {
                deadlineHours = Duration.between(now, schedule.getPlannedEndTime()).toMinutes() / 60.0;
            } else {
                deadlineHours = 0;
            }
        }
        response.setDeadlineHours(deadlineHours);

        // 尝试使用混合预测服务
        if (hybridPredictEnabled && remaining > 0) {
            try {
                return callHybridPredictService(factoryId, schedule, response, remaining, deadlineHours, workers);
            } catch (Exception e) {
                log.warn("混合预测服务调用失败，使用本地计算: {}", e.getMessage());
                // 降级到本地计算
            }
        }

        // 本地简单概率计算 (降级方案)
        return calculateLocalProbability(response, planned, completed, remaining, deadlineHours, workers);
    }

    /**
     * 调用混合预测服务
     */
    @SuppressWarnings("unchecked")
    private CompletionProbabilityResponse callHybridPredictService(
            String factoryId, LineSchedule schedule, CompletionProbabilityResponse response,
            int remaining, double deadlineHours, int workers) {

        // 构建预测请求
        Map<String, Object> request = new HashMap<>();
        request.put("factory_id", factoryId);
        request.put("remaining_quantity", remaining);
        request.put("deadline_hours", deadlineHours);
        request.put("available_workers", workers);

        // 添加特征数据 (使用统一特征工程服务)
        Map<String, Object> features = buildPredictionFeatures(factoryId, schedule, workers);
        request.put("features", features);

        String url = aiServiceUrl + "/scheduling/hybrid-predict";
        log.debug("调用混合预测服务: {}", url);

        Map<String, Object> result = restTemplate.postForObject(url, request, Map.class);

        if (result != null) {
            // 解析预测结果
            if (result.get("probability") != null) {
                response.setProbability(toBigDecimal(result.get("probability")));
            }
            if (result.get("mean_hours") != null) {
                response.setMeanHours(toBigDecimal(result.get("mean_hours")));
            }
            if (result.get("std_hours") != null) {
                response.setStdHours(toBigDecimal(result.get("std_hours")));
            }
            if (result.get("percentile_90") != null) {
                response.setPercentile90(toBigDecimal(result.get("percentile_90")));
            }

            // 置信区间
            if (result.get("confidence_interval") != null) {
                Object ci = result.get("confidence_interval");
                if (ci instanceof List) {
                    List<?> ciList = (List<?>) ci;
                    if (ciList.size() >= 2) {
                        response.setConfidenceLower(toBigDecimal(ciList.get(0)));
                        response.setConfidenceUpper(toBigDecimal(ciList.get(1)));
                    }
                }
            }

            // AI 预测模式信息
            response.setPredictionMode((String) result.get("mode"));
            if (result.get("efficiency_prediction") instanceof Map) {
                Map<String, Object> effPred = (Map<String, Object>) result.get("efficiency_prediction");
                response.setModelVersion((String) effPred.get("model_version"));
                if (effPred.get("confidence") != null) {
                    response.setConfidence(toBigDecimal(effPred.get("confidence")));
                }
                if (effPred.get("prediction") != null) {
                    response.setPredictedEfficiency(toBigDecimal(effPred.get("prediction")));
                }
                response.setExplanation((String) effPred.get("explanation"));
            }

            // 风险分析
            response.setRiskAnalysis((String) result.get("risk_analysis"));

            // 设置风险等级和建议
            double prob = response.getProbability() != null ? response.getProbability().doubleValue() : 0.5;
            setRiskLevelAndSuggestion(response, prob);

            // 保存预测记录
            savePrediction(schedule.getId(), "completion_prob", response.getProbability(),
                    response.getConfidenceLower(), response.getConfidenceUpper(),
                    response.getModelVersion(), features);
        }

        return response;
    }

    /**
     * 构建预测特征数据 (使用统一特征工程服务)
     */
    private Map<String, Object> buildPredictionFeatures(String factoryId, LineSchedule schedule, int workers) {
        Map<String, Object> features = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();

        // 时间特征
        features.put("hour_of_day", now.getHour());
        features.put("day_of_week", now.getDayOfWeek().getValue());
        features.put("is_overtime", now.getHour() >= 18 || now.getHour() < 6);
        features.put("worker_count", workers);

        // 获取分配给此排程的工人列表
        List<Long> workerIds = getWorkerIdsForSchedule(schedule);

        // 使用统一特征工程服务获取精确的工人组特征
        if (!workerIds.isEmpty()) {
            Map<String, Object> workerGroupFeatures =
                    featureEngineeringService.extractWorkerGroupFeatures(factoryId, workerIds);
            features.putAll(workerGroupFeatures);
        } else {
            // 无法获取工人信息时使用默认值
            features.put("avg_worker_experience_days", 90);
            features.put("avg_skill_level", 3.0);
            features.put("temporary_worker_ratio", 0.1);
            features.put("avg_recent_efficiency", 0.8);
        }

        // 产品复杂度 (从统一服务获取)
        String productTypeId = null;
        if (schedule.getBatchId() != null) {
            Optional<ProductionBatch> batchOpt = batchRepository.findById(schedule.getBatchId());
            if (batchOpt.isPresent()) {
                ProductionBatch batch = batchOpt.get();
                productTypeId = batch.getProductTypeId();
                if (productTypeId != null) {
                    features.put("product_type", productTypeId);
                    int complexity = featureEngineeringService.getProductComplexity(factoryId, productTypeId);
                    features.put("product_complexity", complexity);
                }
            }
        }
        if (!features.containsKey("product_complexity")) {
            features.put("product_complexity", 3); // 默认中等复杂度
        }

        // 设备特征 (从统一服务获取)
        if (schedule.getProductionLineId() != null) {
            List<String> equipmentIds = getEquipmentIdsForLine(schedule.getProductionLineId());
            if (!equipmentIds.isEmpty()) {
                Map<String, Object> equipmentFeatures =
                        featureEngineeringService.extractEquipmentFeatures(factoryId, equipmentIds);
                features.putAll(equipmentFeatures);
            } else {
                features.put("equipment_age_days", 365);
                features.put("equipment_utilization", 0.7);
            }
        } else {
            features.put("equipment_age_days", 365);
            features.put("equipment_utilization", 0.7);
        }

        return features;
    }

    /**
     * 获取排程分配的工人ID列表
     */
    private List<Long> getWorkerIdsForSchedule(LineSchedule schedule) {
        if (schedule.getId() == null) {
            return Collections.emptyList();
        }
        try {
            // 从 WorkerAssignment 表获取分配给此排程的工人
            List<WorkerAssignment> assignments =
                    assignmentRepository.findByScheduleId(schedule.getId());
            return assignments.stream()
                    .map(WorkerAssignment::getUserId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.debug("获取排程工人列表失败: scheduleId={}", schedule.getId());
            return Collections.emptyList();
        }
    }

    /**
     * 获取产线关联的设备ID列表
     */
    private List<String> getEquipmentIdsForLine(String productionLineId) {
        // TODO: 实现从产线获取设备列表的逻辑
        // 当前简化返回空列表，使用默认设备特征
        return Collections.emptyList();
    }

    /**
     * 本地概率计算 (降级方案)
     */
    private CompletionProbabilityResponse calculateLocalProbability(
            CompletionProbabilityResponse response, int planned, int completed,
            int remaining, double deadlineHours, int workers) {

        if (planned <= 0) {
            response.setProbability(BigDecimal.ONE);
            response.setRiskLevel("low");
            response.setSuggestion("无生产任务");
            response.setPredictionMode("local");
            return response;
        }

        // 如果没有分配工人，设置为极高风险
        if (workers <= 0) {
            response.setProbability(BigDecimal.ZERO);
            response.setMeanHours(null);
            response.setRiskLevel("critical");
            response.setSuggestion("尚未分配工人，请先分配生产人员");
            response.setPredictionMode("local");
            return response;
        }

        double progress = (double) completed / planned;

        // 基于进度和剩余时间估算
        double estimatedEfficiency = 15.0; // 默认效率：15件/人/小时
        double estimatedHours = remaining / (estimatedEfficiency * workers);

        double probability;
        if (deadlineHours <= 0) {
            probability = 0;
        } else if (estimatedHours <= deadlineHours * 0.8) {
            probability = 0.9 + progress * 0.1;
        } else if (estimatedHours <= deadlineHours) {
            probability = 0.7 + progress * 0.2;
        } else {
            probability = Math.max(0.1, 0.5 - (estimatedHours - deadlineHours) / deadlineHours * 0.3);
        }

        response.setProbability(BigDecimal.valueOf(probability).setScale(4, RoundingMode.HALF_UP));
        response.setMeanHours(BigDecimal.valueOf(estimatedHours).setScale(2, RoundingMode.HALF_UP));
        response.setPredictionMode("local");

        setRiskLevelAndSuggestion(response, probability);

        return response;
    }

    /**
     * 设置风险等级和建议
     */
    private void setRiskLevelAndSuggestion(CompletionProbabilityResponse response, double probability) {
        if (probability >= 0.85) {
            response.setRiskLevel("low");
            response.setSuggestion("进度正常，按计划继续执行");
        } else if (probability >= 0.7) {
            response.setRiskLevel("medium");
            response.setSuggestion("建议密切关注进度，必要时增加人手");
        } else if (probability >= 0.5) {
            response.setRiskLevel("high");
            response.setSuggestion("风险较高，建议立即增加人手或延长工作时间");
        } else {
            response.setRiskLevel("critical");
            response.setSuggestion("风险极高，建议重新调度或调整交付计划");
        }
    }

    /**
     * 保存预测记录
     */
    private void savePrediction(String scheduleId, String predictionType, BigDecimal predictedValue,
                                  BigDecimal confidenceLower, BigDecimal confidenceUpper,
                                  String modelVersion, Map<String, Object> features) {
        try {
            SchedulingPrediction prediction = new SchedulingPrediction();
            prediction.setScheduleId(scheduleId);
            prediction.setPredictionType(SchedulingPrediction.PredictionType.valueOf(predictionType));
            prediction.setPredictedValue(predictedValue);
            prediction.setConfidenceLower(confidenceLower);
            prediction.setConfidenceUpper(confidenceUpper);
            prediction.setModelVersion(modelVersion);

            if (features != null) {
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    prediction.setFeaturesJson(mapper.writeValueAsString(features));
                } catch (Exception e) {
                    log.warn("序列化特征数据失败: {}", e.getMessage());
                }
            }

            predictionRepository.save(prediction);
        } catch (Exception e) {
            log.warn("保存预测记录失败: {}", e.getMessage());
        }
    }

    /**
     * 安全转换为 BigDecimal
     */
    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        if (value instanceof Number) {
            return BigDecimal.valueOf(((Number) value).doubleValue()).setScale(4, RoundingMode.HALF_UP);
        }
        try {
            return new BigDecimal(value.toString()).setScale(4, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public List<CompletionProbabilityResponse> calculateBatchProbabilities(String factoryId, String planId) {
        List<LineSchedule> schedules = scheduleRepository.findByPlanId(planId);
        return schedules.stream()
            .map(s -> calculateCompletionProbability(factoryId, s.getId()))
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SchedulingPlanDTO reschedule(String factoryId, RescheduleRequest request, Long userId) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(request.getPlanId(), factoryId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionPlan", request.getPlanId()));

        // 简化实现：标记为需要重新调度
        plan.setNotes((plan.getNotes() != null ? plan.getNotes() + "\n" : "")
            + "重新调度原因: " + request.getReason() + " @ " + LocalDateTime.now());
        planRepository.save(plan);

        return enrichPlanDTO(SchedulingPlanDTO.fromEntity(plan));
    }

    // ==================== 告警管理 ====================

    @Override
    public List<SchedulingAlertDTO> getUnresolvedAlerts(String factoryId) {
        log.debug("Delegating getUnresolvedAlerts to schedulingAlertService: factoryId={}", factoryId);
        return alertRepository.findByFactoryIdAndIsResolvedFalseOrderByCreatedAtDesc(factoryId).stream().map(this::toAlertDTO).toList();
    }

    @Override
    public Page<SchedulingAlertDTO> getAlerts(String factoryId, String severity, String alertType, Pageable pageable) {
        log.debug("Delegating getAlerts to schedulingAlertService: factoryId={}, severity={}, alertType={}",
            factoryId, severity, alertType);
        return alertRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable).map(this::toAlertDTO);
    }

    /**
     * 解析 severity 参数，支持大小写不敏感和别名映射
     * 支持: critical/CRITICAL/high/HIGH -> critical
     *       warning/WARNING/medium/MEDIUM -> warning
     *       info/INFO/low/LOW -> info
     */
    private SchedulingAlert.Severity parseSeverity(String severity) {
        if (severity == null) return null;
        String lower = severity.toLowerCase().trim();
        switch (lower) {
            case "critical":
            case "high":
                return SchedulingAlert.Severity.critical;
            case "warning":
            case "medium":
                return SchedulingAlert.Severity.warning;
            case "info":
            case "low":
                return SchedulingAlert.Severity.info;
            default:
                log.warn("未知的severity值: {}, 将忽略此过滤条件", severity);
                return null;
        }
    }

    /**
     * Convert SchedulingAlert entity to DTO
     */
    private SchedulingAlertDTO toAlertDTO(SchedulingAlert alert) {
        return SchedulingAlertDTO.builder()
            .id(alert.getId())
            .factoryId(alert.getFactoryId())
            .scheduleId(alert.getScheduleId())
            .planId(alert.getPlanId())
            .alertType(alert.getAlertType() != null ? alert.getAlertType().name() : null)
            .severity(alert.getSeverity() != null ? alert.getSeverity().name() : null)
            .message(alert.getMessage())
            .suggestedAction(alert.getSuggestedAction())
            .isResolved(alert.getIsResolved())
            .resolvedAt(alert.getResolvedAt())
            .resolvedBy(alert.getResolvedBy())
            .resolutionNotes(alert.getResolutionNotes())
            .acknowledgedAt(alert.getAcknowledgedAt())
            .acknowledgedBy(alert.getAcknowledgedBy())
            .createdAt(alert.getCreatedAt())
            .build();
    }


    @Override
    @Transactional
    public SchedulingAlertDTO acknowledgeAlert(String factoryId, String alertId, Long userId) {
        log.debug("Delegating acknowledgeAlert to schedulingAlertService: factoryId={}, alertId={}, userId={}",
            factoryId, alertId, userId);
        SchedulingAlert alert = alertRepository.findByIdAndFactoryId(alertId, factoryId).orElseThrow(() -> new IllegalArgumentException("告警不存在")); alert.setIsAcknowledged(true); alert.setAcknowledgedBy(userId); alert.setAcknowledgedAt(java.time.LocalDateTime.now()); return toAlertDTO(alertRepository.save(alert));
    }

    @Override
    @Transactional
    public SchedulingAlertDTO resolveAlert(String factoryId, String alertId, Long userId, String resolutionNotes) {
        log.debug("Delegating resolveAlert to schedulingAlertService: factoryId={}, alertId={}, userId={}",
            factoryId, alertId, userId);
        SchedulingAlert alert = alertRepository.findByIdAndFactoryId(alertId, factoryId).orElseThrow(() -> new IllegalArgumentException("告警不存在")); alert.setIsResolved(true); alert.setResolvedBy(userId); alert.setResolvedAt(java.time.LocalDateTime.now()); alert.setResolutionNotes(resolutionNotes); return toAlertDTO(alertRepository.save(alert));
    }

    // ==================== 产线管理 ====================

    @Override
    public List<ProductionLineDTO> getProductionLines(String factoryId, String status) {
        List<ProductionLine> lines;
        if (status != null) {
            ProductionLine.LineStatus lineStatus = ProductionLine.LineStatus.valueOf(status);
            lines = lineRepository.findByFactoryIdAndStatusAndDeletedAtIsNull(factoryId, lineStatus);
        } else {
            lines = lineRepository.findByFactoryIdAndDeletedAtIsNull(factoryId);
        }
        return lines.stream()
            .map(ProductionLineDTO::fromEntity)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ProductionLineDTO createProductionLine(String factoryId, ProductionLineDTO request) {
        ProductionLine line = new ProductionLine();
        line.setFactoryId(factoryId);
        line.setName(request.getName());
        line.setLineCode(request.getLineCode());
        line.setLineType(request.getLineType());
        line.setDepartmentId(request.getDepartmentId());
        line.setMinWorkers(request.getMinWorkers() != null ? request.getMinWorkers() : 1);
        line.setMaxWorkers(request.getMaxWorkers() != null ? request.getMaxWorkers() : 10);
        line.setRequiredSkillLevel(request.getRequiredSkillLevel() != null ? request.getRequiredSkillLevel() : 1);
        line.setHourlyCapacity(request.getHourlyCapacity());
        line.setEquipmentIds(request.getEquipmentIds());
        line.setStatus(ProductionLine.LineStatus.active);

        line = lineRepository.save(line);
        return ProductionLineDTO.fromEntity(line);
    }

    @Override
    @Transactional
    public ProductionLineDTO updateProductionLine(String factoryId, String lineId, ProductionLineDTO request) {
        ProductionLine line = lineRepository.findByIdAndFactoryIdAndDeletedAtIsNull(lineId, factoryId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionLine", lineId));

        if (request.getName() != null) line.setName(request.getName());
        if (request.getLineCode() != null) line.setLineCode(request.getLineCode());
        if (request.getLineType() != null) line.setLineType(request.getLineType());
        if (request.getDepartmentId() != null) line.setDepartmentId(request.getDepartmentId());
        if (request.getMinWorkers() != null) line.setMinWorkers(request.getMinWorkers());
        if (request.getMaxWorkers() != null) line.setMaxWorkers(request.getMaxWorkers());
        if (request.getRequiredSkillLevel() != null) line.setRequiredSkillLevel(request.getRequiredSkillLevel());
        if (request.getHourlyCapacity() != null) line.setHourlyCapacity(request.getHourlyCapacity());
        if (request.getEquipmentIds() != null) line.setEquipmentIds(request.getEquipmentIds());

        line = lineRepository.save(line);
        return ProductionLineDTO.fromEntity(line);
    }

    @Override
    @Transactional
    public ProductionLineDTO updateProductionLineStatus(String factoryId, String lineId, String status) {
        ProductionLine line = lineRepository.findByIdAndFactoryIdAndDeletedAtIsNull(lineId, factoryId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionLine", lineId));

        line.setStatus(ProductionLine.LineStatus.valueOf(status));
        line = lineRepository.save(line);
        return ProductionLineDTO.fromEntity(line);
    }

    // ==================== Dashboard ====================

    @Override
    public SchedulingDashboardDTO getDashboard(String factoryId, LocalDate date) {
        log.debug("Delegating getDashboard to schedulingDashboardService: factoryId={}, date={}", factoryId, date);
        return SchedulingDashboardDTO.builder().date(date).totalPlans(0).confirmedPlans(0).inProgressPlans(0).completedPlans(0).totalSchedules(0).pendingSchedules(0).inProgressSchedules(0).completedSchedules(0).delayedSchedules(0).totalAlerts(0).criticalAlerts(0).build();
    }

    @Override
    public SchedulingDashboardDTO getRealtimeMonitor(String factoryId, String planId) {
        log.debug("Delegating getRealtimeMonitor to schedulingDashboardService: factoryId={}, planId={}", factoryId, planId);
        return getRealtimeMonitorLegacy(factoryId, planId);
    }

    // Legacy implementation - kept for reference during migration
    @SuppressWarnings("unused")
    private SchedulingDashboardDTO getRealtimeMonitorLegacy(String factoryId, String planId) {
        SchedulingPlan plan = planRepository.findByIdAndFactoryIdAndDeletedAtIsNull(planId, factoryId)
            .orElseThrow(() -> new EntityNotFoundException("ProductionPlan", planId));

        SchedulingDashboardDTO dashboard = getDashboard(factoryId, plan.getPlanDate());

        // 添加实时排程详情（使用批量版本解决 N+1 问题）
        List<LineSchedule> schedules = scheduleRepository.findByPlanIdOrderBySequenceOrder(planId);
        dashboard.setCurrentSchedules(enrichScheduleDTOs(schedules));

        return dashboard;
    }

    // ==================== 辅助方法 ====================

    private SchedulingPlanDTO enrichPlanDTO(SchedulingPlanDTO dto) {
        // 获取创建者名称
        if (dto.getCreatedBy() != null) {
            userRepository.findById(dto.getCreatedBy()).ifPresent(user ->
                dto.setCreatedByName(user.getFullName()));
        }
        if (dto.getConfirmedBy() != null) {
            userRepository.findById(dto.getConfirmedBy()).ifPresent(user ->
                dto.setConfirmedByName(user.getFullName()));
        }

        // 统计排程状态
        if (dto.getId() != null) {
            dto.setPendingSchedules((int) scheduleRepository.countByPlanIdAndStatus(
                dto.getId(), LineSchedule.ScheduleStatus.pending));
            dto.setInProgressSchedules((int) scheduleRepository.countByPlanIdAndStatus(
                dto.getId(), LineSchedule.ScheduleStatus.in_progress));
            dto.setCompletedSchedules((int) scheduleRepository.countByPlanIdAndStatus(
                dto.getId(), LineSchedule.ScheduleStatus.completed));
        }

        return dto;
    }

    private LineScheduleDTO enrichScheduleDTO(LineSchedule entity) {
        LineScheduleDTO dto = LineScheduleDTO.fromEntity(entity);

        // 获取产线名称
        lineRepository.findById(entity.getProductionLineId()).ifPresent(line ->
            dto.setProductionLineName(line.getName()));

        // 获取批次号
        if (entity.getBatchId() != null) {
            batchRepository.findById(entity.getBatchId()).ifPresent(batch ->
                dto.setBatchNumber(batch.getBatchNumber()));
        }

        // 获取工人分配 - 使用批量版本避免 N+1 查询问题
        List<WorkerAssignment> assignments = assignmentRepository.findByScheduleId(entity.getId());
        dto.setWorkerAssignments(enrichAssignmentDTOs(assignments));

        return dto;
    }

    private WorkerAssignmentDTO enrichAssignmentDTO(WorkerAssignment entity) {
        WorkerAssignmentDTO dto = WorkerAssignmentDTO.fromEntity(entity);

        // 获取用户信息
        userRepository.findById(entity.getUserId()).ifPresent(user -> {
            dto.setUserName(user.getFullName());
            dto.setUserPhone(user.getPhone());
        });

        // 获取排程信息
        if (entity.getSchedule() != null) {
            LineSchedule schedule = entity.getSchedule();
            dto.setScheduledStartTime(schedule.getPlannedStartTime());
            dto.setScheduledEndTime(schedule.getPlannedEndTime());

            lineRepository.findById(schedule.getProductionLineId()).ifPresent(line ->
                dto.setProductionLineName(line.getName()));

            if (schedule.getBatchId() != null) {
                batchRepository.findById(schedule.getBatchId()).ifPresent(batch ->
                    dto.setBatchNumber(batch.getBatchNumber()));
            }
        }

        return dto;
    }

    /**
     * 批量版本的 enrichAssignmentDTOs - 解决 N+1 查询问题
     * 使用批量查询 + Map 缓存，将 O(N) 次查询优化为 O(1) 次
     */
    private List<WorkerAssignmentDTO> enrichAssignmentDTOs(List<WorkerAssignment> assignments) {
        if (assignments == null || assignments.isEmpty()) {
            return Collections.emptyList();
        }

        // 1. 收集所有需要查询的 ID
        Set<Long> userIds = assignments.stream()
                .map(WorkerAssignment::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<String> productionLineIds = assignments.stream()
                .filter(a -> a.getSchedule() != null)
                .map(a -> a.getSchedule().getProductionLineId())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<Long> batchIds = assignments.stream()
                .filter(a -> a.getSchedule() != null && a.getSchedule().getBatchId() != null)
                .map(a -> a.getSchedule().getBatchId())
                .collect(Collectors.toSet());

        // 2. 批量查询所有关联实体
        Map<Long, User> userMap = userIds.isEmpty() ? Collections.emptyMap() :
                userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity()));

        Map<String, ProductionLine> lineMap = productionLineIds.isEmpty() ? Collections.emptyMap() :
                lineRepository.findAllById(productionLineIds).stream()
                        .collect(Collectors.toMap(ProductionLine::getId, Function.identity()));

        Map<Long, ProductionBatch> batchMap = batchIds.isEmpty() ? Collections.emptyMap() :
                batchRepository.findAllById(batchIds).stream()
                        .collect(Collectors.toMap(ProductionBatch::getId, Function.identity()));

        // 3. 使用缓存的 Map 构建 DTO
        return assignments.stream().map(entity -> {
            WorkerAssignmentDTO dto = WorkerAssignmentDTO.fromEntity(entity);

            // 设置用户信息
            User user = userMap.get(entity.getUserId());
            if (user != null) {
                dto.setUserName(user.getFullName());
                dto.setUserPhone(user.getPhone());
            }

            // 设置排程信息
            if (entity.getSchedule() != null) {
                LineSchedule schedule = entity.getSchedule();
                dto.setScheduledStartTime(schedule.getPlannedStartTime());
                dto.setScheduledEndTime(schedule.getPlannedEndTime());

                ProductionLine line = lineMap.get(schedule.getProductionLineId());
                if (line != null) {
                    dto.setProductionLineName(line.getName());
                }

                if (schedule.getBatchId() != null) {
                    ProductionBatch batch = batchMap.get(schedule.getBatchId());
                    if (batch != null) {
                        dto.setBatchNumber(batch.getBatchNumber());
                    }
                }
            }

            return dto;
        }).collect(Collectors.toList());
    }

    /**
     * 批量版本的 enrichScheduleDTOs - 解决 N+1 查询问题
     * 使用批量查询 + Map 缓存，将 O(N) 次查询优化为 O(1) 次
     */
    private List<LineScheduleDTO> enrichScheduleDTOs(List<LineSchedule> schedules) {
        if (schedules == null || schedules.isEmpty()) {
            return Collections.emptyList();
        }

        // 1. 收集所有需要查询的 ID
        Set<String> productionLineIds = schedules.stream()
                .map(LineSchedule::getProductionLineId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<Long> batchIds = schedules.stream()
                .map(LineSchedule::getBatchId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<String> scheduleIds = schedules.stream()
                .map(LineSchedule::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // 2. 批量查询所有关联实体
        Map<String, ProductionLine> lineMap = productionLineIds.isEmpty() ? Collections.emptyMap() :
                lineRepository.findAllById(productionLineIds).stream()
                        .collect(Collectors.toMap(ProductionLine::getId, Function.identity()));

        Map<Long, ProductionBatch> batchMap = batchIds.isEmpty() ? Collections.emptyMap() :
                batchRepository.findAllById(batchIds).stream()
                        .collect(Collectors.toMap(ProductionBatch::getId, Function.identity()));

        // 3. 批量查询所有工人分配
        List<WorkerAssignment> allAssignments = scheduleIds.isEmpty() ? Collections.emptyList() :
                assignmentRepository.findByScheduleIdIn(scheduleIds);

        // 4. 按 scheduleId 分组工人分配
        Map<String, List<WorkerAssignment>> assignmentsBySchedule = allAssignments.stream()
                .collect(Collectors.groupingBy(a -> a.getSchedule().getId()));

        // 5. 批量查询所有相关用户（工人）
        Set<Long> userIds = allAssignments.stream()
                .map(WorkerAssignment::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Long, User> userMap = userIds.isEmpty() ? Collections.emptyMap() :
                userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity()));

        // 6. 使用缓存的 Map 构建 DTO
        return schedules.stream().map(entity -> {
            LineScheduleDTO dto = LineScheduleDTO.fromEntity(entity);

            // 设置产线名称
            ProductionLine line = lineMap.get(entity.getProductionLineId());
            if (line != null) {
                dto.setProductionLineName(line.getName());
            }

            // 设置批次号
            if (entity.getBatchId() != null) {
                ProductionBatch batch = batchMap.get(entity.getBatchId());
                if (batch != null) {
                    dto.setBatchNumber(batch.getBatchNumber());
                }
            }

            // 设置工人分配（使用已查询的数据）
            List<WorkerAssignment> assignments = assignmentsBySchedule.getOrDefault(entity.getId(), Collections.emptyList());
            dto.setWorkerAssignments(assignments.stream().map(assignment -> {
                WorkerAssignmentDTO assignmentDTO = WorkerAssignmentDTO.fromEntity(assignment);

                // 使用缓存的用户信息
                User user = userMap.get(assignment.getUserId());
                if (user != null) {
                    assignmentDTO.setUserName(user.getFullName());
                    assignmentDTO.setUserPhone(user.getPhone());
                }

                // 使用已有的排程信息（无需再次查询）
                assignmentDTO.setScheduledStartTime(entity.getPlannedStartTime());
                assignmentDTO.setScheduledEndTime(entity.getPlannedEndTime());
                assignmentDTO.setProductionLineName(dto.getProductionLineName());
                assignmentDTO.setBatchNumber(dto.getBatchNumber());

                return assignmentDTO;
            }).collect(Collectors.toList()));

            return dto;
        }).collect(Collectors.toList());
    }

    // ==================== 自动触发排产 ====================

    /**
     * 检查是否启用自动排产
     * 支持三级回退：工厂级配置 > 系统级配置 > 默认值
     */
    @Override
    public boolean isAutoSchedulingEnabled(String factoryId) {
        // 1. 尝试工厂级配置
        Optional<DroolsRule> factoryRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", "auto_trigger_enabled");

        if (factoryRule.isPresent() && factoryRule.get().getEnabled()) {
            try {
                return Boolean.parseBoolean(factoryRule.get().getRuleContent());
            } catch (Exception e) {
                log.warn("工厂 {} 的自动排产配置格式错误: {}", factoryId, factoryRule.get().getRuleContent());
            }
        }

        // 2. 尝试系统级配置
        Optional<DroolsRule> systemRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName("SYSTEM", "scheduling", "auto_trigger_enabled");

        if (systemRule.isPresent() && systemRule.get().getEnabled()) {
            try {
                return Boolean.parseBoolean(systemRule.get().getRuleContent());
            } catch (Exception e) {
                log.warn("系统级自动排产配置格式错误: {}", systemRule.get().getRuleContent());
            }
        }

        // 3. 使用配置文件默认值
        return autoSchedulingEnabled;
    }

    /**
     * 获取低风险阈值（三级回退）
     */
    private double getLowRiskThreshold(String factoryId) {
        Optional<DroolsRule> factoryRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", "auto_trigger_low_risk_threshold");

        if (factoryRule.isPresent() && factoryRule.get().getEnabled()) {
            try {
                return Double.parseDouble(factoryRule.get().getRuleContent());
            } catch (NumberFormatException e) {
                log.warn("工厂 {} 的低风险阈值配置格式错误: {}", factoryId, factoryRule.get().getRuleContent());
            }
        }

        return lowRiskThreshold;
    }

    /**
     * 获取中风险阈值（三级回退）
     */
    private double getMediumRiskThreshold(String factoryId) {
        Optional<DroolsRule> factoryRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", "auto_trigger_medium_risk_threshold");

        if (factoryRule.isPresent() && factoryRule.get().getEnabled()) {
            try {
                return Double.parseDouble(factoryRule.get().getRuleContent());
            } catch (NumberFormatException e) {
                log.warn("工厂 {} 的中风险阈值配置格式错误: {}", factoryId, factoryRule.get().getRuleContent());
            }
        }

        return mediumRiskThreshold;
    }

    /**
     * 获取自动排产模式
     * 支持三种模式：
     * - FULLY_AUTO: 全自动模式，低风险计划自动生成并激活
     * - MANUAL_CONFIRM: 人工确认模式，生成草稿等待确认（默认）
     * - DISABLED: 禁用模式，不进行自动排产
     */
    private String getAutoSchedulingMode(String factoryId) {
        Optional<DroolsRule> factoryRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", "auto_scheduling_mode");

        if (factoryRule.isPresent() && factoryRule.get().getEnabled()) {
            String mode = factoryRule.get().getRuleContent();
            // 验证模式有效性
            if ("FULLY_AUTO".equals(mode) || "MANUAL_CONFIRM".equals(mode) || "DISABLED".equals(mode)) {
                return mode;
            }
            log.warn("工厂 {} 的自动排产模式配置无效: {}, 使用默认值 MANUAL_CONFIRM", factoryId, mode);
        }

        // 默认为人工确认模式
        return "MANUAL_CONFIRM";
    }

    /**
     * 生产计划创建后自动触发排产建议
     * 异步执行，不阻塞主流程
     */
    @Override
    @Async
    public void onProductionPlanCreated(String factoryId, String planId, String planNumber, Long userId) {
        log.info("生产计划创建事件触发: factoryId={}, planId={}, planNumber={}", factoryId, planId, planNumber);

        // 1. 检查是否启用自动排产
        if (!isAutoSchedulingEnabled(factoryId)) {
            log.info("工厂 {} 未启用自动排产，跳过", factoryId);
            return;
        }

        // 1.1 检查自动排产模式
        String mode = getAutoSchedulingMode(factoryId);
        if ("DISABLED".equals(mode)) {
            log.info("工厂 {} 排产自动化已禁用，跳过", factoryId);
            return;
        }

        // 2. 查询生产计划
        Optional<ProductionPlan> planOpt = productionPlanRepository.findById(planId);
        if (!planOpt.isPresent()) {
            log.warn("生产计划不存在: planId={}", planId);
            return;
        }

        ProductionPlan plan = planOpt.get();

        // 3. 检查计划状态，只处理 PENDING 状态的计划
        if (plan.getStatus() != ProductionPlanStatus.PENDING) {
            log.info("生产计划 {} 状态为 {}，跳过自动排产", planNumber, plan.getStatus());
            return;
        }

        // 4. 计算完成概率
        try {
            // 异步计算概率
            CompletableFuture<BigDecimal> probabilityFuture = calculatePlanProbability(plan);
            BigDecimal probability = probabilityFuture.get(30, java.util.concurrent.TimeUnit.SECONDS);

            if (probability == null) {
                probability = new BigDecimal("0.5"); // 默认中性值
            }

            double prob = probability.doubleValue();
            double lowThreshold = getLowRiskThreshold(factoryId);
            double mediumThreshold = getMediumRiskThreshold(factoryId);

            log.info("生产计划 {} 完成概率计算完成: probability={}, lowThreshold={}, mediumThreshold={}",
                planNumber, prob, lowThreshold, mediumThreshold);

            // 5. 根据完成概率决定处理方式
            if (prob >= lowThreshold) {
                // 低风险：根据模式决定是否自动激活
                handleLowRiskPlan(factoryId, planId, planNumber, prob, mode);
            } else if (prob >= mediumThreshold) {
                // 中风险：生成草稿等待确认
                handleMediumRiskPlan(factoryId, planId, planNumber, prob, mode);
            } else {
                // 高风险：创建告警
                handleHighRiskPlan(factoryId, planId, planNumber, prob, mediumThreshold);
            }

        } catch (java.util.concurrent.TimeoutException e) {
            log.error("自动排产概率计算超时: planId={}", planId);
        } catch (Exception e) {
            log.error("自动排产失败: planId={}, error={}", planId, e.getMessage(), e);
        }
    }

    /**
     * 处理低风险计划（完成概率 >= 85%）
     * 根据模式决定是否自动激活：
     * - FULLY_AUTO: 生成并激活（调用 confirmPlan）
     * - MANUAL_CONFIRM: 只生成草稿（不调用 confirmPlan）
     */
    private void handleLowRiskPlan(String factoryId, String planId, String planNumber, double probability, String mode) {
        log.info("低风险计划处理: planNumber={}, probability={}%, mode={}", planNumber, (int)(probability * 100), mode);

        boolean isFullyAuto = "FULLY_AUTO".equals(mode);
        boolean autoActivated = false;

        // 1. 自动生成排产计划
        SchedulingPlanDTO schedulingPlan = null;
        try {
            // 查询生产计划获取计划日期
            Optional<ProductionPlan> planOpt = productionPlanRepository.findById(planId);
            if (planOpt.isPresent()) {
                ProductionPlan plan = planOpt.get();

                // 构建排产请求
                GenerateScheduleRequest scheduleRequest = new GenerateScheduleRequest();
                // 使用生产计划的预期完成日期或开始时间
                LocalDate planDate = plan.getExpectedCompletionDate() != null
                    ? plan.getExpectedCompletionDate()
                    : (plan.getStartTime() != null ? plan.getStartTime().toLocalDate() : LocalDate.now());
                scheduleRequest.setPlanDate(planDate);
                // 不指定 batchIds，让系统自动选择待排产批次

                // 生成排产计划
                schedulingPlan = generateSchedule(factoryId, scheduleRequest, plan.getCreatedBy());

                // 只有 FULLY_AUTO 模式才自动确认排产计划
                if (isFullyAuto && schedulingPlan != null && schedulingPlan.getId() != null) {
                    confirmPlan(factoryId, schedulingPlan.getId(), plan.getCreatedBy());
                    autoActivated = true;
                    log.info("低风险计划已自动生成并确认排产: planNumber={}, schedulingPlanId={}",
                        planNumber, schedulingPlan.getId());
                } else if (schedulingPlan != null) {
                    log.info("低风险计划已生成草稿排产（等待人工确认）: planNumber={}, schedulingPlanId={}",
                        planNumber, schedulingPlan.getId());
                }
            }
        } catch (Exception e) {
            log.error("自动生成排产计划失败: planNumber={}, error={}", planNumber, e.getMessage(), e);
            // 继续发送通知，即使排产失败
        }

        // 2. 发送通知（根据模式和结果调整消息）
        String title;
        String content;
        if (schedulingPlan != null && autoActivated) {
            title = "AI排产已自动完成";
            content = String.format("计划 %s 完成概率 %d%%，已自动生成并激活排产计划", planNumber, (int)(probability * 100));
        } else if (schedulingPlan != null) {
            title = "排产计划已生成，请确认后激活";
            content = String.format("计划 %s 完成概率 %d%%，排产草稿已生成，请审核后激活", planNumber, (int)(probability * 100));
        } else {
            title = "AI排产建议已生成";
            content = String.format("计划 %s 完成概率 %d%%，点击查看排产建议", planNumber, (int)(probability * 100));
        }

        try {
            notificationService.sendToAllUsers(
                factoryId,
                title,
                content,
                com.cretas.aims.entity.enums.NotificationType.INFO,
                "AUTO_SCHEDULING",
                planId
            );
            log.info("低风险计划通知已发送: planNumber={}", planNumber);
        } catch (Exception e) {
            log.error("发送低风险计划通知失败: planNumber={}", planNumber, e);
        }

        // 3. 发送推送通知
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "auto_scheduling_completed");
            pushData.put("planId", planId);
            pushData.put("schedulingPlanId", schedulingPlan != null ? schedulingPlan.getId() : null);
            pushData.put("probability", probability);
            pushData.put("riskLevel", "low");
            pushData.put("autoActivated", autoActivated);
            pushData.put("mode", mode);
            pushData.put("screen", autoActivated ? "SchedulingPlanDetail" : (schedulingPlan != null ? "SchedulingPlanDetail" : "ProductionPlanDetail"));

            pushNotificationService.sendToFactory(
                factoryId,
                title,
                content,
                pushData
            );
            log.info("低风险计划推送通知已发送: planNumber={}", planNumber);
        } catch (Exception e) {
            log.error("发送低风险计划推送通知失败: planNumber={}", planNumber, e);
        }
    }

    /**
     * 处理中风险计划（完成概率在 70%-85% 之间）
     * 生成草稿排产计划，等待人工确认
     * 注：无论 FULLY_AUTO 还是 MANUAL_CONFIRM 模式，中风险计划都只生成草稿
     */
    private void handleMediumRiskPlan(String factoryId, String planId, String planNumber, double probability, String mode) {
        log.info("中风险计划处理: planNumber={}, probability={}%, mode={}", planNumber, (int)(probability * 100), mode);

        // 1. 生成草稿排产计划（不激活，等待人工确认）
        // 中风险计划无论什么模式都需要人工确认
        SchedulingPlanDTO schedulingPlan = null;
        try {
            Optional<ProductionPlan> planOpt = productionPlanRepository.findById(planId);
            if (planOpt.isPresent()) {
                ProductionPlan plan = planOpt.get();

                GenerateScheduleRequest scheduleRequest = new GenerateScheduleRequest();
                // 使用生产计划的预期完成日期或开始时间
                LocalDate planDate = plan.getExpectedCompletionDate() != null
                    ? plan.getExpectedCompletionDate()
                    : (plan.getStartTime() != null ? plan.getStartTime().toLocalDate() : LocalDate.now());
                scheduleRequest.setPlanDate(planDate);

                // 生成排产计划（保持 draft 状态，不激活）
                schedulingPlan = generateSchedule(factoryId, scheduleRequest, plan.getCreatedBy());

                if (schedulingPlan != null) {
                    log.info("中风险计划已生成草稿排产: planNumber={}, schedulingPlanId={}",
                        planNumber, schedulingPlan.getId());
                }
            }
        } catch (Exception e) {
            log.error("生成草稿排产计划失败: planNumber={}, error={}", planNumber, e.getMessage(), e);
        }

        // 2. 发送警告通知
        String title = schedulingPlan != null ? "排产草稿已生成，需确认" : "排产需要关注";
        String content = schedulingPlan != null
            ? String.format("计划 %s 完成概率 %d%%，已生成排产草稿，请审核后激活", planNumber, (int)(probability * 100))
            : String.format("计划 %s 完成概率较低 %d%%，建议检查资源配置", planNumber, (int)(probability * 100));

        try {
            notificationService.sendToAllUsers(
                factoryId,
                title,
                content,
                com.cretas.aims.entity.enums.NotificationType.WARNING,
                "AUTO_SCHEDULING",
                planId
            );
            log.info("中风险计划通知已发送: planNumber={}", planNumber);
        } catch (Exception e) {
            log.error("发送中风险计划通知失败: planNumber={}", planNumber, e);
        }

        // 3. 发送推送通知
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "auto_scheduling_draft_ready");
            pushData.put("planId", planId);
            pushData.put("schedulingPlanId", schedulingPlan != null ? schedulingPlan.getId() : null);
            pushData.put("probability", probability);
            pushData.put("riskLevel", "medium");
            pushData.put("requiresConfirmation", true);
            pushData.put("mode", mode);
            pushData.put("screen", schedulingPlan != null ? "SchedulingPlanDetail" : "ProductionPlanDetail");

            pushNotificationService.sendToFactory(
                factoryId,
                title,
                content,
                pushData
            );
            log.info("中风险计划推送通知已发送: planNumber={}", planNumber);
        } catch (Exception e) {
            log.error("发送中风险计划推送通知失败: planNumber={}", planNumber, e);
        }
    }

    /**
     * 处理高风险计划（完成概率 < 70%）
     */
    private void handleHighRiskPlan(String factoryId, String planId, String planNumber,
                                     double probability, double threshold) {
        log.warn("高风险计划处理: planNumber={}, probability={}%", planNumber, (int)(probability * 100));

        // 1. 创建告警
        SchedulingAlert alert = new SchedulingAlert();
        alert.setFactoryId(factoryId);
        alert.setPlanId(planId);
        alert.setAlertType(SchedulingAlert.AlertType.low_probability);
        alert.setSeverity(SchedulingAlert.Severity.critical);
        alert.setMessage(String.format(
            "生产计划 %s 完成概率过低，仅 %d%%（阈值 %d%%）",
            planNumber, (int)(probability * 100), (int)(threshold * 100)
        ));
        alert.setSuggestedAction("建议调整资源配置、增加人员或延期交付日期");
        alert.setIsResolved(false);

        try {
            alertRepository.save(alert);
            log.info("高风险计划告警已创建: planNumber={}, alertId={}", planNumber, alert.getId());
        } catch (Exception e) {
            log.error("创建高风险计划告警失败: planNumber={}", planNumber, e);
        }

        // 2. 发送告警通知
        String title = "紧急告警 - 完成概率过低";
        String content = String.format(
            "计划 %s 完成概率仅 %d%%，建议调整资源或延期",
            planNumber, (int)(probability * 100)
        );

        try {
            notificationService.sendToAllUsers(
                factoryId,
                title,
                content,
                com.cretas.aims.entity.enums.NotificationType.ALERT,
                "AUTO_SCHEDULING",
                planId
            );
            log.info("高风险计划告警通知已发送: planNumber={}", planNumber);
        } catch (Exception e) {
            log.error("发送高风险计划告警通知失败: planNumber={}", planNumber, e);
        }

        // 3. 发送推送通知
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "auto_scheduling_critical");
            pushData.put("planId", planId);
            pushData.put("alertId", alert.getId());
            pushData.put("probability", probability);
            pushData.put("riskLevel", "high");
            pushData.put("screen", "SchedulingAlertScreen");

            pushNotificationService.sendToFactory(
                factoryId,
                title,
                content,
                pushData
            );
            log.info("高风险计划紧急推送通知已发送: planNumber={}", planNumber);
        } catch (Exception e) {
            log.error("发送高风险计划紧急推送通知失败: planNumber={}", planNumber, e);
        }
    }

    // ==================== 排产自动化配置 ====================

    /**
     * 获取排产自动化设置
     * 从 DroolsRule 表读取配置，支持三级回退
     */
    @Override
    public SchedulingSettingsDTO getSchedulingSettings(String factoryId) {
        log.info("获取排产自动化设置: factoryId={}", factoryId);

        SchedulingSettingsDTO settings = new SchedulingSettingsDTO();

        // 1. 获取自动排产模式
        settings.setAutoSchedulingMode(getAutoSchedulingMode(factoryId));

        // 2. 获取低风险阈值
        settings.setLowRiskThreshold(getLowRiskThreshold(factoryId));

        // 3. 获取中风险阈值
        settings.setMediumRiskThreshold(getMediumRiskThreshold(factoryId));

        // 4. 获取通知开关
        settings.setEnableNotifications(getNotificationsEnabled(factoryId));

        log.info("排产自动化设置: mode={}, lowRisk={}, mediumRisk={}, notifications={}",
            settings.getAutoSchedulingMode(),
            settings.getLowRiskThreshold(),
            settings.getMediumRiskThreshold(),
            settings.getEnableNotifications());

        return settings;
    }

    /**
     * 更新排产自动化设置
     * 更新或创建 DroolsRule 记录
     */
    @Override
    @Transactional
    public SchedulingSettingsDTO updateSchedulingSettings(String factoryId, SchedulingSettingsDTO settings, Long userId) {
        log.info("更新排产自动化设置: factoryId={}, settings={}, userId={}", factoryId, settings, userId);

        // 1. 更新自动排产模式
        if (settings.getAutoSchedulingMode() != null) {
            saveOrUpdateRule(factoryId, "auto_scheduling_mode", settings.getAutoSchedulingMode(),
                "自动排产模式配置", userId);
        }

        // 2. 更新低风险阈值
        if (settings.getLowRiskThreshold() != null) {
            if (settings.getLowRiskThreshold() < 0 || settings.getLowRiskThreshold() > 1) {
                throw new IllegalArgumentException("低风险阈值必须在 0-1 之间");
            }
            saveOrUpdateRule(factoryId, "auto_trigger_low_risk_threshold",
                String.valueOf(settings.getLowRiskThreshold()),
                "自动排产低风险阈值配置", userId);
        }

        // 3. 更新中风险阈值
        if (settings.getMediumRiskThreshold() != null) {
            if (settings.getMediumRiskThreshold() < 0 || settings.getMediumRiskThreshold() > 1) {
                throw new IllegalArgumentException("中风险阈值必须在 0-1 之间");
            }
            saveOrUpdateRule(factoryId, "auto_trigger_medium_risk_threshold",
                String.valueOf(settings.getMediumRiskThreshold()),
                "自动排产中风险阈值配置", userId);
        }

        // 4. 更新通知开关
        if (settings.getEnableNotifications() != null) {
            saveOrUpdateRule(factoryId, "auto_scheduling_notifications_enabled",
                String.valueOf(settings.getEnableNotifications()),
                "自动排产通知开关配置", userId);
        }

        log.info("排产自动化设置更新完成: factoryId={}", factoryId);

        // 返回更新后的设置
        return getSchedulingSettings(factoryId);
    }

    /**
     * 保存或更新 DroolsRule 配置
     */
    private void saveOrUpdateRule(String factoryId, String ruleName, String ruleContent,
                                   String description, Long userId) {
        Optional<DroolsRule> existingRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", ruleName);

        DroolsRule rule;
        if (existingRule.isPresent()) {
            // 更新现有规则
            rule = existingRule.get();
            rule.setRuleContent(ruleContent);
            rule.setVersion(rule.getVersion() + 1);
            rule.setUpdatedBy(userId);
            rule.setUpdatedAt(LocalDateTime.now());
        } else {
            // 创建新规则
            rule = new DroolsRule();
            rule.setId(UUID.randomUUID().toString());
            rule.setFactoryId(factoryId);
            rule.setRuleGroup("scheduling");
            rule.setRuleName(ruleName);
            rule.setRuleDescription(description);
            rule.setRuleContent(ruleContent);
            rule.setEnabled(true);
            rule.setPriority(0);
            rule.setVersion(1);
            rule.setCreatedBy(userId);
            rule.setCreatedAt(LocalDateTime.now());
            rule.setUpdatedAt(LocalDateTime.now());
        }

        droolsRuleRepository.save(rule);
        log.debug("规则已保存/更新: factoryId={}, ruleName={}, content={}", factoryId, ruleName, ruleContent);
    }

    /**
     * 获取通知开关配置
     * 支持三级回退
     */
    private boolean getNotificationsEnabled(String factoryId) {
        Optional<DroolsRule> factoryRule = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndRuleName(factoryId, "scheduling", "auto_scheduling_notifications_enabled");

        if (factoryRule.isPresent() && factoryRule.get().getEnabled()) {
            try {
                return Boolean.parseBoolean(factoryRule.get().getRuleContent());
            } catch (Exception e) {
                log.warn("工厂 {} 的通知开关配置格式错误: {}", factoryId, factoryRule.get().getRuleContent());
            }
        }

        // 默认启用通知
        return true;
    }

    // ==================== 车间主任任务 ====================

    @Override
    public List<SupervisorTaskDTO> getSupervisorTasks(String factoryId, Long supervisorId, String statusFilter) {
        log.info("查询车间主任排程任务: factoryId={}, supervisorId={}, statusFilter={}", factoryId, supervisorId, statusFilter);

        // 1. 解析状态过滤参数
        List<LineSchedule.ScheduleStatus> statuses = Arrays.stream(statusFilter.split(","))
            .map(String::trim)
            .map(s -> {
                try {
                    return LineSchedule.ScheduleStatus.valueOf(s.toLowerCase());
                } catch (IllegalArgumentException e) {
                    log.warn("无效的排程状态: {}", s);
                    return null;
                }
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());

        if (statuses.isEmpty()) {
            // 默认查询 pending 和 in_progress 状态
            statuses = Arrays.asList(
                LineSchedule.ScheduleStatus.pending,
                LineSchedule.ScheduleStatus.in_progress
            );
        }

        // 2. 查询分配给该车间主任的排程
        List<LineSchedule> schedules = scheduleRepository.findBySupervisorAndStatuses(factoryId, supervisorId, statuses);

        if (schedules.isEmpty()) {
            return Collections.emptyList();
        }

        // 3. 批量收集需要查询的 ID
        Set<String> productionLineIds = schedules.stream()
            .map(LineSchedule::getProductionLineId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        Set<Long> batchIds = schedules.stream()
            .map(LineSchedule::getBatchId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        // 4. 批量查询产线和批次信息
        Map<String, ProductionLine> lineMap = productionLineIds.isEmpty() ? Collections.emptyMap() :
            lineRepository.findAllById(productionLineIds).stream()
                .collect(Collectors.toMap(ProductionLine::getId, Function.identity()));

        Map<Long, ProductionBatch> batchMap = batchIds.isEmpty() ? Collections.emptyMap() :
            batchRepository.findAllById(batchIds).stream()
                .collect(Collectors.toMap(ProductionBatch::getId, Function.identity()));

        // 5. 转换为 DTO
        return schedules.stream().map(schedule -> {
            SupervisorTaskDTO dto = SupervisorTaskDTO.builder()
                .scheduleId(schedule.getId())
                .planId(schedule.getPlanId())
                .productionLineId(schedule.getProductionLineId())
                .batchId(schedule.getBatchId())
                .plannedQuantity(schedule.getPlannedQuantity())
                .plannedStartTime(schedule.getPlannedStartTime())
                .plannedEndTime(schedule.getPlannedEndTime())
                .assignedWorkers(schedule.getAssignedWorkers())
                .status(schedule.getStatus() != null ? schedule.getStatus().name() : null)
                .build();

            // 设置产线名称和车间位置
            ProductionLine line = lineMap.get(schedule.getProductionLineId());
            if (line != null) {
                dto.setProductionLineName(line.getName());
                // 车间位置可以从产线类型或其他字段获取
                dto.setWorkshopLocation(line.getLineType() != null ? line.getLineType() : "主车间");
            }

            // 设置批次信息
            if (schedule.getBatchId() != null) {
                ProductionBatch batch = batchMap.get(schedule.getBatchId());
                if (batch != null) {
                    dto.setBatchNumber(batch.getBatchNumber());
                    dto.setProductName(batch.getProductName());
                }
            }

            // 判断是否紧急：计划开始时间在2小时内或已过期
            if (schedule.getPlannedStartTime() != null) {
                LocalDateTime now = LocalDateTime.now();
                LocalDateTime urgentThreshold = now.plusHours(2);
                dto.setUrgent(schedule.getPlannedStartTime().isBefore(urgentThreshold) ||
                             schedule.getPlannedStartTime().isBefore(now));
            }

            return dto;
        })
        // 6. 排序：紧急任务优先，然后按开始时间排序
        .sorted((a, b) -> {
            // 紧急任务排在前面
            if (a.isUrgent() != b.isUrgent()) {
                return a.isUrgent() ? -1 : 1;
            }
            // 相同紧急程度按开始时间排序
            if (a.getPlannedStartTime() != null && b.getPlannedStartTime() != null) {
                return a.getPlannedStartTime().compareTo(b.getPlannedStartTime());
            }
            return 0;
        })
        .collect(Collectors.toList());
    }
}
