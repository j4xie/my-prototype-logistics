package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.PurchaseReceiveStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 采购入库单
 * 对应一次到货验收入库操作，入库确认后创建 MaterialBatch
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "purchaseOrder", "supplier", "receivedByUser", "items"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "purchase_receive_records",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"factory_id", "receive_number"})
        },
        indexes = {
                @Index(name = "idx_prr_factory", columnList = "factory_id"),
                @Index(name = "idx_prr_po", columnList = "purchase_order_id"),
                @Index(name = "idx_prr_supplier", columnList = "supplier_id"),
                @Index(name = "idx_prr_date", columnList = "receive_date"),
                @Index(name = "idx_prr_status", columnList = "status")
        }
)
public class PurchaseReceiveRecord extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    @Column(name = "factory_id", nullable = false)
    private String factoryId;

    @Column(name = "receive_number", nullable = false, length = 50)
    private String receiveNumber;

    @Column(name = "purchase_order_id", length = 191)
    private String purchaseOrderId;

    @Column(name = "supplier_id", nullable = false, length = 191)
    private String supplierId;

    @Column(name = "receive_date", nullable = false)
    private LocalDate receiveDate;

    /** 预留：仓库ID（P3 启用） */
    @Column(name = "warehouse_id", length = 191)
    private String warehouseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private PurchaseReceiveStatus status = PurchaseReceiveStatus.DRAFT;

    @Column(name = "received_by", nullable = false)
    private Long receivedBy;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    // ==================== 关联 ====================

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id", referencedColumnName = "id", insertable = false, updatable = false)
    private PurchaseOrder purchaseOrder;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Supplier supplier;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "received_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User receivedByUser;

    @OneToMany(mappedBy = "receiveRecord", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<PurchaseReceiveItem> items = new ArrayList<>();
}
