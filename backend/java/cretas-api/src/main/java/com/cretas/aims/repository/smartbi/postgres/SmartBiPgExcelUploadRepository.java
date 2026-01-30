package com.cretas.aims.repository.smartbi.postgres;

import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * SmartBI PostgreSQL Excel Upload Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Repository
public interface SmartBiPgExcelUploadRepository extends JpaRepository<SmartBiPgExcelUpload, Long> {

    /**
     * Find all uploads for a factory
     */
    List<SmartBiPgExcelUpload> findByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * Find uploads for a factory with pagination
     */
    Page<SmartBiPgExcelUpload> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /**
     * Find uploads by factory and status
     */
    List<SmartBiPgExcelUpload> findByFactoryIdAndUploadStatus(
            String factoryId, UploadStatus uploadStatus);

    /**
     * Find uploads by table type
     */
    List<SmartBiPgExcelUpload> findByFactoryIdAndDetectedTableType(
            String factoryId, String detectedTableType);

    /**
     * Find latest upload for a factory
     */
    Optional<SmartBiPgExcelUpload> findFirstByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * Find by factory and file name
     */
    Optional<SmartBiPgExcelUpload> findByFactoryIdAndFileName(String factoryId, String fileName);

    /**
     * Update upload status
     */
    @Modifying
    @Query("UPDATE SmartBiPgExcelUpload u SET u.uploadStatus = :status, u.updatedAt = :now WHERE u.id = :id")
    void updateStatus(
            @Param("id") Long id,
            @Param("status") UploadStatus status,
            @Param("now") LocalDateTime now);

    /**
     * Update upload status with error message
     */
    @Modifying
    @Query("UPDATE SmartBiPgExcelUpload u SET u.uploadStatus = :status, u.errorMessage = :error, u.updatedAt = :now WHERE u.id = :id")
    void updateStatusWithError(
            @Param("id") Long id,
            @Param("status") UploadStatus status,
            @Param("error") String error,
            @Param("now") LocalDateTime now);

    /**
     * Count uploads by factory and status
     */
    long countByFactoryIdAndUploadStatus(String factoryId, UploadStatus uploadStatus);

    /**
     * Count all uploads for a factory
     */
    long countByFactoryId(String factoryId);

    /**
     * Delete old uploads (for cleanup)
     */
    @Modifying
    @Query("DELETE FROM SmartBiPgExcelUpload u WHERE u.factoryId = :factoryId AND u.createdAt < :before")
    int deleteOldUploads(
            @Param("factoryId") String factoryId,
            @Param("before") LocalDateTime before);
}
