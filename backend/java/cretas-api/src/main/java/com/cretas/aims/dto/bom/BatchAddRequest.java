package com.cretas.aims.dto.bom;

import com.cretas.aims.entity.bom.EngineeringChangeNotice.EcnReason;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Batch-add request: 多 BOM 同时加一物料 (e.g. 全产品加 0.5g 防腐剂) — Sprint 3 Track-H.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchAddRequest {

    @NotBlank private String factoryId;
    @NotBlank private String materialId;

    /** Standard quantity on each affected BomRecipeItem (per output unit). */
    @NotNull private BigDecimal standardQuantity;

    /** Optional yield rate 0-100 (default 100). */
    private BigDecimal yieldRate;

    @NotBlank private String unit;

    /** RAW / AUXILIARY / PACKAGING (default RAW). */
    private String materialCategory;

    /** Skip recipe if it already contains this material (default true; false = double-add). */
    @Builder.Default private boolean skipIfAlreadyPresent = true;

    @Builder.Default private boolean allInFactory = false;
    private List<String> recipeIds;

    @NotNull private EcnReason ecnReason;
    private String ecnReasonDetail;
    private LocalDate effectiveDate;
    private Long createdBy;
}
