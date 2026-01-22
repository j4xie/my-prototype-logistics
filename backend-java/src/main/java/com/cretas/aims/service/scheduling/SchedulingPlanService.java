package com.cretas.aims.service.scheduling;

import com.cretas.aims.dto.scheduling.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

/**
 * 调度计划服务接口
 *
 * 负责调度计划的核心逻辑，包括：
 * - 计划 CRUD
 * - 计划生成
 * - 计划重排
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface SchedulingPlanService {

    /**
     * 创建调度计划
     */
    SchedulingPlanDTO createPlan(String factoryId, CreateSchedulingPlanRequest request, Long userId);

    /**
     * 获取调度计划
     */
    SchedulingPlanDTO getPlan(String factoryId, String planId);

    /**
     * 分页获取调度计划列表
     */
    Page<SchedulingPlanDTO> getPlans(String factoryId, LocalDate startDate, LocalDate endDate,
                                      String status, Pageable pageable);

    /**
     * 更新调度计划
     */
    SchedulingPlanDTO updatePlan(String factoryId, String planId, CreateSchedulingPlanRequest request);

    /**
     * 确认调度计划
     */
    SchedulingPlanDTO confirmPlan(String factoryId, String planId, Long userId);

    /**
     * 取消调度计划
     */
    void cancelPlan(String factoryId, String planId, String reason);

    /**
     * 生成调度计划
     */
    SchedulingPlanDTO generateSchedule(String factoryId, GenerateScheduleRequest request, Long userId);

    /**
     * 重新排产
     */
    SchedulingPlanDTO reschedule(String factoryId, RescheduleRequest request, Long userId);

    /**
     * 获取待排产批次
     */
    List<com.cretas.aims.dto.production.ProductionPlanDTO> getPendingBatches(
            String factoryId, LocalDate startDate, LocalDate endDate, Long userId);
}
