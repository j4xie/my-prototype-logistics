package com.cretas.aims.repository;

import com.cretas.aims.entity.ProductionReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Repository
public interface ProductionReportRepository extends JpaRepository<ProductionReport, Long> {

    // ==================== 列表查询 ====================

    Page<ProductionReport> findByFactoryIdAndDeletedAtIsNull(
            String factoryId, Pageable pageable);

    Page<ProductionReport> findByFactoryIdAndReportTypeAndDeletedAtIsNull(
            String factoryId, String reportType, Pageable pageable);

    Page<ProductionReport> findByFactoryIdAndReportDateBetweenAndDeletedAtIsNull(
            String factoryId, LocalDate startDate, LocalDate endDate, Pageable pageable);

    Page<ProductionReport> findByFactoryIdAndReportTypeAndReportDateBetweenAndDeletedAtIsNull(
            String factoryId, String reportType, LocalDate startDate, LocalDate endDate, Pageable pageable);

    // ==================== 按状态查询 ====================

    long countByFactoryIdAndStatusAndDeletedAtIsNull(String factoryId, ProductionReport.Status status);

    Page<ProductionReport> findByFactoryIdAndStatusAndDeletedAtIsNull(
            String factoryId, ProductionReport.Status status, Pageable pageable);

    // ==================== SmartBI同步 ====================

    List<ProductionReport> findByFactoryIdAndSyncedToSmartbiFalseAndDeletedAtIsNull(String factoryId);

    @Query("SELECT DISTINCT r.factoryId FROM ProductionReport r WHERE r.syncedToSmartbi = false AND r.deletedAt IS NULL")
    List<String> findDistinctFactoryIdsWithUnsyncedReports();

    // ==================== 汇总统计 ====================

