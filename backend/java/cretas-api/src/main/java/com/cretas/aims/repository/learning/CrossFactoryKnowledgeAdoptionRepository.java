package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.CrossFactoryKnowledgeAdoption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for CrossFactoryKnowledgeAdoption entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface CrossFactoryKnowledgeAdoptionRepository extends JpaRepository<CrossFactoryKnowledgeAdoption, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find by knowledge ID and factory ID
     */
    Optional<CrossFactoryKnowledgeAdoption> findByKnowledgeIdAndFactoryId(Long knowledgeId, String factoryId);

    /**
     * Find all adoptions for a knowledge
     */
    List<CrossFactoryKnowledgeAdoption> findByKnowledgeId(Long knowledgeId);

    /**
     * Find all adoptions for a factory
     */
    List<CrossFactoryKnowledgeAdoption> findByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * Count active adoptions for knowledge
     */
    long countByKnowledgeIdAndIsActiveTrue(Long knowledgeId);

    // ==================== Effectiveness Queries ====================

    /**
     * Find effective adoptions
     */
    @Query("SELECT a FROM CrossFactoryKnowledgeAdoption a " +
           "WHERE a.knowledgeId = :knowledgeId " +
           "AND a.isActive = true " +
           "AND a.localEffectivenessScore >= :minEffectiveness")
    List<CrossFactoryKnowledgeAdoption> findEffectiveAdoptions(
            @Param("knowledgeId") Long knowledgeId,
            @Param("minEffectiveness") BigDecimal minEffectiveness);

    /**
     * Find low effectiveness adoptions
     */
    @Query("SELECT a FROM CrossFactoryKnowledgeAdoption a " +
           "WHERE a.factoryId = :factoryId " +
           "AND a.isActive = true " +
           "AND a.localEffectivenessScore < :threshold " +
           "AND (a.localPositiveCount + a.localNegativeCount) >= :minFeedback")
    List<CrossFactoryKnowledgeAdoption> findLowEffectivenessAdoptions(
            @Param("factoryId") String factoryId,
            @Param("threshold") BigDecimal threshold,
            @Param("minFeedback") int minFeedback);

    /**
     * Get average effectiveness for knowledge
     */
    @Query("SELECT AVG(a.localEffectivenessScore) FROM CrossFactoryKnowledgeAdoption a " +
           "WHERE a.knowledgeId = :knowledgeId " +
           "AND a.isActive = true " +
           "AND a.localEffectivenessScore IS NOT NULL")
    BigDecimal getAverageEffectiveness(@Param("knowledgeId") Long knowledgeId);

    // ==================== Statistics ====================

    /**
     * Count factories using knowledge
     */
    @Query("SELECT COUNT(DISTINCT a.factoryId) FROM CrossFactoryKnowledgeAdoption a " +
           "WHERE a.knowledgeId = :knowledgeId " +
           "AND a.isActive = true")
    long countFactoriesUsingKnowledge(@Param("knowledgeId") Long knowledgeId);

    /**
     * Get total feedback counts for knowledge
     */
    @Query("SELECT SUM(a.localPositiveCount), SUM(a.localNegativeCount) " +
           "FROM CrossFactoryKnowledgeAdoption a " +
           "WHERE a.knowledgeId = :knowledgeId " +
           "AND a.isActive = true")
    List<Object[]> getTotalFeedbackCounts(@Param("knowledgeId") Long knowledgeId);

    // ==================== Updates ====================

    /**
     * Record positive feedback
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledgeAdoption a " +
           "SET a.localPositiveCount = a.localPositiveCount + 1 " +
           "WHERE a.knowledgeId = :knowledgeId " +
           "AND a.factoryId = :factoryId")
    int recordPositiveFeedback(
            @Param("knowledgeId") Long knowledgeId,
            @Param("factoryId") String factoryId);

    /**
     * Record negative feedback
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledgeAdoption a " +
           "SET a.localNegativeCount = a.localNegativeCount + 1 " +
           "WHERE a.knowledgeId = :knowledgeId " +
           "AND a.factoryId = :factoryId")
    int recordNegativeFeedback(
            @Param("knowledgeId") Long knowledgeId,
            @Param("factoryId") String factoryId);

    /**
     * Update local effectiveness
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledgeAdoption a " +
           "SET a.localEffectivenessScore = :score " +
           "WHERE a.id = :id")
    int updateLocalEffectiveness(
            @Param("id") Long id,
            @Param("score") BigDecimal score);

    /**
     * Deactivate adoption
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledgeAdoption a " +
           "SET a.isActive = false, " +
           "    a.deactivatedAt = :deactivatedAt " +
           "WHERE a.id = :id")
    int deactivateAdoption(
            @Param("id") Long id,
            @Param("deactivatedAt") LocalDateTime deactivatedAt);

    /**
     * Reactivate adoption
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledgeAdoption a " +
           "SET a.isActive = true, " +
           "    a.deactivatedAt = NULL " +
           "WHERE a.id = :id")
    int reactivateAdoption(@Param("id") Long id);

    // ==================== Bulk Operations ====================

    /**
     * Deactivate all adoptions for knowledge
     */
    @Modifying
    @Query("UPDATE CrossFactoryKnowledgeAdoption a " +
           "SET a.isActive = false, " +
           "    a.deactivatedAt = :now " +
           "WHERE a.knowledgeId = :knowledgeId " +
           "AND a.isActive = true")
    int deactivateAllForKnowledge(
            @Param("knowledgeId") Long knowledgeId,
            @Param("now") LocalDateTime now);

    /**
     * Check if factory has adopted knowledge
     */
    boolean existsByKnowledgeIdAndFactoryIdAndIsActiveTrue(Long knowledgeId, String factoryId);
}
