package com.cretas.aims.repository.bom;

import com.cretas.aims.entity.bom.BomVersion;
import com.cretas.aims.entity.bom.BomVersion.VersionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * BomVersion Repository (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * <p>Companion to {@link com.cretas.aims.repository.bom.BomRecipeRepository}. BomVersion
 * is independent row per approval; BomRecipe.version Integer + isCurrent Boolean kept for
 * 6-month transition.
 *
 * <p>Enum filters bind as {@code @Param} (avoids JPQL nested-enum FQN ambiguity).
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Repository
public interface BomVersionRepository extends JpaRepository<BomVersion, String> {

    /** All versions for a recipe, newest first. */
    List<BomVersion> findByFactoryIdAndBomRecipeIdOrderByVersionNumberDesc(
            String factoryId, String bomRecipeId);

    /** Current effective version: status=APPROVED with effective_to IS NULL. */
    @Query("SELECT bv FROM BomVersion bv " +
           "WHERE bv.factoryId = :factoryId " +
           "AND bv.bomRecipeId = :bomRecipeId " +
           "AND bv.status = :status " +
           "AND bv.effectiveTo IS NULL")
    Optional<BomVersion> findCurrentInStatus(@Param("factoryId") String factoryId,
                                              @Param("bomRecipeId") String bomRecipeId,
                                              @Param("status") VersionStatus status);

    /**
     * Version effective at a specific historical date (order追溯).
     * Caller passes the eligible-status list (typically APPROVED + OBSOLETE).
     */
    @Query("SELECT bv FROM BomVersion bv " +
           "WHERE bv.factoryId = :factoryId " +
           "AND bv.bomRecipeId = :bomRecipeId " +
           "AND bv.status IN :statuses " +
           "AND bv.effectiveFrom IS NOT NULL " +
           "AND bv.effectiveFrom <= :date " +
           "AND (bv.effectiveTo IS NULL OR bv.effectiveTo >= :date)")
    Optional<BomVersion> findEffectiveAtInStatuses(@Param("factoryId") String factoryId,
                                                    @Param("bomRecipeId") String bomRecipeId,
                                                    @Param("date") LocalDate date,
                                                    @Param("statuses") Collection<VersionStatus> statuses);

    /** Max version number for a recipe (createDraft assigns max+1). */
    @Query("SELECT COALESCE(MAX(bv.versionNumber), 0) FROM BomVersion bv " +
           "WHERE bv.factoryId = :factoryId AND bv.bomRecipeId = :bomRecipeId")
    Integer findMaxVersionNumber(@Param("factoryId") String factoryId,
                                  @Param("bomRecipeId") String bomRecipeId);

    /** All versions in a given status (for batch monitoring / dashboards). */
    List<BomVersion> findByFactoryIdAndStatus(String factoryId, VersionStatus status);

    /** Versions tied to an ECN (cascade approval via ECN). */
    List<BomVersion> findByEcnId(String ecnId);
}
