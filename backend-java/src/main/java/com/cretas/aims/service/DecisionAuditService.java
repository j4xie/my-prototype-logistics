package com.cretas.aims.service;

import com.cretas.aims.entity.DecisionAuditLog;
import com.cretas.aims.entity.DecisionAuditLog.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 决策审计服务接口
 */
public interface DecisionAuditService {

    /**
     * 记录规则执行决策
     */
    DecisionAuditLog logRuleExecution(
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
    );

    /**
     * 记录状态转换决策
     */
    DecisionAuditLog logStateTransition(
            String factoryId,
            String entityType,
            String entityId,
            String previousState,
            String newState,
            String reason,
            Long executorId,
            String executorName,
            String executorRole
    );

    /**
     * 记录强制插单决策
     */
    DecisionAuditLog logForceInsert(
            String factoryId,
            String entityType,
            String entityId,
            Map<String, Object> inputContext,
            String reason,
            boolean requiresApproval,
            Long executorId,
            String executorName,
            String executorRole
    );

    /**
     * 记录强制插单决策（含规则版本追踪）
     */
    DecisionAuditLog logForceInsertWithRuleConfig(
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
    );

    /**
     * 记录审批决策
     */
    DecisionAuditLog logApproval(
            String factoryId,
            String entityType,
            String entityId,
            ApprovalStatus status,
            String approvalComment,
            Long approverId,
            String approverName
    );

    /**
     * 记录AI分析决策
     */
    DecisionAuditLog logAIAnalysis(
            String factoryId,
            String entityType,
            String entityId,
            Map<String, Object> inputContext,
            Map<String, Object> outputResult,
            String decisionMade,
            Double confidence
    );

    /**
     * 更新审批状态
     */
    DecisionAuditLog updateApprovalStatus(
            String auditLogId,
            ApprovalStatus status,
            String comment,
            Long approverId,
            String approverName
    );

    /**
     * 获取实体的决策历史
     */
    List<DecisionAuditLog> getEntityHistory(String entityType, String entityId);

    /**
     * 获取待审批列表
     */
    Page<DecisionAuditLog> getPendingApprovals(String factoryId, Pageable pageable);

    /**
     * 分页查询决策日志
     */
    Page<DecisionAuditLog> getDecisionLogs(
            String factoryId,
            DecisionType decisionType,
            LocalDateTime startTime,
            LocalDateTime endTime,
            Pageable pageable
    );

    /**
     * 获取决策统计
     */
    Map<String, Object> getDecisionStats(String factoryId, LocalDateTime startTime);

    /**
     * 获取可回放的决策序列
     */
    List<DecisionAuditLog> getReplayableDecisions(String entityType, String entityId);
}
