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
 * <p>本接口继承自JpaRepository，提供原材料批次实体的基础CRUD操作和复杂的业务查询方法。</p>
 *
 * <h3>功能分类</h3>
 * <ol>
 *   <li><b>基础查询</b>：按工厂ID、批次号、状态等条件查询</li>
 *   <li><b>FIFO查询</b>：按先进先出原则查询可用批次</li>
 *   <li><b>过期管理</b>：查询即将过期和已过期的批次</li>
 *   <li><b>库存统计</b>：计算库存总值、按类型统计数量等</li>
 *   <li><b>关联查询</b>：按材料类型、供应商等关联查询</li>
 * </ol>
 *
 * <h3>核心查询方法说明</h3>
 * <ul>
 *   <li><b>findAvailableBatchesFIFO</b>：
 *     <ul>
 *       <li>功能：按FIFO（先进先出）原则查找可用批次</li>
 *       <li>排序：按入库日期（receiptDate）升序，ID升序</li>
 *       <li>条件：状态为AVAILABLE，可用数量大于0</li>
 *       <li>用途：生产出库时推荐使用最早入库的批次</li>
 *     </ul>
 *   </li>
 *   <li><b>findExpiringBatches</b>：
 *     <ul>
 *       <li>功能：查找即将过期的批次</li>
 *       <li>条件：过期日期在当前日期和警告日期之间</li>
 *       <li>排序：按过期日期升序</li>
 *       <li>用途：库存预警，提醒及时使用</li>
 *     </ul>
 *   </li>
 *   <li><b>findExpiredBatches</b>：
 *     <ul>
 *       <li>功能：查找已过期的批次</li>
 *       <li>条件：过期日期小于当前日期，状态不是EXPIRED</li>
 *       <li>用途：过期批次处理</li>
 *     </ul>
 *   </li>
 *   <li><b>calculateInventoryValue</b>：
 *     <ul>
 *       <li>功能：计算库存总价值</li>
 *       <li>公式：SUM((入库数量 - 已用数量 - 预留数量) × 单价)</li>
 *       <li>条件：仅统计可用状态的批次</li>
 *     </ul>
 *   </li>
 * </ul>
 *
 * <h3>查询性能优化</h3>
 * <ul>
 *   <li>所有查询都基于factoryId，确保数据隔离</li>
 *   <li>使用索引字段进行排序（如receiptDate、expireDate）</li>
 *   <li>统计查询使用聚合函数，避免加载实体对象</li>
 *   <li>分页查询使用Pageable参数</li>
 * </ul>
 *
 * <h3>数据库索引建议</h3>
 * <p>建议在以下字段上创建索引以提高查询性能：</p>
 * <ul>
 *   <li><code>factory_id</code>：所有查询的基础条件</li>
 *   <li><code>status</code>：状态筛选</li>
 *   <li><code>expire_date</code>：过期查询</li>
 *   <li><code>material_type_id</code>：按材料类型查询</li>
 *   <li><code>batch_number</code>：批次号查询（唯一索引）</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 * @see MaterialBatch 实体类
 * @see MaterialBatchService 业务逻辑层
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
     * 搜索原材料批次（按批次号或材料类型名称模糊匹配）
     * 
     * <p>搜索功能说明：</p>
     * <ul>
     *   <li>批次号搜索：支持精确或模糊匹配批次号</li>
     *   <li>材料类型名称搜索：通过关联的RawMaterialType实体搜索材料类型名称</li>
     * </ul>
     * 
     * <p>查询逻辑：</p>
     * <ul>
     *   <li>使用LEFT JOIN关联RawMaterialType实体</li>
     *   <li>在批次号（batchNumber）和材料类型名称（materialType.name）中搜索关键词</li>
     *   <li>使用LIKE进行模糊匹配，支持部分匹配</li>
     * </ul>
     * 
     * @param factoryId 工厂ID（必填，用于数据隔离）
     * @param keyword 搜索关键词（批次号或材料类型名称，支持模糊匹配）
     * @param pageable 分页参数
     * @return 分页的批次列表
     */
    /**
     * 注意：batchNumber使用右模糊（可使用索引），name使用双向模糊（无法使用索引）
     */
    @Query("SELECT m FROM MaterialBatch m " +
           "LEFT JOIN m.materialType mt " +
           "WHERE m.factoryId = :factoryId " +
           "AND (m.batchNumber LIKE CONCAT(:keyword, '%') OR mt.name LIKE CONCAT('%', :keyword, '%'))")
    Page<MaterialBatch> searchByKeyword(@Param("factoryId") String factoryId,
                                        @Param("keyword") String keyword,
                                        Pageable pageable);

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

    /**
     * 查找所有工厂中已过期且状态为AVAILABLE的批次（定时任务用）
     * 用于自动更新过期批次状态，避免全表扫描后过滤
     * @param currentDate 当前日期
     * @return 已过期的可用批次列表
     */
    @Query("SELECT m FROM MaterialBatch m WHERE m.status = 'AVAILABLE' AND m.expireDate IS NOT NULL AND m.expireDate < :currentDate")
    List<MaterialBatch> findAllExpiredAvailableBatches(@Param("currentDate") LocalDate currentDate);

    /**
     * 统计指定日期之后入库的批次数量
     * @param factoryId 工厂ID
     * @param dateTime 起始日期时间
     * @return 批次数量
     */
    @Query("SELECT COUNT(m) FROM MaterialBatch m WHERE m.factoryId = :factoryId AND m.createdAt >= :dateTime")
    long countByFactoryIdAndReceiptDateAfter(@Param("factoryId") String factoryId, @Param("dateTime") java.time.LocalDateTime dateTime);
}
