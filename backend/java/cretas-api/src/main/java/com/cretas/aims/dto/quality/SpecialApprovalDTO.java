package com.cretas.aims.dto.quality;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 特批放行申请 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Data
@Builder
public class SpecialApprovalDTO {

    /**
     * 审批请求ID (对应 DecisionAuditLog ID)
     */
    private String approvalId;

    /**
     * 质检记录ID
     */
    private String inspectionId;

    /**
     * 生产批次ID
     */
    private Long productionBatchId;

    /**
     * 生产批次号
     */
    private String batchNumber;

    /**
     * 请求的处置动作
     */
    private String requestedAction;

    /**
     * 请求动作描述
     */
    private String requestedActionDescription;

    /**
     * 申请原因
     */
    private String reason;

    /**
     * 申请人ID
     */
    private Long requesterId;

    /**
     * 申请人姓名
     */
    private String requesterName;

    /**
     * 申请人角色
     */
    private String requesterRole;

    /**
     * 申请时间
     */
    private LocalDateTime requestTime;

    /**
     * 审批状态 (PENDING/APPROVED/REJECTED)
     */
    private String status;

    /**
     * 紧急程度
     */
    private String urgency;

    /**
     * 质检结果摘要
     */
    private DispositionEvaluationDTO.InspectionSummary inspectionSummary;

    /**
     * 触发的规则名称
     */
    private String triggeredRuleName;

    /**
     * 规则配置ID
     */
    private String ruleConfigId;

    /**
     * 审批人ID (如果已审批)
     */
    private Long approverId;

    /**
     * 审批人姓名 (如果已审批)
     */
    private String approverName;

    /**
     * 审批时间 (如果已审批)
     */
    private LocalDateTime approvalTime;

    /**
     * 审批意见 (如果已审批)
     */
    private String approvalComment;
}
