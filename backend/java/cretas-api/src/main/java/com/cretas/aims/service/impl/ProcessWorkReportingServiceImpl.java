package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.ProcessTask;
import com.cretas.aims.entity.ProductionReport;
import com.cretas.aims.entity.enums.ProcessTaskStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.ProcessTaskRepository;
import com.cretas.aims.repository.ProductionReportRepository;
import com.cretas.aims.service.ProcessWorkReportingService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProcessWorkReportingServiceImpl implements ProcessWorkReportingService {

    private static final Logger log = LoggerFactory.getLogger(ProcessWorkReportingServiceImpl.class);
    private final ProductionReportRepository reportRepository;
    private final ProcessTaskRepository taskRepository;

    @Override
    @Transactional
    public Map<String, Object> approveReport(String factoryId, Long reportId, Long approvedBy) {
        log.info("Approving report {} for factory {}", reportId, factoryId);
        ProductionReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("ProductionReport", "id", reportId.toString()));

        if (!factoryId.equals(report.getFactoryId())) {
            throw new BusinessException("报工记录不属于当前工厂");
        }

        // Idempotency: only approve if currently PENDING
        if (!"PENDING".equals(report.getApprovalStatus())) {
            throw new BusinessException(409, "报工记录已被处理，当前状态: " + report.getApprovalStatus());
        }

        report.setApprovalStatus("APPROVED");
        report.setApprovedBy(approvedBy);
        report.setApprovedAt(LocalDateTime.now());
        reportRepository.save(report);

        // Sync quantities to ProcessTask
        if (report.getProcessTaskId() != null) {
            syncQuantitiesToTask(report.getProcessTaskId(), report.getOutputQuantity(), true);
            checkAndRestoreFromSupplementing(report.getProcessTaskId());
        }

        return Map.of("reportId", reportId, "status", "APPROVED");
    }

    @Override
    @Transactional
    public Map<String, Object> rejectReport(String factoryId, Long reportId, String reason, Long rejectedBy) {
        log.info("Rejecting report {} for factory {}", reportId, factoryId);
        ProductionReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("ProductionReport", "id", reportId.toString()));

        if (!factoryId.equals(report.getFactoryId())) {
            throw new BusinessException("报工记录不属于当前工厂");
        }

        if (!"PENDING".equals(report.getApprovalStatus())) {
            throw new BusinessException(409, "报工记录已被处理，当前状态: " + report.getApprovalStatus());
        }

        report.setApprovalStatus("REJECTED");
        report.setRejectedReason(reason);
        report.setApprovedBy(rejectedBy);
        report.setApprovedAt(LocalDateTime.now());
        reportRepository.save(report);

        // Decrease pending quantity on task
        if (report.getProcessTaskId() != null) {
            ProcessTask task = taskRepository.findById(report.getProcessTaskId()).orElse(null);
            if (task != null) {
                task.setPendingQuantity(
                        task.getPendingQuantity().subtract(report.getOutputQuantity()).max(BigDecimal.ZERO));
                taskRepository.save(task);
            }
            checkAndRestoreFromSupplementing(report.getProcessTaskId());
        }

        return Map.of("reportId", reportId, "status", "REJECTED");
    }

    @Override
    @Transactional
    public Map<String, Object> batchApprove(String factoryId, List<Long> reportIds, Long approvedBy) {
        log.info("Batch approving {} reports for factory {}", reportIds.size(), factoryId);
        List<Map<String, Object>> results = new ArrayList<>();

        List<Long> skippedIds = new ArrayList<>();
        Set<String> affectedTaskIds = new java.util.HashSet<>();

        for (Long reportId : reportIds) {
            ProductionReport report = reportRepository.findById(reportId).orElse(null);
            if (report == null) {
                skippedIds.add(reportId);
                continue;
            }

            if (!factoryId.equals(report.getFactoryId())) {
                skippedIds.add(reportId);
                continue;
            }
            if (!"PENDING".equals(report.getApprovalStatus())) {
                // 跳过已处理的，不抛异常不回滚
                skippedIds.add(reportId);
                continue;
            }

            report.setApprovalStatus("APPROVED");
            report.setApprovedBy(approvedBy);
            report.setApprovedAt(LocalDateTime.now());
            reportRepository.save(report);

            if (report.getProcessTaskId() != null) {
                syncQuantitiesToTask(report.getProcessTaskId(), report.getOutputQuantity(), true);
                affectedTaskIds.add(report.getProcessTaskId());
            }

            results.add(Map.of("reportId", reportId, "status", "APPROVED"));
        }

        // Check SUPPLEMENTING state for all affected tasks
        affectedTaskIds.forEach(this::checkAndRestoreFromSupplementing);

        return Map.of("approved", results.size(), "skipped", skippedIds.size(), "results", results);
    }

    @Override
    @Transactional
    public Map<String, Object> submitNormalReport(String factoryId, String processTaskId,
                                                    Long workerId, String reporterName,
                                                    BigDecimal outputQuantity, String notes) {
        log.info("Submitting normal report for task {} by worker {}", processTaskId, workerId);

        // P1-3: 30秒时间窗口去重 — 防止弱网环境重复提交
        LocalDateTime dedup30s = LocalDateTime.now().minusSeconds(30);
        List<ProductionReport> recentDuplicates = reportRepository
                .findByProcessTaskIdAndDeletedAtIsNull(processTaskId).stream()
                .filter(r -> r.getWorkerId() != null && r.getWorkerId().equals(workerId))
                .filter(r -> r.getOutputQuantity() != null && r.getOutputQuantity().compareTo(outputQuantity) == 0)
                .filter(r -> r.getCreatedAt() != null && r.getCreatedAt().isAfter(dedup30s))
                .collect(Collectors.toList());
        if (!recentDuplicates.isEmpty()) {
            log.warn("Duplicate report detected for task {} worker {} qty {} within 30s", processTaskId, workerId, outputQuantity);
            ProductionReport existing = recentDuplicates.get(0);
            return Map.of("reportId", existing.getId(), "taskStatus", "IN_PROGRESS",
                    "pendingQuantity", existing.getOutputQuantity(), "duplicate", true);
        }

        ProcessTask task = taskRepository.findByFactoryIdAndId(factoryId, processTaskId)
                .orElseThrow(() -> new ResourceNotFoundException("ProcessTask", "id", processTaskId));

        // Normal report only for IN_PROGRESS or PENDING tasks
        if (task.getStatus() != ProcessTaskStatus.IN_PROGRESS
                && task.getStatus() != ProcessTaskStatus.PENDING) {
            throw new BusinessException("正常报工仅限进行中或待开始的任务，当前状态: " + task.getStatus());
        }

        // Auto-transition PENDING → IN_PROGRESS
        if (task.getStatus() == ProcessTaskStatus.PENDING) {
            task.setStatus(ProcessTaskStatus.IN_PROGRESS);
        }

        // Create report — all reports need approval
        ProductionReport report = ProductionReport.builder()
                .factoryId(factoryId)
                .processTaskId(processTaskId)
                .workerId(workerId)
                .reporterName(reporterName)
                .reportType(ProductionReport.ReportType.PROGRESS)
                .reportDate(LocalDate.now())
                .outputQuantity(outputQuantity)
                .isSupplemental(false)
                .approvalStatus("PENDING")
                .notes(notes)
                .status(ProductionReport.Status.SUBMITTED)
                .build();

        ProductionReport saved = reportRepository.save(report);

        // Add to pendingQuantity (will move to completedQuantity upon approval)
        task.setPendingQuantity(task.getPendingQuantity().add(outputQuantity));
        taskRepository.save(task);

        return Map.of(
                "reportId", saved.getId(),
                "taskStatus", task.getStatus().name(),
                "pendingQuantity", task.getPendingQuantity());
    }

    @Override
    @Transactional
    public Map<String, Object> submitSupplement(String factoryId, String processTaskId,
                                                 Long workerId, String reporterName,
                                                 BigDecimal outputQuantity, String processCategory, String notes) {
        log.info("Submitting supplement for task {} by worker {}", processTaskId, workerId);

        ProcessTask task = taskRepository.findByFactoryIdAndId(factoryId, processTaskId)
                .orElseThrow(() -> new ResourceNotFoundException("ProcessTask", "id", processTaskId));

        // Must be COMPLETED, CLOSED, or already SUPPLEMENTING
        if (task.getStatus() != ProcessTaskStatus.COMPLETED
                && task.getStatus() != ProcessTaskStatus.CLOSED
                && task.getStatus() != ProcessTaskStatus.SUPPLEMENTING) {
            throw new BusinessException("只有已完成或已关闭的任务可以补报");
        }

        // Enter SUPPLEMENTING state if not already
        if (task.getStatus() != ProcessTaskStatus.SUPPLEMENTING) {
            task.setPreviousTerminalStatus(task.getStatus().name());
            task.setStatus(ProcessTaskStatus.SUPPLEMENTING);
            taskRepository.save(task);
        }

        // Create supplemental report
        ProductionReport report = ProductionReport.builder()
                .factoryId(factoryId)
                .processTaskId(processTaskId)
                .workerId(workerId)
                .reporterName(reporterName)
                .reportType(ProductionReport.ReportType.PROGRESS)
                .reportDate(LocalDate.now())
                .outputQuantity(outputQuantity)
                .processCategory(processCategory)
                .isSupplemental(true)
                .approvalStatus("PENDING")
                .notes(notes)
                .status(ProductionReport.Status.SUBMITTED)
                .build();

        ProductionReport saved = reportRepository.save(report);

        // Increase pending quantity
        task.setPendingQuantity(task.getPendingQuantity().add(outputQuantity));
        taskRepository.save(task);

        return Map.of("reportId", saved.getId(), "taskStatus", "SUPPLEMENTING");
    }

    @Override
    @Transactional
    public Map<String, Object> createReversal(String factoryId, Long originalReportId,
                                               Long createdBy, String reason) {
        log.info("Creating reversal for report {} in factory {}", originalReportId, factoryId);

        ProductionReport original = reportRepository.findById(originalReportId)
                .orElseThrow(() -> new ResourceNotFoundException("ProductionReport", "id", originalReportId.toString()));

        if (!"APPROVED".equals(original.getApprovalStatus())) {
            throw new BusinessException("只能冲销已审批通过的报工");
        }

        if (reportRepository.existsByReversalOfIdAndDeletedAtIsNull(originalReportId)) {
            throw new BusinessException("该报工已被冲销，不可重复操作");
        }

        // Create negative reversal record
        ProductionReport reversal = ProductionReport.builder()
                .factoryId(factoryId)
                .processTaskId(original.getProcessTaskId())
                .workerId(original.getWorkerId())
                .reporterName(original.getReporterName())
                .reportType(original.getReportType())
                .reportDate(LocalDate.now())
                .outputQuantity(original.getOutputQuantity().negate())
                .processCategory(original.getProcessCategory())
                .productName(original.getProductName())
                .isSupplemental(false)
                .approvalStatus("APPROVED")
                .approvedBy(createdBy)
                .approvedAt(LocalDateTime.now())
                .reversalOfId(originalReportId)
                .rejectedReason(reason)
                .status(ProductionReport.Status.APPROVED)
                .build();

        ProductionReport saved = reportRepository.save(reversal);

        // Reverse the quantity on the task
        if (original.getProcessTaskId() != null) {
            ProcessTask task = taskRepository.findById(original.getProcessTaskId()).orElse(null);
            if (task != null) {
                task.setCompletedQuantity(
                        task.getCompletedQuantity().subtract(original.getOutputQuantity()).max(BigDecimal.ZERO));
                taskRepository.save(task);
            }
        }

        return Map.of("reversalId", saved.getId(), "originalId", originalReportId);
    }

    @Override
    public PageResponse<Map<String, Object>> getPendingApprovals(String factoryId, Pageable pageable) {
        Page<ProductionReport> page = reportRepository
                .findByFactoryIdAndApprovalStatusAndProcessTaskIdIsNotNullAndDeletedAtIsNull(
                        factoryId, "PENDING", pageable);

        List<Map<String, Object>> content = page.getContent().stream()
                .map(this::reportToMap)
                .collect(Collectors.toList());

        return PageResponse.of(content, page.getNumber() + 1, page.getSize(), page.getTotalElements());
    }

    @Override
    public List<Map<String, Object>> getReportsByTask(String factoryId, String taskId) {
        return reportRepository.findByProcessTaskIdAndDeletedAtIsNull(taskId)
                .stream()
                .map(this::reportToMap)
                .collect(Collectors.toList());
    }

    @Override
    public List<ProcessTaskDTO.WorkerSummary> getWorkerSummaryByTask(String factoryId, String taskId) {
        List<Map<String, Object>> raw = reportRepository.getWorkerSummaryByTaskId(taskId);

        // Get all reports for this task to compute approved vs pending per worker
        List<ProductionReport> allReports = reportRepository.findByProcessTaskIdAndDeletedAtIsNull(taskId);
        Map<Long, BigDecimal> approvedByWorker = new java.util.HashMap<>();
        Map<Long, BigDecimal> pendingByWorker = new java.util.HashMap<>();
        for (ProductionReport r : allReports) {
            if (r.getWorkerId() == null) continue;
            if ("APPROVED".equals(r.getApprovalStatus())) {
                approvedByWorker.merge(r.getWorkerId(), r.getOutputQuantity(), BigDecimal::add);
            } else if ("PENDING".equals(r.getApprovalStatus())) {
                pendingByWorker.merge(r.getWorkerId(), r.getOutputQuantity(), BigDecimal::add);
            }
        }

        return raw.stream()
                .map(row -> {
                    Long workerId = ((Number) row.get("worker_id")).longValue();
                    return ProcessTaskDTO.WorkerSummary.builder()
                        .workerId(workerId)
                        .workerName((String) row.get("worker_name"))
                        .totalQuantity(new BigDecimal(row.get("total_quantity").toString()))
                        .approvedQuantity(approvedByWorker.getOrDefault(workerId, BigDecimal.ZERO))
                        .pendingQuantity(pendingByWorker.getOrDefault(workerId, BigDecimal.ZERO))
                        .reportCount(((Number) row.get("report_count")).intValue())
                        .build();
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void calibrateTaskQuantities(String factoryId) {
        log.info("Calibrating task quantities for factory: {}", factoryId);
        List<ProcessTask> activeTasks = taskRepository.findActiveTasksForCalibration(factoryId);

        for (ProcessTask task : activeTasks) {
            Map<String, Object> approvedSum = reportRepository.sumApprovedQuantityByTaskId(task.getId());
            Map<String, Object> pendingSum = reportRepository.sumPendingQuantityByTaskId(task.getId());

            BigDecimal actualCompleted = new BigDecimal(approvedSum.get("total").toString());
            BigDecimal actualPending = new BigDecimal(pendingSum.get("total").toString());

            if (actualCompleted.compareTo(task.getCompletedQuantity()) != 0
                    || actualPending.compareTo(task.getPendingQuantity()) != 0) {
                log.warn("Calibration drift detected for task {}: completed {}→{}, pending {}→{}",
                        task.getId(),
                        task.getCompletedQuantity(), actualCompleted,
                        task.getPendingQuantity(), actualPending);
                task.setCompletedQuantity(actualCompleted);
                task.setPendingQuantity(actualPending);
                taskRepository.save(task);
            }
        }
    }

    // ==================== Private helpers ====================

    private void syncQuantitiesToTask(String taskId, BigDecimal quantity, boolean approved) {
        ProcessTask task = taskRepository.findById(taskId).orElse(null);
        if (task == null) return;

        if (approved) {
            task.setCompletedQuantity(task.getCompletedQuantity().add(quantity));
            task.setPendingQuantity(task.getPendingQuantity().subtract(quantity).max(BigDecimal.ZERO));
        }

        // Auto-transition PENDING → IN_PROGRESS on first approved report
        if (task.getStatus() == ProcessTaskStatus.PENDING) {
            task.setStatus(ProcessTaskStatus.IN_PROGRESS);
        }

        taskRepository.save(task);
    }

    private void checkAndRestoreFromSupplementing(String taskId) {
        ProcessTask task = taskRepository.findById(taskId).orElse(null);
        if (task == null || task.getStatus() != ProcessTaskStatus.SUPPLEMENTING) return;

        // Check if any supplemental reports are still PENDING
        List<ProductionReport> pendingSupplements = reportRepository
                .findByProcessTaskIdAndApprovalStatusAndDeletedAtIsNull(taskId, "PENDING")
                .stream()
                .filter(r -> Boolean.TRUE.equals(r.getIsSupplemental()))
                .collect(Collectors.toList());

        if (pendingSupplements.isEmpty()) {
            // Restore to previous terminal status
            String previousStatus = task.getPreviousTerminalStatus();
            if (previousStatus != null) {
                task.setStatus(ProcessTaskStatus.valueOf(previousStatus));
                task.setPreviousTerminalStatus(null);
                taskRepository.save(task);
                log.info("Task {} restored from SUPPLEMENTING to {}", taskId, previousStatus);
            }
        }
    }

    private Map<String, Object> reportToMap(ProductionReport r) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", r.getId());
        map.put("factoryId", r.getFactoryId());
        map.put("processTaskId", r.getProcessTaskId());
        map.put("workerId", r.getWorkerId());
        map.put("reporterName", r.getReporterName());
        map.put("reportDate", r.getReportDate());
        map.put("outputQuantity", r.getOutputQuantity());
        map.put("processCategory", r.getProcessCategory());
        map.put("productName", r.getProductName());
        map.put("approvalStatus", r.getApprovalStatus());
        map.put("isSupplemental", r.getIsSupplemental());
        map.put("approvedBy", r.getApprovedBy());
        map.put("approvedAt", r.getApprovedAt());
        map.put("rejectedReason", r.getRejectedReason());
        map.put("reversalOfId", r.getReversalOfId());
        map.put("notes", r.getNotes());
        map.put("createdAt", r.getCreatedAt());
        return map;
    }
}
