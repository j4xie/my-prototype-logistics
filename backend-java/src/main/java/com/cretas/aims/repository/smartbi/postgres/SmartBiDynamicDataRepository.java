package com.cretas.aims.repository.smartbi.postgres;

import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * SmartBI Dynamic Data Repository (PostgreSQL)
 *
 * Provides data access for dynamic JSONB data storage.
 * Includes native PostgreSQL queries with JSONB operators for:
 * - Dynamic aggregation (SUM, AVG, etc.)
 * - JSON path queries
 * - GIN index-backed searches
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Repository
public interface SmartBiDynamicDataRepository extends JpaRepository<SmartBiDynamicData, Long> {

    /**
     * Find all data by factory and upload ID
     */
    List<SmartBiDynamicData> findByFactoryIdAndUploadId(String factoryId, Long uploadId);

    /**
     * Find data by factory and upload ID with pagination
     * Orders by row index to maintain original Excel order
     */
    Page<SmartBiDynamicData> findByFactoryIdAndUploadIdOrderByRowIndex(
            String factoryId, Long uploadId, Pageable pageable);

    /**
     * Find data by upload ID with pagination (no factory constraint)
     */
    Page<SmartBiDynamicData> findByUploadIdOrderByRowIndex(Long uploadId, Pageable pageable);

    /**
     * Find data by factory and period
     */
    List<SmartBiDynamicData> findByFactoryIdAndPeriod(String factoryId, String period);

    /**
     * Find data by factory, upload, and category
     */
    List<SmartBiDynamicData> findByFactoryIdAndUploadIdAndCategory(
            String factoryId, Long uploadId, String category);

    /**
     * Count rows by upload
     */
    long countByUploadId(Long uploadId);

    /**
     * Delete all data for an upload
     */
    @Modifying
    @Query("DELETE FROM SmartBiDynamicData d WHERE d.uploadId = :uploadId")
    void deleteByUploadId(@Param("uploadId") Long uploadId);

    /**
     * Delete all data for factory and upload
     */
    @Modifying
    @Query("DELETE FROM SmartBiDynamicData d WHERE d.factoryId = :factoryId AND d.uploadId = :uploadId")
    void deleteByFactoryIdAndUploadId(
            @Param("factoryId") String factoryId,
            @Param("uploadId") Long uploadId);

    // ========== Native PostgreSQL JSONB Queries ==========

    /**
     * Dynamic aggregation by field
     * Uses PostgreSQL JSONB ->> operator
     *
     * @param factoryId Factory ID
     * @param uploadId Upload ID
     * @param groupField Field to group by (e.g., "部门")
     * @param measureField Field to aggregate (e.g., "营业收入")
     * @return List of [groupValue, total] pairs
     */
    @Query(value = """
        SELECT
            row_data->>:groupField as group_value,
            SUM(CAST(NULLIF(row_data->>:measureField, '') AS DECIMAL(18,2))) as total
        FROM smart_bi_dynamic_data
        WHERE factory_id = :factoryId AND upload_id = :uploadId
          AND row_data->>:groupField IS NOT NULL
        GROUP BY row_data->>:groupField
        ORDER BY total DESC
        """, nativeQuery = true)
    List<Object[]> aggregateByField(
            @Param("factoryId") String factoryId,
            @Param("uploadId") Long uploadId,
            @Param("groupField") String groupField,
            @Param("measureField") String measureField);

    /**
     * Dynamic aggregation with multiple measures
     *
     * @param factoryId Factory ID
     * @param uploadId Upload ID
     * @param groupField Field to group by
     * @param measureField1 First measure field
     * @param measureField2 Second measure field
     * @return List of [groupValue, total1, total2] tuples
     */
    @Query(value = """
        SELECT
            row_data->>:groupField as group_value,
            SUM(CAST(NULLIF(row_data->>:measureField1, '') AS DECIMAL(18,2))) as total1,
            SUM(CAST(NULLIF(row_data->>:measureField2, '') AS DECIMAL(18,2))) as total2
        FROM smart_bi_dynamic_data
        WHERE factory_id = :factoryId AND upload_id = :uploadId
          AND row_data->>:groupField IS NOT NULL
        GROUP BY row_data->>:groupField
        ORDER BY total1 DESC
        """, nativeQuery = true)
    List<Object[]> aggregateByFieldMultiMeasure(
            @Param("factoryId") String factoryId,
            @Param("uploadId") Long uploadId,
            @Param("groupField") String groupField,
            @Param("measureField1") String measureField1,
            @Param("measureField2") String measureField2);

