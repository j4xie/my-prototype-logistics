package com.cretas.aims.dto.scheduling;

import com.cretas.aims.entity.ProductionLine;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 产线配置 DTO
 */
@Data
public class ProductionLineDTO {
    private String id;
    private String factoryId;
    private Long departmentId;
    private String departmentName;
    private String name;
    private String lineCode;
    private String lineType;
    private Integer minWorkers;
    private Integer maxWorkers;
    private Integer requiredSkillLevel;
    private BigDecimal hourlyCapacity;
    private String equipmentIds;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 统计数据
    private Integer currentWorkers;
    private Integer activeSchedules;
    private BigDecimal todayOutput;

    public static ProductionLineDTO fromEntity(ProductionLine entity) {
        ProductionLineDTO dto = new ProductionLineDTO();
        dto.setId(entity.getId());
        dto.setFactoryId(entity.getFactoryId());
        dto.setDepartmentId(entity.getDepartmentId());
        dto.setName(entity.getName());
        dto.setLineCode(entity.getLineCode());
        dto.setLineType(entity.getLineType());
        dto.setMinWorkers(entity.getMinWorkers());
        dto.setMaxWorkers(entity.getMaxWorkers());
        dto.setRequiredSkillLevel(entity.getRequiredSkillLevel());
        dto.setHourlyCapacity(entity.getHourlyCapacity());
        dto.setEquipmentIds(entity.getEquipmentIds());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus().name() : null);
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }
}
