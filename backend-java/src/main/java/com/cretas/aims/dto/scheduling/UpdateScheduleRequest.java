package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 更新排程请求
 */
@Data
public class UpdateScheduleRequest {
    private Integer sequenceOrder;
    private LocalDateTime plannedStartTime;
    private LocalDateTime plannedEndTime;
    private Integer plannedQuantity;
    private String notes;
    private List<Long> workerIds;
}
