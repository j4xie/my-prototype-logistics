package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

import javax.persistence.*;
import javax.validation.constraints.DecimalMax;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * BOM 配方实体（餐饮版）
 *
 * <p>记录菜品与食材的标准用量关系，是领料计算和成本核算的基础。</p>
 *
 * <h3>数据库表信息</h3>
 * <ul>
 *   <li><b>表名</b>：recipes</li>
 *   <li><b>索引</b>：factory_id, product_type_id, raw_material_type_id</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "recipes",
        indexes = {
                @Index(name = "idx_recipe_factory", columnList = "factory_id"),
                @Index(name = "idx_recipe_product", columnList = "product_type_id"),
                @Index(name = "idx_recipe_material", columnList = "raw_material_type_id"),
                @Index(name = "idx_recipe_factory_product", columnList = "factory_id,product_type_id")
        }
)
public class Recipe extends BaseEntity {

    // ========== 主键 ==========

    /**
     * 主键ID — UUID 字符串格式
     */
    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    // ========== 归属 ==========

    /**
     * 工厂/餐厅 ID，用于数据隔离
     */
    @NotBlank
    @Column(name = "factory_id", nullable = false, length = 100)
    private String factoryId;

    /**
     * 关联菜品 (product_types.id)
     */
    @NotBlank
    @Column(name = "product_type_id", nullable = false, length = 191)
    private String productTypeId;

    /**
     * 关联食材 (raw_material_types.id)
     */
    @NotBlank
    @Column(name = "raw_material_type_id", nullable = false, length = 191)
    private String rawMaterialTypeId;

    // ========== 配方信息 ==========

    /**
     * 标准用量（对应菜品一份所需食材量）
     */
    @NotNull
    @Column(name = "standard_quantity", nullable = false, precision = 10, scale = 4)
    private BigDecimal standardQuantity;

    /**
     * 计量单位（kg / L / 个 / g）
     */
    @Column(name = "unit", length = 20)
    private String unit;

    /**
     * 净料率 (0.0 – 1.0)
     * <p>例如：鱼肉净料率 0.6 表示 1kg 整鱼只有 600g 可用。</p>
     * <p>实际用量 = standardQuantity / netYieldRate</p>
     */
    @DecimalMin("0.01")
    @DecimalMax("1.00")
    @Column(name = "net_yield_rate", precision = 5, scale = 4)
    private BigDecimal netYieldRate;

    /**
     * 是否为主料（true = 主料，false = 辅料/调料）
     */
    @Column(name = "is_main_ingredient")
    private Boolean isMainIngredient = true;

    /**
     * 备注
     */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    /**
     * 配方状态（true = 启用，false = 停用）
     */
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    /**
     * 创建者 ID
     */
    @Column(name = "created_by")
    private Long createdBy;

    // ========== 计算属性 ==========

    /**
     * 计算实际采购用量（考虑净料率）
     * <p>当净料率为 null 或 0 时，视为 1（净料）</p>
     *
     * @return 实际需要采购的食材量
     */
    @Transient
    public BigDecimal getActualQuantity() {
        if (netYieldRate == null || netYieldRate.compareTo(BigDecimal.ZERO) == 0) {
            return standardQuantity;
        }
        return standardQuantity.divide(netYieldRate, 4, java.math.RoundingMode.HALF_UP);
    }
}
