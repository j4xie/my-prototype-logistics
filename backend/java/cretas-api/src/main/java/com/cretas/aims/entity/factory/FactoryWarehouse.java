package com.cretas.aims.entity.factory;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;
import org.hibernate.annotations.Where;

/**
 * 工厂仓库查询表 (P1-4, v1 §2.9 "双仓体系 - 物流仓 + 鲜棉仓").
 *
 * <p>客户原话 (会议 3225s):
 * <pre>
 * "我们这边是双仓体系, 物流仓 + 鲜棉仓, 鲜棉仓当天清仓, 不留原辅料"
 * </pre>
 *
 * <p><b>仅为查询表</b>: 提供 FactoryMaterialRequisition.sourceWarehouseId /
 * targetWarehouseId 字段的可读参考数据 (物流仓 / 鲜棉仓 等). 当前系统库存粒度
 * 仍为 factory 级 (MaterialBatch 无 warehouseId 字段), 此 entity 不参与 stock
 * query. 若未来引入 warehouse 维度库存管理 epic (见 docs/plans/p0-5-b2-warehouse-dimension-adr.md),
 * 此 entity 可扩展为真实仓库管理.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "factory_warehouses",
        indexes = {
                @Index(name = "idx_fw_factory", columnList = "factory_id"),
                @Index(name = "idx_fw_factory_type", columnList = "factory_id,type"),
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_fw_factory_code", columnNames = {"factory_id", "code"})
        }
)
@Where(clause = "deleted_at IS NULL")
public class FactoryWarehouse extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) id = UUID.randomUUID().toString();
    }

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    /** 仓库编码 (per-factory 唯一), 例如 "WH-LOG" / "WH-WKS". */
    @Column(name = "code", nullable = false, length = 32)
    private String code;

    /** 仓库名称, 例如 "物流仓" / "鲜棉仓". */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private WarehouseType type;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = Boolean.TRUE;

    @Column(name = "remarks", columnDefinition = "TEXT")
    private String remarks;

    /**
     * 仓库类型枚举.
     * <ul>
     *   <li>LOGISTICS - 物流仓 (长期存储)</li>
     *   <li>WORKSHOP - 鲜棉仓 / 车间仓 (当天清仓, 不留原辅料)</li>
     *   <li>OTHER - 其他 (扩展用)</li>
     * </ul>
     */
    public enum WarehouseType {
        LOGISTICS,
        WORKSHOP,
        OTHER
    }
}
