package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.MaterialRequisition;
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
 * 领料/日消耗记录仓库
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
@Repository
public interface MaterialRequisitionRepository extends JpaRepository<MaterialRequisition, String> {

    // ==================== 基础查询 ====================

    Page<MaterialRequisition> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Page<MaterialRequisition> findByFactoryIdAndStatusOrderByCreatedAtDesc(
            String factoryId, MaterialRequisition.Status status, Pageable pageable);

    Page<MaterialRequisition> findByFactoryIdAndTypeOrderByCreatedAtDesc(
            String factoryId, MaterialRequisition.RequisitionType type, Pageable pageable);

    Optional<MaterialRequisition> findByIdAndFactoryId(String id, String factoryId);

    Optional<MaterialRequisition> findByFactoryIdAndRequisitionNumber(String factoryId, String requisitionNumber);

    // ==================== 日期范围查询 ====================

    @Query("SELECT r FROM MaterialRequisition r WHERE r.factoryId = :factoryId " +
            "AND r.requisitionDate BETWEEN :startDate AND :endDate " +
            "ORDER BY r.requisitionDate DESC, r.createdAt DESC")
    List<MaterialRequisition> findByFactoryIdAndDateRange(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT r FROM MaterialRequisition r WHERE r.factoryId = :factoryId " +
            "AND r.requisitionDate BETWEEN :startDate AND :endDate " +
            "AND r.status = :status " +
            "ORDER BY r.requisitionDate DESC")
    List<MaterialRequisition> findByFactoryIdAndDateRangeAndStatus(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("status") MaterialRequisition.Status status);

    // ==================== 日汇总查询 ====================

    /**
     * 日消耗汇总：按食材类型聚合当天所有已批准的领料
     */
    @Query("SELECT r.rawMaterialTypeId, r.unit, SUM(r.actualQuantity) " +
            "FROM MaterialRequisition r " +
            "WHERE r.factoryId = :factoryId " +
            "AND r.requisitionDate = :date " +
            "AND r.status = 'APPROVED' " +
            "GROUP BY r.rawMaterialTypeId, r.unit " +
            "ORDER BY SUM(r.actualQuantity) DESC")
    List<Object[]> getDailySummaryByMaterial(
            @Param("factoryId") String factoryId,
            @Param("date") LocalDate date);

    /**
     * 统计生成单号：当天该工厂的领料单数量
     */
    @Query("SELECT COUNT(r) FROM MaterialRequisition r " +
            "WHERE r.factoryId = :factoryId AND r.requisitionDate = :date")
    long countByFactoryIdAndDate(@Param("factoryId") String factoryId, @Param("date") LocalDate date);

    // ==================== 待审批 ====================

    Page<MaterialRequisition> findByFactoryIdAndStatusOrderByCreatedAtAsc(
            String factoryId, MaterialRequisition.Status status, Pageable pageable);

    /**
     * 查询某申请人的领料记录
     */
    Page<MaterialRequisition> findByFactoryIdAndRequestedByOrderByCreatedAtDesc(
            String factoryId, Long requestedBy, Pageable pageable);
}
