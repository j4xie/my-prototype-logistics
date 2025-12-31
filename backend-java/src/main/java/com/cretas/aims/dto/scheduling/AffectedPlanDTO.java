package com.cretas.aims.dto.scheduling;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 受影响计划DTO
 * 包含链式影响分析的详细信息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "受影响计划详细信息")
public class AffectedPlanDTO {

    @Schema(description = "计划ID")
    private String planId;

    @Schema(description = "计划编号")
    private String planNumber;

    @Schema(description = "产品名称")
    private String productName;

    @Schema(description = "产品类型ID")
    private String productTypeId;

    @Schema(description = "计划数量")
    private BigDecimal plannedQuantity;

    @Schema(description = "原计划开始时间")
    private LocalDateTime originalStartTime;

    @Schema(description = "原计划结束时间")
    private LocalDateTime originalEndTime;

    @Schema(description = "延迟后开始时间")
    private LocalDateTime delayedStartTime;

    @Schema(description = "延迟后结束时间")
    private LocalDateTime delayedEndTime;

    @Schema(description = "延迟时间（分钟）")
    private Integer delayMinutes;

    @Schema(description = "延迟时间（小时，用于显示）")
    private Double delayHours;

    @Schema(description = "客户名称")
    private String customerName;

    @Schema(description = "是否VIP客户")
    private Boolean isVipCustomer;

    @Schema(description = "客户订单号")
    private String customerOrderNumber;

    @Schema(description = "CR值 (Critical Ratio)")
    private BigDecimal crValue;

    @Schema(description = "延迟后的CR值")
    private BigDecimal delayedCrValue;

    @Schema(description = "是否变为紧急 (CR < 1)")
    private Boolean becomesUrgent;

    @Schema(description = "是否超期 (延迟后超过交期)")
    private Boolean exceedsDeadline;

    @Schema(description = "优先级")
    private Integer priority;

    @Schema(description = "影响类型: DIRECT/CASCADE")
    private String impactType;

    @Schema(description = "影响层级 (1=直接冲突, 2+=级联影响)")
    private Integer impactLevel;

    @Schema(description = "计划状态")
    private String status;

    @Schema(description = "计划来源类型")
    private String sourceType;

    /**
     * 计算是否为高风险计划
     * 高风险: VIP客户 + CR < 1.0，或者延迟后超期
     */
    public boolean isHighRisk() {
        return (Boolean.TRUE.equals(isVipCustomer) &&
                delayedCrValue != null &&
                delayedCrValue.compareTo(BigDecimal.ONE) < 0) ||
               Boolean.TRUE.equals(exceedsDeadline);
    }

    /**
     * 计算风险分数 (0-100)
     */
    public int calculateRiskScore() {
        int score = 0;

        // VIP客户加分
        if (Boolean.TRUE.equals(isVipCustomer)) {
            score += 30;
        }

        // CR值越低风险越高
        if (delayedCrValue != null) {
            if (delayedCrValue.compareTo(BigDecimal.valueOf(0.5)) < 0) {
                score += 40;
            } else if (delayedCrValue.compareTo(BigDecimal.ONE) < 0) {
                score += 25;
            } else if (delayedCrValue.compareTo(BigDecimal.valueOf(1.5)) < 0) {
                score += 10;
            }
        }

        // 超期额外加分
        if (Boolean.TRUE.equals(exceedsDeadline)) {
            score += 30;
        }

        // 变为紧急加分
        if (Boolean.TRUE.equals(becomesUrgent)) {
            score += 15;
        }

        // 高优先级加分
        if (priority != null && priority >= 8) {
            score += 15;
        }

        return Math.min(100, score);
    }
}
