package com.cretas.aims.dto.quality;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * 处置申请结果 DTO
 * POST /quality-disposition/apply 的响应
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispositionApplicationDTO {

    /**
     * 申请ID (审计日志ID)
     */
    private String applicationId;

    /**
     * 生产批次ID
     */
    private Long batchId;

    /**
     * 质检记录ID
     */
    private String inspectionId;

    /**
     * 处置动作代码
     */
    private String actionCode;

    /**
     * 处置动作描述
     */
    private String actionDescription;

    /**
     * 申请状态 (PENDING_APPROVAL, APPROVED, REJECTED)
     */
    private String status;

    /**
     * 需要的审批级别
     */
    private String approvalLevel;

    /**
     * 申请人ID
     */
    private Long applicantId;

    /**
     * 申请人姓名
     */
    private String applicantName;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 消息提示
     */
    private String message;
}
