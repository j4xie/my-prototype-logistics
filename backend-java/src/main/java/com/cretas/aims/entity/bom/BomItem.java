package com.cretas.aims.entity.bom;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;

/**
 * BOM (Bill of Materials) 项目实体
 * 记录产品所需的原辅料配方
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-13
 */
@Entity
@Table(name = "bom_items", indexes = {
    @Index(name = "idx_bom_factory_product", columnList = "factory_id, product_type_id")
})
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class BomItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    /**
     * 产品类型ID
     */
    @Column(name = "product_type_id", nullable = false, length = 64)
    private String productTypeId;

    /**
     * 产品名称 (冗余字段，方便查询)
     */
    @Column(name = "product_name", length = 100)
    private String productName;

    /**
     * 原辅料类型ID
     */
    @Column(name = "material_type_id", nullable = false, length = 64)
    private String materialTypeId;

    /**
     * 原辅料名称 (冗余字段，方便查询)
     */
    @Column(name = "material_name", length = 100)
    private String materialName;

    /**
     * 成品含量/标准用量 (每单位成品所需原料量)
     */
    @Column(name = "standard_quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal standardQuantity;

    /**
     * 出成率 (0-100的百分比，如90表示90%出成率)
     */
    @Column(name = "yield_rate", precision = 6, scale = 2)
    @Builder.Default
    private BigDecimal yieldRate = new BigDecimal("100.00");

    /**
     * 计量单位
     */
    @Column(name = "unit", length = 20)
    private String unit;

    /**
     * 单价 (含税/不含税取决于tax_rate)
     */
    @Column(name = "unit_price", precision = 15, scale = 4)
    private BigDecimal unitPrice;

    /**
     * 税率 (百分比，如13表示13%增值税)
     */
    @Column(name = "tax_rate", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal taxRate = BigDecimal.ZERO;

    /**
     * 排序顺序
     */
    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    /**
     * 备注
     */
    @Column(name = "remark", length = 500)
    private String remark;

    /**
     * 计算实际用量（考虑出成率）
     * 实际用量 = 标准用量 / (出成率/100)
     */
    @Transient
    public BigDecimal getActualQuantity() {
        if (yieldRate == null || yieldRate.compareTo(BigDecimal.ZERO) == 0) {
            return standardQuantity;
        }
        return standardQuantity.divide(
            yieldRate.divide(new BigDecimal("100"), 6, BigDecimal.ROUND_HALF_UP),
            6, BigDecimal.ROUND_HALF_UP
        );
    }

    /**
     * 计算单项原料成本
     * 成本 = 实际用量 * 单价
     */
    @Transient
    public BigDecimal calculateCost() {
        if (unitPrice == null) {
            return BigDecimal.ZERO;
        }
        return getActualQuantity().multiply(unitPrice).setScale(4, BigDecimal.ROUND_HALF_UP);
    }
}
