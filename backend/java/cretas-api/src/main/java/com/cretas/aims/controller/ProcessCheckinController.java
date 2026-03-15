package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.ProcessCheckinRecord;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.ProductionReport;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.ProcessCheckinRecordRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.repository.ProductionReportRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/process-checkin")
@RequiredArgsConstructor
public class ProcessCheckinController {

    private final ProcessCheckinRecordRepository checkinRepository;
    private final ProductionPlanRepository planRepository;
    private final ProductionBatchRepository batchRepository;
    private final ProductionReportRepository reportRepository;
    private final UserRepository userRepository;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ApiResponse<Map<String, Object>> checkIn(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long operatorId) {
        Long employeeId = Long.valueOf(body.get("employeeId").toString());

        // P2-7: 重复签到防护 — 同一员工已 CHECKED_IN 时拒绝
        List<ProcessCheckinRecord> existing = checkinRepository
                .findByFactoryIdAndEmployeeIdAndStatus(factoryId, employeeId, "CHECKED_IN");
        if (!existing.isEmpty()) {
            return ApiResponse.error("该员工已签到（ID: " + existing.get(0).getId() + "），请先签退后再签到");
        }

        ProcessCheckinRecord record = new ProcessCheckinRecord();
        record.setFactoryId(factoryId);
        record.setEmployeeId(employeeId);
        record.setProcessName((String) body.get("processName"));
        record.setProcessCategory((String) body.get("processCategory"));
        // P2-8: 关联 processTaskId
        if (body.get("processTaskId") != null) {
            record.setProcessTaskId((String) body.get("processTaskId"));
        }
        if (body.get("batchId") != null) {
            record.setBatchId(Long.valueOf(body.get("batchId").toString()));
        }
        record.setCheckInTime(LocalDateTime.now());
        record.setCheckinMethod((String) body.getOrDefault("checkinMethod", "SCAN"));
        record.setStatus("CHECKED_IN");

        record = checkinRepository.save(record);

        // 查员工姓名
        String employeeName = userRepository.findById(employeeId)
                .map(User::getFullName)
                .orElse("工号" + employeeId);

        Map<String, Object> result = new HashMap<>();
        result.put("id", record.getId());
        result.put("employeeId", employeeId);
        result.put("employeeName", employeeName);
        result.put("processName", record.getProcessName());
        result.put("checkInTime", record.getCheckInTime());
        result.put("status", record.getStatus());
        return ApiResponse.success(result);
    }

    @PostMapping("/checkout/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    @Transactional
    public ApiResponse<Map<String, Object>> checkOut(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        ProcessCheckinRecord record = checkinRepository.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("ProcessCheckinRecord", "id", id.toString()));

        if (!"CHECKED_IN".equals(record.getStatus())) {
            return ApiResponse.error("当前状态无法签退");
        }

        record.setCheckOutTime(LocalDateTime.now());
        record.setStatus("CHECKED_OUT");

        long minutes = java.time.Duration.between(record.getCheckInTime(), record.getCheckOutTime()).toMinutes();
        record.setWorkMinutes((int) minutes);

        record = checkinRepository.save(record);

        // Fix-4: 签退后自动创建报工草稿（仅当关联了批次时）
        Long draftReportId = null;
        if (record.getBatchId() != null) {
            try {
                draftReportId = createReportDraft(record);
                log.info("签退自动创建报工草稿: checkinId={}, draftReportId={}", id, draftReportId);
            } catch (Exception e) {
                log.warn("报工草稿创建失败(不影响签退): checkinId={}, error={}", id, e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("checkinRecord", record);
        result.put("draftReportId", draftReportId);
        result.put("message", draftReportId != null
                ? "签退成功！已自动创建报工草稿，请补充产量信息"
                : "签退成功");
        return ApiResponse.success(result);
    }

    /**
     * Fix-4: 签退→报工草稿联动
     * 自动创建 DRAFT 状态报工记录，预填工时和批次信息
     */
    private Long createReportDraft(ProcessCheckinRecord checkin) {
        // 防重：同一工人+批次+日期已有报工则跳过
        if (reportRepository.existsByFactoryIdAndWorkerIdAndBatchIdAndReportDateAndDeletedAtIsNull(
                checkin.getFactoryId(), checkin.getEmployeeId(), checkin.getBatchId(), LocalDate.now())) {
            log.info("已存在报工记录，跳过草稿创建: employeeId={}, batchId={}", checkin.getEmployeeId(), checkin.getBatchId());
            return null;
        }

        // 从批次获取产品信息
        String productName = null;
        if (checkin.getBatchId() != null) {
            productName = batchRepository.findById(checkin.getBatchId())
                    .map(ProductionBatch::getProductName)
                    .orElse(null);
        }

        ProductionReport draft = ProductionReport.builder()
                .factoryId(checkin.getFactoryId())
                .workerId(checkin.getEmployeeId())
                .batchId(checkin.getBatchId())
                .reportType("PROGRESS")
                .reportDate(LocalDate.now())
                .processCategory(checkin.getProcessCategory())
                .productName(productName)
                .totalWorkMinutes(checkin.getWorkMinutes())
                .totalWorkers(1)
                .status(ProductionReport.Status.DRAFT)
                .build();

        draft = reportRepository.save(draft);
        return draft.getId();
    }

    @GetMapping("/active")
    public ApiResponse<List<ProcessCheckinRecord>> getActiveCheckins(
            @PathVariable String factoryId,
            @RequestParam(required = false) Long employeeId) {
        List<ProcessCheckinRecord> records;
        if (employeeId != null) {
            records = checkinRepository.findByFactoryIdAndEmployeeIdAndStatus(factoryId, employeeId, "CHECKED_IN");
        } else {
            records = checkinRepository.findByFactoryIdAndStatus(factoryId, "CHECKED_IN");
        }
        return ApiResponse.success(records);
    }

    @GetMapping("/today-summary")
    public ApiResponse<List<ProcessCheckinRecord>> getTodaySummary(
            @PathVariable String factoryId,
            @RequestParam(required = false) Long employeeId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);

        List<ProcessCheckinRecord> records;
        if (employeeId != null) {
            records = checkinRepository.findTodayByEmployee(factoryId, employeeId, startOfDay, endOfDay);
        } else {
            records = checkinRepository.findTodayRecords(factoryId, startOfDay, endOfDay);
        }
        return ApiResponse.success(records);
    }

    @GetMapping("/available-processes")
    public ApiResponse<List<Map<String, Object>>> getAvailableProcesses(
            @PathVariable String factoryId) {
        // Get today's production plans and extract process names
        List<Map<String, Object>> processes = planRepository.findByFactoryId(factoryId).stream()
                .filter(p -> p.getProcessName() != null && !p.getProcessName().isEmpty())
                .filter(p -> "IN_PROGRESS".equals(p.getStatus().name()) || "PLANNED".equals(p.getStatus().name()) || "PENDING".equals(p.getStatus().name()))
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("processName", p.getProcessName());
                    m.put("productName", p.getProductType() != null ? p.getProductType().getName() : "");
                    m.put("planId", p.getId());
                    m.put("customerName", p.getSourceCustomerName());
                    return m;
                })
                .collect(Collectors.toList());
        return ApiResponse.success(processes);
    }
}
