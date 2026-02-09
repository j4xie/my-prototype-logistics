package com.cretas.aims.dto.scheduling;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 车间主任排程任务 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupervisorTaskDTO {
    private String scheduleId;
    private String planId;
    private String productionLineId;
    private String productionLineName;
    private Long batchId;
    private String batchNumber;
    private String productName;
    private Integer plannedQuantity;
    private LocalDateTime plannedStartTime;
    private LocalDateTime plannedEndTime;
    private Integer assignedWorkers;
    private String status;
    private boolean isUrgent;
    private String workshopLocation;
}
