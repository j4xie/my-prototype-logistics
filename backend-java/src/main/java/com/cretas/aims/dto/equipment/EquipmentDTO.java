package com.cretas.aims.dto.equipment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
/**
 * 设备数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class EquipmentDTO {
    private String id;  // 修改为String，与FactoryEquipment.id一致
    private String factoryId;
    private String equipmentCode;
    private String name;
    private String type;
    private String model;
    private String manufacturer;
    private String serialNumber;
    // 购买信息
    private LocalDate purchaseDate;
    private BigDecimal purchasePrice;
    private Integer depreciationYears;
    private BigDecimal currentValue;
    // 运行信息
    private String status;
    private String location;
    private BigDecimal hourlyCost;
    private BigDecimal powerConsumptionKw;
    private Integer totalRunningHours;
    private BigDecimal totalOperatingCost;
    // 维护信息
    private Integer maintenanceIntervalHours;
    private LocalDate lastMaintenanceDate;
    private LocalDate nextMaintenanceDate;
    private LocalDate warrantyExpiryDate;
    private Integer maintenanceCount;
    private BigDecimal totalMaintenanceCost;
    private Boolean needsMaintenance;
    // 效率信息
    private Double utilizationRate;
    private Double efficiency;
    private Double availability;
    // 其他信息
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer createdBy;
    private String createdByName;
}
