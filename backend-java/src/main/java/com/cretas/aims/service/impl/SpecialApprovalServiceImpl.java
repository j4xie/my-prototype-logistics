package com.cretas.aims.service.impl;

import com.cretas.aims.dto.quality.*;
import com.cretas.aims.entity.DecisionAuditLog;
import com.cretas.aims.entity.DecisionAuditLog.ApprovalStatus;
import com.cretas.aims.entity.DecisionAuditLog.DecisionType;
import com.cretas.aims.entity.DecisionAuditLog.ExecutionMode;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.DecisionAuditLogRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.QualityDispositionRuleService;
import com.cretas.aims.service.SpecialApprovalService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 特批放行审批服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SpecialApprovalServiceImpl implements SpecialApprovalService {

    private final DecisionAuditLogRepository decisionAuditLogRepository;
    private final QualityInspectionRepository qualityInspectionRepository;
    private final ProductionBatchRepository productionBatchRepository;
    private final UserRepository userRepository;
    private final QualityDispositionRuleService qualityDispositionRuleService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public SpecialApprovalDTO submitSpecialApproval(
            String factoryId,
            String inspectionId,
            SpecialApprovalRequest request,
            Long requesterId
    ) {
        log.info("提交特批放行申请: factoryId={}, inspectionId={}, requesterId={}",
                factoryId, inspectionId, requesterId);

        // 1. 获取质检记录
        QualityInspection inspection = qualityInspectionRepository.findById(inspectionId)
                .orElseThrow(() -> new IllegalArgumentException("质检记录不存在: " + inspectionId));

        // 验证工厂ID
        if (!inspection.getFactoryId().equals(factoryId)) {
            throw new IllegalArgumentException("质检记录不属于该工厂");
        }

        // 2. 获取生产批次
        ProductionBatch batch = productionBatchRepository.findById(inspection.getProductionBatchId())
                .orElseThrow(() -> new IllegalArgumentException("生产批次不存在"));

        // 3. 获取申请人信息
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new IllegalArgumentException("申请人不存在"));

        // 4. 评估处置建议 (获取规则信息)
        QualityDispositionRuleService.DispositionResult dispositionResult =
                qualityDispositionRuleService.evaluateDisposition(factoryId, inspection);

        // 5. 构建输入上下文
        Map<String, Object> inputContext = new HashMap<>();
        inputContext.put("inspectionId", inspectionId);
        inputContext.put("productionBatchId", inspection.getProductionBatchId());
        inputContext.put("batchNumber", batch.getBatchNumber());
        inputContext.put("passRate", inspection.getPassRate());
        inputContext.put("defectRate", inspection.getDefectRate());
        inputContext.put("requestedAction", request.getRequestedAction());
        inputContext.put("reason", request.getReason());
        inputContext.put("urgency", request.getUrgency());
        inputContext.put("expectedImpact", request.getExpectedImpact());
        inputContext.put("riskAssessment", request.getRiskAssessment());
        inputContext.put("mitigationPlan", request.getMitigationPlan());

        // 6. 构建审计日志
        DecisionAuditLog auditLog = DecisionAuditLog.builder()
                .decisionType(DecisionType.APPROVAL)
                .decisionCode("SPECIAL_APPROVAL_REQUEST")
                .entityType("QualityInspection")
                .entityId(inspectionId)
                .factoryId(factoryId)
                .inputContext(toJson(inputContext))
                .ruleConfigId(dispositionResult.getRuleConfigId())
                .ruleConfigVersion(dispositionResult.getRuleVersion())
                .ruleConfigName(dispositionResult.getTriggeredRuleName())
                .decisionMade(request.getRequestedAction())
                .reason(request.getReason())
                .confidence(dispositionResult.getConfidence())
                .executorId(requesterId)
                .executorName(requester.getName())
                .executorRole(requester.getRole())
                .executionMode(ExecutionMode.MANUAL)
                .requiresApproval(true)
                .approvalStatus(ApprovalStatus.PENDING)
                .isReplayable(true)
                .build();

        DecisionAuditLog saved = decisionAuditLogRepository.save(auditLog);
        log.info("特批放行申请已创建: approvalId={}", saved.getId());

        // 7. 转换为DTO返回
        return convertToDTO(saved, inspection, batch, requester, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SpecialApprovalDTO> getPendingApprovals(String factoryId) {
        log.info("获取待审批列表: factoryId={}", factoryId);

        List<DecisionAuditLog> pendingApprovals =
                decisionAuditLogRepository.findQualityPendingApprovals(factoryId);

        return pendingApprovals.stream()
                .map(this::enrichAndConvertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public SpecialApprovalDTO getApprovalById(String factoryId, String approvalId) {
        log.info("获取审批详情: factoryId={}, approvalId={}", factoryId, approvalId);

        DecisionAuditLog auditLog = decisionAuditLogRepository.findById(approvalId)
                .orElseThrow(() -> new IllegalArgumentException("审批记录不存在: " + approvalId));

        // 验证工厂ID
        if (!auditLog.getFactoryId().equals(factoryId)) {
            throw new IllegalArgumentException("审批记录不属于该工厂");
        }

        return enrichAndConvertToDTO(auditLog);
    }

    @Override
    @Transactional
    public SpecialApprovalDTO processDecision(
            String factoryId,
            String approvalId,
            ApprovalDecisionRequest decision,
            Long approverId
    ) {
        log.info("处理审批决策: factoryId={}, approvalId={}, decision={}, approverId={}",
                factoryId, approvalId, decision.getDecision(), approverId);

        // 1. 获取审批记录
        DecisionAuditLog auditLog = decisionAuditLogRepository.findById(approvalId)
                .orElseThrow(() -> new IllegalArgumentException("审批记录不存在: " + approvalId));

        // 验证工厂ID
        if (!auditLog.getFactoryId().equals(factoryId)) {
            throw new IllegalArgumentException("审批记录不属于该工厂");
        }

        // 验证状态
        if (auditLog.getApprovalStatus() != ApprovalStatus.PENDING) {
            throw new IllegalStateException("审批已处理，当前状态: " + auditLog.getApprovalStatus());
        }

        // 2. 获取审批人信息
        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new IllegalArgumentException("审批人不存在"));

        // 3. 更新审批状态
        ApprovalStatus newStatus = decision.getDecision() == ApprovalDecisionRequest.ApprovalDecision.APPROVE
                ? ApprovalStatus.APPROVED
                : ApprovalStatus.REJECTED;

        auditLog.setApprovalStatus(newStatus);
        auditLog.setApproverId(approverId);
        auditLog.setApproverName(approver.getName());
        auditLog.setApprovedAt(LocalDateTime.now());
        auditLog.setApprovalComment(decision.getComment());

        // 4. 更新输出结果
        Map<String, Object> outputResult = new HashMap<>();
        outputResult.put("approvalStatus", newStatus.name());
        outputResult.put("approverId", approverId);
        outputResult.put("approverName", approver.getName());
        outputResult.put("approvedAt", LocalDateTime.now().toString());
        outputResult.put("comment", decision.getComment());
        outputResult.put("conditions", decision.getConditions());
        outputResult.put("followUpRequirements", decision.getFollowUpRequirements());
        auditLog.setOutputResult(toJson(outputResult));

        DecisionAuditLog saved = decisionAuditLogRepository.save(auditLog);
        log.info("审批决策已处理: approvalId={}, status={}", approvalId, newStatus);

        // 5. 如果批准，执行处置动作
        if (newStatus == ApprovalStatus.APPROVED) {
            executeApprovedDisposition(auditLog, approver);
        }

        return enrichAndConvertToDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SpecialApprovalDTO> getMyRequests(String factoryId, Long requesterId) {
        log.info("获取我的申请记录: factoryId={}, requesterId={}", factoryId, requesterId);

        List<DecisionAuditLog> myRequests =
                decisionAuditLogRepository.findMyQualityApprovalRequests(factoryId, requesterId);

        return myRequests.stream()
                .map(this::enrichAndConvertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SpecialApprovalDTO> getMyApprovals(String factoryId, Long approverId) {
        log.info("获取我的审批记录: factoryId={}, approverId={}", factoryId, approverId);

        List<DecisionAuditLog> myApprovals =
                decisionAuditLogRepository.findMyQualityApprovalDecisions(factoryId, approverId);

        return myApprovals.stream()
                .map(this::enrichAndConvertToDTO)
                .collect(Collectors.toList());
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 执行已批准的处置动作
     */
    private void executeApprovedDisposition(DecisionAuditLog auditLog, User approver) {
        try {
            String action = auditLog.getDecisionMade();
            log.info("执行已批准的处置动作: inspectionId={}, action={}",
                    auditLog.getEntityId(), action);

            // 获取质检记录
            QualityInspection inspection = qualityInspectionRepository.findById(auditLog.getEntityId())
                    .orElseThrow(() -> new IllegalStateException("质检记录不存在: " + auditLog.getEntityId()));

            // 调用处置规则服务执行处置
            QualityDispositionRuleService.DispositionAction dispositionAction =
                    QualityDispositionRuleService.DispositionAction.valueOf(action);

            String reason = String.format("审批通过: approvalId=%s, approvedBy=%s",
                    auditLog.getId(), approver.getName());

            QualityDispositionRuleService.DispositionExecutionResult result =
                    qualityDispositionRuleService.executeDisposition(
                            auditLog.getFactoryId(),
                            inspection,
                            dispositionAction,
                            approver.getId(),
                            reason
                    );

            if (result.isSuccess()) {
                log.info("处置动作执行成功: action={}", action);
            } else {
                log.warn("处置动作执行失败: action={}, message={}", action, result.getMessage());
            }
        } catch (Exception e) {
            log.error("执行处置动作失败: {}", e.getMessage(), e);
            // 处置执行失败不影响审批记录，但需要记录日志
        }
    }

    /**
     * 丰富并转换为DTO
     */
    private SpecialApprovalDTO enrichAndConvertToDTO(DecisionAuditLog auditLog) {
        // 获取质检记录
        QualityInspection inspection = qualityInspectionRepository.findById(auditLog.getEntityId())
                .orElse(null);

        // 获取生产批次
        ProductionBatch batch = null;
        if (inspection != null) {
            batch = productionBatchRepository.findById(inspection.getProductionBatchId())
                    .orElse(null);
        }

        // 获取申请人
        User requester = null;
        if (auditLog.getExecutorId() != null) {
            requester = userRepository.findById(auditLog.getExecutorId()).orElse(null);
        }

        // 获取审批人
        User approver = null;
        if (auditLog.getApproverId() != null) {
            approver = userRepository.findById(auditLog.getApproverId()).orElse(null);
        }

        return convertToDTO(auditLog, inspection, batch, requester, approver);
    }

    /**
     * 转换为DTO
     */
    private SpecialApprovalDTO convertToDTO(
            DecisionAuditLog auditLog,
            QualityInspection inspection,
            ProductionBatch batch,
            User requester,
            User approver
    ) {
        // 解析输入上下文获取额外信息
        Map<String, Object> inputContext = parseJson(auditLog.getInputContext());
        String urgency = inputContext != null ? (String) inputContext.get("urgency") : null;

        // 构建质检摘要
        DispositionEvaluationDTO.InspectionSummary inspectionSummary = null;
        if (inspection != null) {
            inspectionSummary = DispositionEvaluationDTO.InspectionSummary.builder()
                    .passRate(inspection.getPassRate())
                    .defectRate(inspection.getDefectRate())
                    .sampleSize(inspection.getSampleSize())
                    .passCount(inspection.getPassCount())
                    .failCount(inspection.getFailCount())
                    .inspectionResult(inspection.getResult())
                    .qualityGrade(inspection.getQualityGrade())
                    .build();
        }

        // 获取动作描述
        String actionDescription = getActionDescription(auditLog.getDecisionMade());

        return SpecialApprovalDTO.builder()
                .approvalId(auditLog.getId())
                .inspectionId(auditLog.getEntityId())
                .productionBatchId(inspection != null ? inspection.getProductionBatchId() : null)
                .batchNumber(batch != null ? batch.getBatchNumber() : null)
                .requestedAction(auditLog.getDecisionMade())
                .requestedActionDescription(actionDescription)
                .reason(auditLog.getReason())
                .requesterId(auditLog.getExecutorId())
                .requesterName(auditLog.getExecutorName())
                .requesterRole(auditLog.getExecutorRole())
                .requestTime(auditLog.getCreatedAt())
                .status(auditLog.getApprovalStatus() != null ? auditLog.getApprovalStatus().name() : null)
                .urgency(urgency)
                .inspectionSummary(inspectionSummary)
                .triggeredRuleName(auditLog.getRuleConfigName())
                .ruleConfigId(auditLog.getRuleConfigId())
                .approverId(auditLog.getApproverId())
                .approverName(auditLog.getApproverName())
                .approvalTime(auditLog.getApprovedAt())
                .approvalComment(auditLog.getApprovalComment())
                .build();
    }

    /**
     * 获取动作描述
     */
    private String getActionDescription(String action) {
        if (action == null) return null;

        Map<String, String> descriptions = Map.of(
            "RELEASE", "直接放行",
            "CONDITIONAL_RELEASE", "条件放行",
            "REWORK", "返工处理",
            "SCRAP", "报废处理",
            "SPECIAL_APPROVAL", "特批放行",
            "HOLD", "暂扣待定"
        );

        return descriptions.getOrDefault(action, action);
    }

    /**
     * 对象转JSON字符串
     */
    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("JSON序列化失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * JSON字符串转Map
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isEmpty()) return null;
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (JsonProcessingException e) {
            log.warn("JSON解析失败: {}", e.getMessage());
            return null;
        }
    }
}
