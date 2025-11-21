package com.cretas.aims.repository;

import com.cretas.aims.entity.ProcessingBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 加工批次数据访问层
 *
 * 提供19个Processing模块API端点的数据库查询支持:
 * 1. GET /processing/batches - 分页列表
 * 2. POST /processing/batches - 创建
 * 3. GET /processing/batches/{id} - 详情
 * 4. PUT /processing/batches/{id} - 更新
 * 5. POST /processing/batches/{id}/start - 开始生产
 * 6. POST /processing/batches/{id}/complete - 完成生产
 * 7. POST /processing/batches/{id}/cancel - 取消生产
 * 8. POST /processing/batches/{id}/material-consumption - 记录材料消耗
 * 9. GET /processing/materials - 获取原材料列表
 * 10. POST /processing/material-receipt - 记录原料接收
 * 11-17. 质检相关API（QualityInspectionRepository）
 * 18. GET /processing/batches/{id}/cost-analysis - 成本分析
 * 19. POST /processing/ai-cost-analysis/time-range - AI时间范围分析
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 */
@Repository
public interface ProcessingBatchRepository extends JpaRepository<ProcessingBatch, String> {

    // ========== 基础查询 ==========

    /**
     * 按工厂ID查询（分页）
     */
    Page<ProcessingBatch> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 按工厂ID查询（不分页）
     */
    List<ProcessingBatch> findByFactoryId(String factoryId);

    /**
     * 按工厂ID和ID查询
     */
    Optional<ProcessingBatch> findByFactoryIdAndId(String factoryId, String id);

    /**
     * 按批次号查询（唯一）
     */
    Optional<ProcessingBatch> findByBatchNumber(String batchNumber);

    /**
     * 检查批次号是否存在
     */
    boolean existsByBatchNumber(String batchNumber);

    // ========== 状态查询 ==========

    /**
     * 按工厂ID和状态查询（分页）
     */
    Page<ProcessingBatch> findByFactoryIdAndStatus(String factoryId, ProcessingBatch.BatchStatus status, Pageable pageable);

    /**
     * 按工厂ID和状态查询（不分页）
     */
    List<ProcessingBatch> findByFactoryIdAndStatus(String factoryId, ProcessingBatch.BatchStatus status);

    /**
     * 按工厂ID和多个状态查询
     */
    List<ProcessingBatch> findByFactoryIdAndStatusIn(String factoryId, List<ProcessingBatch.BatchStatus> statuses);

    // ========== 日期范围查询 ==========

