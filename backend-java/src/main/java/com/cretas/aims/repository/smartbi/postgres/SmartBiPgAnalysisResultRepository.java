package com.cretas.aims.repository.smartbi.postgres;

import com.cretas.aims.entity.smartbi.postgres.SmartBiPgAnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * SmartBI PostgreSQL Analysis Result Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Repository
public interface SmartBiPgAnalysisResultRepository extends JpaRepository<SmartBiPgAnalysisResult, Long> {

    /**
     * Find all analysis results for an upload
     */
    List<SmartBiPgAnalysisResult> findByUploadIdOrderByCreatedAtDesc(Long uploadId);

    /**
     * Find analysis by upload and type
     */
    Optional<SmartBiPgAnalysisResult> findByUploadIdAndAnalysisType(
            Long uploadId, String analysisType);

    /**
     * Find latest analysis for an upload
     */
    Optional<SmartBiPgAnalysisResult> findFirstByUploadIdOrderByCreatedAtDesc(Long uploadId);

    /**
     * Find all analyses for a factory
     */
    List<SmartBiPgAnalysisResult> findByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * Find analyses by factory and type
     */
    List<SmartBiPgAnalysisResult> findByFactoryIdAndAnalysisType(
            String factoryId, String analysisType);

    /**
     * Delete all analyses for an upload
     */
    @Modifying
    @Query("DELETE FROM SmartBiPgAnalysisResult a WHERE a.uploadId = :uploadId")
    void deleteByUploadId(@Param("uploadId") Long uploadId);

    /**
     * Delete old analyses (for cleanup)
     */
    @Modifying
    @Query("DELETE FROM SmartBiPgAnalysisResult a WHERE a.factoryId = :factoryId AND a.createdAt < :before")
    int deleteOldAnalyses(
            @Param("factoryId") String factoryId,
            @Param("before") LocalDateTime before);

    /**
     * Check if analysis exists
     */
    boolean existsByUploadIdAndAnalysisType(Long uploadId, String analysisType);
}
