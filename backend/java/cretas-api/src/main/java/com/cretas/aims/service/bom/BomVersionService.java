package com.cretas.aims.service.bom;

import com.cretas.aims.entity.bom.BomVersion;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * BomVersionService (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * <p>Independent row-per-approval companion to {@link BomRecipeService}. BomRecipe.version
 * Integer + isCurrent Boolean kept for 6-month transition; BomVersion is the source-of-truth
 * for historical audit.
 *
 * <p>State machine: {@code DRAFT → PENDING_APPROVAL → APPROVED → OBSOLETE}. Reject sets
 * {@code REJECTED} (terminal). DB-level partial unique {@code uq_bv_one_current_per_recipe}
 * + trigger {@code trg_bom_version_supersede} provide defense-in-depth; service layer also
 * syncs {@link com.cretas.aims.entity.bom.BomRecipe#getIsCurrent()} for double-write
 * compatibility.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
public interface BomVersionService {

    /**
     * Create a DRAFT BomVersion from the current state of {@link com.cretas.aims.entity.bom.BomRecipe}.
     * versionNumber = max(versionNumber)+1 for that recipe. snapshotJson captures full recipe+items.
     */
    BomVersion createDraft(String factoryId, String bomRecipeId, Long createdBy);

    /**
     * Create a DRAFT BomVersion with a caller-supplied snapshot (typically the result of an
     * in-memory transformation by {@code BomBatchOperationService}). versionNumber assigned
     * automatically (max+1).
     */
    BomVersion createDraftWithSnapshot(String factoryId, String bomRecipeId,
                                        java.util.Map<String, Object> snapshot, Long createdBy);

    /** DRAFT → PENDING_APPROVAL. Sets ecnId link (nullable: manual versions skip ECN). */
    BomVersion submitForApproval(String factoryId, String versionId, String ecnId);

    /**
     * PENDING_APPROVAL → APPROVED. Sets effective_from=today, approvedBy, approvedAt. DB trigger
     * auto-supersedes prior APPROVED row (effective_to=today-1, status=OBSOLETE). Service layer
     * also flips {@link com.cretas.aims.entity.bom.BomRecipe#getIsCurrent()} to keep parity.
     */
    BomVersion approve(String factoryId, String versionId, Long approverId);

    /** PENDING_APPROVAL → REJECTED. Sets rejectionReason. Terminal — must createDraft anew. */
    BomVersion reject(String factoryId, String versionId, Long approverId, String reason);

    /** Current effective version (status=APPROVED + effective_to IS NULL). */
    Optional<BomVersion> getCurrent(String factoryId, String bomRecipeId);

    /** All versions for a recipe, newest first. */
    List<BomVersion> getHistory(String factoryId, String bomRecipeId);

    /**
     * Version effective at a specific historical date (order追溯). Returns version where
     * effective_from ≤ date ≤ coalesce(effective_to, today).
     */
    Optional<BomVersion> getEffectiveAt(String factoryId, String bomRecipeId, LocalDate date);

    /** Lookup by id. Throws {@code EntityNotFoundException} if absent / wrong factory. */
    BomVersion getById(String factoryId, String versionId);
}