    @Query(value = """
        SELECT
            COALESCE(SUM(CAST(output_quantity AS DECIMAL(12,2))), 0) as total_output,
            COALESCE(SUM(CAST(good_quantity AS DECIMAL(12,2))), 0) as total_good,
            COALESCE(SUM(CAST(defect_quantity AS DECIMAL(12,2))), 0) as total_defect,
            COUNT(*) as report_count
        FROM production_reports
        WHERE factory_id = :factoryId
          AND report_type = 'PROGRESS'
          AND report_date BETWEEN :startDate AND :endDate
          AND deleted_at IS NULL
        """, nativeQuery = true)
    Map<String, Object> getProgressSummary(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query(value = """
        SELECT
            COALESCE(SUM(total_work_minutes), 0) as total_minutes,
            COALESCE(SUM(total_workers), 0) as total_workers,
            COALESCE(SUM(CAST(operation_volume AS DECIMAL(10,2))), 0) as total_volume,
            COUNT(*) as report_count
        FROM production_reports
        WHERE factory_id = :factoryId
          AND report_type = 'HOURS'
          AND report_date BETWEEN :startDate AND :endDate
          AND deleted_at IS NULL
        """, nativeQuery = true)
    Map<String, Object> getHoursSummary(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query(value = """
        SELECT COUNT(*) FROM production_reports
        WHERE factory_id = :factoryId
          AND report_date = :date
          AND deleted_at IS NULL
        """, nativeQuery = true)
    long countByFactoryIdAndDate(
            @Param("factoryId") String factoryId,
            @Param("date") LocalDate date);

    // ==================== 生产分析 ====================

    @Query(value = """
        SELECT
            report_date as date,
            COALESCE(SUM(CAST(output_quantity AS DECIMAL(12,2))), 0) as output,
            COALESCE(SUM(CAST(good_quantity AS DECIMAL(12,2))), 0) as good,
            COALESCE(SUM(CAST(defect_quantity AS DECIMAL(12,2))), 0) as defect,
            COUNT(*) as report_count
        FROM production_reports
        WHERE factory_id = :factoryId
          AND report_type = 'PROGRESS'
          AND report_date BETWEEN :startDate AND :endDate
          AND deleted_at IS NULL
        GROUP BY report_date
        ORDER BY report_date
        """, nativeQuery = true)
    List<Map<String, Object>> getDailyProductionTrend(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query(value = """
        SELECT
            COALESCE(product_name, '未分类') as product_name,
            COALESCE(SUM(CAST(output_quantity AS DECIMAL(12,2))), 0) as output,
            COALESCE(SUM(CAST(good_quantity AS DECIMAL(12,2))), 0) as good,
            COALESCE(SUM(CAST(defect_quantity AS DECIMAL(12,2))), 0) as defect,
            COUNT(*) as report_count
        FROM production_reports
        WHERE factory_id = :factoryId
          AND report_type = 'PROGRESS'
          AND report_date BETWEEN :startDate AND :endDate
          AND deleted_at IS NULL
        GROUP BY product_name
        ORDER BY output DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getProductBreakdown(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query(value = """
        SELECT
            COALESCE(process_category, '未分类') as process_category,
            COALESCE(SUM(CAST(output_quantity AS DECIMAL(12,2))), 0) as output,
            COALESCE(SUM(CAST(good_quantity AS DECIMAL(12,2))), 0) as good,
            COALESCE(SUM(CAST(defect_quantity AS DECIMAL(12,2))), 0) as defect,
            COUNT(*) as report_count
        FROM production_reports
        WHERE factory_id = :factoryId
          AND report_type = 'PROGRESS'
          AND report_date BETWEEN :startDate AND :endDate
          AND deleted_at IS NULL
        GROUP BY process_category
        ORDER BY output DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getProcessBreakdown(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    // ==================== 人效分析 ====================

    @Query(value = """
        SELECT
            p.worker_id,
            p.reporter_name as worker_name,
            COALESCE(SUM(CAST(p.output_quantity AS DECIMAL(12,2))), 0) as total_output,
            COALESCE(SUM(CAST(p.good_quantity AS DECIMAL(12,2))), 0) as total_good,
            COALESCE(SUM(CAST(p.defect_quantity AS DECIMAL(12,2))), 0) as total_defect,
            COALESCE(SUM(h.total_work_minutes), 0) as total_minutes,
            COUNT(DISTINCT p.report_date) as work_days
        FROM production_reports p
        LEFT JOIN production_reports h ON h.worker_id = p.worker_id
            AND h.factory_id = p.factory_id
            AND h.report_type = 'HOURS'
            AND h.report_date BETWEEN :startDate AND :endDate
            AND h.deleted_at IS NULL
        WHERE p.factory_id = :factoryId
          AND p.report_type = 'PROGRESS'
          AND p.report_date BETWEEN :startDate AND :endDate
          AND p.deleted_at IS NULL
        GROUP BY p.worker_id, p.reporter_name
        ORDER BY total_output DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getWorkerEfficiencyRanking(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query(value = """
        SELECT
            p.report_date as date,
            COALESCE(SUM(CAST(p.output_quantity AS DECIMAL(12,2))), 0) as total_output,
            COALESCE(SUM(h.total_work_minutes), 0) as total_minutes,
            COUNT(DISTINCT p.worker_id) as worker_count
        FROM production_reports p
        LEFT JOIN production_reports h ON h.worker_id = p.worker_id
            AND h.factory_id = p.factory_id
            AND h.report_type = 'HOURS'
            AND h.report_date = p.report_date
            AND h.deleted_at IS NULL
        WHERE p.factory_id = :factoryId
          AND p.report_type = 'PROGRESS'
          AND p.report_date BETWEEN :startDate AND :endDate
          AND p.deleted_at IS NULL
        GROUP BY p.report_date
        ORDER BY p.report_date
        """, nativeQuery = true)
    List<Map<String, Object>> getDailyEfficiencyTrend(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query(value = """
        SELECT
            COALESCE(p.product_name, '未分类') as product_name,
            COALESCE(SUM(h.total_work_minutes), 0) as total_minutes,
            COALESCE(SUM(CAST(p.output_quantity AS DECIMAL(12,2))), 0) as total_output,
            COUNT(DISTINCT p.worker_id) as worker_count
        FROM production_reports p
        LEFT JOIN production_reports h ON h.worker_id = p.worker_id
            AND h.factory_id = p.factory_id
            AND h.report_type = 'HOURS'
            AND h.report_date = p.report_date
            AND h.deleted_at IS NULL
        WHERE p.factory_id = :factoryId
          AND p.report_type = 'PROGRESS'
          AND p.report_date BETWEEN :startDate AND :endDate
          AND p.deleted_at IS NULL
        GROUP BY p.product_name
        ORDER BY total_minutes DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getHoursBreakdownByProduct(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query(value = """
        SELECT
            p.reporter_name as worker_name,
            COALESCE(p.process_category, '未分类') as process_category,
            COALESCE(SUM(CAST(p.output_quantity AS DECIMAL(12,2))), 0) as output
        FROM production_reports p
        WHERE p.factory_id = :factoryId
          AND p.report_type = 'PROGRESS'
          AND p.report_date BETWEEN :startDate AND :endDate
          AND p.deleted_at IS NULL
        GROUP BY p.reporter_name, p.process_category
        ORDER BY p.reporter_name, output DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getWorkerProcessCross(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
