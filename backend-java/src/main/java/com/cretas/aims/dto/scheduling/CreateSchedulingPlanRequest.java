package com.cretas.aims.dto.scheduling;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 创建调度计划请求
 */
@Data
public class CreateSchedulingPlanRequest {
    @NotNull(message = "计划日期不能为空")
    private LocalDate planDate;

    private String planName;

    private String notes;

    // 产线排程列表
    private List<ScheduleItem> schedules;

    @Data
    public static class ScheduleItem {
        @NotNull(message = "产线ID不能为空")
        private String productionLineId;

        private Long batchId;

        private Integer sequenceOrder;

        private LocalDateTime plannedStartTime;

        private LocalDateTime plannedEndTime;

        private Integer plannedQuantity;

        private List<Long> workerIds;
    }
}
