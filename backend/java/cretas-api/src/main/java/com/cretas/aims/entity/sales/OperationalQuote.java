package com.cretas.aims.entity.sales;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.security.PriceSensitive;
import lombok.*;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.hibernate.annotations.Where;

/**
 * 销售运营报价单 — V3 P0-4 (会议 1670-1750s).
 *
 * <h3>客户原话锚点</h3>
 * <ul>
 *   <li>"报价管理就是我们这边样品过了以后, 像类似于提交一个审批, 对应的人员去报价的"</li>
 *   <li>"运营报完价以后那个调过去审批审批完 ok 没问题, 然后给到销售这边" — <b>三段式</b>:
 *       提交 → 录价 → 审批 → 销售可下单</li>
 *   <li>"我们这边叫销售运营部, 这个报价也是他们做" — 报价归属销售运营部</li>
 *   <li>"我们这边肯定是以人员做那个, 一般是指定人员, 不是说指定岗位" — <b>必须指定到人</b></li>
 *   <li>"有些是固定报价的, 有些不是固定报价" — quoteType 区分 FIXED / NEGOTIABLE</li>
 * </ul>
 *
 * <h3>状态机</h3>
 * <pre>
 *   DRAFT → PENDING_QUOTE → PENDING_APPROVAL → APPROVED ↗
 *                                           ↘ REJECTED → (revise) → PENDING_QUOTE
 *                                                                  → EXPIRED (validUntil 过期自动)
 * </pre>
 *
 * @author Cretas Team
 * @since 2026-04-07 (V3 P0-4 / Round 2 Agent B)
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "operational_quotes",
        indexes = {
                @Index(name = "idx_oq_factory_status", columnList = "factory_id,status"),
                @Index(name = "idx_oq_customer", columnList = "customer_id"),
                @Index(name = "idx_oq_product", columnList = "product_type_id"),
                @Index(name = "idx_oq_quoted_by", columnList = "quoted_by_user_id"),
                @Index(name = "idx_oq_factory_quote_no", columnList = "factory_id,quote_no", unique = true)
        })
@Where(clause = "deleted_at IS NULL")
public class OperationalQuote extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) id = UUID.randomUUID().toString();
    }

    @Column(name = "factory_id", nullable = false, length = 191)
    private String factoryId;

    /** 报价单号: QT-YYYYMMDD-NNNN */
    @Column(name = "quote_no", nullable = false, length = 50)
    private String quoteNo;

    /** 关联研发样品 (报价由样品驱动) */
    @Column(name = "sample_id", length = 191)
    private String sampleId;

    /** 关联客户 */
    @Column(name = "customer_id", length = 191)
    private String customerId;

    /** 关联产品 */
    @Column(name = "product_type_id", length = 191)
    private String productTypeId;

    /** 关联 BOM (用于成本参考) */
    @Column(name = "bom_id", length = 191)
    private String bomId;

    // ════════════════════════════════════════════════════════
    // 报价核心
    // ════════════════════════════════════════════════════════

    /** 报价类型: FIXED (固定报价) / NEGOTIABLE (可议价) */
    @Column(name = "quote_type", length = 20)
    private String quoteType;

    /** 单价 (含税) */
    @PriceSensitive
    @Column(name = "unit_price", precision = 15, scale = 2)
    private BigDecimal unitPrice;

    /** 计量单位: kg / 箱 / 件 / 包 */
    @Column(name = "unit", length = 20)
    private String unit;

    /** 最小起订量 */
    @Column(name = "min_order_qty", precision = 15, scale = 3)
    private BigDecimal minOrderQty;

    /** 成本单价 (BOM 成本快照, 内部参考, 不展示给客户) */
    @PriceSensitive
    @Column(name = "cost_price", precision = 15, scale = 2)
    private BigDecimal costPrice;

    /** 毛利率 (内部) */
    @PriceSensitive
    @Column(name = "margin_rate", precision = 6, scale = 4)
    private BigDecimal marginRate;

    /** 有效期截止日期 — 过期后状态自动 EXPIRED */
    @Column(name = "valid_until")
    private LocalDate validUntil;

    // ════════════════════════════════════════════════════════
    // 状态机 + 指派人 (核心: 必须到人, 不到岗位)
    // ════════════════════════════════════════════════════════

    /** DRAFT / PENDING_QUOTE / PENDING_APPROVAL / APPROVED / REJECTED / EXPIRED */
    @Column(name = "status", nullable = false, length = 30)
    private String status;

    /** 销售运营录价人 (具体的人, 不是岗位) */
    @Column(name = "quoted_by_user_id")
    private Long quotedByUserId;

    /** 销售运营录价人姓名 (冗余便于显示) */
    @Column(name = "quoted_by_name", length = 100)
    private String quotedByName;

    @Column(name = "quoted_at")
    private LocalDateTime quotedAt;

    /** 销售运营主管审批人 (具体的人) */
    @Column(name = "approver_user_id")
    private Long approverUserId;

    @Column(name = "approver_name", length = 100)
    private String approverName;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    /** 驳回原因 */
    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    // ════════════════════════════════════════════════════════
    // 其他
    // ════════════════════════════════════════════════════════

    /** 提交人 (研发或销售) */
    @Column(name = "submitted_by_user_id")
    private Long submittedByUserId;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    /** 备注 */
    @Column(name = "remarks", columnDefinition = "TEXT")
    private String remarks;

    /** 修订次数 (客户砍价 → 重新报价 +1) */
    @Column(name = "revision_count")
    private Integer revisionCount = 0;
}
