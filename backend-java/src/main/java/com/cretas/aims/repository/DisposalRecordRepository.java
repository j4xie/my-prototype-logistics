package com.cretas.aims.repository;

import com.cretas.aims.entity.DisposalRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 报废记录Repository
 * 提供报废记录的数据访问方法
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-11-05
 */
@Repository
public interface DisposalRecordRepository extends JpaRepository<DisposalRecord, Long> {

    // ===================================================================
    // 基础查询方法
    // ===================================================================

    /**
     * 根据工厂ID查询报废记录
     */
    Page<DisposalRecord> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和报废类型查询
     */
    Page<DisposalRecord> findByFactoryIdAndDisposalType(String factoryId, String disposalType, Pageable pageable);

    /**
     * 根据质检记录ID查询报废记录
     */
    List<DisposalRecord> findByQualityInspectionId(String qualityInspectionId);

    /**
     * 根据返工记录ID查询报废记录
     */
    List<DisposalRecord> findByReworkRecordId(Long reworkRecordId);

    /**
     * 根据生产批次ID查询报废记录
     */
    List<DisposalRecord> findByProductionBatchId(String productionBatchId);

    /**
     * 根据原材料批次ID查询报废记录
     */
    List<DisposalRecord> findByMaterialBatchId(String materialBatchId);

    // ===================================================================
    // 审批相关查询
    // ===================================================================

    /**
     * 查询待审批的报废记录
     */
    @Query("SELECT d FROM DisposalRecord d WHERE d.factoryId = :factoryId " +
           "AND d.isApproved = false " +
           "ORDER BY d.disposalDate DESC")
    List<DisposalRecord> findPendingApprovals(@Param("factoryId") String factoryId);

    /**
     * 分页查询待审批的报废记录
     */
    Page<DisposalRecord> findByFactoryIdAndIsApproved(String factoryId, Boolean isApproved, Pageable pageable);

    /**
     * 统计待审批的报废记录数量
     */
    Long countByFactoryIdAndIsApproved(String factoryId, Boolean isApproved);

    /**
     * 根据审批人查询报废记录
     */
    Page<DisposalRecord> findByApprovedBy(Integer approvedBy, Pageable pageable);

    // ===================================================================
    // 时间范围查询
    // ===================================================================

