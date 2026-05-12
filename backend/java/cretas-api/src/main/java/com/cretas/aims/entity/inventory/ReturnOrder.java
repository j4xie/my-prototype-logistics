package com.cretas.aims.entity.inventory;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.enums.ReturnOrderStatus;
import com.cretas.aims.entity.enums.ReturnType;
import com.cretas.aims.security.PriceSensitive;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.Where;

@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"items"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "return_orders",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"factory_id", "return_number"})
        },
        indexes = {
                @Index(name = "idx_ro_factory", columnList = "factory_id"),
                @Index(name = "idx_ro_type", columnList = "return_type"),
                @Index(name = "idx_ro_status", columnList = "status"),
                @Index(name = "idx_ro_counterparty", columnList = "counterparty_id"),
                @Index(name = "idx_ro_return_date", columnList = "return_date")
        }
)
@Where(clause = "deleted_at IS NULL")
public class ReturnOrder extends BaseEntity {

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
    @Column(name = "factory_id", nullable = false)
    private String factoryId;

    @NotBlank
    @Column(name = "return_number", nullable = false, length = 50)
    private String returnNumber;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "return_type", nullable = false, length = 32)
    private ReturnType returnType;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ReturnOrderStatus status = ReturnOrderStatus.DRAFT;

    @NotBlank
    @Column(name = "counterparty_id", nullable = false, length = 191)
    private String counterpartyId;

    @Column(name = "source_order_id", length = 191)
    private String sourceOrderId;

    @NotNull
    @Column(name = "return_date", nullable = false)
    private LocalDate returnDate;

    @PriceSensitive
    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    @Version
    @Column(name = "version")
    private Long version;

    // ==================== 关联 ====================

    @OneToMany(mappedBy = "returnOrder", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ReturnOrderItem> items = new ArrayList<>();

    // ==================== 计算属性 ====================

    @Transient
    public BigDecimal calculateTotalAmount() {
        if (items == null || items.isEmpty()) return BigDecimal.ZERO;
        // Defensive: items[].getLineAmount() may return null when unitPrice/lineAmount
        // are @PriceSensitive-stripped (PR #443 F2 fix). Filter nulls so reduce doesn't
        // NPE on BigDecimal::add — mirrors SalesOrder.calculateTotalAmount.
        return items.stream()
                .map(ReturnOrderItem::getLineAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
