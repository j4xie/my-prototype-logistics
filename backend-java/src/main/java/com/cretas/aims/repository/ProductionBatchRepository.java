package com.cretas.aims.repository;

import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.enums.ProductionBatchStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 生产批次数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface ProductionBatchRepository extends JpaRepository<ProductionBatch, Long> {

    /**
     * 根据工厂ID和批次号查找
     */
    Optional<ProductionBatch> findByFactoryIdAndBatchNumber(String factoryId, String batchNumber);

    /**
     * 根据ID和工厂ID查找
     */
    Optional<ProductionBatch> findByIdAndFactoryId(Long id, String factoryId);

    /**
     * 检查批次号是否存在
     */
    boolean existsByFactoryIdAndBatchNumber(String factoryId, String batchNumber);

    /**
     * 分页查找工厂的生产批次
     */
    Page<ProductionBatch> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据状态分页查找
     */
    Page<ProductionBatch> findByFactoryIdAndStatus(String factoryId, ProductionBatchStatus status, Pageable pageable);

    /**
     * 查询时间范围内的批次
     */
    java.util.List<ProductionBatch> findByFactoryIdAndCreatedAtBetween(
            String factoryId,
            LocalDateTime startDate,
            LocalDateTime endDate);

    /**
     * 统计某时间后的批次数
     */
    long countByFactoryIdAndCreatedAtAfter(String factoryId, LocalDateTime createdAt);

    /**
     * 统计某状态的批次数
     */
    long countByFactoryIdAndStatus(String factoryId, ProductionBatchStatus status);

    /**
     * 统计指定工厂、指定状态、指定时间后创建的批次数量
     * @param factoryId 工厂ID
     * @param status 批次状态（字符串）
     * @param createdAt 创建时间起点
     * @return 批次数量
     */
    long countByFactoryIdAndStatusAndCreatedAtAfter(String factoryId, String status, LocalDateTime createdAt);

    /**
     * 计算某月产量
     */
    @Query("SELECT SUM(p.actualQuantity) FROM ProductionBatch p WHERE p.factoryId = :factoryId " +
           "AND p.createdAt >= :startDate AND p.status = 'COMPLETED'")
    BigDecimal calculateMonthlyOutput(@Param("factoryId") String factoryId,
                                      @Param("startDate") LocalDateTime startDate);

    /**
     * 计算平均良品率
     */
    @Query("SELECT AVG(p.yieldRate) FROM ProductionBatch p WHERE p.factoryId = :factoryId " +
           "AND p.createdAt >= :startDate AND p.status = 'COMPLETED'")
    BigDecimal calculateAverageYieldRate(@Param("factoryId") String factoryId,
                                         @Param("startDate") LocalDateTime startDate);

    /**
     * 计算某时间后的总产量
     */
    @Query("SELECT SUM(p.actualQuantity) FROM ProductionBatch p WHERE p.factoryId = :factoryId " +
           "AND p.createdAt >= :startDate")
    BigDecimal calculateTotalOutputAfter(@Param("factoryId") String factoryId,
                                         @Param("startDate") LocalDateTime startDate);

    /**
     * 计算某时间后的总成本
     */
    @Query("SELECT SUM(p.totalCost) FROM ProductionBatch p WHERE p.factoryId = :factoryId " +
           "AND p.createdAt >= :startDate")
    BigDecimal calculateTotalCostAfter(@Param("factoryId") String factoryId,
                                       @Param("startDate") LocalDateTime startDate);

    /**
     * 计算平均效率
     */
    @Query("SELECT AVG(p.efficiency) FROM ProductionBatch p WHERE p.factoryId = :factoryId " +
           "AND p.createdAt >= :startDate AND p.status = 'COMPLETED'")
    BigDecimal calculateAverageEfficiency(@Param("factoryId") String factoryId,
                                          @Param("startDate") LocalDateTime startDate);

    /**
     * 计算每日产量
     */
    @Query("SELECT SUM(p.actualQuantity) FROM ProductionBatch p WHERE p.factoryId = :factoryId " +
           "AND p.createdAt >= :startDate AND p.createdAt <= :endDate")
    BigDecimal calculateDailyOutput(@Param("factoryId") String factoryId,
                                   @Param("startDate") LocalDateTime startDate,
                                   @Param("endDate") LocalDateTime endDate);

    /**
     * 计算每日良品率
     */
    @Query("SELECT AVG(p.yieldRate) FROM ProductionBatch p WHERE p.factoryId = :factoryId " +
           "AND p.createdAt >= :startDate AND p.createdAt <= :endDate AND p.status = 'COMPLETED'")
    BigDecimal calculateDailyYieldRate(@Param("factoryId") String factoryId,
                                       @Param("startDate") LocalDateTime startDate,
                                       @Param("endDate") LocalDateTime endDate);

    /**
     * 计算每日成本
     */
    @Query("SELECT SUM(p.totalCost) FROM ProductionBatch p WHERE p.factoryId = :factoryId " +
           "AND p.createdAt >= :startDate AND p.createdAt <= :endDate")
    BigDecimal calculateDailyCost(@Param("factoryId") String factoryId,
                                  @Param("startDate") LocalDateTime startDate,
                                  @Param("endDate") LocalDateTime endDate);
}
