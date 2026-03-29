package com.cretas.aims.service.impl;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.service.SchedulingService;
import com.cretas.aims.service.scheduling.core.LineScheduleService;
import com.cretas.aims.service.scheduling.core.SchedulingAIService;
import com.cretas.aims.service.scheduling.core.SchedulingPlanCrudService;
import com.cretas.aims.service.scheduling.core.WorkerAssignmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * 智能调度服务 — Facade
 *
 * 将原 3,095 行 God Object 拆分为 4 个专注子服务，
 * 本类仅做方法委托，不包含任何业务逻辑。
 *
 * @see SchedulingPlanCrudService  计划 CRUD + 产线 + Dashboard + 告警
 * @see LineScheduleService        产线排程操作
 * @see WorkerAssignmentService    工人分配 + LinUCB
 * @see SchedulingAIService        AI 排产 + 自动触发 + 配置 + 车间主任任务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingServiceImpl implements SchedulingService {

    private final SchedulingPlanCrudService planCrudService;
    private final LineScheduleService lineScheduleService;
    private final WorkerAssignmentService workerAssignmentService;
    private final SchedulingAIService schedulingAIService;

    // ==================== 调度计划 CRUD ====================

    @Override
    public SchedulingPlanDTO createPlan(String factoryId, CreateSchedulingPlanRequest request, Long userId) {
        return planCrudService.createPlan(factoryId, request, userId);
    }

    @Override
    public SchedulingPlanDTO getPlan(String factoryId, String planId) {
        return planCrudService.getPlan(factoryId, planId);
    }

    @Override
    public Page<SchedulingPlanDTO> getPlans(String factoryId, LocalDate startDate, LocalDate endDate,
                                             String status, Pageable pageable) {
        return planCrudService.getPlans(factoryId, startDate, endDate, status, pageable);
    }

    @Override
    public SchedulingPlanDTO updatePlan(String factoryId, String planId, CreateSchedulingPlanRequest request) {
        return planCrudService.updatePlan(factoryId, planId, request);
    }

    @Override
    public SchedulingPlanDTO confirmPlan(String factoryId, String planId, Long userId) {
        return planCrudService.confirmPlan(factoryId, planId, userId);
    }

    @Override
    public void cancelPlan(String factoryId, String planId, String reason) {
        planCrudService.cancelPlan(factoryId, planId, reason);
    }

    // ==================== 产线排程 ====================

    @Override
    public LineScheduleDTO getSchedule(String factoryId, String scheduleId) {
        return lineScheduleService.getSchedule(factoryId, scheduleId);
    }

    @Override
    public LineScheduleDTO updateSchedule(String factoryId, String scheduleId, UpdateScheduleRequest request) {
        return lineScheduleService.updateSchedule(factoryId, scheduleId, request);
    }

    @Override
    public LineScheduleDTO startSchedule(String factoryId, String scheduleId) {
        return lineScheduleService.startSchedule(factoryId, scheduleId);
    }

    @Override
    public LineScheduleDTO completeSchedule(String factoryId, String scheduleId, Integer completedQuantity) {
        return lineScheduleService.completeSchedule(factoryId, scheduleId, completedQuantity);
    }

    @Override
    public LineScheduleDTO updateProgress(String factoryId, String scheduleId, Integer completedQuantity) {
        return lineScheduleService.updateProgress(factoryId, scheduleId, completedQuantity);
    }

    // ==================== 工人分配 ====================

    @Override
    public List<WorkerAssignmentDTO> assignWorkers(String factoryId, AssignWorkerRequest request) {
        return workerAssignmentService.assignWorkers(factoryId, request);
    }

    @Override
    public void removeWorkerAssignment(String factoryId, String assignmentId) {
        workerAssignmentService.removeWorkerAssignment(factoryId, assignmentId);
    }

    @Override
    public WorkerAssignmentDTO workerCheckIn(String factoryId, String assignmentId) {
        return workerAssignmentService.workerCheckIn(factoryId, assignmentId);
    }

    @Override
    public WorkerAssignmentDTO workerCheckOut(String factoryId, String assignmentId, Integer performanceScore) {
        return workerAssignmentService.workerCheckOut(factoryId, assignmentId, performanceScore);
    }

    @Override
    public List<WorkerAssignmentDTO> getWorkerAssignments(String factoryId, Long userId, LocalDate date) {
        return workerAssignmentService.getWorkerAssignments(factoryId, userId, date);
    }

    @Override
    public List<TaskHistoryDTO> getEmployeeTaskHistory(String factoryId, Long userId, Integer limit) {
        return workerAssignmentService.getEmployeeTaskHistory(factoryId, userId, limit);
    }

    @Override
    public List<AvailableWorkerDTO> getAvailableWorkers(String factoryId, LocalDate date, String scheduleId) {
        return workerAssignmentService.getAvailableWorkers(factoryId, date, scheduleId);
    }

    // ==================== AI 功能 ====================

    @Override
    public SchedulingPlanDTO generateSchedule(String factoryId, GenerateScheduleRequest request, Long userId) {
        return schedulingAIService.generateSchedule(factoryId, request, userId);
    }

    @Override
    public List<WorkerAssignmentDTO> optimizeWorkers(String factoryId, OptimizeWorkersRequest request) {
        return schedulingAIService.optimizeWorkers(factoryId, request);
    }

    @Override
    public CompletionProbabilityResponse calculateCompletionProbability(String factoryId, String scheduleId) {
        return schedulingAIService.calculateCompletionProbability(factoryId, scheduleId);
    }

    @Override
    public List<CompletionProbabilityResponse> calculateBatchProbabilities(String factoryId, String planId) {
        return schedulingAIService.calculateBatchProbabilities(factoryId, planId);
    }

    @Override
    public SchedulingPlanDTO reschedule(String factoryId, RescheduleRequest request, Long userId) {
        return schedulingAIService.reschedule(factoryId, request, userId);
    }

    // ==================== 告警管理 ====================

    @Override
    public List<SchedulingAlertDTO> getUnresolvedAlerts(String factoryId) {
        return planCrudService.getUnresolvedAlerts(factoryId);
    }

    @Override
    public Page<SchedulingAlertDTO> getAlerts(String factoryId, String severity, String alertType, Pageable pageable) {
        return planCrudService.getAlerts(factoryId, severity, alertType, pageable);
    }

    @Override
    public SchedulingAlertDTO acknowledgeAlert(String factoryId, String alertId, Long userId) {
        return planCrudService.acknowledgeAlert(factoryId, alertId, userId);
    }

    @Override
    public SchedulingAlertDTO resolveAlert(String factoryId, String alertId, Long userId, String resolutionNotes) {
        return planCrudService.resolveAlert(factoryId, alertId, userId, resolutionNotes);
    }

    // ==================== 产线管理 ====================

    @Override
    public List<ProductionLineDTO> getProductionLines(String factoryId, String status) {
        return planCrudService.getProductionLines(factoryId, status);
    }

    @Override
    public ProductionLineDTO createProductionLine(String factoryId, ProductionLineDTO request) {
        return planCrudService.createProductionLine(factoryId, request);
    }

    @Override
    public ProductionLineDTO updateProductionLine(String factoryId, String lineId, ProductionLineDTO request) {
        return planCrudService.updateProductionLine(factoryId, lineId, request);
    }

    @Override
    public ProductionLineDTO updateProductionLineStatus(String factoryId, String lineId, String status) {
        return planCrudService.updateProductionLineStatus(factoryId, lineId, status);
    }

    // ==================== Dashboard ====================

    @Override
    public SchedulingDashboardDTO getDashboard(String factoryId, LocalDate date) {
        return planCrudService.getDashboard(factoryId, date);
    }

    @Override
    public SchedulingDashboardDTO getRealtimeMonitor(String factoryId, String planId) {
        return planCrudService.getRealtimeMonitor(factoryId, planId);
    }

    // ==================== 待排产批次与阈值 ====================

    @Override
    public List<ProductionPlanDTO> getPendingBatches(String factoryId, LocalDate startDate, LocalDate endDate) {
        return planCrudService.getPendingBatches(factoryId, startDate, endDate);
    }

    @Override
    public double getUrgentThreshold(String factoryId) {
        return planCrudService.getUrgentThreshold(factoryId);
    }

    @Override
    public void updateUrgentThreshold(String factoryId, Double threshold, Long userId) {
        planCrudService.updateUrgentThreshold(factoryId, threshold, userId);
    }

    // ==================== 自动触发排产 ====================

    @Override
    public void onProductionPlanCreated(String factoryId, String planId, String planNumber, Long userId) {
        schedulingAIService.onProductionPlanCreated(factoryId, planId, planNumber, userId);
    }

    @Override
    public boolean isAutoSchedulingEnabled(String factoryId) {
        return schedulingAIService.isAutoSchedulingEnabled(factoryId);
    }

    // ==================== 排产自动化配置 ====================

    @Override
    public SchedulingSettingsDTO getSchedulingSettings(String factoryId) {
        return schedulingAIService.getSchedulingSettings(factoryId);
    }

    @Override
    public SchedulingSettingsDTO updateSchedulingSettings(String factoryId, SchedulingSettingsDTO settings, Long userId) {
        return schedulingAIService.updateSchedulingSettings(factoryId, settings, userId);
    }

    // ==================== 车间主任任务 ====================

    @Override
    public List<SupervisorTaskDTO> getSupervisorTasks(String factoryId, Long supervisorId, String statusFilter) {
        return schedulingAIService.getSupervisorTasks(factoryId, supervisorId, statusFilter);
    }
}
