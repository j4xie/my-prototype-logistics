package com.cretas.aims.service.impl;

import com.cretas.aims.dto.WorkReportSubmitRequest;
import com.cretas.aims.dto.WorkReportResponse;
import com.cretas.aims.entity.BatchWorkSession;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.ProductionReport;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.BatchWorkSessionRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.ProductionReportRepository;
import com.cretas.aims.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkReportingServiceImpl {

    private final ProductionReportRepository reportRepository;
    private final BatchWorkSessionRepository batchWorkSessionRepository;
    private final ProductionBatchRepository productionBatchRepository;
    private final UserRepository userRepository;

    /**
     * 提交报工
     */
    @Transactional
    public WorkReportResponse submitReport(String factoryId, Long workerId, WorkReportSubmitRequest request) {
        log.info("提交报工: factoryId={}, workerId={}, type={}", factoryId, workerId, request.getReportType());

        // 自动填充报告人姓名
        String reporterName = request.getReporterName();
        if (reporterName == null || reporterName.isBlank()) {
            reporterName = userRepository.findById(workerId)
                    .map(u -> u.getFullName() != null ? u.getFullName() : u.getUsername())
                    .orElse(null);
        }

        ProductionReport report = ProductionReport.builder()
                .factoryId(factoryId)
                .workerId(workerId)
                .batchId(request.getBatchId())
                .reportType(request.getReportType())
                .schemaId(request.getSchemaId())
                .reportDate(request.getReportDate())
                .reporterName(reporterName)
                .processCategory(request.getProcessCategory())
                .productName(request.getProductName())
                .outputQuantity(request.getOutputQuantity())
                .goodQuantity(request.getGoodQuantity())
                .defectQuantity(request.getDefectQuantity())
                .totalWorkMinutes(request.getTotalWorkMinutes())
                .totalWorkers(request.getTotalWorkers())
                .operationVolume(request.getOperationVolume())
                .hourEntries(request.getHourEntries())
                .nonProductionEntries(request.getNonProductionEntries())
                .productionStartTime(request.getProductionStartTime())
                .productionEndTime(request.getProductionEndTime())
                .customFields(request.getCustomFields())
                .photos(request.getPhotos())
                .build();

        report = reportRepository.save(report);

        // 如果关联批次且有产量，更新批次实际产量
        if (request.getBatchId() != null && request.getOutputQuantity() != null) {
            updateBatchActualQuantity(request.getBatchId(), request.getOutputQuantity());
        }

        return toResponse(report);
    }

    /**
     * 查询报工列表
     */
    public Page<WorkReportResponse> getReports(String factoryId, String reportType,
                                                 LocalDate startDate, LocalDate endDate,
                                                 int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "reportDate"));

        Page<ProductionReport> reports;
        if (reportType != null && startDate != null && endDate != null) {
            reports = reportRepository.findByFactoryIdAndReportTypeAndReportDateBetweenAndDeletedAtIsNull(
                    factoryId, reportType, startDate, endDate, pageRequest);
        } else if (reportType != null) {
            reports = reportRepository.findByFactoryIdAndReportTypeAndDeletedAtIsNull(
                    factoryId, reportType, pageRequest);
        } else if (startDate != null && endDate != null) {
            reports = reportRepository.findByFactoryIdAndReportDateBetweenAndDeletedAtIsNull(
                    factoryId, startDate, endDate, pageRequest);
        } else {
            reports = reportRepository.findByFactoryIdAndDeletedAtIsNull(factoryId, pageRequest);
        }

        return reports.map(this::toResponse);
    }

    /**
     * 获取报工详情
     */
    public WorkReportResponse getReport(String factoryId, Long reportId) {
        ProductionReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("报工记录不存在: " + reportId));
        if (!report.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("无权访问此报工记录");
        }
        return toResponse(report);
    }

    /**
     * 修改草稿 (P0-3: APPROVED/REJECTED不可修改)
     */
    @Transactional
    public WorkReportResponse updateReport(String factoryId, Long reportId, WorkReportSubmitRequest request) {
        ProductionReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("报工记录不存在: " + reportId));
        if (!report.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("无权修改此报工记录");
        }
        if (ProductionReport.Status.APPROVED.equals(report.getStatus())
                || ProductionReport.Status.REJECTED.equals(report.getStatus())) {
            throw new RuntimeException("已审批的报工不可修改，当前状态: " + report.getStatus());
        }

        if (request.getReportDate() != null) report.setReportDate(request.getReportDate());
        if (request.getProcessCategory() != null) report.setProcessCategory(request.getProcessCategory());
        if (request.getProductName() != null) report.setProductName(request.getProductName());
        if (request.getOutputQuantity() != null) report.setOutputQuantity(request.getOutputQuantity());
        if (request.getGoodQuantity() != null) report.setGoodQuantity(request.getGoodQuantity());
        if (request.getDefectQuantity() != null) report.setDefectQuantity(request.getDefectQuantity());
        if (request.getTotalWorkMinutes() != null) report.setTotalWorkMinutes(request.getTotalWorkMinutes());
        if (request.getTotalWorkers() != null) report.setTotalWorkers(request.getTotalWorkers());
        if (request.getOperationVolume() != null) report.setOperationVolume(request.getOperationVolume());
        if (request.getHourEntries() != null) report.setHourEntries(request.getHourEntries());
        if (request.getProductionStartTime() != null) report.setProductionStartTime(request.getProductionStartTime());
        if (request.getProductionEndTime() != null) report.setProductionEndTime(request.getProductionEndTime());
        if (request.getCustomFields() != null) report.setCustomFields(request.getCustomFields());
        if (request.getPhotos() != null) report.setPhotos(request.getPhotos());

        report = reportRepository.save(report);
        return toResponse(report);
    }

    /**
     * 审批报工 (P0-3: 仅SUBMITTED状态可审批)
     */
    @Transactional
    public WorkReportResponse approveReport(String factoryId, Long reportId, boolean approved) {
        ProductionReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("报工记录不存在: " + reportId));
        if (!report.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("无权审批此报工记录");
        }
        if (!ProductionReport.Status.SUBMITTED.equals(report.getStatus())) {
            throw new RuntimeException("仅SUBMITTED状态的报工可以审批，当前状态: " + report.getStatus());
        }

        report.setStatus(approved ? ProductionReport.Status.APPROVED : ProductionReport.Status.REJECTED);
        report = reportRepository.save(report);
        return toResponse(report);
    }

    /**
     * 签到
     */
    @Transactional
    public BatchWorkSession checkin(String factoryId, Long batchId, Long employeeId,
                                     String checkinMethod, Long assignedBy) {
        log.info("签到: factoryId={}, batchId={}, employeeId={}, method={}",
                factoryId, batchId, employeeId, checkinMethod);

        // 检查是否已签到
        Optional<BatchWorkSession> existing = batchWorkSessionRepository
                .findByBatchIdAndEmployeeId(batchId, employeeId);
        if (existing.isPresent() && BatchWorkSession.Status.WORKING.equals(existing.get().getStatus())) {
            throw new RuntimeException("该员工已签到此批次");
        }

        BatchWorkSession session = new BatchWorkSession();
        session.setBatchId(batchId);
        session.setEmployeeId(employeeId);
        session.setCheckInTime(LocalDateTime.now());
        session.setStatus(BatchWorkSession.Status.WORKING);
        session.setCheckinMethod(checkinMethod != null ? checkinMethod : "MANUAL");
        session.setAssignedBy(assignedBy);

        return batchWorkSessionRepository.save(session);
    }

    /**
     * 签退
     */
    @Transactional
    public BatchWorkSession checkout(String factoryId, Long batchId, Long employeeId) {
        BatchWorkSession session = batchWorkSessionRepository
                .findByBatchIdAndEmployeeId(batchId, employeeId)
                .orElseThrow(() -> new RuntimeException("未找到签到记录"));

        session.setCheckOutTime(LocalDateTime.now());
        session.setStatus(BatchWorkSession.Status.COMPLETED);

        if (session.getCheckInTime() != null) {
            long minutes = java.time.Duration.between(session.getCheckInTime(), session.getCheckOutTime()).toMinutes();
            session.setWorkMinutes((int) minutes);
        }

        return batchWorkSessionRepository.save(session);
    }

    /**
     * 获取汇总统计
     */
    public Map<String, Object> getSummary(String factoryId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) startDate = LocalDate.now().minusDays(7);
        if (endDate == null) endDate = LocalDate.now();

        Map<String, Object> summary = new HashMap<>();
        summary.put("progressSummary", reportRepository.getProgressSummary(factoryId, startDate, endDate));
        summary.put("hoursSummary", reportRepository.getHoursSummary(factoryId, startDate, endDate));
        summary.put("todayCount", reportRepository.countByFactoryIdAndDate(factoryId, LocalDate.now()));
        return summary;
    }

    // --- private helpers ---

    private void updateBatchActualQuantity(Long batchId, BigDecimal outputQuantity) {
        try {
            Optional<ProductionBatch> batchOpt = productionBatchRepository.findById(batchId);
            if (batchOpt.isPresent()) {
                ProductionBatch batch = batchOpt.get();
                BigDecimal current = batch.getActualQuantity() != null ? batch.getActualQuantity() : BigDecimal.ZERO;
                batch.setActualQuantity(current.add(outputQuantity));
                productionBatchRepository.save(batch);
            }
        } catch (Exception e) {
            log.warn("更新批次实际产量失败: batchId={}, error={}", batchId, e.getMessage());
        }
    }

    private WorkReportResponse toResponse(ProductionReport r) {
        return WorkReportResponse.builder()
                .id(r.getId())
                .factoryId(r.getFactoryId())
                .batchId(r.getBatchId())
                .workerId(r.getWorkerId())
                .reportType(r.getReportType())
                .schemaId(r.getSchemaId())
                .reportDate(r.getReportDate())
                .reporterName(r.getReporterName())
                .processCategory(r.getProcessCategory())
                .productName(r.getProductName())
                .outputQuantity(r.getOutputQuantity())
                .goodQuantity(r.getGoodQuantity())
                .defectQuantity(r.getDefectQuantity())
                .totalWorkMinutes(r.getTotalWorkMinutes())
                .totalWorkers(r.getTotalWorkers())
                .operationVolume(r.getOperationVolume())
                .hourEntries(r.getHourEntries())
                .nonProductionEntries(r.getNonProductionEntries())
                .productionStartTime(r.getProductionStartTime())
                .productionEndTime(r.getProductionEndTime())
                .customFields(r.getCustomFields())
                .photos(r.getPhotos())
                .status(r.getStatus())
                .syncedToSmartbi(r.getSyncedToSmartbi())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .build();
    }
}
