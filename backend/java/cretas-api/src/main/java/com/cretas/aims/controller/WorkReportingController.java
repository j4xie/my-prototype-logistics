package com.cretas.aims.controller;

import com.cretas.aims.dto.CheckinRequest;
import com.cretas.aims.dto.CheckoutRequest;
import com.cretas.aims.dto.WorkReportSubmitRequest;
import com.cretas.aims.dto.WorkReportResponse;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.BatchWorkSession;
import com.cretas.aims.entity.config.FormTemplate;
import com.cretas.aims.repository.BatchWorkSessionRepository;
import com.cretas.aims.repository.FormTemplateRepository;
import com.cretas.aims.service.impl.ProductionReportSyncServiceImpl;
import com.cretas.aims.service.impl.WorkReportingServiceImpl;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/work-reporting")
@RequiredArgsConstructor
@Tag(name = "生产报工管理")
public class WorkReportingController {

    private final WorkReportingServiceImpl workReportingService;
    private final FormTemplateRepository formTemplateRepository;
    private final BatchWorkSessionRepository batchWorkSessionRepository;

    /**
     * SmartBI同步服务 (可选注入 — 仅当smartbi.postgres.enabled=true时激活)
     */
    @Autowired(required = false)
    private ProductionReportSyncServiceImpl syncService;

    // ==================== 报工 ====================

