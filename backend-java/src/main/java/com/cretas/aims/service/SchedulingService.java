package com.cretas.aims.service;

import com.cretas.aims.dto.scheduling.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

/**
 * 智能调度服务接口
 */
public interface SchedulingService {

    // ==================== 调度计划 CRUD ====================

    SchedulingPlanDTO createPlan(String factoryId, CreateSchedulingPlanRequest request, Long userId);

    SchedulingPlanDTO getPlan(String factoryId, String planId);

    Page<SchedulingPlanDTO> getPlans(String factoryId, LocalDate startDate, LocalDate endDate,
                                      String status, Pageable pageable);

    SchedulingPlanDTO updatePlan(String factoryId, String planId, CreateSchedulingPlanRequest request);

    SchedulingPlanDTO confirmPlan(String factoryId, String planId, Long userId);

    void cancelPlan(String factoryId, String planId, String reason);

    // ==================== 产线排程 ====================

    LineScheduleDTO getSchedule(String factoryId, String scheduleId);

    LineScheduleDTO updateSchedule(String factoryId, String scheduleId, UpdateScheduleRequest request);

    LineScheduleDTO startSchedule(String factoryId, String scheduleId);

    LineScheduleDTO completeSchedule(String factoryId, String scheduleId, Integer completedQuantity);

    LineScheduleDTO updateProgress(String factoryId, String scheduleId, Integer completedQuantity);

    // ==================== 工人分配 ====================

    List<WorkerAssignmentDTO> assignWorkers(String factoryId, AssignWorkerRequest request);

    void removeWorkerAssignment(String factoryId, String assignmentId);

    WorkerAssignmentDTO workerCheckIn(String factoryId, String assignmentId);

    WorkerAssignmentDTO workerCheckOut(String factoryId, String assignmentId, Integer performanceScore);

    List<WorkerAssignmentDTO> getWorkerAssignments(String factoryId, Long userId, LocalDate date);

    // ==================== AI 功能 ====================

    SchedulingPlanDTO generateSchedule(String factoryId, GenerateScheduleRequest request, Long userId);

    List<WorkerAssignmentDTO> optimizeWorkers(String factoryId, OptimizeWorkersRequest request);

    CompletionProbabilityResponse calculateCompletionProbability(String factoryId, String scheduleId);

    List<CompletionProbabilityResponse> calculateBatchProbabilities(String factoryId, String planId);

    SchedulingPlanDTO reschedule(String factoryId, RescheduleRequest request, Long userId);

    // ==================== 告警管理 ====================

    List<SchedulingAlertDTO> getUnresolvedAlerts(String factoryId);

    Page<SchedulingAlertDTO> getAlerts(String factoryId, String severity, String alertType, Pageable pageable);

    SchedulingAlertDTO acknowledgeAlert(String factoryId, String alertId, Long userId);

    SchedulingAlertDTO resolveAlert(String factoryId, String alertId, Long userId, String resolutionNotes);

    // ==================== 产线管理 ====================

    List<ProductionLineDTO> getProductionLines(String factoryId, String status);

    ProductionLineDTO createProductionLine(String factoryId, ProductionLineDTO request);

    ProductionLineDTO updateProductionLine(String factoryId, String lineId, ProductionLineDTO request);

    ProductionLineDTO updateProductionLineStatus(String factoryId, String lineId, String status);

    // ==================== Dashboard ====================

    SchedulingDashboardDTO getDashboard(String factoryId, LocalDate date);

    SchedulingDashboardDTO getRealtimeMonitor(String factoryId, String planId);
}
