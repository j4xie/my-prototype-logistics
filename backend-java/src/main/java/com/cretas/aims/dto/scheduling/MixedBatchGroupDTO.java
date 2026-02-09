package com.cretas.aims.dto.scheduling;

import com.cretas.aims.entity.enums.MixedBatchType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 混批分组DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "混批分组信息")
public class MixedBatchGroupDTO {

    @Schema(description = "混批组ID")
    private String id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "混批类型")
    private MixedBatchType groupType;

    @Schema(description = "混批类型显示名称")
    private String groupTypeDisplayName;

    @Schema(description = "原料批次ID")
    private String materialBatchId;

    @Schema(description = "原料批次号")
    private String materialBatchNumber;

    @Schema(description = "原料名称")
    private String materialName;

    @Schema(description = "工艺类型")
    private String processType;

    @Schema(description = "工艺名称")
    private String processName;

    @Schema(description = "包含的订单列表")
    private List<OrderSummaryDTO> orders;

    @Schema(description = "订单数量")
    private Integer orderCount;

    @Schema(description = "合并后总数量")
    private BigDecimal totalQuantity;

    @Schema(description = "数量单位")
    private String quantityUnit;

    @Schema(description = "预计节省换型时间 (分钟)")
    private Integer estimatedSwitchSaving;

    @Schema(description = "工艺相似度 (0-1)")
    private BigDecimal processSimilarity;

    @Schema(description = "最早交期")
    private LocalDateTime earliestDeadline;

    @Schema(description = "最晚交期")
    private LocalDateTime latestDeadline;

    @Schema(description = "交期间隔 (小时)")
    private Integer deadlineGapHours;

    @Schema(description = "状态: pending/confirmed/rejected/expired")
    private String status;

    @Schema(description = "状态显示名称")
    private String statusDisplayName;

    @Schema(description = "AI推荐分数 (0-100)")
    private Integer recommendScore;

    @Schema(description = "AI推荐理由")
    private String recommendationReason;

    @Schema(description = "确认人ID")
    private Long confirmedBy;

    @Schema(description = "确认人姓名")
    private String confirmedByName;

    @Schema(description = "确认时间")
    private LocalDateTime confirmedAt;

    @Schema(description = "拒绝原因")
    private String rejectionReason;

    @Schema(description = "关联的生产计划ID")
    private String productionPlanId;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    /**
     * 订单摘要DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "订单摘要信息")
    public static class OrderSummaryDTO {

        @Schema(description = "订单ID")
        private String orderId;

        @Schema(description = "订单号")
        private String orderNumber;

        @Schema(description = "客户名称")
        private String customerName;

        @Schema(description = "产品名称")
        private String productName;

        @Schema(description = "数量")
        private BigDecimal quantity;

        @Schema(description = "单位")
        private String unit;

        @Schema(description = "交期")
        private LocalDateTime deadline;

        @Schema(description = "优先级")
        private Integer priority;
    }
}