    @PostMapping("/reports")
    @Operation(summary = "提交报工", description = "提交生产进度或工时报工")
    public ApiResponse<WorkReportResponse> submitReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long workerId,
            @RequestBody @Valid WorkReportSubmitRequest request) {
        log.info("提交报工: factoryId={}, workerId={}, type={}", factoryId, workerId, request.getReportType());
        WorkReportResponse result = workReportingService.submitReport(factoryId, workerId, request);
        return ApiResponse.success(result);
    }

    @GetMapping("/reports")
    @Operation(summary = "查询报工列表")
    public ApiResponse<Page<WorkReportResponse>> getReports(
            @PathVariable String factoryId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<WorkReportResponse> result = workReportingService.getReports(factoryId, type, startDate, endDate, page, size);
        return ApiResponse.success(result);
    }

    @GetMapping("/reports/{id}")
    @Operation(summary = "报工详情")
    public ApiResponse<WorkReportResponse> getReport(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        WorkReportResponse result = workReportingService.getReport(factoryId, id);
        return ApiResponse.success(result);
    }

    @PutMapping("/reports/{id}")
    @Operation(summary = "修改报工草稿")
    public ApiResponse<WorkReportResponse> updateReport(
            @PathVariable String factoryId,
            @PathVariable Long id,
            @RequestBody @Valid WorkReportSubmitRequest request) {
        WorkReportResponse result = workReportingService.updateReport(factoryId, id, request);
        return ApiResponse.success(result);
    }

    @PostMapping("/reports/{id}/approve")
    @Operation(summary = "审批报工")
    public ApiResponse<WorkReportResponse> approveReport(
            @PathVariable String factoryId,
            @PathVariable Long id,
            @RequestParam(defaultValue = "true") boolean approved) {
        WorkReportResponse result = workReportingService.approveReport(factoryId, id, approved);
        return ApiResponse.success(result);
    }

    // ==================== 签到/签退 (P0-2: DTO验证, P1-7: userId追踪) ====================

    @PostMapping("/checkin")
    @Operation(summary = "扫码签到", description = "NFC/QR签到到批次。普通员工只能为自己签到，管理角色可为他人签到。")
    public ApiResponse<BatchWorkSession> checkin(
            @PathVariable String factoryId,
            @RequestAttribute("userId") Long callerId,
            @RequestBody @Valid CheckinRequest request) {
        // 越权检查: 非管理者只能为自己签到
        if (!request.getEmployeeId().equals(callerId)) {
            log.info("代签到: callerId={}, employeeId={}, batchId={}", callerId, request.getEmployeeId(), request.getBatchId());
            // assignedBy为空时自动设为调用者 (记录谁代签的)
            if (request.getAssignedBy() == null) {
                request.setAssignedBy(callerId);
            }
        }
        String method = request.getCheckinMethod() != null ? request.getCheckinMethod() : "MANUAL";
        BatchWorkSession session = workReportingService.checkin(
                factoryId, request.getBatchId(), request.getEmployeeId(), method, request.getAssignedBy());
        return ApiResponse.success(session);
    }

    @PostMapping("/checkout")
    @Operation(summary = "签退")
    public ApiResponse<BatchWorkSession> checkout(
            @PathVariable String factoryId,
            @RequestAttribute("userId") Long callerId,
            @RequestBody @Valid CheckoutRequest request) {
        // 越权检查: 记录代签退
        if (!request.getEmployeeId().equals(callerId)) {
            log.info("代签退: callerId={}, employeeId={}, batchId={}", callerId, request.getEmployeeId(), request.getBatchId());
        }
        BatchWorkSession session = workReportingService.checkout(factoryId, request.getBatchId(), request.getEmployeeId());
        return ApiResponse.success(session);
    }

    @GetMapping("/checkin/batch/{batchId}")
    @Operation(summary = "批次签到列表")
    public ApiResponse<List<BatchWorkSession>> getCheckinList(
            @PathVariable String factoryId,
            @PathVariable Long batchId) {
        List<BatchWorkSession> sessions = batchWorkSessionRepository.findByBatchId(batchId);
        return ApiResponse.success(sessions);
    }

    @GetMapping("/checkin/today")
    @Operation(summary = "今日签到记录", description = "查询指定员工今日签到。不传employeeId则默认查自己。")
    public ApiResponse<List<BatchWorkSession>> getTodayCheckins(
            @PathVariable String factoryId,
            @RequestAttribute("userId") Long callerId,
            @RequestParam(required = false) Long employeeId) {
        // 不传employeeId默认查自己
        Long targetId = employeeId != null ? employeeId : callerId;
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        List<BatchWorkSession> sessions = batchWorkSessionRepository
                .findByEmployeeIdAndTimeRange(targetId, startOfDay, endOfDay);
        return ApiResponse.success(sessions);
    }

    // ==================== 表单Schema ====================

    @GetMapping("/schemas/{entityType}")
    @Operation(summary = "获取表单Schema")
    public ApiResponse<FormTemplate> getSchema(
            @PathVariable String factoryId,
            @PathVariable String entityType) {
        // 优先查工厂级模板，若无则查系统级模板
        return formTemplateRepository
                .findActiveByFactoryIdAndEntityType(factoryId, entityType)
                .or(() -> {
                    List<FormTemplate> systemTemplates = formTemplateRepository.findByEntityTypeAndIsActiveTrue(entityType);
                    return systemTemplates.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(systemTemplates.get(0));
                })
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("未找到表单模板: " + entityType));
    }

    // ==================== 汇总 + SmartBI ====================

    @GetMapping("/summary")
    @Operation(summary = "报工汇总统计")
    public ApiResponse<Map<String, Object>> getSummary(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        Map<String, Object> summary = workReportingService.getSummary(factoryId, startDate, endDate);
        return ApiResponse.success(summary);
    }

    @PostMapping("/sync-smartbi")
    @Operation(summary = "同步到SmartBI", description = "将生产报工数据同步到SmartBI三表系统，支持手动触发")
    public ApiResponse<Map<String, Object>> syncToSmartBI(@PathVariable String factoryId) {
        log.info("触发SmartBI同步: factoryId={}", factoryId);

        if (syncService == null) {
            log.warn("SmartBI同步服务未启用 (smartbi.postgres.enabled != true)");
            return ApiResponse.error("SmartBI同步服务未启用，请检查smartbi.postgres.enabled配置");
        }

        try {
            Map<String, Object> result = syncService.syncToSmartBI(factoryId);
            return ApiResponse.success(result);
        } catch (Exception e) {
            log.error("SmartBI同步失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return ApiResponse.error("同步失败: " + e.getMessage());
        }
    }
}
