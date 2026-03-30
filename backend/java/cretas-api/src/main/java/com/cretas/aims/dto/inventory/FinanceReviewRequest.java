package com.cretas.aims.dto.inventory;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 财务审核请求DTO
 * 用于财务审批或驳回销售订单
 */
@Data
public class FinanceReviewRequest {

    /** 审核意见/驳回原因（审批可选，驳回建议填写） */
    private String notes;
}
