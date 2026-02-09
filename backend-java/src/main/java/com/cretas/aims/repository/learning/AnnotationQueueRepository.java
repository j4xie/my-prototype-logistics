package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.AnnotationQueue;
import com.cretas.aims.entity.learning.AnnotationQueue.AnnotationStatus;
import com.cretas.aims.entity.learning.AnnotationQueue.DifficultyLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for AnnotationQueue entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface AnnotationQueueRepository extends JpaRepository<AnnotationQueue, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find by factory and status
     */
    Page<AnnotationQueue> findByFactoryIdAndAnnotationStatusOrderByPriorityDesc(
            String factoryId, AnnotationStatus status, Pageable pageable);

    /**
     * Find by assigned annotator
     */
    List<AnnotationQueue> findByAssignedToAndAnnotationStatus(
            String annotator, AnnotationStatus status);

    /**
     * Find pending items for assignment
     */
    @Query("SELECT a FROM AnnotationQueue a " +
           "WHERE a.factoryId = :factoryId " +
           "AND a.annotationStatus = 'PENDING' " +
           "AND a.assignedTo IS NULL " +
           "ORDER BY a.priority DESC, a.createdAt ASC")
    List<AnnotationQueue> findPendingForAssignment(
            @Param("factoryId") String factoryId,
            Pageable pageable);

    // ==================== Assignment Queries ====================

    /**
     * Find overdue items
     */
    @Query("SELECT a FROM AnnotationQueue a " +
           "WHERE a.dueAt < :now " +
           "AND a.annotationStatus IN ('PENDING', 'ASSIGNED') " +
           "ORDER BY a.dueAt ASC")
    List<AnnotationQueue> findOverdueItems(@Param("now") LocalDateTime now);

    /**
     * Find items by difficulty
     */
    List<AnnotationQueue> findByFactoryIdAndDifficultyLevelAndAnnotationStatus(
            String factoryId, DifficultyLevel difficulty, AnnotationStatus status);

    /**
     * Count by annotator
     */
    long countByAssignedToAndAnnotationStatus(String annotator, AnnotationStatus status);

    // ==================== Statistics ====================

    /**
     * Count by factory and status
     */
    long countByFactoryIdAndAnnotationStatus(String factoryId, AnnotationStatus status);

    /**
     * Count disputed items
     */
    long countByFactoryIdAndIsDisputedTrue(String factoryId);

    /**
     * Get annotation accuracy (matching system prediction)
     */
    @Query("SELECT " +
           "  SUM(CASE WHEN a.annotatedIntentCode = a.predictedIntentCode THEN 1 ELSE 0 END), " +
           "  COUNT(a) " +
           "FROM AnnotationQueue a " +
           "WHERE a.factoryId = :factoryId " +
           "AND a.annotationStatus = 'COMPLETED' " +
           "AND a.annotatedIntentCode IS NOT NULL")
    List<Object[]> getAnnotationAccuracy(@Param("factoryId") String factoryId);

    /**
     * Count by difficulty level
     */
    @Query("SELECT a.difficultyLevel, COUNT(a) FROM AnnotationQueue a " +
           "WHERE a.factoryId = :factoryId " +
           "AND a.annotationStatus = :status " +
           "GROUP BY a.difficultyLevel")
    List<Object[]> countByDifficultyLevel(
            @Param("factoryId") String factoryId,
            @Param("status") AnnotationStatus status);

    // ==================== Updates ====================

    /**
     * Assign to annotator
     */
    @Modifying
    @Query("UPDATE AnnotationQueue a " +
           "SET a.assignedTo = :annotator, " +
           "    a.assignedAt = :assignedAt, " +
           "    a.dueAt = :dueAt, " +
           "    a.annotationStatus = 'ASSIGNED' " +
           "WHERE a.id IN :ids " +
           "AND a.annotationStatus = 'PENDING'")
    int assignToAnnotator(
            @Param("ids") List<Long> ids,
            @Param("annotator") String annotator,
            @Param("assignedAt") LocalDateTime assignedAt,
            @Param("dueAt") LocalDateTime dueAt);

    /**
     * Complete annotation
     */
    @Modifying
    @Query("UPDATE AnnotationQueue a " +
           "SET a.annotatedIntentCode = :intentCode, " +
           "    a.annotatedBy = :annotator, " +
           "    a.annotatedAt = :annotatedAt, " +
           "    a.annotationNotes = :notes, " +
           "    a.annotationStatus = 'COMPLETED' " +
           "WHERE a.id = :id")
    int completeAnnotation(
            @Param("id") Long id,
            @Param("intentCode") String intentCode,
            @Param("annotator") String annotator,
            @Param("annotatedAt") LocalDateTime annotatedAt,
            @Param("notes") String notes);

    /**
     * Raise dispute
     */
    @Modifying
    @Query("UPDATE AnnotationQueue a " +
           "SET a.isDisputed = true, " +
           "    a.disputeReason = :reason, " +
           "    a.annotationStatus = 'DISPUTED' " +
           "WHERE a.id = :id")
    int raiseDispute(
            @Param("id") Long id,
            @Param("reason") String reason);

    /**
     * Resolve dispute
     */
    @Modifying
    @Query("UPDATE AnnotationQueue a " +
           "SET a.resolvedBy = :resolver, " +
           "    a.resolvedAt = :resolvedAt, " +
           "    a.annotatedIntentCode = :intentCode, " +
           "    a.annotationStatus = 'COMPLETED', " +
           "    a.isDisputed = false " +
           "WHERE a.id = :id")
    int resolveDispute(
            @Param("id") Long id,
            @Param("resolver") String resolver,
            @Param("resolvedAt") LocalDateTime resolvedAt,
            @Param("intentCode") String intentCode);

    // ==================== Quality Control ====================

    /**
     * Find completed items pending verification
     */
    @Query("SELECT a FROM AnnotationQueue a " +
           "WHERE a.factoryId = :factoryId " +
           "AND a.annotationStatus = 'COMPLETED' " +
           "AND a.verificationStatus IS NULL " +
           "ORDER BY a.annotatedAt ASC")
    List<AnnotationQueue> findPendingVerification(
            @Param("factoryId") String factoryId,
            Pageable pageable);

    /**
     * Verify annotation
     */
    @Modifying
    @Query("UPDATE AnnotationQueue a " +
           "SET a.verifiedBy = :verifier, " +
           "    a.verifiedAt = :verifiedAt, " +
           "    a.verificationStatus = :status " +
           "WHERE a.id = :id")
    int verifyAnnotation(
            @Param("id") Long id,
            @Param("verifier") String verifier,
            @Param("verifiedAt") LocalDateTime verifiedAt,
            @Param("status") AnnotationQueue.VerificationStatus status);

    // ==================== Cleanup ====================

    /**
     * Delete old completed items
     */
    @Modifying
    @Query("DELETE FROM AnnotationQueue a " +
           "WHERE a.annotationStatus = 'COMPLETED' " +
           "AND a.annotatedAt < :cutoffDate")
    int deleteOldCompletedItems(@Param("cutoffDate") LocalDateTime cutoffDate);

    /**
     * Check if sample already queued
     */
    boolean existsBySampleId(Long sampleId);
}