    /**
     * 查询指定时间范围内的报废记录
     */
    @Query("SELECT d FROM DisposalRecord d WHERE d.factoryId = :factoryId " +
           "AND d.disposalDate BETWEEN :startDate AND :endDate " +
           "ORDER BY d.disposalDate DESC")
    List<DisposalRecord> findByDateRange(
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * 分页查询指定时间范围内的报废记录
     */
    @Query("SELECT d FROM DisposalRecord d WHERE d.factoryId = :factoryId " +
           "AND d.disposalDate BETWEEN :startDate AND :endDate")
    Page<DisposalRecord> findByDateRange(
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        Pageable pageable
    );

    // ===================================================================
    // 统计查询方法
    // ===================================================================

    /**
     * 统计工厂的总报废次数
     */
    Long countByFactoryId(String factoryId);

    /**
     * 统计特定类型的报废次数
     */
    Long countByFactoryIdAndDisposalType(String factoryId, String disposalType);

    /**
     * 统计总报废数量
     */
    @Query("SELECT COALESCE(SUM(d.disposalQuantity), 0) FROM DisposalRecord d " +
           "WHERE d.factoryId = :factoryId " +
           "AND d.disposalDate BETWEEN :startDate AND :endDate")
    Double calculateTotalDisposalQuantity(
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * 统计总损失金额
     */
    @Query("SELECT COALESCE(SUM(COALESCE(d.actualLoss, d.estimatedLoss)), 0) " +
           "FROM DisposalRecord d " +
           "WHERE d.factoryId = :factoryId " +
           "AND d.disposalDate BETWEEN :startDate AND :endDate " +
           "AND d.isApproved = true")
    Double calculateTotalLoss(
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * 统计总回收价值
     */
    @Query("SELECT COALESCE(SUM(d.recoveryValue), 0) FROM DisposalRecord d " +
           "WHERE d.factoryId = :factoryId " +
           "AND d.disposalDate BETWEEN :startDate AND :endDate " +
           "AND d.isApproved = true")
    Double calculateTotalRecoveryValue(
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * 统计净损失（总损失 - 回收价值）
     */
    @Query("SELECT COALESCE(SUM(COALESCE(d.actualLoss, d.estimatedLoss) - COALESCE(d.recoveryValue, 0)), 0) " +
           "FROM DisposalRecord d " +
           "WHERE d.factoryId = :factoryId " +
           "AND d.disposalDate BETWEEN :startDate AND :endDate " +
           "AND d.isApproved = true")
    Double calculateNetLoss(
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * 按报废类型分组统计
     */
    @Query("SELECT d.disposalType, COUNT(d), SUM(d.disposalQuantity), " +
           "SUM(COALESCE(d.actualLoss, d.estimatedLoss)) " +
           "FROM DisposalRecord d " +
           "WHERE d.factoryId = :factoryId " +
           "AND d.disposalDate BETWEEN :startDate AND :endDate " +
           "GROUP BY d.disposalType")
    List<Object[]> getDisposalStatsByType(
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    // ===================================================================
    // 可回收报废查询
    // ===================================================================

    /**
     * 查询可回收的报废记录
     */
    @Query("SELECT d FROM DisposalRecord d WHERE d.factoryId = :factoryId " +
           "AND d.disposalType = 'RECYCLE' " +
           "AND d.isApproved = true " +
           "ORDER BY d.disposalDate DESC")
    List<DisposalRecord> findRecyclableDisposals(@Param("factoryId") String factoryId);

    /**
     * 统计可回收报废的总价值
     */
    @Query("SELECT COALESCE(SUM(d.recoveryValue), 0) FROM DisposalRecord d " +
           "WHERE d.factoryId = :factoryId " +
           "AND d.disposalType = 'RECYCLE' " +
           "AND d.isApproved = true")
    Double calculateRecyclableValue(@Param("factoryId") String factoryId);

    // ===================================================================
    // 批量操作
    // ===================================================================

    /**
     * 批量审批报废记录
     */
    @Modifying
    @Transactional
    @Query("UPDATE DisposalRecord d SET d.isApproved = true, " +
           "d.approvedBy = :approverId, d.approvedByName = :approverName, " +
           "d.approvalDate = :approvalDate " +
           "WHERE d.id IN :ids AND d.factoryId = :factoryId")
    void batchApprove(
        @Param("ids") List<Long> ids,
        @Param("approverId") Integer approverId,
        @Param("approverName") String approverName,
        @Param("approvalDate") LocalDateTime approvalDate,
        @Param("factoryId") String factoryId
    );

    // ===================================================================
    // 关联查询
    // ===================================================================

    /**
     * 查询批次的所有报废记录
     */
    @Query("SELECT d FROM DisposalRecord d WHERE " +
           "(d.productionBatchId = :batchId OR d.materialBatchId = :batchId) " +
           "ORDER BY d.disposalDate DESC")
    List<DisposalRecord> findAllByBatchId(@Param("batchId") Long batchId);

    /**
     * 检查批次是否已报废
     */
    @Query("SELECT CASE WHEN COUNT(d) > 0 THEN true ELSE false END FROM DisposalRecord d " +
           "WHERE (d.productionBatchId = :batchId OR d.materialBatchId = :batchId) " +
           "AND d.isApproved = true")
    boolean isBatchDisposed(@Param("batchId") Long batchId);

    /**
     * 查询高损失报废记录（损失超过阈值）
     */
    @Query("SELECT d FROM DisposalRecord d WHERE d.factoryId = :factoryId " +
           "AND COALESCE(d.actualLoss, d.estimatedLoss, 0) > :threshold " +
           "ORDER BY COALESCE(d.actualLoss, d.estimatedLoss) DESC")
    List<DisposalRecord> findHighLossDisposals(
        @Param("factoryId") String factoryId,
        @Param("threshold") Double threshold
    );
}
