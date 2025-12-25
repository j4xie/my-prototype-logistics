package com.cretas.aims.repository;

import com.cretas.aims.entity.QualityInspection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
/**
 * 质量检验数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface QualityInspectionRepository extends JpaRepository<QualityInspection, String> {
    /**
     * 根据工厂ID分页查找
     */
    Page<QualityInspection> findByFactoryId(String factoryId, Pageable pageable);
     /**
     * 根据工厂ID和生产批次ID分页查找
      */
    Page<QualityInspection> findByFactoryIdAndProductionBatchId(String factoryId, Long productionBatchId, Pageable pageable);
     /**
     * 根据工厂ID和日期范围查找
      */
    @Query("SELECT q FROM QualityInspection q WHERE q.factoryId = :factoryId " +
           "AND q.inspectionDate >= :startDate AND q.inspectionDate <= :endDate")
    List<QualityInspection> findByFactoryIdAndDateRange(@Param("factoryId") String factoryId,
                                                        @Param("startDate") LocalDate startDate,
                                                        @Param("endDate") LocalDate endDate);

    /**
     * 查找指定日期之后的所有质检记录（跨所有工厂，用于趋势分析）
     * @param startDate 起始日期
     * @return 质检记录列表
     */
    @Query("SELECT q FROM QualityInspection q WHERE q.inspectionDate >= :startDate ORDER BY q.inspectionDate")
    List<QualityInspection> findByInspectionDateAfter(@Param("startDate") LocalDate startDate);

    /**
     * 根据生产批次ID查找质检记录
     * @param productionBatchId 生产批次ID
     * @return 质检记录列表
     */
    List<QualityInspection> findByProductionBatchId(Long productionBatchId);

    /**
     * 统计指定日期之后的质检记录数量
     * @param factoryId 工厂ID
     * @param date 起始日期
     * @return 质检记录数量
     */
    @Query("SELECT COUNT(q) FROM QualityInspection q WHERE q.factoryId = :factoryId AND q.inspectionDate >= :date")
    long countByFactoryIdAndInspectionDateAfter(@Param("factoryId") String factoryId, @Param("date") LocalDate date);
}
