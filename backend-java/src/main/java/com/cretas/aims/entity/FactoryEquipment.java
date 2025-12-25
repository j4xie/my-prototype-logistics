package com.cretas.aims.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
/**
 * 工厂设备实体类
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-01-09
 * @updated 2025-12-22 - 主键改为 BIGINT 自增，提升 JOIN 性能
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "equipmentUsages", "maintenanceRecords"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "factory_equipment",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "code"})
       },
       indexes = {
           @Index(name = "idx_equipment_factory", columnList = "factory_id"),
           @Index(name = "idx_equipment_status", columnList = "status")
       }
)
public class FactoryEquipment extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;  // 改为 Long 自增主键，提升 JOIN 性能
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "code", nullable = false, length = 50)
    private String code;
    @Column(name = "equipment_code", nullable = false, length = 50)
    private String equipmentCode;
    @Column(name = "equipment_name", nullable = false, length = 191)
    private String equipmentName;
    @Column(name = "type", length = 50)
    private String type;
    @Column(name = "model", length = 100)
    private String model;
    @Column(name = "manufacturer", length = 100)
    private String manufacturer;
    @Column(name = "purchase_date")
    private LocalDate purchaseDate;
    @Column(name = "purchase_price", precision = 12, scale = 2)
    private BigDecimal purchasePrice;
    @Column(name = "depreciation_years")
    private Integer depreciationYears;
    @Column(name = "hourly_cost", precision = 10, scale = 2)
    private BigDecimal hourlyCost;
    @Column(name = "power_consumption_kw", precision = 10, scale = 2)
    private BigDecimal powerConsumptionKw;
    @Column(name = "status", nullable = false, length = 20)
    private String status = "idle"; // idle, running, maintenance, scrapped
    @Column(name = "location", length = 100)
    private String location;
    @Column(name = "total_running_hours")
    private Integer totalRunningHours = 0;
    @Column(name = "maintenance_interval_hours")
    private Integer maintenanceIntervalHours;
    @Column(name = "last_maintenance_date")
    private LocalDate lastMaintenanceDate;
    @Column(name = "next_maintenance_date")
    private LocalDate nextMaintenanceDate;
    @Column(name = "warranty_expiry_date")
    private LocalDate warrantyExpiryDate;
    @Column(name = "serial_number", length = 100)
    private String serialNumber;
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // 乐观锁版本号
    @Version
    @Column(name = "version")
    private Integer version;

    // 关联关系 (使用 @JsonIgnore 防止循环引用)
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;

    @JsonIgnore
    @OneToMany(mappedBy = "equipment", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<BatchEquipmentUsage> equipmentUsages = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "equipment", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<EquipmentMaintenance> maintenanceRecords = new ArrayList<>();
}
