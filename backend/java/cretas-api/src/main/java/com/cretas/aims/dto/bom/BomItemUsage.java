package com.cretas.aims.dto.bom;

import com.cretas.aims.security.PriceSensitive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Result row for {@code BomReverseQueryService.findUsageByMaterial} (Sprint 3 Track-H).
 *
 * <p>One row per BomRecipeItem matching a given material; recipe header denormalized.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BomItemUsage {

    /** BomRecipe.id. */
    private String recipeId;

    /** BomRecipe.recipeCode (BOM-YYYYMMDD-NNN). */
    private String recipeCode;

    /** BomRecipe.productTypeId. */
    private String productTypeId;

    /** BomRecipe.productName. */
    private String productName;

    /** BomRecipe.version. */
    private Integer version;

    /** True if BomRecipe.isCurrent — i.e. live BOM. */
    private Boolean isCurrent;

    /** BomRecipeItem.id. */
    private Long itemId;

    /** Standard quantity (per output unit). */
    private BigDecimal standardQuantity;

    /** Per-item yield rate 0-100. */
    private BigDecimal yieldRate;

    /** Computed actual qty after yield折算. */
    private BigDecimal actualQuantity;

    /** Unit (g/kg/etc). */
    private String unit;

    /** Material category: RAW / AUXILIARY / PACKAGING. */
    private String materialCategory;

    /** Optional flag (decorative items不影响生产). */
    private Boolean isOptional;

    /** Substitute group (group code if interchangeable across materials). */
    private String substituteGroup;

    /** Item cost — @PriceSensitive, stripped for non-procurement-price roles. */
    @PriceSensitive
    private BigDecimal itemCost;

    /** Unit price — @PriceSensitive. */
    @PriceSensitive
    private BigDecimal unitPrice;
}
