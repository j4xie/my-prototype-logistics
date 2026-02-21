package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.WastageRecord;
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
 * 损耗记录仓库
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
@Repository
public interface WastageRecordRepository extends JpaRepository<WastageRecord, String> {

    // ==================== 基础查询 ====================

    Page<WastageRecord> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Page<WastageRecord> findByFactoryIdAndStatusOrderByCreatedAtDesc(
            String factoryId, WastageRecord.Status status, Pageable pageable);

    Page<WastageRecord> findByFactoryIdAndTypeOrderByCreatedAtDesc(
            String factoryId, WastageRecord.WastageType type, Pageable pageable);

    Optional<WastageRecord> findByIdAndFactoryId(String id, String factoryId);

    Optional<WastageRecord> findByFactoryIdAndWastageNumber(String factoryId, String wastageNumber);

    // ==================== 日期范围查询 ====================

    @Query("SELECT w FROM WastageRecord w WHERE w.factoryId = :factoryId " +
            "AND w.wastageDate BETWEEN :startDate AND :endDate " +
            "ORDER BY w.wastageDate DESC, w.createdAt DESC")
    List<WastageRecord> findByFactoryIdAndDateRange(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    // ==================== 统计查询 ====================

    /**
     * 按损耗类型统计数量和金额
     */
    @Query("SELECT w.type, COUNT(w), SUM(w.quantity), SUM(w.estimatedCost) " +
            "FROM WastageRecord w " +
            "WHERE w.factoryId = :factoryId " +
            "AND w.status = 'APPROVED' " +
            "AND w.wastageDate BETWEEN :startDate AND :endDate " +
            "GROUP BY w.type " +
            "ORDER BY SUM(w.estimatedCost) DESC")
    List<Object[]> getStatisticsByType(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 按食材统计损耗数量和金额（Top N 高损耗食材）
     */
    @Query("SELECT w.rawMaterialTypeId, w.unit, SUM(w.quantity), SUM(w.estimatedCost) " +
            "FROM WastageRecord w " +
            "WHERE w.factoryId = :factoryId " +
            "AND w.status = 'APPROVED' " +
            "AND w.wastageDate BETWEEN :startDate AND :endDate " +
            "GROUP BY w.rawMaterialTypeId, w.unit " +
            "ORDER BY SUM(w.estimatedCost) DESC")
    List<Object[]> getStatisticsByMaterial(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 损耗总金额（时间范围内）
     */
    @Query("SELECT COALESCE(SUM(w.estimatedCost), 0) FROM WastageRecord w " +
            "WHERE w.factoryId = :factoryId " +
            "AND w.status = 'APPROVED' " +
            "AND w.wastageDate BETWEEN :startDate AND :endDate")
    BigDecimal getTotalEstimatedCost(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计生成单号：当天该工厂的损耗单数量
     */
    @Query("SELECT COUNT(w) FROM WastageRecord w " +
            "WHERE w.factoryId = :factoryId AND w.wastageDate = :date")
    long countByFactoryIdAndDate(@Param("factoryId") String factoryId, @Param("date") LocalDate date);
}
