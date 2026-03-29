package com.cretas.aims.service.scheduling.core;

import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.ProductionPlan;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * AI 功能：排产生成、工人优化、完成概率预测、自动触发排产、自动化配置、车间主任任务
 */
public interface SchedulingAIService {

    // ==================== AI 排产 ====================

    SchedulingPlanDTO generateSchedule(String factoryId, GenerateScheduleRequest request, Long userId);

    List<WorkerAssignmentDTO> optimizeWorkers(String factoryId, OptimizeWorkersRequest request);

    CompletionProbabilityResponse calculateCompletionProbability(String factoryId, String scheduleId);

    List<CompletionProbabilityResponse> calculateBatchProbabilities(String factoryId, String planId);

    SchedulingPlanDTO reschedule(String factoryId, RescheduleRequest request, Long userId);

    CompletableFuture<BigDecimal> calculatePlanProbability(ProductionPlan plan);

    // ==================== 自动触发排产 ====================

    void onProductionPlanCreated(String factoryId, String planId, String planNumber, Long userId);

    boolean isAutoSchedulingEnabled(String factoryId);

    // ==================== 排产自动化配置 ====================

    SchedulingSettingsDTO getSchedulingSettings(String factoryId);

    SchedulingSettingsDTO updateSchedulingSettings(String factoryId, SchedulingSettingsDTO settings, Long userId);

    // ==================== 车间主任任务 ====================

    List<SupervisorTaskDTO> getSupervisorTasks(String factoryId, Long supervisorId, String statusFilter);
}
