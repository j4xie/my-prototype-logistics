package com.cretas.aims.integration;

import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.dto.WorkProcessDTO;
import com.cretas.aims.dto.ProductWorkProcessDTO;
import com.cretas.aims.entity.ProcessTask;
import com.cretas.aims.entity.ProductionReport;
import com.cretas.aims.entity.enums.ProcessTaskStatus;
import com.cretas.aims.entity.rules.StateMachine;
import com.cretas.aims.repository.ProcessTaskRepository;
import com.cretas.aims.repository.ProductionReportRepository;
import com.cretas.aims.repository.StateMachineRepository;
import com.cretas.aims.service.ProcessTaskService;
import com.cretas.aims.service.ProcessWorkReportingService;
import com.cretas.aims.service.ProductWorkProcessService;
import com.cretas.aims.service.StateMachineService;
import com.cretas.aims.service.StateMachineService.StateMachineConfig;
import com.cretas.aims.service.StateMachineService.StateInfo;
import com.cretas.aims.service.StateMachineService.TransitionDef;
import com.cretas.aims.service.WorkProcessService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Process-Centric Production Mode Integration Test
 * Tests the complete lifecycle of process tasks: creation, reporting, approval,
 * supplement, reversal, batch approval, calibration, factory isolation, run overview,
 * and state machine publish.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-12
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("ProcessModeFlowTest - 工序制生产模式全流程测试")
@Transactional
class ProcessModeFlowTest {

    @Autowired(required = false)
    private ProcessTaskService processTaskService;

    @Autowired(required = false)
    private ProcessWorkReportingService reportingService;

    @Autowired(required = false)
    private WorkProcessService workProcessService;

    @Autowired(required = false)
    private ProductWorkProcessService productWorkProcessService;

    @Autowired(required = false)
    private StateMachineService stateMachineService;

    @Autowired(required = false)
    private ProcessTaskRepository processTaskRepository;

    @Autowired(required = false)
    private ProductionReportRepository productionReportRepository;

    @Autowired(required = false)
    private StateMachineRepository stateMachineRepository;

    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_FACTORY_ID_2 = "F002";
    private static final Long TEST_WORKER_ID = 100L;
    private static final Long TEST_APPROVER_ID = 200L;
    private static final String TEST_REPORTER_NAME = "测试工人";
    private static final String TEST_PROCESS_CATEGORY = "切割";

    // ==================== Helper Methods ====================

    /**
     * Creates a WorkProcess and returns the DTO with the assigned ID.
     */
    private WorkProcessDTO createTestWorkProcess(String factoryId, String processName) {
        WorkProcessDTO dto = WorkProcessDTO.builder()
                .processName(processName)
                .processCategory(TEST_PROCESS_CATEGORY)
                .unit("kg")
                .sortOrder(1)
                .isActive(true)
                .build();
        return workProcessService.create(factoryId, dto);
    }

    /**
     * Creates a ProductWorkProcess binding and returns the DTO.
     */
    private ProductWorkProcessDTO createTestProductWorkProcess(String factoryId,
                                                                String productTypeId,
                                                                String workProcessId,
                                                                int processOrder) {
        ProductWorkProcessDTO dto = ProductWorkProcessDTO.builder()
                .productTypeId(productTypeId)
                .workProcessId(workProcessId)
                .processOrder(processOrder)
                .build();
        return productWorkProcessService.create(factoryId, dto);
    }

    /**
     * Creates a ProcessTask with the given planned quantity and returns the DTO.
     */
    private ProcessTaskDTO createTestProcessTask(String factoryId, String workProcessId,
                                                  BigDecimal plannedQuantity,
                                                  String productionRunId) {
        ProcessTaskDTO dto = ProcessTaskDTO.builder()
                .productTypeId("PT-TEST-001")
                .workProcessId(workProcessId)
                .plannedQuantity(plannedQuantity)
                .unit("kg")
                .startDate(LocalDate.now())
                .expectedEndDate(LocalDate.now().plusDays(7))
                .createdBy(TEST_WORKER_ID)
                .productionRunId(productionRunId)
                .notes("Integration test task")
                .build();
        return processTaskService.create(factoryId, dto);
    }

