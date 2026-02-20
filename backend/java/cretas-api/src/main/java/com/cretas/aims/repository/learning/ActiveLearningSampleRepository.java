package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.ActiveLearningSample;
import com.cretas.aims.entity.learning.ActiveLearningSample.LearningStatus;
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
 * Repository for ActiveLearningSample entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface ActiveLearningSampleRepository extends JpaRepository<ActiveLearningSample, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find samples by factory ID and learning status
     */
    List<ActiveLearningSample> findByFactoryIdAndLearningStatus(
            String factoryId, LearningStatus status);

    /**
     * Find samples by factory ID with pagination
     */
    Page<ActiveLearningSample> findByFactoryIdOrderByCreatedAtDesc(
            String factoryId, Pageable pageable);

    /**
     * Find samples by cluster ID
     */
    List<ActiveLearningSample> findByClusterId(String clusterId);

    // ==================== Low Confidence Queries ====================

    /**
     * Find low confidence samples for analysis
     */
    @Query("SELECT s FROM ActiveLearningSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.confidenceScore < :threshold " +
           "AND s.learningStatus = 'PENDING' " +
           "AND s.createdAt >= :startDate " +
           "ORDER BY s.confidenceScore ASC")
    List<ActiveLearningSample> findLowConfidenceSamples(
            @Param("factoryId") String factoryId,
            @Param("threshold") BigDecimal threshold,
            @Param("startDate") LocalDateTime startDate);

    /**
     * Find pending samples for clustering
     */
    @Query("SELECT s FROM ActiveLearningSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.learningStatus = 'PENDING' " +
           "AND s.clusterId IS NULL " +
           "ORDER BY s.createdAt ASC")
    List<ActiveLearningSample> findPendingForClustering(
            @Param("factoryId") String factoryId,
            Pageable pageable);

    // ==================== Statistics ====================

    /**
     * Count samples by factory and status
     */
    long countByFactoryIdAndLearningStatus(String factoryId, LearningStatus status);

    /**
     * Count samples by factory and confidence range
     */
    @Query("SELECT COUNT(s) FROM ActiveLearningSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.confidenceScore >= :minConf " +
           "AND s.confidenceScore < :maxConf " +
           "AND s.createdAt >= :startDate")
    long countByConfidenceRange(
            @Param("factoryId") String factoryId,
            @Param("minConf") BigDecimal minConf,
            @Param("maxConf") BigDecimal maxConf,
            @Param("startDate") LocalDateTime startDate);

    /**
     * Get average confidence by factory
     */
    @Query("SELECT AVG(s.confidenceScore) FROM ActiveLearningSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.createdAt >= :startDate")
    BigDecimal getAverageConfidence(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDateTime startDate);

    // ==================== Intent Analysis ====================

    /**
     * Find samples by matched intent code
     */
    @Query("SELECT s FROM ActiveLearningSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.matchedIntentCode = :intentCode " +
           "AND s.learningStatus = 'PENDING' " +
           "ORDER BY s.confidenceScore ASC")
    List<ActiveLearningSample> findByIntentCode(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode,
            Pageable pageable);

    /**
     * Count samples by intent code
     */
    @Query("SELECT s.matchedIntentCode, COUNT(s) FROM ActiveLearningSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.matchedIntentCode IS NOT NULL " +
           "AND s.createdAt >= :startDate " +
           "GROUP BY s.matchedIntentCode " +
           "ORDER BY COUNT(s) DESC")
    List<Object[]> countByIntentCode(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDateTime startDate);

    // ==================== Updates ====================

    /**
     * Update cluster assignment
     */
    @Modifying
    @Query("UPDATE ActiveLearningSample s " +
           "SET s.clusterId = :clusterId, " +
           "    s.clusterLabel = :clusterLabel, " +
           "    s.learningStatus = 'ANALYZED', " +
           "    s.analyzedAt = :analyzedAt " +
           "WHERE s.id IN :sampleIds")
    int updateClusterAssignment(
            @Param("sampleIds") List<Long> sampleIds,
            @Param("clusterId") String clusterId,
            @Param("clusterLabel") String clusterLabel,
            @Param("analyzedAt") LocalDateTime analyzedAt);

    /**
     * Update learning status
     */
    @Modifying
    @Query("UPDATE ActiveLearningSample s " +
           "SET s.learningStatus = :status, " +
           "    s.learnedAt = :learnedAt " +
           "WHERE s.clusterId = :clusterId")
    int updateLearningStatusByCluster(
            @Param("clusterId") String clusterId,
            @Param("status") LearningStatus status,
            @Param("learnedAt") LocalDateTime learnedAt);

    // ==================== Cleanup ====================

    /**
     * Delete old samples
     */
    @Modifying
    @Query("DELETE FROM ActiveLearningSample s " +
           "WHERE s.createdAt < :cutoffDate " +
           "AND s.learningStatus IN ('LEARNED', 'IGNORED')")
    int deleteOldSamples(@Param("cutoffDate") LocalDateTime cutoffDate);

    /**
     * Check if sample already exists
     */
    boolean existsBySourceRecordId(String sourceRecordId);
}
