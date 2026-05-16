package com.cretas.aims.repository.bom;

import com.cretas.aims.entity.bom.EngineeringChangeNotice;
import com.cretas.aims.entity.bom.EngineeringChangeNotice.EcnStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * EngineeringChangeNotice Repository (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Repository
public interface EngineeringChangeNoticeRepository extends JpaRepository<EngineeringChangeNotice, String> {

    /** Lookup by ECN number (unique per factory). */
    Optional<EngineeringChangeNotice> findByFactoryIdAndEcnNumber(String factoryId, String ecnNumber);

    /** All ECNs for a recipe, newest first. */
    List<EngineeringChangeNotice> findByFactoryIdAndBomRecipeIdOrderByCreatedAtDesc(
            String factoryId, String bomRecipeId);

    /** ECNs in given status (e.g. SUBMITTED → approval-pending dashboard). */
    List<EngineeringChangeNotice> findByFactoryIdAndStatus(String factoryId, EcnStatus status);

    /**
     * Count ECNs created within a given year prefix; used for {@code ECN-YYYY-NNNN}
     * auto-numbering.
     *
     * @param factoryId factory scope
     * @param prefix    e.g. {@code "ECN-2026-%"}
     */
    @Query("SELECT COUNT(e) FROM EngineeringChangeNotice e " +
           "WHERE e.factoryId = :factoryId AND e.ecnNumber LIKE :prefix")
    long countByEcnNumberPrefix(@Param("factoryId") String factoryId,
                                 @Param("prefix") String prefix);

    /**
     * ECNs whose effectiveDate is on or before the given date and still in the given status —
     * candidates for transition (e.g. APPROVED → EFFECTIVE).
     */
    @Query("SELECT e FROM EngineeringChangeNotice e " +
           "WHERE e.factoryId = :factoryId " +
           "AND e.status = :status " +
           "AND e.effectiveDate IS NOT NULL " +
           "AND e.effectiveDate <= :asOf")
    List<EngineeringChangeNotice> findDueForActivation(@Param("factoryId") String factoryId,
                                                        @Param("status") EcnStatus status,
                                                        @Param("asOf") LocalDate asOf);
}
