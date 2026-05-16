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
 * Batch-modify request: 多 BOM 同一物料的 standard_quantity 批量改 (Sprint 3 Track-H).
 *
 * <p>Either {@code recipeIds} (subset) or {@code allInFactory=true} (full factory scope).
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchModifyRequest {

    @NotBlank private String factoryId;
    @NotBlank private String materialId;

    /** New standardQuantity to set on each affected BomRecipeItem. */
    @NotNull  private BigDecimal newStandardQuantity;

    /** Optional new unit. null = preserve existing. */
    private String newUnit;

    /** If true, all factory BOMs containing materialId — otherwise restrict to {@link #recipeIds}. */
    @Builder.Default private boolean allInFactory = false;

    /** Subset of recipe ids (ignored when allInFactory=true). */
    private List<String> recipeIds;

    @NotNull private EcnReason ecnReason;
    private String ecnReasonDetail;
    private LocalDate effectiveDate;
    private Long createdBy;
}
