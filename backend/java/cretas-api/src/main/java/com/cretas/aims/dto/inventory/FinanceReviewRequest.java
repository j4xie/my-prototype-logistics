package com.cretas.aims.dto.inventory;

import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 财务审核请求DTO
 * 用于财务审批或驳回销售订单
 *
 * 六扇门 V1 §2.2 (audit fix 2026-04-26 #6): finance reviewer 现在可以在审核时
 * 录入预估成本 (estimatedCost), 系统自动计算预估利润 (totalAmount - estimatedCost)
 * 并持久化到 sales_orders 已有的 estimated_cost / estimated_profit 列。V2 增强会
 * 自动从 BOM 推导 4 项分项 (材料/工时/设备/其他), 当前 V1.5 接受单一 estimatedCost.
 */
@Data
public class FinanceReviewRequest {

    /** 审核意见/驳回原因（审批可选，驳回建议填写） */
    private String notes;

    /**
     * 预估成本 (元) — 财务审核时录入,通常 = BOM 材料成本 + 历史工时/制造费.
     * 可选: 不填则保持现有 estimated_cost 值不变.
     */
    @PositiveOrZero(message = "预估成本必须大于等于 0")
    private BigDecimal estimatedCost;
}
