package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.scheduling.SchedulingPlan;
import com.cretas.aims.entity.scheduling.LineSchedule;
import com.cretas.aims.repository.scheduling.SchedulingPlanRepository;
import com.cretas.aims.repository.scheduling.LineScheduleRepository;
import com.cretas.aims.service.scheduling.SchedulingPlanService;
import com.cretas.aims.mapper.SchedulingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 排产计划服务实现
 *
 * 负责排产计划的 CRUD 操作
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingPlanServiceImpl implements SchedulingPlanService {

    private final SchedulingPlanRepository planRepository;
    private final LineScheduleRepository scheduleRepository;
    private final SchedulingMapper mapper;

    @Override
    @Transactional
    public SchedulingPlanDTO createPlan(String factoryId, CreateSchedulingPlanRequest request, Long userId) {
        log.info("Creating scheduling plan for factory {} by user {}", factoryId, userId);

        SchedulingPlan plan = new SchedulingPlan();
        plan.setPlanId(generatePlanId());
        plan.setFactoryId(factoryId);
        plan.setPlanNumber(generatePlanNumber(factoryId));
        plan.setPlanDate(request.getPlanDate());
        plan.setStatus(SchedulingPlan.PlanStatus.draft);
        plan.setCreatedBy(userId);
        plan.setCreatedAt(LocalDateTime.now());

        if (request.getName() != null) {
            plan.setName(request.getName());
        }
        if (request.getDescription() != null) {
            plan.setDescription(request.getDescription());
        }

        SchedulingPlan saved = planRepository.save(plan);
        log.info("Created plan: {} with ID: {}", saved.getPlanNumber(), saved.getPlanId());

        return mapper.toDTO(saved);
    }

    @Override
    public SchedulingPlanDTO getPlan(String factoryId, String planId) {
        SchedulingPlan plan = planRepository.findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, planId)
                .orElseThrow(() -> new IllegalArgumentException("排产计划不存在: " + planId));
        return mapper.toDTO(plan);
    }

    @Override
    public Page<SchedulingPlanDTO> getPlans(String factoryId, LocalDate startDate, LocalDate endDate,
                                             String status, Pageable pageable) {
        Page<SchedulingPlan> plans;

        if (status != null && !status.isBlank()) {
            SchedulingPlan.PlanStatus planStatus = SchedulingPlan.PlanStatus.valueOf(status);
            plans = planRepository.findByFactoryIdAndStatusAndPlanDateBetweenAndDeletedAtIsNull(
                    factoryId, planStatus, startDate, endDate, pageable);
        } else {
            plans = planRepository.findByFactoryIdAndPlanDateBetweenAndDeletedAtIsNull(
                    factoryId, startDate, endDate, pageable);
        }

        return plans.map(mapper::toDTO);
    }

    @Override
    @Transactional
    public SchedulingPlanDTO updatePlan(String factoryId, String planId, CreateSchedulingPlanRequest request) {
        SchedulingPlan plan = planRepository.findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, planId)
                .orElseThrow(() -> new IllegalArgumentException("排产计划不存在: " + planId));

        if (plan.getStatus() != SchedulingPlan.PlanStatus.draft) {
            throw new IllegalStateException("只能修改草稿状态的计划");
        }

        if (request.getName() != null) {
            plan.setName(request.getName());
        }
        if (request.getDescription() != null) {
            plan.setDescription(request.getDescription());
        }
        if (request.getPlanDate() != null) {
            plan.setPlanDate(request.getPlanDate());
        }

        plan.setUpdatedAt(LocalDateTime.now());
        SchedulingPlan saved = planRepository.save(plan);

        log.info("Updated plan: {}", planId);
        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public SchedulingPlanDTO confirmPlan(String factoryId, String planId, Long userId) {
        SchedulingPlan plan = planRepository.findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, planId)
                .orElseThrow(() -> new IllegalArgumentException("排产计划不存在: " + planId));

        if (plan.getStatus() != SchedulingPlan.PlanStatus.draft) {
            throw new IllegalStateException("只能确认草稿状态的计划");
        }

        plan.setStatus(SchedulingPlan.PlanStatus.confirmed);
        plan.setConfirmedBy(userId);
        plan.setConfirmedAt(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());

        SchedulingPlan saved = planRepository.save(plan);
        log.info("Confirmed plan: {} by user {}", planId, userId);

        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public void cancelPlan(String factoryId, String planId, String reason) {
        SchedulingPlan plan = planRepository.findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, planId)
                .orElseThrow(() -> new IllegalArgumentException("排产计划不存在: " + planId));

        if (plan.getStatus() == SchedulingPlan.PlanStatus.completed) {
            throw new IllegalStateException("已完成的计划不能取消");
        }

        plan.setStatus(SchedulingPlan.PlanStatus.cancelled);
        plan.setCancelReason(reason);
        plan.setUpdatedAt(LocalDateTime.now());

        planRepository.save(plan);
        log.info("Cancelled plan: {} with reason: {}", planId, reason);
    }

    @Override
    @Transactional
    public SchedulingPlanDTO generateSchedule(String factoryId, GenerateScheduleRequest request, Long userId) {
        log.info("Generating schedule for factory {} by user {}", factoryId, userId);

        // 创建新计划
        SchedulingPlan plan = new SchedulingPlan();
        plan.setPlanId(generatePlanId());
        plan.setFactoryId(factoryId);
        plan.setPlanNumber(generatePlanNumber(factoryId));
        plan.setPlanDate(request.getPlanDate());
        plan.setStatus(SchedulingPlan.PlanStatus.draft);
        plan.setCreatedBy(userId);
        plan.setCreatedAt(LocalDateTime.now());
        plan.setIsAutoGenerated(true);

        SchedulingPlan saved = planRepository.save(plan);

        // 根据请求参数生成排程
        // 这里应该调用排程算法服务
        log.info("Generated schedule plan: {} with {} production plans",
                saved.getPlanNumber(), request.getProductionPlanIds().size());

        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public SchedulingPlanDTO reschedule(String factoryId, RescheduleRequest request, Long userId) {
        log.info("Rescheduling for factory {} by user {}", factoryId, userId);

        String originalPlanId = request.getOriginalPlanId();
        SchedulingPlan originalPlan = planRepository.findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, originalPlanId)
                .orElseThrow(() -> new IllegalArgumentException("原计划不存在: " + originalPlanId));

        // 取消原计划
        originalPlan.setStatus(SchedulingPlan.PlanStatus.cancelled);
        originalPlan.setCancelReason("重排");
        planRepository.save(originalPlan);

        // 创建新计划
        SchedulingPlan newPlan = new SchedulingPlan();
        newPlan.setPlanId(generatePlanId());
        newPlan.setFactoryId(factoryId);
        newPlan.setPlanNumber(generatePlanNumber(factoryId));
        newPlan.setPlanDate(originalPlan.getPlanDate());
        newPlan.setStatus(SchedulingPlan.PlanStatus.draft);
        newPlan.setCreatedBy(userId);
        newPlan.setCreatedAt(LocalDateTime.now());
        newPlan.setIsReschedule(true);
        newPlan.setOriginalPlanId(originalPlanId);

        SchedulingPlan saved = planRepository.save(newPlan);
        log.info("Rescheduled: {} -> {}", originalPlanId, saved.getPlanId());

        return mapper.toDTO(saved);
    }

    /**
     * 生成计划ID
     */
    private String generatePlanId() {
        return "SP" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /**
     * 生成计划编号
     */
    private String generatePlanNumber(String factoryId) {
        String dateStr = LocalDate.now().toString().replace("-", "");
        long count = planRepository.countByFactoryIdAndCreatedAtAfter(factoryId,
                LocalDate.now().atStartOfDay());
        return String.format("%s-%s-%03d", factoryId, dateStr, count + 1);
    }
}
