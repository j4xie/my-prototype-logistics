package com.cretas.aims.entity.purchase;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.enums.InquiryQuoteStatus;
import com.cretas.aims.security.PriceSensitive;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.Formula;
import org.hibernate.annotations.Where;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 核价单实体 (P-NUCLEAR-1, 28-Backlog #30).
 *
 * <p>询价 → 核价 → 采购 三阶段 pipeline:
 * <ol>
 *   <li>buyer 创建 InquiryQuote (产品 + 数量 + 期望到货)</li>
 *   <li>suppliers 提交 {@link InquiryQuoteSupplierPrice} 报价</li>
 *   <li>buyer 选定中标供应商 + 转化为 PurchaseOrder</li>
 * </ol>
 *
 * <p>防呆 R4 (idempotent): 一个 inquiry 只能 convertToPurchaseOrder 一次 —
 * status=CONVERTED + purchaseOrderId 非空时拒绝重复转换.
 *
 * @author Cretas Team
 * @since 2026-05-17
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"supplierPrices"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "inquiry_quotes",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"factory_id", "inquiry_number"})
        },
        indexes = {
                @Index(name = "idx_iq_factory", columnList = "factory_id"),
                @Index(name = "idx_iq_status", columnList = "status"),
                @Index(name = "idx_iq_inquiry_date", columnList = "inquiry_date"),
                @Index(name = "idx_iq_material", columnList = "material_type_id"),
                @Index(name = "idx_iq_po", columnList = "purchase_order_id")
        }
)
@Where(clause = "deleted_at IS NULL")
public class InquiryQuote extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    @NotBlank(message = "工厂不能为空")
    @Column(name = "factory_id", nullable = false)
    private String factoryId;

    @NotBlank(message = "核价单号不能为空")
    @Column(name = "inquiry_number", nullable = false, length = 50)
    private String inquiryNumber;

    /** 询价标题 / 简述 (e.g. "Q2 辣椒采购询价") */
    @Column(name = "title", length = 200)
    private String title;

    /** 询价物料类型 ID — references raw_material_types.id (跟 PurchaseOrderItem.materialTypeId 同字段) */
    @NotBlank(message = "物料类型不能为空")
    @Column(name = "material_type_id", nullable = false, length = 191)
    private String materialTypeId;

    /** 物料名称冗余 (方便列表展示, 防呆 R2 context) */
    @Column(name = "material_name", length = 200)
    private String materialName;

    /** 规格 (可选) */
    @Column(name = "specification", length = 200)
    private String specification;

    @NotNull(message = "询价数量不能为空")
    @Positive(message = "询价数量必须 > 0")
    @Column(name = "quantity", nullable = false, precision = 15, scale = 4)
    private BigDecimal quantity;

    @NotBlank(message = "单位不能为空")
    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    @NotNull(message = "询价日期不能为空")
    @Column(name = "inquiry_date", nullable = false)
    private LocalDate inquiryDate;

    /** 期望到货日期 */
    @Column(name = "required_date")
    private LocalDate requiredDate;

    @NotNull(message = "状态不能为空")
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private InquiryQuoteStatus status = InquiryQuoteStatus.DRAFT;

    /** 中标供应商 ID (selectAndConvert 后填充) */
    @Column(name = "selected_supplier_id", length = 191)
    private String selectedSupplierId;

    /** 中标价格 (selectAndConvert 后填充) */
    @PriceSensitive
    @Column(name = "selected_unit_price", precision = 15, scale = 4)
    private BigDecimal selectedUnitPrice;

    /** 转换后的采购单 ID (idempotent 关键字段) */
    @Column(name = "purchase_order_id", length = 191)
    private String purchaseOrderId;

    /** 转换后的采购单号 (冗余, 防呆 R2 context) */
    @Column(name = "purchase_order_number", length = 50)
    private String purchaseOrderNumber;

    /** 中标供应商名称 (Formula 查询, 列表展示用) */
    @Formula("(SELECT s.name FROM suppliers s WHERE s.id = selected_supplier_id)")
    private String selectedSupplierName;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    /** Optimistic lock version — prevents silent last-write-wins on concurrent edits */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    // ==================== 关联 ====================

    @JsonIgnore
    @OneToMany(mappedBy = "inquiryQuote", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<InquiryQuoteSupplierPrice> supplierPrices = new ArrayList<>();
}
