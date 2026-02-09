package com.cretas.aims.repository.smartbi.postgres;

import com.cretas.aims.entity.smartbi.postgres.SmartBiPgFieldDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI PostgreSQL Field Definition Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Repository
public interface SmartBiPgFieldDefinitionRepository extends JpaRepository<SmartBiPgFieldDefinition, Long> {

    /**
     * Find all field definitions for an upload
     */
    List<SmartBiPgFieldDefinition> findByUploadIdOrderByDisplayOrder(Long uploadId);

    /**
     * Find all field definitions for an upload (simple)
     */
    List<SmartBiPgFieldDefinition> findByUploadId(Long uploadId);

    /**
     * Find field by upload and original name
     */
    Optional<SmartBiPgFieldDefinition> findByUploadIdAndOriginalName(
            Long uploadId, String originalName);

    /**
     * Find all dimension fields for an upload
     */
    List<SmartBiPgFieldDefinition> findByUploadIdAndIsDimensionTrue(Long uploadId);

    /**
     * Find all measure fields for an upload
     */
    List<SmartBiPgFieldDefinition> findByUploadIdAndIsMeasureTrue(Long uploadId);

    /**
     * Find time fields for an upload
     */
    List<SmartBiPgFieldDefinition> findByUploadIdAndIsTimeTrue(Long uploadId);

    /**
     * Find fields by semantic type
     */
    List<SmartBiPgFieldDefinition> findByUploadIdAndSemanticType(
            Long uploadId, String semanticType);

    /**
     * Find fields by chart role
     */
    List<SmartBiPgFieldDefinition> findByUploadIdAndChartRole(
            Long uploadId, String chartRole);

    /**
     * Delete all field definitions for an upload
     */
    @Modifying
    @Query("DELETE FROM SmartBiPgFieldDefinition f WHERE f.uploadId = :uploadId")
    void deleteByUploadId(@Param("uploadId") Long uploadId);

    /**
     * Count fields by upload
     */
    long countByUploadId(Long uploadId);
}
