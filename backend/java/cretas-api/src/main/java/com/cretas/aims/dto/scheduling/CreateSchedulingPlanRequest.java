package com.cretas.aims.dto.scheduling;

import lombok.Data;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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

    @Size(max = 200, message = "计划名称长度不能超过200个字符")
    private String planName;

    @Size(max = 5000, message = "备注长度不能超过5000个字符")
    private String notes;

    // 产线排程列表
    private List<ScheduleItem> schedules;

    @Data
    public static class ScheduleItem {
        @NotNull(message = "产线ID不能为空")
        @Size(max = 191, message = "产线ID长度不能超过191个字符")
        private String productionLineId;

        private Long batchId;

        private Integer sequenceOrder;

        private LocalDateTime plannedStartTime;

        private LocalDateTime plannedEndTime;

        private Integer plannedQuantity;

        private List<Long> workerIds;
    }
}
