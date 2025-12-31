package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.quality.*;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.entity.DecisionAuditLog;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.repository.DecisionAuditLogRepository;
import com.cretas.aims.service.QualityDispositionRuleService;
import com.cretas.aims.service.QualityDispositionRuleService.DispositionAction;
import com.cretas.aims.service.QualityDispositionRuleService.DispositionResult;
import com.cretas.aims.service.QualityDispositionRuleService.DispositionExecutionResult;
import com.cretas.aims.service.StateMachineService;
import com.cretas.aims.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 质检处置规则控制器
 *
 * 功能：
 * 1. 根据质检结果评估处置建议
 * 2. 获取可用的处置动作列表
 * 3. 执行处置动作（集成状态机门禁）
 * 4. 查看处置历史
 * 5. 配置处置规则
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/quality-disposition")
@RequiredArgsConstructor
@Tag(name = "质检处置管理", description = "质检处置规则与执行管理")
public class QualityDispositionController {

    private final QualityDispositionRuleService qualityDispositionRuleService;
    private final QualityInspectionRepository qualityInspectionRepository;
    private final DecisionAuditLogRepository decisionAuditLogRepository;
    private final StateMachineService stateMachineService;
    private final NotificationService notificationService;

    /**
     * 根据质检结果评估处置建议
     *
     * 业务规则：
     * 1. 合格率 >= 95%: RELEASE (无需审批)
     * 2. 合格率 80-95%: REWORK (主管审批)
     * 3. 合格率 60-80%: DOWNGRADE (经理审批)
     * 4. 合格率 < 60%: SCRAP (质量主管审批)
     * 5. 存在安全隐患: HOLD (立即暂停，等待高层决定)
     */
    @PostMapping("/evaluate")
    @Operation(summary = "评估质检处置", description = "根据质检结果评估推荐的处置动作")
    public ApiResponse<DispositionEvaluationDTO> evaluateDisposition(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "质检结果") QualityCheckResultDTO qualityResult) {

        log.info("评估质检处置 - factoryId={}, inspectionId={}", factoryId, qualityResult.getInspectionId());

        // 查找质检记录
        QualityInspection inspection = qualityInspectionRepository.findById(qualityResult.getInspectionId())
                .orElseThrow(() -> new RuntimeException("质检记录不存在: " + qualityResult.getInspectionId()));

        // 评估处置
        DispositionResult result = qualityDispositionRuleService.evaluateDisposition(factoryId, inspection);

        // 转换为 DTO
        DispositionEvaluationDTO dto = DispositionEvaluationDTO.builder()
                .inspectionId(inspection.getId())
                .productionBatchId(inspection.getProductionBatchId())
                .recommendedAction(result.getRecommendedAction().name())
                .recommendedActionDescription(result.getRecommendedAction().getDescription())
                .requiresApproval(result.isRequiresApproval())
                .triggeredRuleName(result.getTriggeredRuleName())
                .ruleConfigId(result.getRuleConfigId())
                .ruleVersion(result.getRuleVersion())
                .confidence(result.getConfidence())
                .reason(result.getReason())
                .alternativeActions(Arrays.stream(result.getAlternativeActions())
                        .map(action -> DispositionEvaluationDTO.AlternativeAction.builder()
                                .action(action.name())
                                .description(action.getDescription())
                                .requiresApproval(true)
                                .build())
                        .collect(Collectors.toList()))
                .inspectionSummary(DispositionEvaluationDTO.InspectionSummary.builder()
                        .passRate(inspection.getPassRate())
                        .defectRate(inspection.getDefectRate())
                        .inspectionResult(inspection.getResult())
                        .qualityGrade(inspection.getQualityGrade())
                        .sampleSize(inspection.getSampleSize())
                        .passCount(inspection.getPassCount())
                        .failCount(inspection.getFailCount())
                        .build())
                .build();

        log.info("质检处置评估完成 - action={}, requiresApproval={}",
                result.getRecommendedAction(), result.isRequiresApproval());

        return ApiResponse.success(dto);
    }

    /**
     * 获取可用的处置动作列表
     */
    @GetMapping("/actions")
    @Operation(summary = "获取可用处置动作", description = "获取所有可用的质检处置动作列表")
    public ApiResponse<List<DispositionActionDTO>> getAvailableActions(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {

        log.info("获取可用处置动作 - factoryId={}", factoryId);

        List<DispositionActionDTO> actions = new ArrayList<>();

        for (DispositionAction action : DispositionAction.values()) {
            DispositionActionDTO dto = DispositionActionDTO.builder()
                    .actionCode(action.name())
                    .actionName(action.getDescription())
                    .description(getActionFullDescription(action))
                    .requiresApproval(getActionRequiresApproval(action))
                    .approvalLevel(getActionApprovalLevel(action))
                    .applicableCondition(getActionApplicableCondition(action))
                    .build();
            actions.add(dto);
        }

        return ApiResponse.success(actions);
    }

    /**
     * 执行处置动作
     *
     * 步骤：
     * 1. 验证状态机转换合法性
     * 2. 执行处置动作
     * 3. 记录审计日志
     * 4. 发送通知
     */
    @PostMapping("/execute")
    @Operation(summary = "执行处置动作", description = "执行质检处置动作，集成状态机门禁")
    public ApiResponse<DispositionResultDTO> executeDisposition(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "执行处置请求") ExecuteDispositionRequest request) {

        log.info("执行质检处置 - factoryId={}, batchId={}, action={}",
                factoryId, request.getBatchId(), request.getActionCode());

        // 查找质检记录
        QualityInspection inspection = qualityInspectionRepository.findById(request.getInspectionId())
                .orElseThrow(() -> new RuntimeException("质检记录不存在: " + request.getInspectionId()));

        // 解析处置动作
        DispositionAction action;
        try {
            action = DispositionAction.valueOf(request.getActionCode());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("无效的处置动作: " + request.getActionCode());
        }

        // 构建处置原因
        String reason = request.getOperatorComment() != null
                ? request.getOperatorComment()
                : "质检处置: " + action.getDescription();

        // 执行处置
        DispositionExecutionResult executionResult = qualityDispositionRuleService.executeDisposition(
                factoryId,
                inspection,
                action,
                request.getExecutorId(),
                reason
        );

        // 发送通知
        try {
            if (executionResult.isApprovalInitiated()) {
                notificationService.sendNotification(
                        factoryId,
                        "QUALITY_APPROVAL_REQUIRED",
                        "质检处置需要审批",
                        String.format("批次 %d 的质检处置（%s）需要审批",
                                request.getBatchId(), action.getDescription()),
                        Map.of("batchId", request.getBatchId(),
                                "action", action.name(),
                                "approvalRequestId", executionResult.getApprovalRequestId())
                );
            } else {
                notificationService.sendNotification(
                        factoryId,
                        "QUALITY_DISPOSITION_EXECUTED",
                        "质检处置已执行",
                        String.format("批次 %d 已完成质检处置: %s",
                                request.getBatchId(), action.getDescription()),
                        Map.of("batchId", request.getBatchId(),
                                "action", action.name(),
                                "newStatus", executionResult.getNewBatchStatus())
                );
            }
        } catch (Exception e) {
            log.warn("发送处置通知失败", e);
        }

        // 转换为 DTO
        DispositionResultDTO dto = DispositionResultDTO.builder()
                .dispositionId(executionResult.getAuditLogId())
                .status(executionResult.isApprovalInitiated() ? "PENDING_APPROVAL" : "EXECUTED")
                .executedAction(executionResult.getExecutedAction().name())
                .message(executionResult.getMessage())
                .nextSteps(buildNextSteps(executionResult))
                .newBatchStatus(executionResult.getNewBatchStatus())
                .approvalInitiated(executionResult.isApprovalInitiated())
                .approvalRequestId(executionResult.getApprovalRequestId())
                .auditLogId(executionResult.getAuditLogId())
                .executedAt(LocalDateTime.now())
                .build();

        log.info("质检处置执行完成 - dispositionId={}, status={}",
                dto.getDispositionId(), dto.getStatus());

        return ApiResponse.success(dto);
    }

    /**
     * 获取处置历史
     */
    @GetMapping("/history/{batchId}")
    @Operation(summary = "获取处置历史", description = "获取指定批次的质检处置历史记录")
    public ApiResponse<List<DispositionHistoryDTO>> getDispositionHistory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "生产批次ID") Long batchId) {

        log.info("获取处置历史 - factoryId={}, batchId={}", factoryId, batchId);

        // 查找该批次的所有质检记录
        List<QualityInspection> inspections = qualityInspectionRepository
                .findByFactoryIdAndProductionBatchId(factoryId, batchId);

        List<DispositionHistoryDTO> history = new ArrayList<>();

        for (QualityInspection inspection : inspections) {
            // 查找该质检记录相关的审计日志
            List<DecisionAuditLog> auditLogs = decisionAuditLogRepository
                    .findByFactoryIdAndEntityTypeAndEntityId(factoryId, "QualityInspection", inspection.getId());

            for (DecisionAuditLog log : auditLogs) {
                DispositionHistoryDTO dto = DispositionHistoryDTO.builder()
                        .id(log.getId())
                        .batchId(batchId)
                        .inspectionId(inspection.getId())
                        .action(log.getDecisionMade())
                        .actionDescription(log.getDecisionMade())
                        .reason(log.getReason())
                        .passRate(inspection.getPassRate())
                        .defectRate(inspection.getDefectRate())
                        .qualityGrade(inspection.getQualityGrade())
                        .executorId(log.getExecutorId())
                        .executorName(log.getExecutorName())
                        .executorRole(log.getExecutorRole())
                        .requiresApproval(log.getRequiresApproval())
                        .approvalStatus(log.getApprovalStatus() != null
                                ? log.getApprovalStatus().name()
                                : null)
                        .approverName(log.getApproverName())
                        .approvedAt(log.getApprovedAt())
                        .newStatus(log.getNewState())
                        .createdAt(log.getCreatedAt())
                        .build();
                history.add(dto);
            }
        }

        // 按时间倒序排序
        history.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));

        return ApiResponse.success(history);
    }

    /**
     * 配置处置规则
     */
    @PostMapping("/rules")
    @Operation(summary = "创建处置规则", description = "创建新的质检处置规则")
    public ApiResponse<DispositionRuleDTO> createRule(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "规则创建请求") CreateDispositionRuleRequest request) {

        log.info("创建处置规则 - factoryId={}, ruleName={}", factoryId, request.getRuleName());

        // 注意：这里应该有一个 DispositionRuleEntity 和对应的 Service
        // 当前实现只是返回一个示例响应
        // TODO: 实现完整的规则配置功能

        DispositionRuleDTO dto = DispositionRuleDTO.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .ruleName(request.getRuleName())
                .description(request.getDescription())
                .minPassRate(request.getMinPassRate())
                .maxDefectRate(request.getMaxDefectRate())
                .action(request.getAction())
                .requiresApproval(request.getRequiresApproval())
                .approvalLevel(request.getApprovalLevel())
                .priority(request.getPriority())
                .version(1)
                .enabled(request.getEnabled())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        log.warn("处置规则配置功能尚未完全实现，返回模拟数据");

        return ApiResponse.success(dto);
    }

    /**
     * 获取处置规则列表
     */
    @GetMapping("/rules")
    @Operation(summary = "获取处置规则列表", description = "获取工厂的所有质检处置规则")
    public ApiResponse<List<DispositionRuleDTO>> getRules(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {

        log.info("获取处置规则列表 - factoryId={}", factoryId);

        // TODO: 实现从数据库读取规则配置
        // 当前返回默认规则示例

        List<DispositionRuleDTO> rules = new ArrayList<>();

        rules.add(DispositionRuleDTO.builder()
                .id("rule-1")
                .factoryId(factoryId)
                .ruleName("高合格率自动放行")
                .description("当合格率 >= 95% 时自动放行")
                .minPassRate(new BigDecimal("95.00"))
                .action("RELEASE")
                .requiresApproval(false)
                .priority(10)
                .version(1)
                .enabled(true)
                .build());

        rules.add(DispositionRuleDTO.builder()
                .id("rule-2")
                .factoryId(factoryId)
                .ruleName("中等合格率返工")
                .description("当合格率在 70-95% 之间时需要返工")
                .minPassRate(new BigDecimal("70.00"))
                .action("REWORK")
                .requiresApproval(true)
                .approvalLevel("SUPERVISOR")
                .priority(5)
                .version(1)
                .enabled(true)
                .build());

        rules.add(DispositionRuleDTO.builder()
                .id("rule-3")
                .factoryId(factoryId)
                .ruleName("高缺陷率报废")
                .description("当缺陷率 >= 50% 时建议报废")
                .maxDefectRate(new BigDecimal("50.00"))
                .action("SCRAP")
                .requiresApproval(true)
                .approvalLevel("QUALITY_HEAD")
                .priority(8)
                .version(1)
                .enabled(true)
                .build());

        log.warn("处置规则列表功能尚未完全实现，返回模拟数据");

        return ApiResponse.success(rules);
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 获取动作完整描述
     */
    private String getActionFullDescription(DispositionAction action) {
        switch (action) {
            case RELEASE:
                return "直接放行 - 质检合格，允许进入下一工序";
            case CONDITIONAL_RELEASE:
                return "条件放行 - 有限期或有条件使用";
            case REWORK:
                return "返工 - 可修复的不合格品，需要重新加工";
            case SCRAP:
                return "报废 - 无法修复的严重不合格品";
            case SPECIAL_APPROVAL:
                return "特批申请 - 超出常规规则，需要高级审批";
            case HOLD:
                return "待定 - 需要进一步检测或评估";
            default:
                return action.getDescription();
        }
    }

    /**
     * 判断动作是否需要审批
     */
    private Boolean getActionRequiresApproval(DispositionAction action) {
        switch (action) {
            case RELEASE:
                return false;
            case CONDITIONAL_RELEASE:
            case REWORK:
                return true;
            case SCRAP:
            case SPECIAL_APPROVAL:
            case HOLD:
                return true;
            default:
                return true;
        }
    }

    /**
     * 获取审批级别
     */
    private String getActionApprovalLevel(DispositionAction action) {
        switch (action) {
            case RELEASE:
                return null;
            case CONDITIONAL_RELEASE:
            case REWORK:
                return "SUPERVISOR";
            case SCRAP:
                return "QUALITY_HEAD";
            case SPECIAL_APPROVAL:
                return "FACTORY_MANAGER";
            case HOLD:
                return "MANAGER";
            default:
                return "SUPERVISOR";
        }
    }

    /**
     * 获取适用条件说明
     */
    private String getActionApplicableCondition(DispositionAction action) {
        switch (action) {
            case RELEASE:
                return "合格率 >= 95%";
            case CONDITIONAL_RELEASE:
                return "合格率 85-95%";
            case REWORK:
                return "合格率 70-85%";
            case SCRAP:
                return "缺陷率 >= 50% 或合格率 < 60%";
            case SPECIAL_APPROVAL:
                return "不满足常规规则";
            case HOLD:
                return "需要进一步评估";
            default:
                return "";
        }
    }

    /**
     * 构建下一步操作说明
     */
    private String buildNextSteps(DispositionExecutionResult result) {
        if (result.isApprovalInitiated()) {
            return "处置请求已提交审批，请等待审批结果";
        }

        switch (result.getExecutedAction()) {
            case RELEASE:
                return "批次已放行，可以进入下一工序或出库";
            case CONDITIONAL_RELEASE:
                return "批次已条件放行，请注意使用限制";
            case REWORK:
                return "批次需要返工，请安排返工计划";
            case SCRAP:
                return "批次已标记为报废，请执行报废流程";
            case HOLD:
                return "批次已暂停，请等待进一步指示";
            default:
                return "请查看处置结果并采取相应行动";
        }
    }
}
