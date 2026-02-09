package com.cretas.aims.dto.scheduling;

import com.cretas.aims.entity.SchedulingPlan;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 调度计划 DTO
 */
@Data
public class SchedulingPlanDTO {
    private String id;
    private String factoryId;
    private LocalDate planDate;
    private String planName;
    private String status;
    private Integer totalBatches;
    private Integer totalWorkers;
    private Long createdBy;
    private String createdByName;
    private Long confirmedBy;
    private String confirmedByName;
    private LocalDateTime confirmedAt;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 关联数据
    private List<LineScheduleDTO> lineSchedules;

    // 统计数据
    private Integer completedSchedules;
    private Integer inProgressSchedules;
    private Integer pendingSchedules;

    public static SchedulingPlanDTO fromEntity(SchedulingPlan entity) {
        SchedulingPlanDTO dto = new SchedulingPlanDTO();
        dto.setId(entity.getId());
        dto.setFactoryId(entity.getFactoryId());
        dto.setPlanDate(entity.getPlanDate());
        dto.setPlanName(entity.getPlanName());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus().name() : null);
        dto.setTotalBatches(entity.getTotalBatches());
        dto.setTotalWorkers(entity.getTotalWorkers());
        dto.setCreatedBy(entity.getCreatedBy());
        dto.setConfirmedBy(entity.getConfirmedBy());
        dto.setConfirmedAt(entity.getConfirmedAt());
        dto.setNotes(entity.getNotes());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }
}
