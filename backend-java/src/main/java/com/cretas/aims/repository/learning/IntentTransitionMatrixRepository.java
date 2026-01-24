package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.IntentTransitionMatrix;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Repository for IntentTransitionMatrix entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface IntentTransitionMatrixRepository extends JpaRepository<IntentTransitionMatrix, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find by factory and intent pair for a time window
     */
    Optional<IntentTransitionMatrix> findByFactoryIdAndFromIntentCodeAndToIntentCodeAndWindowStart(
            String factoryId,
            String fromIntentCode,
            String toIntentCode,
            LocalDate windowStart);

    /**
     * Find all transitions from a specific intent
     */
    List<IntentTransitionMatrix> findByFactoryIdAndFromIntentCodeAndWindowStart(
            String factoryId,
            String fromIntentCode,
            LocalDate windowStart);

    /**
     * Find all transitions to a specific intent
     */
    List<IntentTransitionMatrix> findByFactoryIdAndToIntentCodeAndWindowStart(
            String factoryId,
            String toIntentCode,
            LocalDate windowStart);

    // ==================== Probability Queries ====================

    /**
     * Find high probability transitions
     */
    @Query("SELECT t FROM IntentTransitionMatrix t " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.windowStart = :windowStart " +
           "AND t.transitionProbability >= :minProbability " +
           "ORDER BY t.transitionProbability DESC")
    List<IntentTransitionMatrix> findHighProbabilityTransitions(
            @Param("factoryId") String factoryId,
            @Param("windowStart") LocalDate windowStart,
            @Param("minProbability") BigDecimal minProbability);

    /**
     * Get most likely next intents from a given intent
     */
    @Query("SELECT t FROM IntentTransitionMatrix t " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.fromIntentCode = :fromIntent " +
           "AND t.windowStart = :windowStart " +
           "ORDER BY t.transitionProbability DESC")
    List<IntentTransitionMatrix> findMostLikelyNextIntents(
            @Param("factoryId") String factoryId,
            @Param("fromIntent") String fromIntent,
            @Param("windowStart") LocalDate windowStart);

    // ==================== Statistics ====================

    /**
     * Count unique intents in matrix
     */
    @Query("SELECT COUNT(DISTINCT t.fromIntentCode) + COUNT(DISTINCT t.toIntentCode) " +
           "FROM IntentTransitionMatrix t " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.windowStart = :windowStart")
    long countUniqueIntents(
            @Param("factoryId") String factoryId,
            @Param("windowStart") LocalDate windowStart);

    /**
     * Get total transitions from an intent
     */
    @Query("SELECT SUM(t.transitionCount) FROM IntentTransitionMatrix t " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.fromIntentCode = :fromIntent " +
           "AND t.windowStart = :windowStart")
    Integer getTotalTransitionsFrom(
            @Param("factoryId") String factoryId,
            @Param("fromIntent") String fromIntent,
            @Param("windowStart") LocalDate windowStart);

    /**
     * Get all distinct source intents
     */
    @Query("SELECT DISTINCT t.fromIntentCode FROM IntentTransitionMatrix t " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.windowStart = :windowStart")
    List<String> findDistinctSourceIntents(
            @Param("factoryId") String factoryId,
            @Param("windowStart") LocalDate windowStart);

    /**
     * Get all distinct target intents
     */
    @Query("SELECT DISTINCT t.toIntentCode FROM IntentTransitionMatrix t " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.windowStart = :windowStart")
    List<String> findDistinctTargetIntents(
            @Param("factoryId") String factoryId,
            @Param("windowStart") LocalDate windowStart);

    // ==================== Updates ====================

    /**
     * Increment transition count
     */
    @Modifying
    @Query("UPDATE IntentTransitionMatrix t " +
           "SET t.transitionCount = t.transitionCount + 1 " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.fromIntentCode = :fromIntent " +
           "AND t.toIntentCode = :toIntent " +
           "AND t.windowStart = :windowStart")
    int incrementTransitionCount(
            @Param("factoryId") String factoryId,
            @Param("fromIntent") String fromIntent,
            @Param("toIntent") String toIntent,
            @Param("windowStart") LocalDate windowStart);

    /**
     * Update total from count for all transitions from an intent
     */
    @Modifying
    @Query("UPDATE IntentTransitionMatrix t " +
           "SET t.totalFromCount = :totalCount " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.fromIntentCode = :fromIntent " +
           "AND t.windowStart = :windowStart")
    int updateTotalFromCount(
            @Param("factoryId") String factoryId,
            @Param("fromIntent") String fromIntent,
            @Param("totalCount") int totalCount,
            @Param("windowStart") LocalDate windowStart);

    /**
     * Recalculate all probabilities for a factory/window
     */
    @Query("SELECT t FROM IntentTransitionMatrix t " +
           "WHERE t.factoryId = :factoryId " +
           "AND t.windowStart = :windowStart")
    List<IntentTransitionMatrix> findAllForRecalculation(
            @Param("factoryId") String factoryId,
            @Param("windowStart") LocalDate windowStart);

    // ==================== Cleanup ====================

    /**
     * Delete old time windows
     */
    @Modifying
    @Query("DELETE FROM IntentTransitionMatrix t " +
           "WHERE t.windowEnd < :cutoffDate")
    int deleteOldWindows(@Param("cutoffDate") LocalDate cutoffDate);

    /**
     * Check if window exists
     */
    boolean existsByFactoryIdAndWindowStart(String factoryId, LocalDate windowStart);
}
