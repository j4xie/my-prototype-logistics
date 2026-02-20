package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.TransferStatus;
import com.cretas.aims.entity.enums.TransferType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 内部调拨单
 * 总部↔分店/分厂 之间的物资调拨
 * 状态机: DRAFT → REQUESTED → APPROVED → SHIPPED → RECEIVED → CONFIRMED
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"sourceFactory", "targetFactory", "requestedByUser", "approvedByUser", "items"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "internal_transfers",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"source_factory_id", "transfer_number"})
        },
        indexes = {
                @Index(name = "idx_it_source", columnList = "source_factory_id"),
                @Index(name = "idx_it_target", columnList = "target_factory_id"),
                @Index(name = "idx_it_status", columnList = "status"),
                @Index(name = "idx_it_type", columnList = "transfer_type"),
                @Index(name = "idx_it_transfer_date", columnList = "transfer_date")
        }
)
public class InternalTransfer extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    @NotBlank
    @Column(name = "transfer_number", nullable = false, length = 50)
    private String transferNumber;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "transfer_type", nullable = false, length = 32)
    private TransferType transferType;

    /** 调出方工厂/门店ID */
    @NotBlank
    @Column(name = "source_factory_id", nullable = false, length = 191)
    private String sourceFactoryId;

    /** 调入方工厂/门店ID */
    @NotBlank
    @Column(name = "target_factory_id", nullable = false, length = 191)
    private String targetFactoryId;

    @Column(name = "transfer_date", nullable = false)
    private LocalDate transferDate;

    /** 期望到货日期 */
    @Column(name = "expected_arrival_date")
    private LocalDate expectedArrivalDate;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private TransferStatus status = TransferStatus.DRAFT;

    /** 申请人 */
    @Column(name = "requested_by")
    private Long requestedBy;

    @Column(name = "requested_at")
    private LocalDateTime requestedAt;

    /** 审批人 */
    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    /** 发货时间 */
    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    /** 签收时间 */
    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    /** 确认时间 */
    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    /** 驳回/取消原因 */
    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    // ==================== 关联 ====================

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory sourceFactory;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory targetFactory;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User requestedByUser;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User approvedByUser;

    @OneToMany(mappedBy = "transfer", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<InternalTransferItem> items = new ArrayList<>();
}
