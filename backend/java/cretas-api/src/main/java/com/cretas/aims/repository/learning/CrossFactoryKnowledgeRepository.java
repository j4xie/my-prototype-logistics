package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.CrossFactoryKnowledge;
import com.cretas.aims.entity.learning.CrossFactoryKnowledge.KnowledgeType;
import com.cretas.aims.entity.learning.CrossFactoryKnowledge.PromotionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Repository for CrossFactoryKnowledge entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface CrossFactoryKnowledgeRepository extends JpaRepository<CrossFactoryKnowledge, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find by content hash
     */
    Optional<CrossFactoryKnowledge> findByKnowledgeTypeAndIntentCodeAndContentHash(
            KnowledgeType type, String intentCode, String contentHash);

    /**
     * Find by intent code
     */
    List<CrossFactoryKnowledge> findByIntentCode(String intentCode);

    /**
     * Find by source factory
     */
    List<CrossFactoryKnowledge> findBySourceFactoryId(String factoryId);

    /**
     * Find by promotion status
     */
    List<CrossFactoryKnowledge> findByPromotionStatus(PromotionStatus status);

    // ==================== Global Knowledge Queries ====================

    /**
     * Find global knowledge for an intent
     */
    @Query("SELECT k FROM CrossFactoryKnowledge k " +
           "WHERE k.intentCode = :intentCode " +
           "AND k.promotionStatus = 'GLOBAL' " +
           "ORDER BY k.effectivenessScore DESC")
    List<CrossFactoryKnowledge> findGlobalKnowledgeForIntent(
            @Param("intentCode") String intentCode);

    /**
     * Find all global keywords
     */
    @Query("SELECT k FROM CrossFactoryKnowledge k " +
           "WHERE k.knowledgeType = 'KEYWORD' " +
           "AND k.promotionStatus = 'GLOBAL' " +
           "ORDER BY k.effectivenessScore DESC")
    List<CrossFactoryKnowledge> findAllGlobalKeywords();

    /**
     * Find candidates for promotion
     */
    @Query("SELECT k FROM CrossFactoryKnowledge k " +
           "WHERE k.promotionStatus = 'LOCAL' " +
           "AND k.effectivenessScore >= :minEffectiveness " +
           "AND k.adoptionCount >= :minAdoptions " +
           "ORDER BY k.effectivenessScore DESC, k.adoptionCount DESC")
    List<CrossFactoryKnowledge> findPromotionCandidates(
            @Param("minEffectiveness") BigDecimal minEffectiveness,
            @Param("minAdoptions") int minAdoptions);

    // ==================== Effectiveness Queries ====================

    /**
     * Find high effectiveness knowledge
     */
    @Query("SELECT k FROM CrossFactoryKnowledge k " +
           "WHERE k.effectivenessScore >= :threshold " +
           "ORDER BY k.effectivenessScore DESC")
    List<CrossFactoryKnowledge> findHighEffectivenessKnowledge(
            @Param("threshold") BigDecimal threshold);

    /**
     * Find low effectiveness knowledge for deprecation
     */
    @Query("SELECT k FROM CrossFactoryKnowledge k " +
           "WHERE k.effectivenessScore < :threshold " +
           "AND (k.positiveFeedbackCount + k.negativeFeedbackCount) >= :minFeedback " +
           "AND k.promotionStatus != 'DEPRECATED'")
    List<CrossFactoryKnowledge> findForDeprecation(
            @Param("threshold") BigDecimal threshold,
            @Param("minFeedback") int minFeedback);

    // ==================== Search ====================

    /**
     * Search knowledge by content
     */
    @Query("SELECT k FROM CrossFactoryKnowledge k " +
           "WHERE k.content LIKE :pattern " +
           "AND k.promotionStatus IN ('LOCAL', 'CANDIDATE', 'GLOBAL')")
    List<CrossFactoryKnowledge> searchByContent(@Param("pattern") String pattern);

    /**
     * Find knowledge not yet adopted by a factory
     */
    @Query("SELECT k FROM CrossFactoryKnowledge k " +
           "WHERE k.promotionStatus = 'GLOBAL' " +
           "AND k.id NOT IN (SELECT a.knowledgeId FROM CrossFactoryKnowledgeAdoption a " +
           "                 WHERE a.factoryId = :factoryId AND a.isActive = true)")
    List<CrossFactoryKnowledge> findNotAdoptedByFactory(@Param("factoryId") String factoryId);

    // ==================== Statistics ====================

    /**
     * Count by promotion status
     */
    long countByPromotionStatus(PromotionStatus status);

    /**
     * Count by knowledge type and status
     */
    long countByKnowledgeTypeAndPromotionStatus(KnowledgeType type, PromotionStatus status);

    /**
     * Get average effectiveness by intent
     */
    @Query("SELECT AVG(k.effectivenessScore) FROM CrossFactoryKnowledge k " +
           "WHERE k.intentCode = :intentCode " +
           "AND k.promotionStatus = 'GLOBAL'")
    BigDecimal getAverageEffectivenessByIntent(@Param("intentCode") String intentCode);

    // ==================== Updates ====================

    /**
     * Update effectiveness score
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledge k " +
           "SET k.effectivenessScore = :score " +
           "WHERE k.id = :id")
    int updateEffectivenessScore(
            @Param("id") Long id,
            @Param("score") BigDecimal score);

    /**
     * Increment adoption count
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledge k " +
           "SET k.adoptionCount = k.adoptionCount + 1 " +
           "WHERE k.id = :id")
    int incrementAdoptionCount(@Param("id") Long id);

    /**
     * Update promotion status
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledge k " +
           "SET k.promotionStatus = :status " +
           "WHERE k.id = :id")
    int updatePromotionStatus(
            @Param("id") Long id,
            @Param("status") PromotionStatus status);

    // ==================== Pagination ====================

    /**
     * Find with pagination
     */
    Page<CrossFactoryKnowledge> findByPromotionStatusOrderByEffectivenessScoreDesc(
            PromotionStatus status, Pageable pageable);
}
