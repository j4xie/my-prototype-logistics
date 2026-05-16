package com.cretas.aims.dto.bom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Result of a batch operation (Sprint 3 Track-H).
 *
 * <p>Captures: created ECN id, per-recipe BomVersion DRAFT ids, skipped recipes (with reason),
 * accumulated warnings.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchResult {

    /** Operation discriminator: MODIFY / REPLACE / DELETE / ADD. */
    private String operation;

    /** Auto-created ECN DRAFT id. */
    private String ecnId;
    private String ecnNumber;

    /** Recipe ids resolved as affected scope. */
    @Builder.Default
    private List<String> affectedRecipeIds = new ArrayList<>();

    /** Created BomVersion DRAFT ids — one per affected recipe. Key = recipeId, value = versionId. */
    @Builder.Default
    private Map<String, String> draftVersionIds = new LinkedHashMap<>();

    /** Recipes excluded with reason (e.g. "no item references material"). */
    @Builder.Default
    private Map<String, String> skippedRecipes = new LinkedHashMap<>();

    /** Free-form warnings accumulated during execution. */
    @Builder.Default
    private List<String> warnings = new ArrayList<>();
}
