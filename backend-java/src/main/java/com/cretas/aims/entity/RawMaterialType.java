package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
/**
 * 原材料类型实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "createdBy", "materialBatches", "conversions"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "raw_material_types",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "code"})
       },
       indexes = {
           @Index(name = "idx_material_factory", columnList = "factory_id"),
           @Index(name = "idx_material_is_active", columnList = "is_active")
       }
)
public class RawMaterialType extends BaseEntity {
    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "code", nullable = false, length = 50)
    private String code;
    @Column(name = "name", nullable = false)
    private String name;
    @Column(name = "category", length = 50)
    private String category;
    @Column(name = "unit", nullable = false, length = 20)
    private String unit;
    @Column(name = "unit_price", precision = 10, scale = 2)
    private BigDecimal unitPrice;
    @Column(name = "storage_type", length = 20)
    private String storageType;  // fresh, frozen, dry
    @Column(name = "shelf_life_days")
    private Integer shelfLifeDays;
    @Column(name = "min_stock", precision = 10, scale = 2)
    private BigDecimal minStock;
    @Column(name = "max_stock", precision = 10, scale = 2)
    private BigDecimal maxStock;
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    @Column(name = "created_by", nullable = false)
    private Integer createdBy;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User createdByUser;
    @OneToMany(mappedBy = "materialType", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialBatch> materialBatches = new ArrayList<>();
    @OneToMany(mappedBy = "materialType", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialProductConversion> conversions = new ArrayList<>();
}
