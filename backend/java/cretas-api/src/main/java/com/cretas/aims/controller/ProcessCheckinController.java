package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.ProcessCheckinRecord;
import com.cretas.aims.repository.ProcessCheckinRecordRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/mobile/{factoryId}/process-checkin")
@RequiredArgsConstructor
public class ProcessCheckinController {

    private final ProcessCheckinRecordRepository checkinRepository;
    private final ProductionPlanRepository planRepository;

    @PostMapping
    public ApiResponse<ProcessCheckinRecord> checkIn(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body) {
        ProcessCheckinRecord record = new ProcessCheckinRecord();
        record.setFactoryId(factoryId);
        record.setEmployeeId(Long.valueOf(body.get("employeeId").toString()));
        record.setProcessName((String) body.get("processName"));
        record.setProcessCategory((String) body.get("processCategory"));
        if (body.get("batchId") != null) {
            record.setBatchId(Long.valueOf(body.get("batchId").toString()));
        }
        record.setCheckInTime(LocalDateTime.now());
        record.setCheckinMethod((String) body.getOrDefault("checkinMethod", "SCAN"));
        record.setStatus("CHECKED_IN");

        record = checkinRepository.save(record);
        return ApiResponse.success(record);
    }

    @PostMapping("/checkout/{id}")
    public ApiResponse<ProcessCheckinRecord> checkOut(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        ProcessCheckinRecord record = checkinRepository.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new RuntimeException("签到记录不存在"));

        if (!"CHECKED_IN".equals(record.getStatus())) {
            return ApiResponse.error("当前状态无法签退");
        }

        record.setCheckOutTime(LocalDateTime.now());
        record.setStatus("CHECKED_OUT");

        long minutes = java.time.Duration.between(record.getCheckInTime(), record.getCheckOutTime()).toMinutes();
        record.setWorkMinutes((int) minutes);

        record = checkinRepository.save(record);
        return ApiResponse.success(record);
    }

    @GetMapping("/active")
    public ApiResponse<List<ProcessCheckinRecord>> getActiveCheckins(
            @PathVariable String factoryId,
            @RequestParam Long employeeId) {
        List<ProcessCheckinRecord> records = checkinRepository
                .findByFactoryIdAndEmployeeIdAndStatus(factoryId, employeeId, "CHECKED_IN");
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
