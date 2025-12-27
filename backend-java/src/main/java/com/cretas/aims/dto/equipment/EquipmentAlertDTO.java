package com.cretas.aims.dto.equipment;

import com.cretas.aims.entity.enums.AlertLevel;
import com.cretas.aims.entity.enums.AlertStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 设备告警DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-27
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EquipmentAlertDTO {

    private Integer id;
    private String factoryId;
    private Long equipmentId;
    private String equipmentName;
    private String alertType;
    private AlertLevel level;
    private String severity; // 前端使用的字段：CRITICAL, HIGH, MEDIUM, LOW
    private AlertStatus status;
    private String message;
    private String details;
    private LocalDateTime triggeredAt;
    private LocalDateTime acknowledgedAt;
    private Long acknowledgedBy;
    private String acknowledgedByName;
    private LocalDateTime resolvedAt;
    private Long resolvedBy;
    private String resolvedByName;
    private String resolutionNotes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 前端期望的额外字段
    public String getSeverity() {
        if (level == null) return "LOW";
        switch (level) {
            case CRITICAL: return "CRITICAL";
            case WARNING: return "HIGH";
            case INFO: return "MEDIUM";
            default: return "LOW";
        }
    }
}
