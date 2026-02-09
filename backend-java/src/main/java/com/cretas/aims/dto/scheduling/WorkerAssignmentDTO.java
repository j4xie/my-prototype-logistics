package com.cretas.aims.dto.scheduling;

import com.cretas.aims.entity.WorkerAssignment;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 工人分配 DTO
 */
@Data
public class WorkerAssignmentDTO {
    private String id;
    private String scheduleId;
    private Long userId;
    private String userName;
    private String userPhone;
    private LocalDateTime assignedAt;
    private LocalDateTime actualStartTime;
    private LocalDateTime actualEndTime;
    private Boolean isTemporary;
    private BigDecimal laborCost;
    private Integer performanceScore;
    private String status;
    private String notes;

    // 关联数据
    private String productionLineName;
    private String batchNumber;
    private LocalDateTime scheduledStartTime;
    private LocalDateTime scheduledEndTime;

    public static WorkerAssignmentDTO fromEntity(WorkerAssignment entity) {
        WorkerAssignmentDTO dto = new WorkerAssignmentDTO();
        dto.setId(entity.getId());
        dto.setScheduleId(entity.getScheduleId());
        dto.setUserId(entity.getUserId());
        dto.setAssignedAt(entity.getAssignedAt());
        dto.setActualStartTime(entity.getActualStartTime());
        dto.setActualEndTime(entity.getActualEndTime());
        dto.setIsTemporary(entity.getIsTemporary());
        dto.setLaborCost(entity.getLaborCost());
        dto.setPerformanceScore(entity.getPerformanceScore());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus().name() : null);
        dto.setNotes(entity.getNotes());
        return dto;
    }
}