    /**
     * Creates a ProductionReport in PENDING approval status directly via repository.
     */
    private ProductionReport createTestReport(String factoryId, String processTaskId,
                                               BigDecimal outputQuantity) {
        ProductionReport report = ProductionReport.builder()
                .factoryId(factoryId)
                .processTaskId(processTaskId)
                .workerId(TEST_WORKER_ID)
                .reporterName(TEST_REPORTER_NAME)
                .reportType(ProductionReport.ReportType.PROGRESS)
                .reportDate(LocalDate.now())
                .outputQuantity(outputQuantity)
                .processCategory(TEST_PROCESS_CATEGORY)
                .isSupplemental(false)
                .approvalStatus("PENDING")
                .status(ProductionReport.Status.SUBMITTED)
                .build();
        return productionReportRepository.save(report);
    }

    /**
     * Transitions a task from PENDING to IN_PROGRESS.
     */
    private void transitionToInProgress(String factoryId, String taskId) {
        ProcessTaskDTO.StatusUpdateRequest request = ProcessTaskDTO.StatusUpdateRequest.builder()
                .status("IN_PROGRESS")
                .notes("Starting work")
                .build();
        processTaskService.updateStatus(factoryId, taskId, request);
    }

    /**
     * Transitions a task from IN_PROGRESS to COMPLETED.
     */
    private void transitionToCompleted(String factoryId, String taskId) {
        ProcessTaskDTO.StatusUpdateRequest request = ProcessTaskDTO.StatusUpdateRequest.builder()
                .status("COMPLETED")
                .notes("Work completed")
                .build();
        processTaskService.updateStatus(factoryId, taskId, request);
    }

    // ==================== IT-01: Full Lifecycle ====================

    @Test
    @Order(1)
    @DisplayName("IT-01: 全生命周期 — WorkProcess → ProductWorkProcess → ProcessTask → 报工 → 审批 → 完成")
    void testFullLifecycle() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(reportingService != null, "ProcessWorkReportingService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");
        assumeTrue(productWorkProcessService != null, "ProductWorkProcessService not available");
        assumeTrue(processTaskRepository != null, "ProcessTaskRepository not available");
        assumeTrue(productionReportRepository != null, "ProductionReportRepository not available");

        // Step 1: Create WorkProcess
        WorkProcessDTO workProcess = createTestWorkProcess(TEST_FACTORY_ID, "IT01-切割工序");
        assertThat(workProcess).isNotNull();
        assertThat(workProcess.getId()).isNotNull();

        // Step 2: Create ProductWorkProcess
        ProductWorkProcessDTO productBinding = createTestProductWorkProcess(
                TEST_FACTORY_ID, "PT-TEST-001", workProcess.getId(), 1);
        assertThat(productBinding).isNotNull();
        assertThat(productBinding.getId()).isNotNull();

        // Step 3: Create ProcessTask (status = PENDING)
        String runId = UUID.randomUUID().toString();
        BigDecimal planned = new BigDecimal("100.00");
        ProcessTaskDTO task = createTestProcessTask(TEST_FACTORY_ID, workProcess.getId(), planned, runId);
        assertThat(task).isNotNull();
        assertThat(task.getId()).isNotNull();
        assertThat(task.getStatus()).isEqualTo("PENDING");
        assertThat(task.getCompletedQuantity()).isEqualByComparingTo(BigDecimal.ZERO);

        // Step 4: Verify getActiveTasks includes our task (PENDING is active)
        List<ProcessTaskDTO> activeTasks = processTaskService.getActiveTasks(TEST_FACTORY_ID);
        assertThat(activeTasks).isNotNull();
        assertThat(activeTasks).anyMatch(t -> t.getId().equals(task.getId()));

        // Step 5: Submit a report (create ProductionReport with processTaskId, approvalStatus=PENDING)
        ProductionReport report1 = createTestReport(TEST_FACTORY_ID, task.getId(), new BigDecimal("30.00"));

