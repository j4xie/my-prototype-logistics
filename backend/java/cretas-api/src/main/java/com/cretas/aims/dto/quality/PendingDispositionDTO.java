package com.cretas.aims.dto.quality;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * 待处置 DTO
 * 用于 /quality-disposition/pending 端点
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingDispositionDTO {

    /**
     * 审计日志ID
     */
    private String id;

    /**
     * 实体类型 (QualityInspection, QualityDisposition)
     */
    private String entityType;

    /**
     * 实体ID (质检记录ID)
     */
    private String entityId;

    /**
     * 生产批次ID (从 entityId 关联)
     */
    private Long productionBatchId;

    /**
     * 批次号
     */
    private String batchNumber;

    /**
     * 处置动作
     */
    private String decisionMade;

    /**
     * 处置动作描述
     */
    private String actionDescription;

    /**
     * 处置原因
     */
    private String reason;

    /**
     * 申请人ID
     */
    private Long executorId;

    /**
     * 申请人姓名
     */
    private String executorName;

    /**
     * 申请人角色
     */
    private String executorRole;

    /**
     * 需要的审批级别
     */
    private String approvalLevel;

    /**
     * 紧急程度
     */
    private String urgency;

    /**
     * 规则配置名称
     */
    private String ruleConfigName;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;
}
