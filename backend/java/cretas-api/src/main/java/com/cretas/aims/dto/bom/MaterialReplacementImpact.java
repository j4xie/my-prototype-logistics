package com.cretas.aims.dto.bom;

import com.cretas.aims.security.PriceSensitive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Report returned by {@code BomReverseQueryService.analyzeReplacement} (Sprint 3 Track-H).
 *
 * <p>For each affected BomRecipe, captures the before/after cost diff if old material
 * were replaced with new. Useful for: cost-optimization ECN proposals, material-discontinue
 * substitution analysis, supplier change impact assessment.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaterialReplacementImpact {

    private String oldMaterialId;
    private String newMaterialId;
    private String oldMaterialName;
    private String newMaterialName;

    /** Old material's unit price (null if not available / RBAC stripped). */
    @PriceSensitive
    private BigDecimal oldUnitPrice;

    /** New material's unit price. */
    @PriceSensitive
    private BigDecimal newUnitPrice;

    /** Number of distinct BomRecipes affected. */
    @Builder.Default
    private int affectedRecipeCount = 0;

    /** Number of distinct BomRecipeItem rows affected. */
    @Builder.Default
    private int affectedItemCount = 0;

    /** Sum of (newCost - oldCost) across all affected items. Positive = net cost increase. */
    @PriceSensitive
    @Builder.Default
    private BigDecimal totalCostDelta = BigDecimal.ZERO;

    /** Per-recipe breakdown. */
    @Builder.Default
    private List<RecipeImpact> recipeBreakdown = new ArrayList<>();

    /** Warnings (e.g. "newMaterial has no unit_price; cost diff cannot be computed"). */
    @Builder.Default
    private List<String> warnings = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecipeImpact {
        private String recipeId;
        private String recipeCode;
        private String productName;
        private Integer version;
        private Boolean isCurrent;

        @PriceSensitive
        private BigDecimal oldRecipeMaterialCost;
        @PriceSensitive
        private BigDecimal newRecipeMaterialCost;
        @PriceSensitive
        private BigDecimal costDelta;
    }
}
