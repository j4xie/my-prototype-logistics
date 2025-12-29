package com.cretas.aims.dto.scheduling;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 紧急插单时段DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "紧急插单时段信息")
public class InsertSlotDTO {

    @Schema(description = "时段ID")
    private String id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "产线ID")
    private String productionLineId;

    @Schema(description = "产线名称")
    private String productionLineName;

    @Schema(description = "开始时间")
    private LocalDateTime startTime;

    @Schema(description = "结束时间")
    private LocalDateTime endTime;

    @Schema(description = "时段时长（小时）")
    private Double durationHours;

    @Schema(description = "可用产能 (kg)")
    private BigDecimal availableCapacity;

    @Schema(description = "影响等级: none/low/medium/high")
    private String impactLevel;

    @Schema(description = "影响等级显示名称")
    private String impactLevelDisplayName;

    @Schema(description = "受影响的计划列表")
    private List<ImpactedPlanDTO> impactedPlans;

    @Schema(description = "所需人员数")
    private Integer requiredWorkers;

    @Schema(description = "可用人员数")
    private Integer availableWorkers;

    @Schema(description = "人员是否充足")
    private Boolean hasEnoughWorkers;

    @Schema(description = "换型成本 (分钟)")
    private Integer switchCostMinutes;

    @Schema(description = "AI推荐分数 (0-100)")
    private Integer recommendScore;

    @Schema(description = "AI推荐理由")
    private String recommendationReason;

    @Schema(description = "状态: available/selected/expired")
    private String status;

    @Schema(description = "是否可用")
    private Boolean isAvailable;

    /**
     * 受影响计划DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "受影响计划信息")
    public static class ImpactedPlanDTO {

        @Schema(description = "计划ID")
        private String planId;

        @Schema(description = "计划编号")
        private String planNumber;

        @Schema(description = "计划名称/产品名称")
        private String planName;

        @Schema(description = "延迟时间（分钟）")
        private Integer delayMinutes;

        @Schema(description = "原计划完成时间")
        private LocalDateTime originalEndTime;

        @Schema(description = "延迟后完成时间")
        private LocalDateTime delayedEndTime;
    }
}
