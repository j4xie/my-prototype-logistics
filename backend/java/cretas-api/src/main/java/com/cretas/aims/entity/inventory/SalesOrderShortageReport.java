package com.cretas.aims.entity.inventory;

import com.cretas.aims.dto.orchestration.LineItemMatch;
import com.cretas.aims.dto.orchestration.MaterialRequirement;
import com.cretas.aims.dto.orchestration.MaterialShortfall;
import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.service.shortage.dto.ProcurementSuggestion;
import com.cretas.aims.service.shortage.dto.ProductionPlanSuggestion;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.Where;

import java.util.List;
import java.util.UUID;

/**
 * 销售订单缺料分析报告 (Sprint 2 Track E — S-MRP-1 / N31)
 *
 * <p>由 {@code SalesOrderShortageReportListener} 在
 * {@link com.cretas.aims.event.SalesOrderFinanceApprovedEvent} 发布后异步生成。
 * 表设计见 {@code V20260601_01__sales_order_shortage_report.sql}。
 *
 * <p>同 (factory_id, sales_order_id) 一单一报告 — 重复审批时覆盖旧记录。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "sales_order_shortage_report",
        indexes = {
                @Index(name = "idx_sosr_factory_sales", columnList = "factory_id,sales_order_id"),
                @Index(name = "idx_sosr_factory_status", columnList = "factory_id,analysis_status")
        }
)
@Where(clause = "deleted_at IS NULL")
public class SalesOrderShortageReport extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @PrePersist
    void assignUUID() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    @NotBlank
    @Column(name = "factory_id", nullable = false, length = 36)
    private String factoryId;

    @NotBlank
    @Column(name = "sales_order_id", nullable = false, length = 36)
    private String salesOrderId;

    /** PENDING (默认) / COMPLETED / FAILED */
    @Column(name = "analysis_status", nullable = false, length = 20)
    private String analysisStatus;

    /** BOM 原料需求 (聚合 by materialTypeId) */
    @Type(JsonBinaryType.class)
    @Column(name = "total_required", columnDefinition = "jsonb")
    private List<MaterialRequirement> totalRequired;

    /** FG 库存匹配 (每行 = 销售订单 SKU 行) */
    @Type(JsonBinaryType.class)
    @Column(name = "available", columnDefinition = "jsonb")
    private List<LineItemMatch> available;

    /** BOM 原料短缺 (驱动采购建议) */
    @Type(JsonBinaryType.class)
    @Column(name = "shortage", columnDefinition = "jsonb")
    private List<MaterialShortfall> shortage;

    @Type(JsonBinaryType.class)
    @Column(name = "procurement_suggestions", columnDefinition = "jsonb")
    private List<ProcurementSuggestion> procurementSuggestions;

    @Type(JsonBinaryType.class)
    @Column(name = "production_suggestions", columnDefinition = "jsonb")
    private List<ProductionPlanSuggestion> productionSuggestions;

    @Column(name = "analysis_summary", columnDefinition = "text")
    private String analysisSummary;
}
