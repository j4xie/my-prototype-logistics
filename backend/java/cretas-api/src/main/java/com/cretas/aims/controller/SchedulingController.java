package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.service.LinUCBService;
import com.cretas.aims.service.SchedulingService;
import com.cretas.aims.service.UrgentInsertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "智能调度管理", description = "调度计划、产线排程、人员分配、AI辅助调度等功能")
public class SchedulingController {

    private final SchedulingService schedulingService;
    private final UrgentInsertService urgentInsertService;
    private final LinUCBService linUCBService;

    // ==================== 调度计划 CRUD ====================

    /**
     * 创建调度计划
     */
    @PostMapping("/plans")
    @Operation(summary = "创建调度计划", description = "创建新的日生产调度计划，包含产线排程和人员分配")
    public ApiResponse<SchedulingPlanDTO> createPlan(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "获取调度计划详情", description = "获取调度计划完整信息，包含所有排程和工人分配")
    public ApiResponse<SchedulingPlanDTO> getPlan(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "调度计划ID", example = "SP-2025-001")
            @PathVariable String planId) {
        log.info("获取调度计划详情: factoryId={}, planId={}", factoryId, planId);
        SchedulingPlanDTO plan = schedulingService.getPlan(factoryId, planId);
        return ApiResponse.success("获取成功", plan);
    }

    /**
     * 获取调度计划列表 (分页)
     */
    @GetMapping("/plans")
    @Operation(summary = "获取调度计划列表", description = "分页查询调度计划，支持按日期范围和状态过滤")
    public ApiResponse<Page<SchedulingPlanDTO>> getPlans(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "开始日期", example = "2025-01-01")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", example = "2025-01-31")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "状态: DRAFT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED", example = "CONFIRMED")
            @RequestParam(required = false) String status,
            @Parameter(description = "页码（从0开始）", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页数量", example = "10")
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
    @Operation(summary = "更新调度计划", description = "更新调度计划信息，仅限DRAFT状态的计划")
    public ApiResponse<SchedulingPlanDTO> updatePlan(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "调度计划ID", example = "SP-2025-001")
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
    @Operation(summary = "确认调度计划", description = "确认调度计划，状态变更为CONFIRMED，可开始执行")
    public ApiResponse<SchedulingPlanDTO> confirmPlan(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "调度计划ID", example = "SP-2025-001")
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
    @Operation(summary = "取消调度计划", description = "取消调度计划，需提供取消原因")
    public ApiResponse<Void> cancelPlan(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "调度计划ID", example = "SP-2025-001")
            @PathVariable String planId,
            @Parameter(description = "取消原因", example = "客户订单取消")
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
    @Operation(summary = "获取排程详情", description = "获取单条产线排程的详细信息")
    public ApiResponse<LineScheduleDTO> getSchedule(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "排程ID", example = "LS-2025-001")
            @PathVariable String scheduleId) {
        log.info("获取排程详情: factoryId={}, scheduleId={}", factoryId, scheduleId);
        LineScheduleDTO schedule = schedulingService.getSchedule(factoryId, scheduleId);
        return ApiResponse.success("获取成功", schedule);
    }

    /**
     * 更新排程
     */
    @PutMapping("/schedules/{scheduleId}")
    @Operation(summary = "更新排程", description = "更新产线排程配置，如时间、产量等")
    public ApiResponse<LineScheduleDTO> updateSchedule(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "排程ID", example = "LS-2025-001")
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
    @Operation(summary = "开始排程", description = "启动产线生产，状态变更为IN_PROGRESS")
    public ApiResponse<LineScheduleDTO> startSchedule(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "排程ID", example = "LS-2025-001")
            @PathVariable String scheduleId) {
        log.info("开始排程: factoryId={}, scheduleId={}", factoryId, scheduleId);
        LineScheduleDTO schedule = schedulingService.startSchedule(factoryId, scheduleId);
        return ApiResponse.success("已开始生产", schedule);
    }

    /**
     * 完成排程
     */
    @PostMapping("/schedules/{scheduleId}/complete")
    @Operation(summary = "完成排程", description = "标记排程完成，记录实际完成产量")
    public ApiResponse<LineScheduleDTO> completeSchedule(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "排程ID", example = "LS-2025-001")
            @PathVariable String scheduleId,
            @Parameter(description = "实际完成数量", example = "100")
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
    @Operation(summary = "更新排程进度", description = "实时更新生产进度数量")
    public ApiResponse<LineScheduleDTO> updateProgress(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "排程ID", example = "LS-2025-001")
            @PathVariable String scheduleId,
            @Parameter(description = "当前完成数量", example = "50")
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
    @Operation(summary = "分配工人", description = "将工人分配到指定排程任务，支持批量分配")
    public ApiResponse<List<WorkerAssignmentDTO>> assignWorkers(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "移除工人分配", description = "取消工人的排程任务分配")
    public ApiResponse<Void> removeWorkerAssignment(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "分配ID", example = "WA-2025-001")
            @PathVariable String assignmentId) {
        log.info("移除工人分配: factoryId={}, assignmentId={}", factoryId, assignmentId);
        schedulingService.removeWorkerAssignment(factoryId, assignmentId);
        return ApiResponse.success("移除成功", null);
    }

    /**
     * 工人签到
     */
    @PostMapping("/workers/assignments/{assignmentId}/check-in")
    @Operation(summary = "工人签到", description = "工人到达工位后签到，记录实际开始工作时间")
    public ApiResponse<WorkerAssignmentDTO> workerCheckIn(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "分配ID", example = "WA-2025-001")
            @PathVariable String assignmentId) {
        log.info("工人签到: factoryId={}, assignmentId={}", factoryId, assignmentId);
        WorkerAssignmentDTO assignment = schedulingService.workerCheckIn(factoryId, assignmentId);
        return ApiResponse.success("签到成功", assignment);
    }

    /**
     * 工人签退
     */
    @PostMapping("/workers/assignments/{assignmentId}/check-out")
    @Operation(summary = "工人签退", description = "工人完成工作后签退，可记录绩效评分")
    public ApiResponse<WorkerAssignmentDTO> workerCheckOut(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "分配ID", example = "WA-2025-001")
            @PathVariable String assignmentId,
            @Parameter(description = "绩效评分(1-100)", example = "85")
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
    @Operation(summary = "获取工人分配列表", description = "查询工人分配记录，支持按用户ID和日期过滤")
    public ApiResponse<List<WorkerAssignmentDTO>> getWorkerAssignments(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "用户ID", example = "22")
            @RequestParam(required = false) Long userId,
            @Parameter(description = "日期", example = "2025-01-15")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        log.info("获取工人分配: factoryId={}, userId={}, date={}", factoryId, userId, date);
        List<WorkerAssignmentDTO> assignments = schedulingService.getWorkerAssignments(factoryId, userId, date);
        return ApiResponse.success("获取成功", assignments);
    }

    /**
     * 获取可用工人列表
     */
    @GetMapping("/workers/available")
    @Operation(summary = "获取可用工人列表", description = "获取指定日期可分配的工人列表，排除已有任务的工人")
    public ApiResponse<List<AvailableWorkerDTO>> getAvailableWorkers(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "日期", example = "2025-01-15")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Parameter(description = "排程ID（用于排除已分配工人）", example = "LS-2025-001")
            @RequestParam(required = false) String scheduleId) {
        log.info("获取可用工人列表: factoryId={}, date={}, scheduleId={}", factoryId, date, scheduleId);
        List<AvailableWorkerDTO> workers = schedulingService.getAvailableWorkers(factoryId, date, scheduleId);
        return ApiResponse.success("获取成功", workers);
    }

    /**
     * AI 工人推荐
     * 基于 LinUCB 算法推荐最优工人分配
     */
    @PostMapping("/workers/recommend")
    @Operation(summary = "AI工人推荐", description = "基于LinUCB算法，根据任务特征推荐最优工人分配方案")
    public ApiResponse<List<LinUCBService.WorkerRecommendation>> recommendWorkers(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @RequestBody WorkerRecommendRequest request) {
        log.info("AI工人推荐: factoryId={}, scheduleId={}", factoryId, request.getScheduleId());

        // 构建任务特征
        double[] taskFeatures = linUCBService.extractTaskFeatures(request.getTaskFeatures());

        // 获取推荐
        List<LinUCBService.WorkerRecommendation> recommendations =
            linUCBService.recommendWorkers(factoryId, taskFeatures, request.getCandidateWorkerIds());

        return ApiResponse.success("推荐成功", recommendations);
    }

    /**
     * 获取员工任务历史
     */
    @GetMapping("/workers/{userId}/task-history")
    @Operation(summary = "获取员工任务历史", description = "获取指定员工的近期任务执行记录，包含工时和完成状态")
    public ApiResponse<List<TaskHistoryDTO>> getEmployeeTaskHistory(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "员工用户ID", example = "22")
            @PathVariable Long userId,
            @Parameter(description = "返回数量限制（默认10条）", example = "10")
            @RequestParam(defaultValue = "10") Integer limit) {
        log.info("获取员工任务历史: factoryId={}, userId={}, limit={}", factoryId, userId, limit);
        List<TaskHistoryDTO> history = schedulingService.getEmployeeTaskHistory(factoryId, userId, limit);
        return ApiResponse.success("获取成功", history);
    }

    // ==================== AI 辅助功能 ====================

    /**
     * AI 生成调度计划
     */
    @PostMapping("/generate")
    @Operation(summary = "AI生成调度计划", description = "使用AI算法自动生成最优调度计划，考虑产能、人员、设备等因素")
    public ApiResponse<SchedulingPlanDTO> generateSchedule(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "AI优化人员分配", description = "基于工人技能、历史绩效等因素，智能优化人员分配方案")
    public ApiResponse<List<WorkerAssignmentDTO>> optimizeWorkers(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "计算完成概率", description = "AI预测排程按时完成的概率，用于风险预警")
    public ApiResponse<CompletionProbabilityResponse> calculateCompletionProbability(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "排程ID", example = "LS-2025-001")
            @PathVariable String scheduleId) {
        log.info("计算完成概率: factoryId={}, scheduleId={}", factoryId, scheduleId);
        CompletionProbabilityResponse probability = schedulingService.calculateCompletionProbability(factoryId, scheduleId);
        return ApiResponse.success("计算完成", probability);
    }

    /**
     * 批量计算计划内所有排程的完成概率
     */
    @GetMapping("/plans/{planId}/probabilities")
    @Operation(summary = "批量计算完成概率", description = "批量预测计划内所有排程的完成概率")
    public ApiResponse<List<CompletionProbabilityResponse>> calculateBatchProbabilities(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "调度计划ID", example = "SP-2025-001")
            @PathVariable String planId) {
        log.info("批量计算完成概率: factoryId={}, planId={}", factoryId, planId);
        List<CompletionProbabilityResponse> probabilities = schedulingService.calculateBatchProbabilities(factoryId, planId);
        return ApiResponse.success("计算完成", probabilities);
    }

    /**
     * 重新调度 (AI 辅助)
     */
    @PostMapping("/reschedule")
    @Operation(summary = "重新调度", description = "AI辅助重新调度，用于应对突发情况如设备故障、人员变动等")
    public ApiResponse<SchedulingPlanDTO> reschedule(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "获取未解决告警", description = "获取所有未处理的调度告警，包括延误、资源冲突等")
    public ApiResponse<List<SchedulingAlertDTO>> getUnresolvedAlerts(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId) {
        log.info("获取未解决告警: factoryId={}", factoryId);
        List<SchedulingAlertDTO> alerts = schedulingService.getUnresolvedAlerts(factoryId);
        return ApiResponse.success("获取成功", alerts);
    }

    /**
     * 获取告警列表 (分页)
     */
    @GetMapping("/alerts")
    @Operation(summary = "获取告警列表", description = "分页查询调度告警，支持按严重程度和类型过滤")
    public ApiResponse<Page<SchedulingAlertDTO>> getAlerts(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "严重程度: CRITICAL, HIGH, MEDIUM, LOW", example = "HIGH")
            @RequestParam(required = false) String severity,
            @Parameter(description = "告警类型: DELAY, RESOURCE_CONFLICT, CAPACITY_EXCEEDED", example = "DELAY")
            @RequestParam(required = false) String alertType,
            @Parameter(description = "页码（从0开始）", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页数量", example = "10")
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
    @Operation(summary = "确认告警", description = "确认已收到告警通知，状态变更为ACKNOWLEDGED")
    public ApiResponse<SchedulingAlertDTO> acknowledgeAlert(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "告警ID", example = "SA-2025-001")
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
    @Operation(summary = "解决告警", description = "标记告警已处理，可附带解决说明")
    public ApiResponse<SchedulingAlertDTO> resolveAlert(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "告警ID", example = "SA-2025-001")
            @PathVariable String alertId,
            @Parameter(description = "解决说明", example = "已调整产线排程，增加人员支援")
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
    @Operation(summary = "获取产线列表", description = "获取工厂所有产线信息，可按状态过滤")
    public ApiResponse<List<ProductionLineDTO>> getProductionLines(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "状态: ACTIVE, MAINTENANCE, IDLE", example = "ACTIVE")
            @RequestParam(required = false) String status) {
        log.info("获取产线列表: factoryId={}, status={}", factoryId, status);
        List<ProductionLineDTO> lines = schedulingService.getProductionLines(factoryId, status);
        return ApiResponse.success("获取成功", lines);
    }

    /**
     * 创建产线
     */
    @PostMapping("/production-lines")
    @Operation(summary = "创建产线", description = "新增生产线配置，包括产能、设备等信息")
    public ApiResponse<ProductionLineDTO> createProductionLine(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "更新产线", description = "更新产线配置信息")
    public ApiResponse<ProductionLineDTO> updateProductionLine(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "产线ID", example = "PL-001")
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
    @Operation(summary = "更新产线状态", description = "切换产线运行状态，如启用、维护、停用等")
    public ApiResponse<ProductionLineDTO> updateProductionLineStatus(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "产线ID", example = "PL-001")
            @PathVariable String lineId,
            @Parameter(description = "状态: ACTIVE, MAINTENANCE, IDLE", example = "ACTIVE")
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
    @Operation(summary = "获取调度Dashboard", description = "获取调度概览数据，包括产能利用率、排程状态分布、告警等")
    public ApiResponse<SchedulingDashboardDTO> getDashboard(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "日期（默认今天）", example = "2025-01-15")
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
    @Operation(summary = "获取实时监控", description = "获取指定调度计划的实时生产进度和状态")
    public ApiResponse<SchedulingDashboardDTO> getRealtimeMonitor(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "调度计划ID", example = "SP-2025-001")
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
    @Operation(summary = "获取待排产批次", description = "获取待排产的生产计划列表，带紧急状态标识，用于AI智能排产")
    public ApiResponse<List<ProductionPlanDTO>> getPendingBatches(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "开始日期", example = "2025-01-01")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", example = "2025-01-31")
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
    @Operation(summary = "获取紧急阈值配置", description = "获取完成概率低于此阈值时标记为紧急的配置值")
    public ApiResponse<java.util.Map<String, Object>> getUrgentThresholdConfig(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "更新紧急阈值", description = "设置紧急状态判定阈值（0-1），需管理员权限")
    public ApiResponse<java.util.Map<String, Object>> updateUrgentThresholdConfig(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "获取可用插单时段", description = "获取可用于紧急插单的时段列表，按推荐分数排序，包含影响分析")
    public ApiResponse<List<InsertSlotDTO>> getInsertSlots(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "产品类型ID", example = "PT-001")
            @RequestParam(required = false) String productTypeId,
            @Parameter(description = "需求数量", example = "100")
            @RequestParam(required = false) Integer quantity,
            @Parameter(description = "截止时间（ISO格式）", example = "2025-01-15T18:00:00")
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
    @Operation(summary = "获取时段详情", description = "获取插单时段的详细信息，包括产线状态、评分明细等")
    public ApiResponse<InsertSlotDTO> getSlotDetail(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "时段ID", example = "SLOT-2025-001")
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
    @Operation(summary = "分析插单影响", description = "分析在指定时段插单的链式影响、资源冲突和风险评估")
    public ApiResponse<java.util.Map<String, Object>> analyzeSlotImpact(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "时段ID", example = "SLOT-2025-001")
            @PathVariable String slotId,
            @Parameter(description = "产品类型ID", example = "PT-001")
            @RequestParam(required = false) String productTypeId,
            @Parameter(description = "需求数量", example = "100")
            @RequestParam(required = false) Integer quantity,
            @Parameter(description = "截止时间（ISO格式）", example = "2025-01-15T18:00:00")
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
    @Operation(summary = "确认紧急插单", description = "确认插单并创建生产计划，适用于低影响等级场景")
    public ApiResponse<com.cretas.aims.dto.production.ProductionPlanDTO> confirmUrgentInsert(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "强制插单", description = "强制插单需提交审批，适用于高影响等级场景")
    public ApiResponse<com.cretas.aims.dto.production.ProductionPlanDTO> forceUrgentInsert(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "生成插单时段", description = "根据当前排产情况生成可用插单时段，使用多维度评分算法")
    public ApiResponse<java.util.Map<String, Object>> generateInsertSlots(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "预计算小时数", example = "48")
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
    @Operation(summary = "锁定时段", description = "锁定选中的时段，防止其他用户并发选择")
    public ApiResponse<InsertSlotDTO> lockSlot(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "时段ID", example = "SLOT-2025-001")
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
    @Operation(summary = "释放时段锁定", description = "释放已锁定的时段，使其可被其他用户选择")
    public ApiResponse<Void> unlockSlot(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "时段ID", example = "SLOT-2025-001")
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
    @Operation(summary = "获取插单统计", description = "获取紧急插单的统计数据，包括成功率、平均影响等")
    public ApiResponse<java.util.Map<String, Object>> getUrgentInsertStatistics(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId) {
        log.info("获取紧急插单统计: factoryId={}", factoryId);
        java.util.Map<String, Object> stats = urgentInsertService.getUrgentInsertStatistics(factoryId);
        return ApiResponse.success("获取成功", stats);
    }

    /**
     * 清理过期时段
     */
    @PostMapping("/urgent-insert/cleanup")
    @Operation(summary = "清理过期时段", description = "清理已过期的插单时段数据，释放系统资源")
    public ApiResponse<java.util.Map<String, Object>> cleanupExpiredSlots(
            @Parameter(description = "工厂ID", example = "F001")
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
    @Operation(summary = "获取待审批列表", description = "获取待审批的强制插单请求列表，需要管理员审批后才能执行")
    public ApiResponse<List<com.cretas.aims.dto.production.ProductionPlanDTO>> getPendingApprovals(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId) {
        log.info("获取待审批强制插单: factoryId={}", factoryId);
        List<com.cretas.aims.dto.production.ProductionPlanDTO> approvals = urgentInsertService.getPendingForceInsertApprovals(factoryId);
        return ApiResponse.success("获取成功", approvals);
    }

    /**
     * 审批强制插单 - 批准
     */
    @PostMapping("/approvals/{planId}/approve")
    @Operation(summary = "批准强制插单", description = "管理员批准强制插单请求，计划将立即进入排程")
    public ApiResponse<com.cretas.aims.dto.production.ProductionPlanDTO> approveForceInsert(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "计划ID", example = "SP-2025-001")
            @PathVariable String planId,
            @Parameter(description = "审批备注", example = "紧急客户订单，批准优先处理")
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
    @Operation(summary = "拒绝强制插单", description = "管理员拒绝强制插单请求，必须提供拒绝原因")
    public ApiResponse<com.cretas.aims.dto.production.ProductionPlanDTO> rejectForceInsert(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "计划ID", example = "SP-2025-001")
            @PathVariable String planId,
            @Parameter(description = "拒绝原因", example = "产能已满，建议推迟至下周")
            @RequestParam String reason,
            HttpServletRequest httpRequest) {
        Long approverId = getUserId(httpRequest);
        log.info("拒绝强制插单: factoryId={}, planId={}, approverId={}, reason={}",
                factoryId, planId, approverId, reason);
        com.cretas.aims.dto.production.ProductionPlanDTO plan = urgentInsertService.approveForceInsert(
                factoryId, planId, approverId, false, reason);
        return ApiResponse.success("已拒绝", plan);
    }

    // ==================== 排产自动化配置 ====================

    /**
     * 获取排产自动化设置
     */
    @GetMapping("/settings")
    @Operation(summary = "获取排产设置", description = "获取排产自动化配置，包括自动排产模式、风险阈值、通知开关等")
    public ApiResponse<SchedulingSettingsDTO> getSchedulingSettings(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId) {
        log.info("获取排产设置: factoryId={}", factoryId);
        SchedulingSettingsDTO settings = schedulingService.getSchedulingSettings(factoryId);
        return ApiResponse.success("获取成功", settings);
    }

    /**
     * 更新排产自动化设置
     */
    @PutMapping("/settings")
    @Operation(summary = "更新排产设置", description = "更新排产自动化配置，支持部分更新")
    public ApiResponse<SchedulingSettingsDTO> updateSchedulingSettings(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Valid @RequestBody SchedulingSettingsDTO settings,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("更新排产设置: factoryId={}, settings={}, userId={}", factoryId, settings, userId);
        SchedulingSettingsDTO updatedSettings = schedulingService.updateSchedulingSettings(factoryId, settings, userId);
        return ApiResponse.success("更新成功", updatedSettings);
    }

    // ==================== 车间主任任务 ====================

    /**
     * 获取分配给当前车间主任的排程任务
     * 用于车间主任APP首页显示待执行任务
     */
    @GetMapping("/supervisor/tasks")
    @Operation(summary = "获取车间主任的排程任务", description = "获取分配给当前登录车间主任的待处理排程任务")
    public ApiResponse<List<SupervisorTaskDTO>> getSupervisorTasks(
            @Parameter(description = "工厂ID", example = "F001")
            @PathVariable String factoryId,
            @Parameter(description = "状态过滤: pending, in_progress, completed")
            @RequestParam(required = false, defaultValue = "pending,in_progress") String status,
            HttpServletRequest httpRequest) {
        Long userId = getUserId(httpRequest);
        log.info("获取车间主任排程任务: factoryId={}, userId={}, status={}", factoryId, userId, status);
        List<SupervisorTaskDTO> tasks = schedulingService.getSupervisorTasks(factoryId, userId, status);
        return ApiResponse.success("获取成功", tasks);
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
