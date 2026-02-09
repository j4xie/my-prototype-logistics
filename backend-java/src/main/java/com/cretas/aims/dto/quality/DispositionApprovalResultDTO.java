package com.cretas.aims.dto.quality;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * 处置审批结果 DTO
 * POST /quality-disposition/{id}/approve 的响应
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispositionApprovalResultDTO {

    /**
     * 申请ID
     */
    private String applicationId;

    /**
     * 生产批次ID
     */
    private Long batchId;

    /**
     * 是否批准
     */
    private Boolean approved;

    /**
     * 审批人ID
     */
    private Long approverId;

    /**
     * 审批人姓名
     */
    private String approverName;

    /**
     * 审批意见
     */
    private String comment;

    /**
     * 审批时间
     */
    private LocalDateTime approvedAt;

    /**
     * 处置执行结果（如果批准且已执行）
     */
    private String executionStatus;

    /**
     * 批次新状态
     */
    private String newBatchStatus;

    /**
     * 消息提示
     */
    private String message;
}
