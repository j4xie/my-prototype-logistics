package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
/**
 * 产品类型实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "createdBy", "conversions", "productionPlans"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "product_types",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "code"})
       },
       indexes = {
           @Index(name = "idx_product_factory", columnList = "factory_id"),
           @Index(name = "idx_product_is_active", columnList = "is_active")
       }
)
public class ProductType extends BaseEntity {
    @Id
    //@GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", length = 100)
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
    @Column(name = "production_time_minutes")
    private Integer productionTimeMinutes;
    @Column(name = "shelf_life_days")
    private Integer shelfLifeDays;
    @Column(name = "package_spec", length = 100)
    private String packageSpec;
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
    @OneToMany(mappedBy = "productType", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialProductConversion> conversions = new ArrayList<>();

    @OneToMany(mappedBy = "productType", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductionPlan> productionPlans = new ArrayList<>();
}
