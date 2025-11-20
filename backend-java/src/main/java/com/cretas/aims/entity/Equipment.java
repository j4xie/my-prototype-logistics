package com.cretas.aims.entity;

import com.cretas.aims.entity.enums.EquipmentStatus;
import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
/**
 * 设备实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "usages"})
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "equipment",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "code"})
       },
       indexes = {
           @Index(name = "idx_equipment_factory", columnList = "factory_id"),
           @Index(name = "idx_equipment_status", columnList = "status")
       }
)
public class Equipment extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "code", nullable = false, length = 50)
    private String code;
    @Column(name = "name", nullable = false)
    private String name;
    @Column(name = "category", length = 50)
    private String category;
    @Column(name = "model", length = 100)
    private String model;
    @Column(name = "manufacturer", length = 100)
    private String manufacturer;
    @Column(name = "purchase_date")
    private LocalDate purchaseDate;
    @Column(name = "purchase_price", precision = 10, scale = 2)
    private BigDecimal purchasePrice;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private EquipmentStatus status = EquipmentStatus.IDLE;
    @Column(name = "location", length = 100)
    private String location;
    @Column(name = "total_operating_hours")
    private Integer totalOperatingHours = 0;
    @Column(name = "last_maintenance_date")
    private LocalDate lastMaintenanceDate;
    @Column(name = "next_maintenance_date")
    private LocalDate nextMaintenanceDate;
    @Column(name = "maintenance_interval_days")
    private Integer maintenanceIntervalDays;
    @Column(name = "maintenance_notes", columnDefinition = "TEXT")
    private String maintenanceNotes;
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;
    @OneToMany(mappedBy = "equipment", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<EquipmentUsage> usages = new ArrayList<>();
}
