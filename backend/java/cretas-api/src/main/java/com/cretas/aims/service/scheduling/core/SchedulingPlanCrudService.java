package com.cretas.aims.service.scheduling.core;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.LineSchedule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

/**
 * 调度计划 CRUD + 产线管理 + Dashboard + 告警管理
 */
public interface SchedulingPlanCrudService {

    // ==================== 调度计划 CRUD ====================

    SchedulingPlanDTO createPlan(String factoryId, CreateSchedulingPlanRequest request, Long userId);

    SchedulingPlanDTO getPlan(String factoryId, String planId);

    Page<SchedulingPlanDTO> getPlans(String factoryId, LocalDate startDate, LocalDate endDate,
                                      String status, Pageable pageable);

    SchedulingPlanDTO updatePlan(String factoryId, String planId, CreateSchedulingPlanRequest request);

    SchedulingPlanDTO confirmPlan(String factoryId, String planId, Long userId);

    void cancelPlan(String factoryId, String planId, String reason);

    // ==================== 产线管理 ====================

    List<ProductionLineDTO> getProductionLines(String factoryId, String status);

    ProductionLineDTO createProductionLine(String factoryId, ProductionLineDTO request);

    ProductionLineDTO updateProductionLine(String factoryId, String lineId, ProductionLineDTO request);

    ProductionLineDTO updateProductionLineStatus(String factoryId, String lineId, String status);

    // ==================== Dashboard ====================

    SchedulingDashboardDTO getDashboard(String factoryId, LocalDate date);

    SchedulingDashboardDTO getRealtimeMonitor(String factoryId, String planId);

    // ==================== 告警管理 ====================

    List<SchedulingAlertDTO> getUnresolvedAlerts(String factoryId);

    Page<SchedulingAlertDTO> getAlerts(String factoryId, String severity, String alertType, Pageable pageable);

    SchedulingAlertDTO acknowledgeAlert(String factoryId, String alertId, Long userId);

    SchedulingAlertDTO resolveAlert(String factoryId, String alertId, Long userId, String resolutionNotes);

    // ==================== 待排产批次与阈值 ====================

    List<ProductionPlanDTO> getPendingBatches(String factoryId, LocalDate startDate, LocalDate endDate);

    double getUrgentThreshold(String factoryId);

    void updateUrgentThreshold(String factoryId, Double threshold, Long userId);

    // ==================== DTO 丰富化（供外部调用） ====================

    SchedulingPlanDTO enrichPlanDTO(SchedulingPlanDTO dto);

    List<LineScheduleDTO> enrichScheduleDTOs(List<LineSchedule> schedules);
}
