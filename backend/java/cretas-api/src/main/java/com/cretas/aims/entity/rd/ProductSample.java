package com.cretas.aims.entity.rd;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 样品档案 — 研发人员创建并追踪样品开发过程
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "product_samples",
        indexes = {
                @Index(name = "idx_ps_factory", columnList = "factory_id"),
                @Index(name = "idx_ps_request", columnList = "rd_request_id"),
                @Index(name = "idx_ps_status", columnList = "status")
        })
public class ProductSample extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 191)
    private String id;

    @PrePersist
    void assignUUID() { if (id == null) id = UUID.randomUUID().toString(); }

    @Column(name = "factory_id", nullable = false, length = 191)
    private String factoryId;

    @Column(name = "sample_code", nullable = false, length = 50)
    private String sampleCode;

    @Column(name = "rd_request_id", length = 191)
    private String rdRequestId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "specification", length = 200)
    private String specification;

    @Column(name = "grade", length = 50)
    private String grade;

    @Column(name = "main_material", length = 200)
    private String mainMaterial;

    /** DRAFT / IN_PROGRESS / TESTING / SUBMITTED / APPROVED / REJECTED */
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    /** 进度记录 (JSON array: [{time, note, photoUrl}]) */
    @Column(name = "progress_notes", columnDefinition = "TEXT")
    private String progressNotes;

    /** 样品照片URLs (JSON array) */
    @Column(name = "photo_urls", columnDefinition = "TEXT")
    private String photoUrls;

    @Column(name = "assigned_to")
    private Long assignedTo;

    @Column(name = "submitted_by")
    private Long submittedBy;

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "approval_notes", columnDefinition = "TEXT")
    private String approvalNotes;

    /** 审核通过后关联生成的 ProductType ID */
    @Column(name = "product_type_id", length = 191)
    private String productTypeId;

    /** 审核通过后自动生成的 BOM ID (bom_items 的 product_type_id) */
    @Column(name = "bom_product_type_id", length = 191)
    private String bomProductTypeId;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    /** 产品级别: A / B / C / D */
    @Column(name = "product_level", length = 10)
    private String productLevel;

    /** 客户名称 */
    @Column(name = "customer_name", length = 200)
    private String customerName;

    /** 业务员 */
    @Column(name = "salesperson", length = 100)
    private String salesperson;

    /** 储存方式: 冷冻 / 冷藏 / 常温 */
    @Column(name = "storage_method", length = 50)
    private String storageMethod;
}
