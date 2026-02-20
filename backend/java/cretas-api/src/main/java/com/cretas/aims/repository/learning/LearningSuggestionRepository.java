package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.LearningSuggestion;
import com.cretas.aims.entity.learning.LearningSuggestion.SuggestionStatus;
import com.cretas.aims.entity.learning.LearningSuggestion.SuggestionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for LearningSuggestion entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface LearningSuggestionRepository extends JpaRepository<LearningSuggestion, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find by factory and status
     */
    Page<LearningSuggestion> findByFactoryIdAndStatusOrderByPriorityDesc(
            String factoryId, SuggestionStatus status, Pageable pageable);

    /**
     * Find by intent code
     */
    List<LearningSuggestion> findByIntentCodeAndStatus(String intentCode, SuggestionStatus status);

    /**
     * Find by cluster ID
     */
    List<LearningSuggestion> findByClusterId(String clusterId);

    /**
     * Find pending suggestions for review
     */
    @Query("SELECT s FROM LearningSuggestion s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.status = 'PENDING' " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > :now) " +
           "ORDER BY s.priority DESC, s.sampleCount DESC")
    List<LearningSuggestion> findPendingForReview(
            @Param("factoryId") String factoryId,
            @Param("now") LocalDateTime now,
            Pageable pageable);

    // ==================== Type Specific Queries ====================

    /**
     * Find by suggestion type and status
     */
    List<LearningSuggestion> findByFactoryIdAndSuggestionTypeAndStatus(
            String factoryId, SuggestionType type, SuggestionStatus status);

    /**
     * Find keyword suggestions for intent
     */
    @Query("SELECT s FROM LearningSuggestion s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.intentCode = :intentCode " +
           "AND s.suggestionType = 'NEW_KEYWORD' " +
           "AND s.status IN ('PENDING', 'APPROVED') " +
           "ORDER BY s.confidenceScore DESC")
    List<LearningSuggestion> findKeywordSuggestionsForIntent(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode);

    /**
     * Find high confidence suggestions
     */
    @Query("SELECT s FROM LearningSuggestion s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.confidenceScore >= :minConfidence " +
           "AND s.status = 'PENDING' " +
           "ORDER BY s.confidenceScore DESC")
    List<LearningSuggestion> findHighConfidenceSuggestions(
            @Param("factoryId") String factoryId,
            @Param("minConfidence") BigDecimal minConfidence);

    // ==================== Statistics ====================

    /**
     * Count by factory and status
     */
    long countByFactoryIdAndStatus(String factoryId, SuggestionStatus status);

    /**
     * Count by type and status
     */
    long countByFactoryIdAndSuggestionTypeAndStatus(
            String factoryId, SuggestionType type, SuggestionStatus status);

    /**
     * Get effectiveness improvement stats
     */
    @Query("SELECT AVG(s.effectivenessDelta), COUNT(s) FROM LearningSuggestion s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.status = 'APPLIED' " +
           "AND s.effectivenessDelta IS NOT NULL " +
           "AND s.appliedAt >= :startDate")
    List<Object[]> getEffectivenessImprovementStats(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDateTime startDate);

    /**
     * Count by status distribution
     */
    @Query("SELECT s.status, COUNT(s) FROM LearningSuggestion s " +
           "WHERE s.factoryId = :factoryId " +
           "GROUP BY s.status")
    List<Object[]> countByStatus(@Param("factoryId") String factoryId);

    // ==================== Updates ====================

    /**
     * Approve suggestion
     */
    @Modifying
    @Query("UPDATE LearningSuggestion s " +
           "SET s.status = 'APPROVED', " +
           "    s.reviewedBy = :reviewer, " +
           "    s.reviewedAt = :reviewedAt, " +
           "    s.reviewNotes = :notes " +
           "WHERE s.id = :id")
    int approveSuggestion(
            @Param("id") Long id,
            @Param("reviewer") String reviewer,
            @Param("reviewedAt") LocalDateTime reviewedAt,
            @Param("notes") String notes);

    /**
     * Reject suggestion
     */
    @Modifying
    @Query("UPDATE LearningSuggestion s " +
           "SET s.status = 'REJECTED', " +
           "    s.reviewedBy = :reviewer, " +
           "    s.reviewedAt = :reviewedAt, " +
           "    s.reviewNotes = :notes " +
           "WHERE s.id = :id")
    int rejectSuggestion(
            @Param("id") Long id,
            @Param("reviewer") String reviewer,
            @Param("reviewedAt") LocalDateTime reviewedAt,
            @Param("notes") String notes);

    /**
     * Apply suggestion
     */
    @Modifying
    @Query("UPDATE LearningSuggestion s " +
           "SET s.status = 'APPLIED', " +
           "    s.appliedBy = :applier, " +
           "    s.appliedAt = :appliedAt, " +
           "    s.effectivenessBefore = :effectivenessBefore " +
           "WHERE s.id = :id")
    int applySuggestion(
            @Param("id") Long id,
            @Param("applier") String applier,
            @Param("appliedAt") LocalDateTime appliedAt,
            @Param("effectivenessBefore") BigDecimal effectivenessBefore);

    /**
     * Record effectiveness after
     */
    @Modifying
    @Query("UPDATE LearningSuggestion s " +
           "SET s.effectivenessAfter = :effectivenessAfter, " +
           "    s.effectivenessDelta = :effectivenessAfter - s.effectivenessBefore " +
           "WHERE s.id = :id")
    int recordEffectivenessAfter(
            @Param("id") Long id,
            @Param("effectivenessAfter") BigDecimal effectivenessAfter);

    // ==================== Expiration ====================

    /**
     * Find expired suggestions
     */
    @Query("SELECT s FROM LearningSuggestion s " +
           "WHERE s.status = 'PENDING' " +
           "AND s.expiresAt < :now")
    List<LearningSuggestion> findExpiredSuggestions(@Param("now") LocalDateTime now);

    /**
     * Expire suggestions
     */
    @Modifying
    @Query("UPDATE LearningSuggestion s " +
           "SET s.status = 'EXPIRED' " +
           "WHERE s.status = 'PENDING' " +
           "AND s.expiresAt < :now")
    int expireSuggestions(@Param("now") LocalDateTime now);

    // ==================== Duplicate Check ====================

    /**
     * Check if similar suggestion exists
     */
    @Query("SELECT COUNT(s) > 0 FROM LearningSuggestion s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.suggestionType = :type " +
           "AND s.intentCode = :intentCode " +
           "AND s.content = :content " +
           "AND s.status IN ('PENDING', 'APPROVED')")
    boolean existsSimilarSuggestion(
            @Param("factoryId") String factoryId,
            @Param("type") SuggestionType type,
            @Param("intentCode") String intentCode,
            @Param("content") String content);
}
