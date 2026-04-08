package com.cretas.aims.entity.warehouse;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * 周转耗材 (周转框/塑料筐) 主数据
 * 客户原话 (Apr 7 会议 3428-3475s): "周转耗材需要做个管理...我们会给到客户很多周转框...如果丢了他要赔钱"
 */
@Entity
@Table(name = "reusable_containers",
        uniqueConstraints = @UniqueConstraint(name = "uk_reusable_container_code",
                columnNames = {"factory_id", "container_code"}))
@Getter
@Setter
public class ReusableContainer extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", length = 64, nullable = false)
    private String factoryId;

    @Column(name = "container_code", length = 64, nullable = false)
    private String containerCode;

    @Column(name = "container_name", length = 128, nullable = false)
    private String containerName;

    @Column(name = "specification", length = 128)
    private String specification;

    @Column(name = "unit_price", precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_quantity", nullable = false)
    private Integer totalQuantity = 0;

    @Column(name = "in_warehouse_quantity", nullable = false)
    private Integer inWarehouseQuantity = 0;

    @Column(name = "in_transit_quantity", nullable = false)
    private Integer inTransitQuantity = 0;

    @Column(name = "remark", length = 500)
    private String remark;
}
