package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.service.SchedulingService;
import com.cretas.aims.service.UrgentInsertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.time.LocalDate;
import java.util.List;

/**
 * 智能调度控制器
 * 提供调度计划、产线排程、人员分配、AI辅助调度等功能
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/scheduling")
@RequiredArgsConstructor
public class SchedulingController {

    private final SchedulingService schedulingService;
    private final UrgentInsertService urgentInsertService;

    // ==================== 调度计划 CRUD ====================

    /**
     * 创建调度计划
     */
    @PostMapping("/plans")
    public ApiResponse<SchedulingPlanDTO> createPlan(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateSchedulingPlanRequest request,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("创建调度计划: factoryId={}, planDate={}", factoryId, request.getPlanDate());
        SchedulingPlanDTO plan = schedulingService.createPlan(factoryId, request, userId);
        return ApiResponse.success("创建成功", plan);
    }

    /**
     * 获取调度计划详情
     */
    @GetMapping("/plans/{planId}")
    public ApiResponse<SchedulingPlanDTO> getPlan(
            @PathVariable String factoryId,
            @PathVariable String planId) {
        log.info("获取调度计划详情: factoryId={}, planId={}", factoryId, planId);
        SchedulingPlanDTO plan = schedulingService.getPlan(factoryId, planId);
        return ApiResponse.success("获取成功", plan);
    }

    /**
     * 获取调度计划列表 (分页)
     */
    @GetMapping("/plans")
    public ApiResponse<Page<SchedulingPlanDTO>> getPlans(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("获取调度计划列表: factoryId={}, startDate={}, endDate={}, status={}",
                factoryId, startDate, endDate, status);
        Pageable pageable = PageRequest.of(page, size);
        Page<SchedulingPlanDTO> plans = schedulingService.getPlans(factoryId, startDate, endDate, status, pageable);
        return ApiResponse.success("获取成功", plans);
    }

    /**
     * 更新调度计划
     */
    @PutMapping("/plans/{planId}")
    public ApiResponse<SchedulingPlanDTO> updatePlan(
            @PathVariable String factoryId,
            @PathVariable String planId,
            @Valid @RequestBody CreateSchedulingPlanRequest request) {
        log.info("更新调度计划: factoryId={}, planId={}", factoryId, planId);
        SchedulingPlanDTO plan = schedulingService.updatePlan(factoryId, planId, request);
        return ApiResponse.success("更新成功", plan);
    }

    /**
     * 确认调度计划
     */
    @PostMapping("/plans/{planId}/confirm")
    public ApiResponse<SchedulingPlanDTO> confirmPlan(
            @PathVariable String factoryId,
            @PathVariable String planId,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("确认调度计划: factoryId={}, planId={}", factoryId, planId);
        SchedulingPlanDTO plan = schedulingService.confirmPlan(factoryId, planId, userId);
        return ApiResponse.success("确认成功", plan);
    }

    /**
     * 取消调度计划
     */
    @PostMapping("/plans/{planId}/cancel")
    public ApiResponse<Void> cancelPlan(
            @PathVariable String factoryId,
            @PathVariable String planId,
            @RequestParam(required = false) String reason) {
        log.info("取消调度计划: factoryId={}, planId={}, reason={}", factoryId, planId, reason);
        schedulingService.cancelPlan(factoryId, planId, reason);
        return ApiResponse.success("取消成功", null);
    }

    // ==================== 产线排程管理 ====================

    /**
     * 获取排程详情
     */
    @GetMapping("/schedules/{scheduleId}")
    public ApiResponse<LineScheduleDTO> getSchedule(
            @PathVariable String factoryId,
            @PathVariable String scheduleId) {
        log.info("获取排程详情: factoryId={}, scheduleId={}", factoryId, scheduleId);
        LineScheduleDTO schedule = schedulingService.getSchedule(factoryId, scheduleId);
        return ApiResponse.success("获取成功", schedule);
    }

    /**
     * 更新排程
     */
    @PutMapping("/schedules/{scheduleId}")
    public ApiResponse<LineScheduleDTO> updateSchedule(
            @PathVariable String factoryId,
            @PathVariable String scheduleId,
            @Valid @RequestBody UpdateScheduleRequest request) {
        log.info("更新排程: factoryId={}, scheduleId={}", factoryId, scheduleId);
        LineScheduleDTO schedule = schedulingService.updateSchedule(factoryId, scheduleId, request);
        return ApiResponse.success("更新成功", schedule);
    }

    /**
     * 开始排程 (启动生产)
     */
    @PostMapping("/schedules/{scheduleId}/start")
    public ApiResponse<LineScheduleDTO> startSchedule(
            @PathVariable String factoryId,
            @PathVariable String scheduleId) {
        log.info("开始排程: factoryId={}, scheduleId={}", factoryId, scheduleId);
        LineScheduleDTO schedule = schedulingService.startSchedule(factoryId, scheduleId);
        return ApiResponse.success("已开始生产", schedule);
    }

    /**
     * 完成排程
     */
    @PostMapping("/schedules/{scheduleId}/complete")
    public ApiResponse<LineScheduleDTO> completeSchedule(
            @PathVariable String factoryId,
            @PathVariable String scheduleId,
            @RequestParam Integer completedQuantity) {
        log.info("完成排程: factoryId={}, scheduleId={}, completedQuantity={}",
                factoryId, scheduleId, completedQuantity);
        LineScheduleDTO schedule = schedulingService.completeSchedule(factoryId, scheduleId, completedQuantity);
        return ApiResponse.success("已完成", schedule);
    }

    /**
     * 更新排程进度
     */
    @PostMapping("/schedules/{scheduleId}/progress")
    public ApiResponse<LineScheduleDTO> updateProgress(
            @PathVariable String factoryId,
            @PathVariable String scheduleId,
            @RequestParam Integer completedQuantity) {
        log.info("更新排程进度: factoryId={}, scheduleId={}, completedQuantity={}",
                factoryId, scheduleId, completedQuantity);
        LineScheduleDTO schedule = schedulingService.updateProgress(factoryId, scheduleId, completedQuantity);
        return ApiResponse.success("进度已更新", schedule);
    }

    // ==================== 工人分配管理 ====================

    /**
     * 分配工人
     */
    @PostMapping("/workers/assign")
    public ApiResponse<List<WorkerAssignmentDTO>> assignWorkers(
            @PathVariable String factoryId,
            @Valid @RequestBody AssignWorkerRequest request) {
        log.info("分配工人: factoryId={}, scheduleId={}, workerCount={}",
                factoryId, request.getScheduleId(), request.getWorkerIds().size());
        List<WorkerAssignmentDTO> assignments = schedulingService.assignWorkers(factoryId, request);
        return ApiResponse.success("分配成功", assignments);
    }

    /**
     * 移除工人分配
     */
    @DeleteMapping("/workers/assignments/{assignmentId}")
    public ApiResponse<Void> removeWorkerAssignment(
            @PathVariable String factoryId,
            @PathVariable String assignmentId) {
        log.info("移除工人分配: factoryId={}, assignmentId={}", factoryId, assignmentId);
        schedulingService.removeWorkerAssignment(factoryId, assignmentId);
        return ApiResponse.success("移除成功", null);
    }

    /**
     * 工人签到
     */
    @PostMapping("/workers/assignments/{assignmentId}/check-in")
    public ApiResponse<WorkerAssignmentDTO> workerCheckIn(
            @PathVariable String factoryId,
            @PathVariable String assignmentId) {
        log.info("工人签到: factoryId={}, assignmentId={}", factoryId, assignmentId);
        WorkerAssignmentDTO assignment = schedulingService.workerCheckIn(factoryId, assignmentId);
        return ApiResponse.success("签到成功", assignment);
    }

    /**
     * 工人签退
     */
    @PostMapping("/workers/assignments/{assignmentId}/check-out")
    public ApiResponse<WorkerAssignmentDTO> workerCheckOut(
            @PathVariable String factoryId,
            @PathVariable String assignmentId,
            @RequestParam(required = false) Integer performanceScore) {
        log.info("工人签退: factoryId={}, assignmentId={}, performanceScore={}",
                factoryId, assignmentId, performanceScore);
        WorkerAssignmentDTO assignment = schedulingService.workerCheckOut(factoryId, assignmentId, performanceScore);
        return ApiResponse.success("签退成功", assignment);
    }

    /**
     * 获取工人分配列表 (按用户和日期)
     */
    @GetMapping("/workers/assignments")
    public ApiResponse<List<WorkerAssignmentDTO>> getWorkerAssignments(
            @PathVariable String factoryId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        log.info("获取工人分配: factoryId={}, userId={}, date={}", factoryId, userId, date);
        List<WorkerAssignmentDTO> assignments = schedulingService.getWorkerAssignments(factoryId, userId, date);
        return ApiResponse.success("获取成功", assignments);
    }

    // ==================== AI 辅助功能 ====================

    /**
     * AI 生成调度计划
     */
    @PostMapping("/generate")
    public ApiResponse<SchedulingPlanDTO> generateSchedule(
            @PathVariable String factoryId,
            @Valid @RequestBody GenerateScheduleRequest request,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("AI生成调度计划: factoryId={}, planDate={}", factoryId, request.getPlanDate());
        SchedulingPlanDTO plan = schedulingService.generateSchedule(factoryId, request, userId);
        return ApiResponse.success("生成成功", plan);
    }

    /**
     * AI 优化人员分配
     */
    @PostMapping("/optimize-workers")
    public ApiResponse<List<WorkerAssignmentDTO>> optimizeWorkers(
            @PathVariable String factoryId,
            @Valid @RequestBody OptimizeWorkersRequest request) {
        log.info("AI优化人员分配: factoryId={}, planId={}", factoryId, request.getPlanId());
        List<WorkerAssignmentDTO> assignments = schedulingService.optimizeWorkers(factoryId, request);
        return ApiResponse.success("优化完成", assignments);
    }

    /**
     * 计算排程完成概率
     */
    @GetMapping("/schedules/{scheduleId}/probability")
    public ApiResponse<CompletionProbabilityResponse> calculateCompletionProbability(
            @PathVariable String factoryId,
            @PathVariable String scheduleId) {
        log.info("计算完成概率: factoryId={}, scheduleId={}", factoryId, scheduleId);
        CompletionProbabilityResponse probability = schedulingService.calculateCompletionProbability(factoryId, scheduleId);
        return ApiResponse.success("计算完成", probability);
    }

    /**
     * 批量计算计划内所有排程的完成概率
     */
    @GetMapping("/plans/{planId}/probabilities")
    public ApiResponse<List<CompletionProbabilityResponse>> calculateBatchProbabilities(
            @PathVariable String factoryId,
            @PathVariable String planId) {
        log.info("批量计算完成概率: factoryId={}, planId={}", factoryId, planId);
        List<CompletionProbabilityResponse> probabilities = schedulingService.calculateBatchProbabilities(factoryId, planId);
        return ApiResponse.success("计算完成", probabilities);
    }

    /**
     * 重新调度 (AI 辅助)
     */
    @PostMapping("/reschedule")
    public ApiResponse<SchedulingPlanDTO> reschedule(
            @PathVariable String factoryId,
            @Valid @RequestBody RescheduleRequest request,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("重新调度: factoryId={}, planId={}", factoryId, request.getPlanId());
        SchedulingPlanDTO plan = schedulingService.reschedule(factoryId, request, userId);
        return ApiResponse.success("重新调度完成", plan);
    }

    // ==================== 告警管理 ====================

    /**
     * 获取未解决告警列表
     */
    @GetMapping("/alerts/unresolved")
    public ApiResponse<List<SchedulingAlertDTO>> getUnresolvedAlerts(
            @PathVariable String factoryId) {
        log.info("获取未解决告警: factoryId={}", factoryId);
        List<SchedulingAlertDTO> alerts = schedulingService.getUnresolvedAlerts(factoryId);
        return ApiResponse.success("获取成功", alerts);
    }

    /**
     * 获取告警列表 (分页)
     */
    @GetMapping("/alerts")
    public ApiResponse<Page<SchedulingAlertDTO>> getAlerts(
            @PathVariable String factoryId,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String alertType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("获取告警列表: factoryId={}, severity={}, alertType={}", factoryId, severity, alertType);
        Pageable pageable = PageRequest.of(page, size);
        Page<SchedulingAlertDTO> alerts = schedulingService.getAlerts(factoryId, severity, alertType, pageable);
        return ApiResponse.success("获取成功", alerts);
    }

    /**
     * 确认告警
     */
    @PostMapping("/alerts/{alertId}/acknowledge")
    public ApiResponse<SchedulingAlertDTO> acknowledgeAlert(
            @PathVariable String factoryId,
            @PathVariable String alertId,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("确认告警: factoryId={}, alertId={}", factoryId, alertId);
        SchedulingAlertDTO alert = schedulingService.acknowledgeAlert(factoryId, alertId, userId);
        return ApiResponse.success("确认成功", alert);
    }

    /**
     * 解决告警
     */
    @PostMapping("/alerts/{alertId}/resolve")
    public ApiResponse<SchedulingAlertDTO> resolveAlert(
            @PathVariable String factoryId,
            @PathVariable String alertId,
            @RequestParam(required = false) String resolutionNotes,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("解决告警: factoryId={}, alertId={}", factoryId, alertId);
        SchedulingAlertDTO alert = schedulingService.resolveAlert(factoryId, alertId, userId, resolutionNotes);
        return ApiResponse.success("解决成功", alert);
    }

    // ==================== 产线管理 ====================

    /**
     * 获取产线列表
     */
    @GetMapping("/production-lines")
    public ApiResponse<List<ProductionLineDTO>> getProductionLines(
            @PathVariable String factoryId,
            @RequestParam(required = false) String status) {
        log.info("获取产线列表: factoryId={}, status={}", factoryId, status);
        List<ProductionLineDTO> lines = schedulingService.getProductionLines(factoryId, status);
        return ApiResponse.success("获取成功", lines);
    }

    /**
     * 创建产线
     */
    @PostMapping("/production-lines")
    public ApiResponse<ProductionLineDTO> createProductionLine(
            @PathVariable String factoryId,
            @Valid @RequestBody ProductionLineDTO request) {
        log.info("创建产线: factoryId={}, name={}", factoryId, request.getName());
        ProductionLineDTO line = schedulingService.createProductionLine(factoryId, request);
        return ApiResponse.success("创建成功", line);
    }

    /**
     * 更新产线
     */
    @PutMapping("/production-lines/{lineId}")
    public ApiResponse<ProductionLineDTO> updateProductionLine(
            @PathVariable String factoryId,
            @PathVariable String lineId,
            @Valid @RequestBody ProductionLineDTO request) {
        log.info("更新产线: factoryId={}, lineId={}", factoryId, lineId);
        ProductionLineDTO line = schedulingService.updateProductionLine(factoryId, lineId, request);
        return ApiResponse.success("更新成功", line);
    }

    /**
     * 更新产线状态
     */
    @PutMapping("/production-lines/{lineId}/status")
    public ApiResponse<ProductionLineDTO> updateProductionLineStatus(
            @PathVariable String factoryId,
            @PathVariable String lineId,
            @RequestParam String status) {
        log.info("更新产线状态: factoryId={}, lineId={}, status={}", factoryId, lineId, status);
        ProductionLineDTO line = schedulingService.updateProductionLineStatus(factoryId, lineId, status);
        return ApiResponse.success("状态更新成功", line);
    }

    // ==================== Dashboard ====================

    /**
     * 获取调度 Dashboard
     */
    @GetMapping("/dashboard")
    public ApiResponse<SchedulingDashboardDTO> getDashboard(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        if (date == null) {
            date = LocalDate.now();
        }
        log.info("获取调度Dashboard: factoryId={}, date={}", factoryId, date);
        SchedulingDashboardDTO dashboard = schedulingService.getDashboard(factoryId, date);
        return ApiResponse.success("获取成功", dashboard);
    }

    /**
     * 获取实时监控数据
     */
    @GetMapping("/realtime/{planId}")
    public ApiResponse<SchedulingDashboardDTO> getRealtimeMonitor(
            @PathVariable String factoryId,
            @PathVariable String planId) {
        log.info("获取实时监控: factoryId={}, planId={}", factoryId, planId);
        SchedulingDashboardDTO dashboard = schedulingService.getRealtimeMonitor(factoryId, planId);
        return ApiResponse.success("获取成功", dashboard);
    }

    // ==================== 紧急状态监控 ====================

    /**
     * 获取待排产批次列表（带紧急状态）
     * 用于AI智能排产页面的待选批次展示
     */
    @GetMapping("/pending-batches")
    public ApiResponse<List<ProductionPlanDTO>> getPendingBatches(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        log.info("获取待排产批次: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);
        List<ProductionPlanDTO> batches = schedulingService.getPendingBatches(factoryId, startDate, endDate);
        return ApiResponse.success("获取成功", batches);
    }

    /**
     * 获取当前紧急阈值配置
     */
    @GetMapping("/config/urgent-threshold")
    public ApiResponse<java.util.Map<String, Object>> getUrgentThresholdConfig(
            @PathVariable String factoryId) {
        log.info("获取紧急阈值配置: factoryId={}", factoryId);

        double threshold = schedulingService.getUrgentThreshold(factoryId);

        java.util.Map<String, Object> config = new java.util.HashMap<>();
        config.put("threshold", threshold);
        config.put("factoryId", factoryId);
        config.put("description", "完成概率低于此值时标记为紧急");

        return ApiResponse.success("获取成功", config);
    }

    /**
     * 更新紧急阈值配置（仅限管理员）
     * 注：此接口应配合权限控制使用
     */
    @PutMapping("/config/urgent-threshold")
    public ApiResponse<java.util.Map<String, Object>> updateUrgentThresholdConfig(
            @PathVariable String factoryId,
            @RequestBody java.util.Map<String, Double> request,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        Double newThreshold = request.get("threshold");

        if (newThreshold == null || newThreshold < 0 || newThreshold > 1) {
            return ApiResponse.error("阈值必须在0-1之间");
        }

        log.info("更新紧急阈值: factoryId={}, userId={}, threshold={}",
                factoryId, userId, newThreshold);

        schedulingService.updateUrgentThreshold(factoryId, newThreshold, userId);

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("threshold", newThreshold);
        result.put("factoryId", factoryId);
        result.put("updatedAt", java.time.LocalDateTime.now());

        return ApiResponse.success("更新成功", result);
    }

    // ==================== 紧急插单管理 (Phase C) ====================

    /**
     * 获取可用的插单时段列表
     * 返回按推荐分数排序的时段，包含多维度评分和影响分析
     */
    @GetMapping("/urgent-insert/slots")
    public ApiResponse<List<InsertSlotDTO>> getInsertSlots(
            @PathVariable String factoryId,
            @RequestParam(required = false) String productTypeId,
            @RequestParam(required = false) Integer quantity,
            @RequestParam(required = false) String deadline) {
        log.info("获取可用插单时段: factoryId={}, productTypeId={}, quantity={}",
                factoryId, productTypeId, quantity);

        GetInsertSlotsRequest request = new GetInsertSlotsRequest();
        request.setProductTypeId(productTypeId);
        if (quantity != null) {
            request.setRequiredQuantity(java.math.BigDecimal.valueOf(quantity));
        }
        if (deadline != null) {
            request.setDeadline(java.time.LocalDateTime.parse(deadline));
        }

        List<InsertSlotDTO> slots = urgentInsertService.getAvailableSlots(factoryId, request);
        return ApiResponse.success("获取成功", slots);
    }

    /**
     * 获取单个时段详情
     */
    @GetMapping("/urgent-insert/slots/{slotId}")
    public ApiResponse<InsertSlotDTO> getSlotDetail(
            @PathVariable String factoryId,
            @PathVariable String slotId) {
        log.info("获取时段详情: factoryId={}, slotId={}", factoryId, slotId);
        InsertSlotDTO slot = urgentInsertService.getSlotDetail(factoryId, slotId);
        return ApiResponse.success("获取成功", slot);
    }

    /**
     * 分析插单影响
     * 返回链式影响分析、资源检查、风险评估等详细信息
     */
    @GetMapping("/urgent-insert/slots/{slotId}/impact")
    public ApiResponse<java.util.Map<String, Object>> analyzeSlotImpact(
            @PathVariable String factoryId,
            @PathVariable String slotId,
            @RequestParam(required = false) String productTypeId,
            @RequestParam(required = false) Integer quantity,
            @RequestParam(required = false) String deadline) {
        log.info("分析插单影响: factoryId={}, slotId={}, productTypeId={}, quantity={}",
                factoryId, slotId, productTypeId, quantity);

        GetInsertSlotsRequest request = new GetInsertSlotsRequest();
        request.setProductTypeId(productTypeId);
        if (quantity != null) {
            request.setRequiredQuantity(java.math.BigDecimal.valueOf(quantity));
        }
        if (deadline != null) {
            request.setDeadline(java.time.LocalDateTime.parse(deadline));
        }

        java.util.Map<String, Object> impact = urgentInsertService.analyzeInsertImpact(factoryId, slotId, request);
        return ApiResponse.success("分析完成", impact);
    }

    /**
     * 确认紧急插单（正常流程，创建生产计划）
     */
    @PostMapping("/urgent-insert/confirm")
    public ApiResponse<com.cretas.aims.dto.production.ProductionPlanDTO> confirmUrgentInsert(
            @PathVariable String factoryId,
            @Valid @RequestBody ConfirmUrgentInsertRequest request,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("确认紧急插单: factoryId={}, slotId={}, productTypeId={}, userId={}",
                factoryId, request.getSlotId(), request.getProductTypeId(), userId);
        com.cretas.aims.dto.production.ProductionPlanDTO plan = urgentInsertService.confirmInsert(factoryId, userId, request);
        return ApiResponse.success("插单成功", plan);
    }

    /**
     * 强制插单（需要审批流程）
     * 用于高影响等级场景，创建待审批状态的生产计划
     */
    @PostMapping("/urgent-insert/force")
    public ApiResponse<com.cretas.aims.dto.production.ProductionPlanDTO> forceUrgentInsert(
            @PathVariable String factoryId,
            @Valid @RequestBody ConfirmUrgentInsertRequest request,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("强制插单: factoryId={}, slotId={}, productTypeId={}, userId={}",
                factoryId, request.getSlotId(), request.getProductTypeId(), userId);
        com.cretas.aims.dto.production.ProductionPlanDTO plan = urgentInsertService.forceInsert(factoryId, userId, request);
        return ApiResponse.success("已提交审批", plan);
    }

    /**
     * 生成/刷新插单时段
     * 根据当前排产情况计算可用时段，使用科学的多维度分析算法
     */
    @PostMapping("/urgent-insert/generate-slots")
    public ApiResponse<java.util.Map<String, Object>> generateInsertSlots(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "48") int hoursAhead) {
        log.info("生成插单时段: factoryId={}, hoursAhead={}", factoryId, hoursAhead);
        int count = urgentInsertService.generateInsertSlots(factoryId, hoursAhead);

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("generatedCount", count);
        result.put("factoryId", factoryId);
        result.put("hoursAhead", hoursAhead);
        result.put("generatedAt", java.time.LocalDateTime.now());

        return ApiResponse.success("生成完成", result);
    }

    /**
     * 锁定时段（防止并发选择）
     */
    @PostMapping("/urgent-insert/slots/{slotId}/lock")
    public ApiResponse<InsertSlotDTO> lockSlot(
            @PathVariable String factoryId,
            @PathVariable String slotId,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("锁定时段: factoryId={}, slotId={}, userId={}", factoryId, slotId, userId);
        urgentInsertService.markSlotAsSelected(factoryId, slotId);
        InsertSlotDTO slot = urgentInsertService.getSlotDetail(factoryId, slotId);
        return ApiResponse.success("锁定成功", slot);
    }

    /**
     * 释放时段锁定
     */
    @DeleteMapping("/urgent-insert/slots/{slotId}/lock")
    public ApiResponse<Void> unlockSlot(
            @PathVariable String factoryId,
            @PathVariable String slotId,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("释放时段: factoryId={}, slotId={}, userId={}", factoryId, slotId, userId);
        urgentInsertService.releaseSlot(factoryId, slotId);
        return ApiResponse.success("释放成功", null);
    }

    /**
     * 获取紧急插单统计信息
     */
    @GetMapping("/urgent-insert/statistics")
    public ApiResponse<java.util.Map<String, Object>> getUrgentInsertStatistics(
            @PathVariable String factoryId) {
        log.info("获取紧急插单统计: factoryId={}", factoryId);
        java.util.Map<String, Object> stats = urgentInsertService.getUrgentInsertStatistics(factoryId);
        return ApiResponse.success("获取成功", stats);
    }

    /**
     * 清理过期时段
     */
    @PostMapping("/urgent-insert/cleanup")
    public ApiResponse<java.util.Map<String, Object>> cleanupExpiredSlots(
            @PathVariable String factoryId) {
        log.info("清理过期时段: factoryId={}", factoryId);
        int count = urgentInsertService.cleanupExpiredSlots(factoryId);

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("cleanedCount", count);
        result.put("factoryId", factoryId);
        result.put("cleanedAt", java.time.LocalDateTime.now());

        return ApiResponse.success("清理完成", result);
    }

    // ==================== 紧急插单审批管理 ====================

    /**
     * 获取待审批的强制插单列表
     * 注意：使用production包下的ProductionPlanDTO（审批流程需要完整的计划信息）
     */
    @GetMapping("/approvals/pending")
    public ApiResponse<List<com.cretas.aims.dto.production.ProductionPlanDTO>> getPendingApprovals(
            @PathVariable String factoryId) {
        log.info("获取待审批强制插单: factoryId={}", factoryId);
        List<com.cretas.aims.dto.production.ProductionPlanDTO> approvals = urgentInsertService.getPendingForceInsertApprovals(factoryId);
        return ApiResponse.success("获取成功", approvals);
    }

    /**
     * 审批强制插单 - 批准
     */
    @PostMapping("/approvals/{planId}/approve")
    public ApiResponse<com.cretas.aims.dto.production.ProductionPlanDTO> approveForceInsert(
            @PathVariable String factoryId,
            @PathVariable String planId,
            @RequestParam(required = false) String comment,
            HttpServletRequest httpRequest) {
        Long approverId = getUserId(httpRequest);
        log.info("批准强制插单: factoryId={}, planId={}, approverId={}", factoryId, planId, approverId);
        com.cretas.aims.dto.production.ProductionPlanDTO plan = urgentInsertService.approveForceInsert(
                factoryId, planId, approverId, true, comment);
        return ApiResponse.success("审批通过", plan);
    }

    /**
     * 审批强制插单 - 拒绝
     */
    @PostMapping("/approvals/{planId}/reject")
    public ApiResponse<com.cretas.aims.dto.production.ProductionPlanDTO> rejectForceInsert(
            @PathVariable String factoryId,
            @PathVariable String planId,
            @RequestParam String reason,
            HttpServletRequest httpRequest) {
        Long approverId = getUserId(httpRequest);
        log.info("拒绝强制插单: factoryId={}, planId={}, approverId={}, reason={}",
                factoryId, planId, approverId, reason);
        com.cretas.aims.dto.production.ProductionPlanDTO plan = urgentInsertService.approveForceInsert(
                factoryId, planId, approverId, false, reason);
        return ApiResponse.success("已拒绝", plan);
    }

    // ==================== 辅助方法 ====================

    /**
     * 从请求中获取用户ID
     */
    private Long getUserId(HttpServletRequest request) {
        Object userIdObj = request.getAttribute("userId");
        if (userIdObj == null) {
            return null;
        }
        if (userIdObj instanceof Long) {
            return (Long) userIdObj;
        }
        if (userIdObj instanceof Integer) {
            return ((Integer) userIdObj).longValue();
        }
        if (userIdObj instanceof String) {
            try {
                return Long.parseLong((String) userIdObj);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