    /**
     * JSONB contains query (uses GIN index)
     * Finds rows where row_data contains the specified JSON
     *
     * Example: {"部门": "江苏分部"} finds all rows for this department
     *
     * @param factoryId Factory ID
     * @param jsonFilter JSON filter in string format (e.g., '{"部门": "江苏分部"}')
     * @return Matching data rows
     */
    @Query(value = """
        SELECT * FROM smart_bi_dynamic_data
        WHERE factory_id = :factoryId
          AND row_data @> CAST(:jsonFilter AS jsonb)
        """, nativeQuery = true)
    List<SmartBiDynamicData> findByJsonContains(
            @Param("factoryId") String factoryId,
            @Param("jsonFilter") String jsonFilter);

    /**
     * Get distinct values for a field
     * Useful for building filter dropdowns
     *
     * @param factoryId Factory ID
     * @param uploadId Upload ID
     * @param fieldName Field name to get values for
     * @return List of distinct values
     */
    @Query(value = """
        SELECT DISTINCT row_data->>:fieldName as value
        FROM smart_bi_dynamic_data
        WHERE factory_id = :factoryId AND upload_id = :uploadId
          AND row_data->>:fieldName IS NOT NULL
        ORDER BY value
        """, nativeQuery = true)
    List<String> getDistinctFieldValues(
            @Param("factoryId") String factoryId,
            @Param("uploadId") Long uploadId,
            @Param("fieldName") String fieldName);

    /**
     * Calculate sum of a numeric field
     *
     * @param factoryId Factory ID
     * @param uploadId Upload ID
     * @param measureField Field to sum
     * @return Sum value
     */
    @Query(value = """
        SELECT SUM(CAST(NULLIF(row_data->>:measureField, '') AS DECIMAL(18,2)))
        FROM smart_bi_dynamic_data
        WHERE factory_id = :factoryId AND upload_id = :uploadId
        """, nativeQuery = true)
    Double sumField(
            @Param("factoryId") String factoryId,
            @Param("uploadId") Long uploadId,
            @Param("measureField") String measureField);

    /**
     * Calculate average of a numeric field
     *
     * @param factoryId Factory ID
     * @param uploadId Upload ID
     * @param measureField Field to average
     * @return Average value
     */
    @Query(value = """
        SELECT AVG(CAST(NULLIF(row_data->>:measureField, '') AS DECIMAL(18,2)))
        FROM smart_bi_dynamic_data
        WHERE factory_id = :factoryId AND upload_id = :uploadId
        """, nativeQuery = true)
    Double avgField(
            @Param("factoryId") String factoryId,
            @Param("uploadId") Long uploadId,
            @Param("measureField") String measureField);

    /**
     * Get min and max of a numeric field
     *
     * @param factoryId Factory ID
     * @param uploadId Upload ID
     * @param measureField Field to analyze
     * @return [min, max] pair
     */
    @Query(value = """
        SELECT
            MIN(CAST(NULLIF(row_data->>:measureField, '') AS DECIMAL(18,2))),
            MAX(CAST(NULLIF(row_data->>:measureField, '') AS DECIMAL(18,2)))
        FROM smart_bi_dynamic_data
        WHERE factory_id = :factoryId AND upload_id = :uploadId
        """, nativeQuery = true)
    List<Object[]> minMaxField(
            @Param("factoryId") String factoryId,
            @Param("uploadId") Long uploadId,
            @Param("measureField") String measureField);

    /**
     * Time series aggregation
     * Groups by period and aggregates measures
     *
     * @param factoryId Factory ID
     * @param uploadId Upload ID
     * @param measureField Field to aggregate
     * @return List of [period, total] pairs ordered by period
     */
    @Query(value = """
        SELECT
            period,
            SUM(CAST(NULLIF(row_data->>:measureField, '') AS DECIMAL(18,2))) as total
        FROM smart_bi_dynamic_data
        WHERE factory_id = :factoryId AND upload_id = :uploadId
          AND period IS NOT NULL
        GROUP BY period
        ORDER BY period
        """, nativeQuery = true)
    List<Object[]> aggregateByPeriod(
            @Param("factoryId") String factoryId,
            @Param("uploadId") Long uploadId,
            @Param("measureField") String measureField);
}
