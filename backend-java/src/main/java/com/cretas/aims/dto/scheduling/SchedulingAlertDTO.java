package com.cretas.aims.dto.scheduling;

import com.cretas.aims.entity.SchedulingAlert;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 调度告警 DTO
 */
@Data
public class SchedulingAlertDTO {
    private String id;
    private String factoryId;
    private String scheduleId;
    private String planId;
    private String alertType;
    private String severity;
    private String message;
    private String suggestedAction;
    private Boolean isResolved;
    private LocalDateTime resolvedAt;
    private Long resolvedBy;
    private String resolvedByName;
    private String resolutionNotes;
    private LocalDateTime acknowledgedAt;
    private Long acknowledgedBy;
    private String acknowledgedByName;
    private LocalDateTime createdAt;

    // 关联数据
    private String productionLineName;
    private String batchNumber;

    public static SchedulingAlertDTO fromEntity(SchedulingAlert entity) {
        SchedulingAlertDTO dto = new SchedulingAlertDTO();
        dto.setId(entity.getId());
        dto.setFactoryId(entity.getFactoryId());
        dto.setScheduleId(entity.getScheduleId());
        dto.setPlanId(entity.getPlanId());
        dto.setAlertType(entity.getAlertType() != null ? entity.getAlertType().name() : null);
        dto.setSeverity(entity.getSeverity() != null ? entity.getSeverity().name() : null);
        dto.setMessage(entity.getMessage());
        dto.setSuggestedAction(entity.getSuggestedAction());
        dto.setIsResolved(entity.getIsResolved());
        dto.setResolvedAt(entity.getResolvedAt());
        dto.setResolvedBy(entity.getResolvedBy());
        dto.setResolutionNotes(entity.getResolutionNotes());
        dto.setAcknowledgedAt(entity.getAcknowledgedAt());
        dto.setAcknowledgedBy(entity.getAcknowledgedBy());
        dto.setCreatedAt(entity.getCreatedAt());
        return dto;
    }
}