        // Also add pending quantity to task to simulate real flow
        ProcessTask taskEntity = processTaskRepository.findById(task.getId()).orElseThrow();
        taskEntity.setPendingQuantity(taskEntity.getPendingQuantity().add(new BigDecimal("30.00")));
        processTaskRepository.save(taskEntity);

        // Step 6: Approve the report
        Map<String, Object> approveResult = reportingService.approveReport(TEST_FACTORY_ID, report1.getId(), TEST_APPROVER_ID);
        assertThat(approveResult).containsEntry("status", "APPROVED");

        // Step 7: Verify completedQty increased
        ProcessTaskDTO taskAfterApproval = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(taskAfterApproval.getCompletedQuantity()).isEqualByComparingTo(new BigDecimal("30.00"));

        // Step 8: Verify PENDING → IN_PROGRESS auto-transition (syncQuantitiesToTask does this)
        assertThat(taskAfterApproval.getStatus()).isEqualTo("IN_PROGRESS");

        // Step 9: Submit more reports to reach planned quantity
        ProductionReport report2 = createTestReport(TEST_FACTORY_ID, task.getId(), new BigDecimal("70.00"));
        taskEntity = processTaskRepository.findById(task.getId()).orElseThrow();
        taskEntity.setPendingQuantity(taskEntity.getPendingQuantity().add(new BigDecimal("70.00")));
        processTaskRepository.save(taskEntity);

        reportingService.approveReport(TEST_FACTORY_ID, report2.getId(), TEST_APPROVER_ID);

        ProcessTaskDTO taskAfterFull = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(taskAfterFull.getCompletedQuantity()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(taskAfterFull.getTargetReached()).isTrue();

        // Step 10: Mark COMPLETED
        transitionToCompleted(TEST_FACTORY_ID, task.getId());
        ProcessTaskDTO completedTask = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(completedTask.getStatus()).isEqualTo("COMPLETED");
    }

    // ==================== IT-02: Supplementing Flow ====================

    @Test
    @Order(2)
    @DisplayName("IT-02: 补报流程 — COMPLETED → SUPPLEMENTING → 审批 → 自动恢复 COMPLETED")
    void testSupplementingFlow() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(reportingService != null, "ProcessWorkReportingService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");
        assumeTrue(processTaskRepository != null, "ProcessTaskRepository not available");
        assumeTrue(productionReportRepository != null, "ProductionReportRepository not available");

        // Setup: Create work process and task
        WorkProcessDTO wp = createTestWorkProcess(TEST_FACTORY_ID, "IT02-包装工序");
        String runId = UUID.randomUUID().toString();
        ProcessTaskDTO task = createTestProcessTask(TEST_FACTORY_ID, wp.getId(), new BigDecimal("50.00"), runId);

        // Transition PENDING → IN_PROGRESS → COMPLETED
        transitionToInProgress(TEST_FACTORY_ID, task.getId());
        transitionToCompleted(TEST_FACTORY_ID, task.getId());

        ProcessTaskDTO completedTask = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(completedTask.getStatus()).isEqualTo("COMPLETED");

        // Step 1: Submit supplement
        Map<String, Object> supplementResult = reportingService.submitSupplement(
                TEST_FACTORY_ID, task.getId(),
                TEST_WORKER_ID, TEST_REPORTER_NAME,
                new BigDecimal("5.00"), TEST_PROCESS_CATEGORY);

        assertThat(supplementResult).containsEntry("taskStatus", "SUPPLEMENTING");
        Long supplementReportId = ((Number) supplementResult.get("reportId")).longValue();

        // Step 2: Verify task status = SUPPLEMENTING and previousTerminalStatus = COMPLETED
        ProcessTaskDTO supplementingTask = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(supplementingTask.getStatus()).isEqualTo("SUPPLEMENTING");
        assertThat(supplementingTask.getPreviousTerminalStatus()).isEqualTo("COMPLETED");

        // Step 3: Approve the supplement report
        reportingService.approveReport(TEST_FACTORY_ID, supplementReportId, TEST_APPROVER_ID);

