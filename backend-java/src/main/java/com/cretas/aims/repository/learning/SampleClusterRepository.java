package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.SampleCluster;
import com.cretas.aims.entity.learning.SampleCluster.AnalysisStatus;
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
import java.util.Optional;

/**
 * Repository for SampleCluster entity
 *
 * @author Cretas Team
 * @since 2026-01-24
 */
@Repository
public interface SampleClusterRepository extends JpaRepository<SampleCluster, Long> {

    // ==================== Basic Queries ====================

    /**
     * Find by factory and cluster ID
     */
    Optional<SampleCluster> findByFactoryIdAndClusterId(String factoryId, String clusterId);

    /**
     * Find by factory ID
     */
    List<SampleCluster> findByFactoryIdOrderBySampleCountDesc(String factoryId);

    /**
     * Find by analysis status
     */
    List<SampleCluster> findByFactoryIdAndAnalysisStatus(String factoryId, AnalysisStatus status);

    // ==================== Significant Clusters ====================

    /**
     * Find significant clusters (large enough for action)
     */
    @Query("SELECT c FROM SampleCluster c " +
           "WHERE c.factoryId = :factoryId " +
           "AND c.sampleCount >= :minSamples " +
           "AND c.analysisStatus = 'PENDING' " +
           "ORDER BY c.sampleCount DESC")
    List<SampleCluster> findSignificantClusters(
            @Param("factoryId") String factoryId,
            @Param("minSamples") int minSamples);

    /**
     * Find clusters with clear dominant intent
     */
    @Query("SELECT c FROM SampleCluster c " +
           "WHERE c.factoryId = :factoryId " +
           "AND c.dominantIntentRatio >= :minRatio " +
           "AND c.sampleCount >= :minSamples " +
           "ORDER BY c.sampleCount DESC")
    List<SampleCluster> findClustersWithClearIntent(
            @Param("factoryId") String factoryId,
            @Param("minRatio") BigDecimal minRatio,
            @Param("minSamples") int minSamples);

    /**
     * Find ambiguous clusters (no clear dominant intent)
     */
    @Query("SELECT c FROM SampleCluster c " +
           "WHERE c.factoryId = :factoryId " +
           "AND (c.dominantIntentRatio IS NULL OR c.dominantIntentRatio < :maxRatio) " +
           "AND c.sampleCount >= :minSamples " +
           "ORDER BY c.sampleCount DESC")
    List<SampleCluster> findAmbiguousClusters(
            @Param("factoryId") String factoryId,
            @Param("maxRatio") BigDecimal maxRatio,
            @Param("minSamples") int minSamples);

    // ==================== Intent Analysis ====================

    /**
     * Find clusters by dominant intent
     */
    List<SampleCluster> findByFactoryIdAndDominantIntentCode(String factoryId, String intentCode);

    /**
     * Count clusters by dominant intent
     */
    @Query("SELECT c.dominantIntentCode, COUNT(c), SUM(c.sampleCount) " +
           "FROM SampleCluster c " +
           "WHERE c.factoryId = :factoryId " +
           "AND c.dominantIntentCode IS NOT NULL " +
           "GROUP BY c.dominantIntentCode " +
           "ORDER BY SUM(c.sampleCount) DESC")
    List<Object[]> countClustersByIntent(@Param("factoryId") String factoryId);

    // ==================== Statistics ====================

    /**
     * Count by analysis status
     */
    long countByFactoryIdAndAnalysisStatus(String factoryId, AnalysisStatus status);

    /**
     * Get total samples in clusters
     */
    @Query("SELECT SUM(c.sampleCount) FROM SampleCluster c " +
           "WHERE c.factoryId = :factoryId")
    Long getTotalSamplesInClusters(@Param("factoryId") String factoryId);

    /**
     * Get average cluster size
     */
    @Query("SELECT AVG(c.sampleCount) FROM SampleCluster c " +
           "WHERE c.factoryId = :factoryId")
    BigDecimal getAverageClusterSize(@Param("factoryId") String factoryId);

    /**
     * Get average confidence by cluster
     */
    @Query("SELECT c.clusterId, c.avgConfidence FROM SampleCluster c " +
           "WHERE c.factoryId = :factoryId " +
           "AND c.avgConfidence IS NOT NULL " +
           "ORDER BY c.avgConfidence ASC")
    List<Object[]> getConfidenceByCluster(@Param("factoryId") String factoryId);

    // ==================== Updates ====================

    /**
     * Update cluster statistics
     */
    @Modifying
    @Query("UPDATE SampleCluster c " +
           "SET c.sampleCount = :sampleCount, " +
           "    c.avgConfidence = :avgConfidence, " +
           "    c.dominantIntentCode = :dominantIntent, " +
           "    c.dominantIntentRatio = :ratio " +
           "WHERE c.id = :id")
    int updateClusterStatistics(
            @Param("id") Long id,
            @Param("sampleCount") int sampleCount,
            @Param("avgConfidence") BigDecimal avgConfidence,
            @Param("dominantIntent") String dominantIntent,
            @Param("ratio") BigDecimal ratio);

    /**
     * Mark as analyzed
     */
    @Modifying
    @Query("UPDATE SampleCluster c " +
           "SET c.analysisStatus = 'ANALYZED', " +
           "    c.analyzedAt = :analyzedAt " +
           "WHERE c.id = :id")
    int markAnalyzed(
            @Param("id") Long id,
            @Param("analyzedAt") LocalDateTime analyzedAt);

    /**
     * Record action taken
     */
    @Modifying
    @Query("UPDATE SampleCluster c " +
           "SET c.analysisStatus = 'ACTION_TAKEN', " +
           "    c.actionTaken = :action, " +
           "    c.actionDetails = :details " +
           "WHERE c.id = :id")
    int recordAction(
            @Param("id") Long id,
            @Param("action") String action,
            @Param("details") String details);

    /**
     * Update suggested keywords
     */
    @Modifying
    @Query("UPDATE SampleCluster c " +
           "SET c.suggestedKeywords = :keywords " +
           "WHERE c.id = :id")
    int updateSuggestedKeywords(
            @Param("id") Long id,
            @Param("keywords") String keywords);

    // ==================== Cleanup ====================

    /**
     * Delete old clusters
     */
    @Modifying
    @Query("DELETE FROM SampleCluster c " +
           "WHERE c.createdAt < :cutoffDate " +
           "AND c.analysisStatus = 'ACTION_TAKEN'")
    int deleteOldClusters(@Param("cutoffDate") LocalDateTime cutoffDate);

    // ==================== Pagination ====================

    /**
     * Find with pagination
     */
    Page<SampleCluster> findByFactoryIdAndAnalysisStatusOrderBySampleCountDesc(
            String factoryId, AnalysisStatus status, Pageable pageable);
}
