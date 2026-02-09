package com.cretas.aims.dto.scheduling;

import com.cretas.aims.entity.LineSchedule;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 产线排程 DTO
 */
@Data
public class LineScheduleDTO {
    private String id;
    private String planId;
    private String productionLineId;
    private String productionLineName;
    private Long batchId;
    private String batchNumber;
    private Integer sequenceOrder;
    private LocalDateTime plannedStartTime;
    private LocalDateTime plannedEndTime;
    private LocalDateTime actualStartTime;
    private LocalDateTime actualEndTime;
    private Integer assignedWorkers;
    private Integer plannedQuantity;
    private Integer completedQuantity;
    private BigDecimal predictedEfficiency;
    private BigDecimal actualEfficiency;
    private BigDecimal predictedCompletionProb;
    private String status;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 关联数据
    private List<WorkerAssignmentDTO> workerAssignments;

    // 计算字段
    private BigDecimal completionRate;
    private Long remainingMinutes;
    private Boolean isDelayed;

    public static LineScheduleDTO fromEntity(LineSchedule entity) {
        LineScheduleDTO dto = new LineScheduleDTO();
        dto.setId(entity.getId());
        dto.setPlanId(entity.getPlanId());
        dto.setProductionLineId(entity.getProductionLineId());
        dto.setBatchId(entity.getBatchId());
        dto.setSequenceOrder(entity.getSequenceOrder());
        dto.setPlannedStartTime(entity.getPlannedStartTime());
        dto.setPlannedEndTime(entity.getPlannedEndTime());
        dto.setActualStartTime(entity.getActualStartTime());
        dto.setActualEndTime(entity.getActualEndTime());
        dto.setAssignedWorkers(entity.getAssignedWorkers());
        dto.setPlannedQuantity(entity.getPlannedQuantity());
        dto.setCompletedQuantity(entity.getCompletedQuantity());
        dto.setPredictedEfficiency(entity.getPredictedEfficiency());
        dto.setActualEfficiency(entity.getActualEfficiency());
        dto.setPredictedCompletionProb(entity.getPredictedCompletionProb());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus().name() : null);
        dto.setNotes(entity.getDelayReason());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());

        // 计算完成率
        if (entity.getPlannedQuantity() != null && entity.getPlannedQuantity() > 0
            && entity.getCompletedQuantity() != null) {
            dto.setCompletionRate(BigDecimal.valueOf(entity.getCompletedQuantity())
                .divide(BigDecimal.valueOf(entity.getPlannedQuantity()), 4, BigDecimal.ROUND_HALF_UP)
                .multiply(BigDecimal.valueOf(100)));
        }

        // 计算是否延迟
        if (entity.getPlannedEndTime() != null && entity.getActualEndTime() == null
            && entity.getStatus() != LineSchedule.ScheduleStatus.completed) {
            dto.setIsDelayed(LocalDateTime.now().isAfter(entity.getPlannedEndTime()));
        } else {
            dto.setIsDelayed(false);
        }

        return dto;
    }
}