    /**
     * 按工厂ID和开始时间范围查询（修复：startDate -> startTime，LocalDate -> LocalDateTime）
     */
    List<ProcessingBatch> findByFactoryIdAndStartTimeBetween(String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 按工厂ID和开始时间范围查询（分页）（修复：startDate -> startTime，LocalDate -> LocalDateTime）
     */
    Page<ProcessingBatch> findByFactoryIdAndStartTimeBetween(String factoryId, LocalDateTime startTime, LocalDateTime endTime, Pageable pageable);

    // ========== 产品类型查询 ==========

    /**
     * 按工厂ID和产品名称查询（修复：productType -> productName）
     */
    List<ProcessingBatch> findByFactoryIdAndProductName(String factoryId, String productName);

    // ========== 统计查询 ==========

    /**
     * 按工厂ID和创建时间范围查询（用于今日统计）
     */
    List<ProcessingBatch> findByFactoryIdAndCreatedAtBetween(String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 统计指定工厂、指定时间后创建的批次数量
     * @param factoryId 工厂ID
     * @param createdAt 创建时间起点
     * @return 批次数量
     */
    long countByFactoryIdAndCreatedAtAfter(String factoryId, LocalDateTime createdAt);

    /**
     * 统计指定工厂、指定状态、指定时间后创建的批次数量
     * @param factoryId 工厂ID
     * @param status 批次状态
     * @param createdAt 创建时间起点
     * @return 批次数量
     */
    long countByFactoryIdAndStatusAndCreatedAtAfter(String factoryId, String status, LocalDateTime createdAt);

    /**
     * 按创建时间范围查询（跨所有工厂，用于平台统计）
     *
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 批次列表
     * @since 2025-11-20
     */
    List<ProcessingBatch> findByCreatedAtBetween(LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 统计指定工厂的批次数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计指定状态的批次数量（跨所有工厂）
     *
     * @param status 批次状态
     * @return 批次数量
     * @since 2025-11-20
     */
    long countByStatus(String status);

    /**
     * 统计指定工厂和状态的批次数量
     */
    long countByFactoryIdAndStatus(String factoryId, ProcessingBatch.BatchStatus status);

    /**
     * 获取指定工厂的平均总成本
     */
    @Query("SELECT AVG(b.totalCost) FROM ProcessingBatch b WHERE b.factoryId = :factoryId AND b.totalCost IS NOT NULL")
    Double getAverageTotalCost(@Param("factoryId") String factoryId);

    /**
     * 获取指定工厂的总成本合计
     */
    @Query("SELECT SUM(b.totalCost) FROM ProcessingBatch b WHERE b.factoryId = :factoryId AND b.status = :status AND b.totalCost IS NOT NULL")
    Double getTotalCostSum(@Param("factoryId") String factoryId, @Param("status") ProcessingBatch.BatchStatus status);

    /**
     * 计算指定时间后的总产出
     * @param factoryId 工厂ID
     * @param createdAt 创建时间起点
     * @return 总产出
     */
    @Query("SELECT SUM(b.outputQuantity) FROM ProcessingBatch b WHERE b.factoryId = :factoryId AND b.createdAt >= :createdAt AND b.outputQuantity IS NOT NULL")
    java.math.BigDecimal calculateTotalOutputAfter(@Param("factoryId") String factoryId, @Param("createdAt") LocalDateTime createdAt);

    /**
     * 计算指定时间后的总成本
     * @param factoryId 工厂ID
     * @param createdAt 创建时间起点
     * @return 总成本
     */
    @Query("SELECT SUM(b.totalCost) FROM ProcessingBatch b WHERE b.factoryId = :factoryId AND b.createdAt >= :createdAt AND b.totalCost IS NOT NULL")
    java.math.BigDecimal calculateTotalCostAfter(@Param("factoryId") String factoryId, @Param("createdAt") LocalDateTime createdAt);

    /**
     * 计算平均效率
     * @param factoryId 工厂ID
     * @param createdAt 创建时间起点
     * @return 平均效率
     *
     * TODO: ProcessingBatch实体中没有productionEfficiency字段，暂时注释
     */
    // @Query("SELECT AVG(b.productionEfficiency) FROM ProcessingBatch b WHERE b.factoryId = :factoryId AND b.createdAt >= :createdAt AND b.productionEfficiency IS NOT NULL")
    // java.math.BigDecimal calculateAverageEfficiency(@Param("factoryId") String factoryId, @Param("createdAt") LocalDateTime createdAt);

    /**
     * 获取时间范围内的批次（用于成本分析）（修复：startDate -> startTime）
     */
    @Query("SELECT b FROM ProcessingBatch b WHERE b.factoryId = :factoryId AND b.startTime BETWEEN :startTime AND :endTime ORDER BY b.startTime DESC")
    List<ProcessingBatch> findBatchesInDateRange(@Param("factoryId") String factoryId,
                                                  @Param("startTime") LocalDateTime startTime,
                                                  @Param("endTime") LocalDateTime endTime);

    /**
     * 获取时间范围内的成本汇总数据（修复：rawMaterialCost -> materialCost, 删除profitRate, startDate -> startTime）
     */
    @Query("SELECT b.factoryId, " +
           "SUM(b.totalCost) as totalCost, " +
           "SUM(b.materialCost) as materialCost, " +
           "SUM(b.laborCost) as laborCost, " +
           "SUM(b.equipmentCost) as equipmentCost, " +
           "SUM(b.otherCost) as otherCost, " +
           "COUNT(b) as batchCount " +
           "FROM ProcessingBatch b " +
           "WHERE b.factoryId = :factoryId AND b.startTime BETWEEN :startTime AND :endTime " +
           "GROUP BY b.factoryId")
    Object[] getCostSummaryInDateRange(@Param("factoryId") String factoryId,
                                       @Param("startTime") LocalDateTime startTime,
                                       @Param("endTime") LocalDateTime endTime);

    // ========== 删除操作 ==========

    /**
     * 删除指定工厂的指定批次
     */
    void deleteByFactoryIdAndId(String factoryId, String id);
}