        // Step 4: Verify auto-restore to COMPLETED (checkAndRestoreFromSupplementing)
        ProcessTaskDTO restoredTask = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(restoredTask.getStatus()).isEqualTo("COMPLETED");
        assertThat(restoredTask.getPreviousTerminalStatus()).isNull();
        assertThat(restoredTask.getCompletedQuantity()).isEqualByComparingTo(new BigDecimal("5.00"));
    }

    // ==================== IT-03: Rejection Flow ====================

    @Test
    @Order(3)
    @DisplayName("IT-03: 驳回流程 — 提交报工 → 驳回 → pendingQty 减少, 任务保持 IN_PROGRESS")
    void testRejectionFlow() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(reportingService != null, "ProcessWorkReportingService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");
        assumeTrue(processTaskRepository != null, "ProcessTaskRepository not available");
        assumeTrue(productionReportRepository != null, "ProductionReportRepository not available");

        // Setup: Create work process and task
        WorkProcessDTO wp = createTestWorkProcess(TEST_FACTORY_ID, "IT03-烘焙工序");
        String runId = UUID.randomUUID().toString();
        ProcessTaskDTO task = createTestProcessTask(TEST_FACTORY_ID, wp.getId(), new BigDecimal("100.00"), runId);

        // Transition to IN_PROGRESS
        transitionToInProgress(TEST_FACTORY_ID, task.getId());

        // Submit a report and set pending quantity
        BigDecimal reportQty = new BigDecimal("20.00");
        ProductionReport report = createTestReport(TEST_FACTORY_ID, task.getId(), reportQty);

        ProcessTask taskEntity = processTaskRepository.findById(task.getId()).orElseThrow();
        taskEntity.setPendingQuantity(taskEntity.getPendingQuantity().add(reportQty));
        processTaskRepository.save(taskEntity);

        // Verify pending quantity before rejection
        ProcessTaskDTO beforeReject = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(beforeReject.getPendingQuantity()).isEqualByComparingTo(reportQty);

        // Reject the report
        Map<String, Object> rejectResult = reportingService.rejectReport(
                TEST_FACTORY_ID, report.getId(), "数量不符", TEST_APPROVER_ID);
        assertThat(rejectResult).containsEntry("status", "REJECTED");

        // Verify: pending quantity decreased
        ProcessTaskDTO afterReject = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(afterReject.getPendingQuantity()).isEqualByComparingTo(BigDecimal.ZERO);

        // Verify: task stays IN_PROGRESS
        assertThat(afterReject.getStatus()).isEqualTo("IN_PROGRESS");

        // Verify: report approvalStatus = REJECTED
        ProductionReport rejectedReport = productionReportRepository.findById(report.getId()).orElseThrow();
        assertThat(rejectedReport.getApprovalStatus()).isEqualTo("REJECTED");
    }

    // ==================== IT-04: Reversal Flow ====================

    @Test
    @Order(4)
    @DisplayName("IT-04: 冲销流程 — 审批报工 → 冲销 → completedQty 减少, 冲销记录有负数量和 reversalOfId")
    void testReversalFlow() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(reportingService != null, "ProcessWorkReportingService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");
        assumeTrue(processTaskRepository != null, "ProcessTaskRepository not available");
        assumeTrue(productionReportRepository != null, "ProductionReportRepository not available");

        // Setup: Create work process and task
        WorkProcessDTO wp = createTestWorkProcess(TEST_FACTORY_ID, "IT04-灌装工序");
        String runId = UUID.randomUUID().toString();
        ProcessTaskDTO task = createTestProcessTask(TEST_FACTORY_ID, wp.getId(), new BigDecimal("100.00"), runId);

        // Create and approve a report
        BigDecimal reportQty = new BigDecimal("40.00");
        ProductionReport report = createTestReport(TEST_FACTORY_ID, task.getId(), reportQty);

        ProcessTask taskEntity = processTaskRepository.findById(task.getId()).orElseThrow();
        taskEntity.setPendingQuantity(taskEntity.getPendingQuantity().add(reportQty));
        processTaskRepository.save(taskEntity);

        reportingService.approveReport(TEST_FACTORY_ID, report.getId(), TEST_APPROVER_ID);

        // Verify completed quantity is 40
        ProcessTaskDTO afterApproval = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(afterApproval.getCompletedQuantity()).isEqualByComparingTo(reportQty);

        // Create reversal
        Map<String, Object> reversalResult = reportingService.createReversal(
                TEST_FACTORY_ID, report.getId(), TEST_APPROVER_ID, "数据录入错误");
        Long reversalId = ((Number) reversalResult.get("reversalId")).longValue();

        // Verify: completedQty decreased
        ProcessTaskDTO afterReversal = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(afterReversal.getCompletedQuantity()).isEqualByComparingTo(BigDecimal.ZERO);

        // Verify: reversal report has negative quantity and reversalOfId
        ProductionReport reversalReport = productionReportRepository.findById(reversalId).orElseThrow();
        assertThat(reversalReport.getOutputQuantity()).isEqualByComparingTo(reportQty.negate());
        assertThat(reversalReport.getReversalOfId()).isEqualTo(report.getId());
        assertThat(reversalReport.getApprovalStatus()).isEqualTo("APPROVED");
    }

    // ==================== IT-05: Batch Approval ====================

    @Test
    @Order(5)
    @DisplayName("IT-05: 批量审批 — 提交 3 份报工 → 批量审批 → 所有报工 APPROVED, 数量同步正确")
    void testBatchApproval() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(reportingService != null, "ProcessWorkReportingService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");
        assumeTrue(processTaskRepository != null, "ProcessTaskRepository not available");
        assumeTrue(productionReportRepository != null, "ProductionReportRepository not available");

        // Setup: Create work process and task
        WorkProcessDTO wp = createTestWorkProcess(TEST_FACTORY_ID, "IT05-搅拌工序");
        String runId = UUID.randomUUID().toString();
        ProcessTaskDTO task = createTestProcessTask(TEST_FACTORY_ID, wp.getId(), new BigDecimal("100.00"), runId);

        // Submit 3 reports
        BigDecimal qty1 = new BigDecimal("10.00");
        BigDecimal qty2 = new BigDecimal("20.00");
        BigDecimal qty3 = new BigDecimal("30.00");
        BigDecimal totalQty = qty1.add(qty2).add(qty3); // 60.00

        ProductionReport report1 = createTestReport(TEST_FACTORY_ID, task.getId(), qty1);
        ProductionReport report2 = createTestReport(TEST_FACTORY_ID, task.getId(), qty2);
        ProductionReport report3 = createTestReport(TEST_FACTORY_ID, task.getId(), qty3);

        // Add pending quantities to task
        ProcessTask taskEntity = processTaskRepository.findById(task.getId()).orElseThrow();
        taskEntity.setPendingQuantity(totalQty);
        processTaskRepository.save(taskEntity);

        // Batch approve all 3
        List<Long> reportIds = Arrays.asList(report1.getId(), report2.getId(), report3.getId());
        Map<String, Object> batchResult = reportingService.batchApprove(
                TEST_FACTORY_ID, reportIds, TEST_APPROVER_ID);
        assertThat(batchResult).containsEntry("approved", 3);

        // Verify all reports are APPROVED
        for (Long reportId : reportIds) {
            ProductionReport r = productionReportRepository.findById(reportId).orElseThrow();
            assertThat(r.getApprovalStatus()).isEqualTo("APPROVED");
        }

        // Verify task quantities synced correctly
        ProcessTaskDTO afterBatch = processTaskService.getById(TEST_FACTORY_ID, task.getId());
        assertThat(afterBatch.getCompletedQuantity()).isEqualByComparingTo(totalQty);
        assertThat(afterBatch.getStatus()).isEqualTo("IN_PROGRESS"); // auto-transitioned from PENDING
    }

    // ==================== IT-06: Optimistic Lock ====================

    @Test
    @Order(6)
    @DisplayName("IT-06: 乐观锁 — 验证 @Version 字段存在并在更新时递增")
    void testOptimisticLock() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");
        assumeTrue(processTaskRepository != null, "ProcessTaskRepository not available");

        // Setup: Create a task
        WorkProcessDTO wp = createTestWorkProcess(TEST_FACTORY_ID, "IT06-检测工序");
        String runId = UUID.randomUUID().toString();
        ProcessTaskDTO task = createTestProcessTask(TEST_FACTORY_ID, wp.getId(), new BigDecimal("100.00"), runId);

        // Verify version field exists on the entity
        ProcessTask entity = processTaskRepository.findById(task.getId()).orElseThrow();
        assertThat(entity.getVersion()).isNotNull();
        Long initialVersion = entity.getVersion();

        // Perform an update (status transition)
        transitionToInProgress(TEST_FACTORY_ID, task.getId());

        // Verify version was incremented by Hibernate's @Version
        ProcessTask updatedEntity = processTaskRepository.findById(task.getId()).orElseThrow();
        assertThat(updatedEntity.getVersion()).isGreaterThan(initialVersion);
    }

    // ==================== IT-07: Factory Isolation ====================

    @Test
    @Order(7)
    @DisplayName("IT-07: 工厂隔离 — F001 和 F002 的任务互不可见")
    void testFactoryIsolation() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");

        // Create work processes for each factory
        WorkProcessDTO wpF001 = createTestWorkProcess(TEST_FACTORY_ID, "IT07-F001工序");
        WorkProcessDTO wpF002 = createTestWorkProcess(TEST_FACTORY_ID_2, "IT07-F002工序");

        // Create tasks for each factory
        String runIdF001 = UUID.randomUUID().toString();
        String runIdF002 = UUID.randomUUID().toString();
        ProcessTaskDTO taskF001 = createTestProcessTask(TEST_FACTORY_ID, wpF001.getId(),
                new BigDecimal("50.00"), runIdF001);
        ProcessTaskDTO taskF002 = createTestProcessTask(TEST_FACTORY_ID_2, wpF002.getId(),
                new BigDecimal("50.00"), runIdF002);

        // Query active tasks for F001
        List<ProcessTaskDTO> f001Tasks = processTaskService.getActiveTasks(TEST_FACTORY_ID);
        assertThat(f001Tasks).isNotNull();

        // Verify only F001 tasks returned — F002 task should NOT appear
        List<String> f001TaskIds = f001Tasks.stream()
                .map(ProcessTaskDTO::getId)
                .collect(java.util.stream.Collectors.toList());
        assertThat(f001TaskIds).contains(taskF001.getId());
        assertThat(f001TaskIds).doesNotContain(taskF002.getId());

        // Query active tasks for F002 — verify F001 task does NOT appear
        List<ProcessTaskDTO> f002Tasks = processTaskService.getActiveTasks(TEST_FACTORY_ID_2);
        List<String> f002TaskIds = f002Tasks.stream()
                .map(ProcessTaskDTO::getId)
                .collect(java.util.stream.Collectors.toList());
        assertThat(f002TaskIds).contains(taskF002.getId());
        assertThat(f002TaskIds).doesNotContain(taskF001.getId());
    }

    // ==================== IT-08: RunOverview ====================

    @Test
    @Order(8)
    @DisplayName("IT-08: 生产批次概览 — 同一 productionRunId 下 3 个任务, 计算 overallProgress")
    void testRunOverview() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");
        assumeTrue(processTaskRepository != null, "ProcessTaskRepository not available");

        // Create 3 work processes
        WorkProcessDTO wp1 = createTestWorkProcess(TEST_FACTORY_ID, "IT08-工序A");
        WorkProcessDTO wp2 = createTestWorkProcess(TEST_FACTORY_ID, "IT08-工序B");
        WorkProcessDTO wp3 = createTestWorkProcess(TEST_FACTORY_ID, "IT08-工序C");

        // Create 3 tasks with the same productionRunId
        String sharedRunId = "RUN-IT08-" + UUID.randomUUID().toString().substring(0, 8);
        ProcessTaskDTO task1 = createTestProcessTask(TEST_FACTORY_ID, wp1.getId(),
                new BigDecimal("100.00"), sharedRunId);
        ProcessTaskDTO task2 = createTestProcessTask(TEST_FACTORY_ID, wp2.getId(),
                new BigDecimal("200.00"), sharedRunId);
        ProcessTaskDTO task3 = createTestProcessTask(TEST_FACTORY_ID, wp3.getId(),
                new BigDecimal("100.00"), sharedRunId);

        // Set some completed quantities directly for testing
        ProcessTask entity1 = processTaskRepository.findById(task1.getId()).orElseThrow();
        entity1.setCompletedQuantity(new BigDecimal("50.00")); // 50% of 100
        processTaskRepository.save(entity1);

        ProcessTask entity2 = processTaskRepository.findById(task2.getId()).orElseThrow();
        entity2.setCompletedQuantity(new BigDecimal("100.00")); // 50% of 200
        processTaskRepository.save(entity2);

        // task3: completedQuantity remains 0 (0% of 100)
        // Total: (50 + 100 + 0) / (100 + 200 + 100) = 150/400 = 37.50%

        // Get run overview
        ProcessTaskDTO.RunOverview overview = processTaskService.getRunOverview(TEST_FACTORY_ID, sharedRunId);
        assertThat(overview).isNotNull();
        assertThat(overview.getProductionRunId()).isEqualTo(sharedRunId);
        assertThat(overview.getTasks()).hasSize(3);
        assertThat(overview.getOverallProgress()).isEqualByComparingTo(new BigDecimal("37.50"));
    }

    // ==================== IT-09: StateMachine Publish ====================

    @Test
    @Order(9)
    @DisplayName("IT-09: 状态机发布 — 保存草稿 → 发布 → 旧版本归档, 新版本 published, 版本号递增")
    void testStateMachinePublish() {
        assumeTrue(stateMachineService != null, "StateMachineService not available");
        assumeTrue(stateMachineRepository != null, "StateMachineRepository not available");

        String entityType = "PRODUCTION_WORKFLOW_IT09";

        // Step 1: Save an initial published version directly in DB to test archiving
        StateMachine initialPublished = StateMachine.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(TEST_FACTORY_ID)
                .entityType(entityType)
                .machineName("生产工作流-旧版")
                .machineDescription("Initial published version")
                .initialState("PENDING")
                .statesJson("[{\"code\":\"PENDING\",\"name\":\"待开始\",\"isFinal\":false}]")
                .transitionsJson("[]")
                .version(1)
                .publishStatus("published")
                .enabled(true)
                .createdBy(TEST_APPROVER_ID)
                .build();
        stateMachineRepository.save(initialPublished);

        // Step 2: Save a draft version
        StateMachine draft = StateMachine.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(TEST_FACTORY_ID)
                .entityType(entityType)
                .machineName("生产工作流-新版")
                .machineDescription("Draft to be published")
                .initialState("PENDING")
                .statesJson("[{\"code\":\"PENDING\",\"name\":\"待开始\",\"isFinal\":false},{\"code\":\"IN_PROGRESS\",\"name\":\"进行中\",\"isFinal\":false},{\"code\":\"COMPLETED\",\"name\":\"已完成\",\"isFinal\":true}]")
                .transitionsJson("[{\"from\":\"PENDING\",\"to\":\"IN_PROGRESS\",\"event\":\"start\"},{\"from\":\"IN_PROGRESS\",\"to\":\"COMPLETED\",\"event\":\"complete\"}]")
                .version(1)
                .publishStatus("draft")
                .enabled(true)
                .createdBy(TEST_APPROVER_ID)
                .build();
        stateMachineRepository.save(draft);

        // Step 3: Publish the draft
        StateMachineConfig publishedConfig = stateMachineService.publishDraft(
                TEST_FACTORY_ID, entityType, draft.getId(), TEST_APPROVER_ID);

        assertThat(publishedConfig).isNotNull();
        assertThat(publishedConfig.getMachineName()).isEqualTo("生产工作流-新版");

        // Step 4: Verify old version is archived
        Optional<StateMachine> archivedOpt = stateMachineRepository.findById(initialPublished.getId());
        assertThat(archivedOpt).isPresent();
        assertThat(archivedOpt.get().getPublishStatus()).isEqualTo("archived");

        // Step 5: Verify new version is published with incremented version
        Optional<StateMachine> publishedOpt = stateMachineRepository.findById(draft.getId());
        assertThat(publishedOpt).isPresent();
        assertThat(publishedOpt.get().getPublishStatus()).isEqualTo("published");
        assertThat(publishedOpt.get().getVersion()).isGreaterThan(1);

        // Step 6: Verify getPublishedStateMachine returns the new version
        Optional<StateMachineConfig> currentPublished = stateMachineService.getPublishedStateMachine(
                TEST_FACTORY_ID, entityType);
        assertThat(currentPublished).isPresent();
        assertThat(currentPublished.get().getMachineName()).isEqualTo("生产工作流-新版");

        // Step 7: Verify version history contains both versions
        List<StateMachineConfig> history = stateMachineService.getVersionHistory(TEST_FACTORY_ID, entityType);
        assertThat(history).hasSizeGreaterThanOrEqualTo(2);
    }

    // ==================== IT-10: Calibration ====================

    @Test
    @Order(10)
    @DisplayName("IT-10: 校准 — 手动制造 completedQty 偏差 → 运行校准 → 偏差修正")
    void testCalibration() {
        assumeTrue(processTaskService != null, "ProcessTaskService not available");
        assumeTrue(reportingService != null, "ProcessWorkReportingService not available");
        assumeTrue(workProcessService != null, "WorkProcessService not available");
        assumeTrue(processTaskRepository != null, "ProcessTaskRepository not available");
        assumeTrue(productionReportRepository != null, "ProductionReportRepository not available");

        // Setup: Create work process and task
        WorkProcessDTO wp = createTestWorkProcess(TEST_FACTORY_ID, "IT10-发酵工序");
        String runId = UUID.randomUUID().toString();
        ProcessTaskDTO task = createTestProcessTask(TEST_FACTORY_ID, wp.getId(), new BigDecimal("100.00"), runId);

        // Transition to IN_PROGRESS so it's an active task for calibration
        transitionToInProgress(TEST_FACTORY_ID, task.getId());

        // Create 2 approved reports totaling 50.00
        ProductionReport r1 = createTestReport(TEST_FACTORY_ID, task.getId(), new BigDecimal("20.00"));
        r1.setApprovalStatus("APPROVED");
        r1.setApprovedBy(TEST_APPROVER_ID);
        r1.setApprovedAt(LocalDateTime.now());
        productionReportRepository.save(r1);

        ProductionReport r2 = createTestReport(TEST_FACTORY_ID, task.getId(), new BigDecimal("30.00"));
        r2.setApprovalStatus("APPROVED");
        r2.setApprovedBy(TEST_APPROVER_ID);
        r2.setApprovedAt(LocalDateTime.now());
        productionReportRepository.save(r2);

        // Create 1 pending report of 10.00
        ProductionReport r3 = createTestReport(TEST_FACTORY_ID, task.getId(), new BigDecimal("10.00"));
        // r3 stays PENDING by default

        // Manually desync the task's completedQty and pendingQty (introduce drift)
        ProcessTask taskEntity = processTaskRepository.findById(task.getId()).orElseThrow();
        taskEntity.setCompletedQuantity(new BigDecimal("99.99")); // Wrong! Should be 50.00
        taskEntity.setPendingQuantity(new BigDecimal("77.77"));   // Wrong! Should be 10.00
        processTaskRepository.save(taskEntity);

        // Verify drift is in place
        ProcessTask driftedTask = processTaskRepository.findById(task.getId()).orElseThrow();
        assertThat(driftedTask.getCompletedQuantity()).isEqualByComparingTo(new BigDecimal("99.99"));
        assertThat(driftedTask.getPendingQuantity()).isEqualByComparingTo(new BigDecimal("77.77"));

        // Run calibration
        reportingService.calibrateTaskQuantities(TEST_FACTORY_ID);

        // Verify correction: completedQty should be 50.00 (sum of approved), pendingQty should be 10.00
        ProcessTask calibratedTask = processTaskRepository.findById(task.getId()).orElseThrow();
        assertThat(calibratedTask.getCompletedQuantity()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(calibratedTask.getPendingQuantity()).isEqualByComparingTo(new BigDecimal("10.00"));
    }
}
