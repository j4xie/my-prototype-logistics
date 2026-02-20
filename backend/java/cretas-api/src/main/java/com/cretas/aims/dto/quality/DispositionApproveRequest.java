package com.cretas.aims.dto.quality;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import javax.validation.constraints.NotNull;

/**
 * 处置审批请求 DTO
 * 用于 POST /quality-disposition/{id}/approve 端点
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DispositionApproveRequest {

    /**
     * 是否批准
     */
    @NotNull(message = "审批决定不能为空")
    private Boolean approved;

    /**
     * 审批人ID
     */
    @NotNull(message = "审批人ID不能为空")
    private Long approverId;

    /**
     * 审批人姓名
     */
    private String approverName;

    /**
     * 审批人角色
     */
    private String approverRole;

    /**
     * 审批意见
     */
    private String comment;

    /**
     * 如果拒绝，建议的替代动作
     */
    private String alternativeAction;

    /**
     * 附加条件（条件批准时使用）
     */
    private String conditions;
}
