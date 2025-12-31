package com.cretas.aims.service.impl;

import com.cretas.aims.entity.DecisionAuditLog;
import com.cretas.aims.entity.DecisionAuditLog.*;
import com.cretas.aims.repository.DecisionAuditLogRepository;
import com.cretas.aims.service.DecisionAuditService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 决策审计服务实现
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DecisionAuditServiceImpl implements DecisionAuditService {

    private final DecisionAuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public DecisionAuditLog logRuleExecution(
            String factoryId,
            String entityType,
            String entityId,
            Map<String, Object> inputContext,
            Map<String, Object> outputResult,
            List<String> rulesApplied,
            String decisionMade,
            Long executorId,
            String executorName,
            String executorRole
    ) {
        DecisionAuditLog auditLog = DecisionAuditLog.builder()
                .decisionType(DecisionType.RULE_EXECUTION)
                .factoryId(factoryId)
                .entityType(entityType)
                .entityId(entityId)
                .inputContext(toJson(inputContext))
                .outputResult(toJson(outputResult))
                .rulesApplied(toJson(rulesApplied))
                .decisionMade(decisionMade)
                .executorId(executorId)
                .executorName(executorName)
                .executorRole(executorRole)
                .executionMode(ExecutionMode.AUTOMATIC)
                .build();

        setReplayData(auditLog, inputContext, outputResult);
        return auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional
    public DecisionAuditLog logStateTransition(
            String factoryId,
            String entityType,
            String entityId,
            String previousState,
            String newState,
            String reason,
            Long executorId,
            String executorName,
            String executorRole
    ) {
        DecisionAuditLog auditLog = DecisionAuditLog.builder()
                .decisionType(DecisionType.STATE_TRANSITION)
                .factoryId(factoryId)
                .entityType(entityType)
                .entityId(entityId)
                .previousState(previousState)
                .newState(newState)
                .reason(reason)
                .decisionMade(String.format("状态从 [%s] 转换为 [%s]", previousState, newState))
                .executorId(executorId)
                .executorName(executorName)
                .executorRole(executorRole)
                .executionMode(ExecutionMode.MANUAL)
                .build();

        Map<String, Object> replayContext = new HashMap<>();
        replayContext.put("previousState", previousState);
        replayContext.put("newState", newState);
        replayContext.put("reason", reason);
        setReplayData(auditLog, replayContext, null);

        return auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional
    public DecisionAuditLog logForceInsert(
            String factoryId,
            String entityType,
            String entityId,
            Map<String, Object> inputContext,
            String reason,
            boolean requiresApproval,
            Long executorId,
            String executorName,
            String executorRole
    ) {
        DecisionAuditLog auditLog = DecisionAuditLog.builder()
                .decisionType(DecisionType.FORCE_INSERT)
                .factoryId(factoryId)
                .entityType(entityType)
                .entityId(entityId)
                .inputContext(toJson(inputContext))
                .reason(reason)
                .decisionMade("强制插单操作")
                .requiresApproval(requiresApproval)
                .approvalStatus(requiresApproval ? ApprovalStatus.PENDING : null)
                .executorId(executorId)
                .executorName(executorName)
                .executorRole(executorRole)
                .executionMode(ExecutionMode.OVERRIDE)
                .build();

        setReplayData(auditLog, inputContext, null);
        return auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional
    public DecisionAuditLog logForceInsertWithRuleConfig(
            String factoryId,
            String entityType,
            String entityId,
            Map<String, Object> inputContext,
            String reason,
            boolean requiresApproval,
            Long executorId,
            String executorName,
            String executorRole,
            String ruleConfigId,
            Integer ruleConfigVersion,
            String ruleConfigName
    ) {
        DecisionAuditLog auditLog = DecisionAuditLog.builder()
                .decisionType(DecisionType.FORCE_INSERT)
                .factoryId(factoryId)
                .entityType(entityType)
                .entityId(entityId)
                .inputContext(toJson(inputContext))
                .reason(reason)
                .decisionMade("强制插单操作")
                .requiresApproval(requiresApproval)
                .approvalStatus(requiresApproval ? ApprovalStatus.PENDING : null)
                .executorId(executorId)
                .executorName(executorName)
                .executorRole(executorRole)
                .executionMode(ExecutionMode.OVERRIDE)
                // 规则版本追踪
                .ruleConfigId(ruleConfigId)
                .ruleConfigVersion(ruleConfigVersion)
                .ruleConfigName(ruleConfigName)
                .build();

        setReplayData(auditLog, inputContext, null);

        log.info("记录强制插单审计日志 - 规则配置: id={}, version={}, name={}",
                ruleConfigId, ruleConfigVersion, ruleConfigName);

        return auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional
    public DecisionAuditLog logApproval(
            String factoryId,
            String entityType,
            String entityId,
            ApprovalStatus status,
            String approvalComment,
            Long approverId,
            String approverName
    ) {
        DecisionAuditLog auditLog = DecisionAuditLog.builder()
                .decisionType(DecisionType.APPROVAL)
                .factoryId(factoryId)
                .entityType(entityType)
                .entityId(entityId)
                .approvalStatus(status)
                .approvalComment(approvalComment)
                .approverId(approverId)
                .approverName(approverName)
                .approvedAt(LocalDateTime.now())
                .decisionMade(String.format("审批结果: %s", status.name()))
                .executionMode(ExecutionMode.MANUAL)
                .build();

        return auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional
    public DecisionAuditLog logAIAnalysis(
            String factoryId,
            String entityType,
            String entityId,
            Map<String, Object> inputContext,
            Map<String, Object> outputResult,
            String decisionMade,
            Double confidence
    ) {
        DecisionAuditLog auditLog = DecisionAuditLog.builder()
                .decisionType(DecisionType.AI_ANALYSIS)
                .factoryId(factoryId)
                .entityType(entityType)
                .entityId(entityId)
                .inputContext(toJson(inputContext))
                .outputResult(toJson(outputResult))
                .decisionMade(decisionMade)
                .confidence(confidence != null ? BigDecimal.valueOf(confidence) : null)
                .executionMode(ExecutionMode.AUTOMATIC)
                .build();

        setReplayData(auditLog, inputContext, outputResult);
        return auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional
    public DecisionAuditLog updateApprovalStatus(
            String auditLogId,
            ApprovalStatus status,
            String comment,
            Long approverId,
            String approverName
    ) {
        DecisionAuditLog auditLog = auditLogRepository.findById(auditLogId)
                .orElseThrow(() -> new RuntimeException("审计日志不存在: " + auditLogId));

        auditLog.setApprovalStatus(status);
        auditLog.setApprovalComment(comment);
        auditLog.setApproverId(approverId);
        auditLog.setApproverName(approverName);
        auditLog.setApprovedAt(LocalDateTime.now());

        return auditLogRepository.save(auditLog);
    }

    @Override
    public List<DecisionAuditLog> getEntityHistory(String entityType, String entityId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId);
    }

    @Override
    public Page<DecisionAuditLog> getPendingApprovals(String factoryId, Pageable pageable) {
        return auditLogRepository.findPendingApprovals(factoryId, pageable);
    }

    @Override
    public Page<DecisionAuditLog> getDecisionLogs(
            String factoryId,
            DecisionType decisionType,
            LocalDateTime startTime,
            LocalDateTime endTime,
            Pageable pageable
    ) {
        if (decisionType != null) {
            return auditLogRepository.findByFactoryIdAndDecisionTypeOrderByCreatedAtDesc(
                    factoryId, decisionType, pageable);
        }
        if (startTime != null && endTime != null) {
            return auditLogRepository.findByFactoryIdAndTimeRange(
                    factoryId, startTime, endTime, pageable);
        }
        return auditLogRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
    }

    @Override
    public Map<String, Object> getDecisionStats(String factoryId, LocalDateTime startTime) {
        Map<String, Object> stats = new HashMap<>();

        List<Object[]> byType = auditLogRepository.countByDecisionType(factoryId, startTime);
        Map<String, Long> typeStats = new HashMap<>();
        for (Object[] row : byType) {
            typeStats.put(((DecisionType) row[0]).name(), (Long) row[1]);
        }
        stats.put("byDecisionType", typeStats);

        List<Object[]> byEntity = auditLogRepository.countByEntityType(factoryId, startTime);
        Map<String, Long> entityStats = new HashMap<>();
        for (Object[] row : byEntity) {
            entityStats.put((String) row[0], (Long) row[1]);
        }
        stats.put("byEntityType", entityStats);

        return stats;
    }

    @Override
    public List<DecisionAuditLog> getReplayableDecisions(String entityType, String entityId) {
        return auditLogRepository.findByEntityTypeAndEntityIdAndIsReplayableTrueOrderByCreatedAtAsc(
                entityType, entityId);
    }

    // ==================== 辅助方法 ====================

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("JSON序列化失败", e);
            return null;
        }
    }

    private void setReplayData(DecisionAuditLog auditLog,
                               Map<String, Object> inputContext,
                               Map<String, Object> outputResult) {
        Map<String, Object> replayData = new HashMap<>();
        replayData.put("inputContext", inputContext);
        replayData.put("outputResult", outputResult);
        replayData.put("timestamp", LocalDateTime.now().toString());

        String replayJson = toJson(replayData);
        auditLog.setReplayData(replayJson);
        auditLog.setChecksum(calculateChecksum(replayJson));
    }

    private String calculateChecksum(String data) {
        if (data == null) return null;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            log.warn("计算校验和失败", e);
            return null;
        }
    }
}
