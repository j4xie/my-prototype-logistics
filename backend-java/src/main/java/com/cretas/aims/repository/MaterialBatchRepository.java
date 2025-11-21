package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 原材料批次数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface MaterialBatchRepository extends JpaRepository<MaterialBatch, String> {

    /**
     * 根据批次号查找
     */
    Optional<MaterialBatch> findByBatchNumber(String batchNumber);

    /**
     * 查找工厂的原材料批次
     */
    Page<MaterialBatch> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据状态查找批次
     */
    List<MaterialBatch> findByFactoryIdAndStatus(String factoryId, MaterialBatchStatus status);

    /**
     * 查找可用的批次（FIFO - 按购买日期排序）
     */
    @Query("SELECT m FROM MaterialBatch m WHERE m.factoryId = :factoryId " +
           "AND m.materialTypeId = :materialTypeId " +
           "AND m.status = 'AVAILABLE' " +
           "AND (m.receiptQuantity - m.usedQuantity - m.reservedQuantity) > 0 " +
           "ORDER BY m.receiptDate ASC, m.id ASC")
    List<MaterialBatch> findAvailableBatchesFIFO(@Param("factoryId") String factoryId,
                                                  @Param("materialTypeId") String materialTypeId);

    /**
     * 查找即将过期的批次
     */
    @Query("SELECT m FROM MaterialBatch m WHERE m.factoryId = :factoryId " +
           "AND m.expireDate BETWEEN CURRENT_DATE AND :warningDate " +
           "ORDER BY m.expireDate ASC")
    List<MaterialBatch> findExpiringBatches(@Param("factoryId") String factoryId,
                                            @Param("warningDate") LocalDate warningDate);

    /**
     * 查找已过期的批次
     */
    @Query("SELECT m FROM MaterialBatch m WHERE m.factoryId = :factoryId " +
           "AND m.status != 'EXPIRED' " +
           "AND m.expireDate < CURRENT_DATE")
    List<MaterialBatch> findExpiredBatches(@Param("factoryId") String factoryId);

    /**
     * 根据供应商查找批次
     */
    List<MaterialBatch> findByFactoryIdAndSupplierId(String factoryId, String supplierId);

    /**
     * 计算库存总值
     */
    @Query("SELECT SUM((m.receiptQuantity - m.usedQuantity - m.reservedQuantity) * m.unitPrice) FROM MaterialBatch m " +
           "WHERE m.factoryId = :factoryId AND m.status = 'AVAILABLE'")
    BigDecimal calculateInventoryValue(@Param("factoryId") String factoryId);

    /**
     * 按原材料类型统计库存数量
     */
    @Query("SELECT m.materialTypeId, SUM(m.receiptQuantity - m.usedQuantity - m.reservedQuantity) FROM MaterialBatch m " +
           "WHERE m.factoryId = :factoryId AND m.status = 'AVAILABLE' " +
           "GROUP BY m.materialTypeId")
    List<Object[]> sumQuantityByMaterialType(@Param("factoryId") String factoryId);

    /**
     * 获取低库存的原材料类型
     */
    @Query("SELECT DISTINCT m.materialType FROM MaterialBatch m " +
           "WHERE m.factoryId = :factoryId " +
           "GROUP BY m.materialType " +
           "HAVING SUM(m.receiptQuantity - m.usedQuantity - m.reservedQuantity) < m.materialType.minStock")
    List<Object> findLowStockMaterials(@Param("factoryId") String factoryId);

    /**
     * 检查批次号是否存在
     */
    boolean existsByBatchNumber(String batchNumber);

    /**
     * 查找指定工厂即将过期的批次（带状态）
     */
    @Query("SELECT b FROM MaterialBatch b WHERE b.factoryId = :factoryId " +
           "AND b.expireDate <= :warningDate " +
           "AND b.expireDate > CURRENT_DATE " +
           "AND b.status = :status")
    List<MaterialBatch> findExpiringBatchesByStatus(@Param("factoryId") String factoryId,
                                                     @Param("warningDate") LocalDate warningDate,
                                                     @Param("status") MaterialBatchStatus status);

    /**
     * 查找已过期批次（带日期）
     */
    @Query("SELECT b FROM MaterialBatch b WHERE b.factoryId = :factoryId " +
           "AND b.expireDate < :currentDate")
    List<MaterialBatch> findExpiredBatchesByDate(@Param("factoryId") String factoryId,
                                                  @Param("currentDate") LocalDate currentDate);

    /**
     * 根据ID和工厂ID查找
     */
    Optional<MaterialBatch> findByIdAndFactoryId(String id, String factoryId);

    /**
     * 根据工厂ID和材料类型ID查找
     */
    List<MaterialBatch> findByFactoryIdAndMaterialTypeId(String factoryId, String materialTypeId);

    /**
     * 统计工厂批次数
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂特定状态批次数
     */
    long countByFactoryIdAndStatus(String factoryId, MaterialBatchStatus status);

    /**
     * 查找可用的批次（FIFO - 带状态参数）
     */
    @Query("SELECT m FROM MaterialBatch m WHERE m.factoryId = :factoryId " +
           "AND m.materialTypeId = :materialTypeId " +
           "AND m.status = :status " +
           "ORDER BY m.receiptDate ASC, m.id ASC")
    List<MaterialBatch> findAvailableBatchesFIFOByStatus(@Param("factoryId") String factoryId,
                                                          @Param("materialTypeId") String materialTypeId,
                                                          @Param("status") MaterialBatchStatus status);

    /**
     * 根据生产计划ID和批次ID查找使用记录
     */
    @Query("SELECT u FROM ProductionPlanBatchUsage u WHERE u.productionPlanId = :planId AND u.materialBatchId = :batchId")
    Optional<Object> findByProductionPlanIdAndBatchId(@Param("planId") Integer planId,
                                                       @Param("batchId") String batchId);

    /**
     * 检查工厂ID和批次号是否存在
     */
    boolean existsByFactoryIdAndBatchNumber(String factoryId, String batchNumber);

    /**
     * 统计低库存材料数量
     */
    @Query("SELECT COUNT(DISTINCT m.materialTypeId) FROM MaterialBatch m " +
           "WHERE m.factoryId = :factoryId " +
           "GROUP BY m.materialTypeId " +
           "HAVING SUM(m.receiptQuantity - m.usedQuantity - m.reservedQuantity) < MAX(m.materialType.minStock)")
    Long countLowStockMaterials(@Param("factoryId") String factoryId);

    /**
     * 查找即将过期的批次（简化版）
     */
    @Query("SELECT m FROM MaterialBatch m WHERE m.factoryId = :factoryId " +
           "AND m.expireDate <= :warningDate " +
           "AND m.expireDate > CURRENT_DATE " +
           "AND m.status = 'AVAILABLE'")
    List<MaterialBatch> findExpiringSoon(@Param("factoryId") String factoryId,
                                         @Param("warningDate") LocalDate warningDate);
}
