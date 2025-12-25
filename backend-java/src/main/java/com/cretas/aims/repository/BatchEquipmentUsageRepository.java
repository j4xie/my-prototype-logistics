package com.cretas.aims.repository;

import com.cretas.aims.entity.BatchEquipmentUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 批次设备使用记录数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-20
 */
@Repository
public interface BatchEquipmentUsageRepository extends JpaRepository<BatchEquipmentUsage, Long> {

    /**
     * 根据设备ID查找使用记录（按开始时间倒序）
     */
    List<BatchEquipmentUsage> findByEquipmentIdOrderByStartTimeDesc(Long equipmentId);

    /**
     * 根据批次ID查找使用记录
     */
    List<BatchEquipmentUsage> findByBatchId(Long batchId);

    /**
     * 根据设备ID和开始时间之后查找使用记录
     */
    List<BatchEquipmentUsage> findByEquipmentIdAndStartTimeAfter(Long equipmentId, LocalDateTime startTime);

    /**
     * 根据设备ID和时间范围查找使用记录
     */
    @Query("SELECT u FROM BatchEquipmentUsage u WHERE u.equipmentId = :equipmentId " +
           "AND u.startTime >= :startTime AND (u.endTime IS NULL OR u.endTime <= :endTime) " +
           "ORDER BY u.startTime DESC")
    List<BatchEquipmentUsage> findByEquipmentIdAndTimeRange(
            @Param("equipmentId") Long equipmentId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 计算设备在指定时间范围内的总使用小时数
     */
    @Query("SELECT COALESCE(SUM(u.usageHours), 0) FROM BatchEquipmentUsage u WHERE u.equipmentId = :equipmentId " +
           "AND u.startTime >= :startTime AND (u.endTime IS NULL OR u.endTime <= :endTime)")
    BigDecimal sumUsageHoursByEquipmentIdAndTimeRange(
            @Param("equipmentId") Long equipmentId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 计算设备在指定时间范围内的使用次数
     */
    @Query("SELECT COUNT(u) FROM BatchEquipmentUsage u WHERE u.equipmentId = :equipmentId " +
           "AND u.startTime >= :startTime AND (u.endTime IS NULL OR u.endTime <= :endTime)")
    Long countByEquipmentIdAndTimeRange(
            @Param("equipmentId") Long equipmentId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 计算设备在指定时间范围内的总成本
     */
    @Query("SELECT COALESCE(SUM(u.equipmentCost), 0) FROM BatchEquipmentUsage u WHERE u.equipmentId = :equipmentId " +
           "AND u.startTime >= :startTime AND (u.endTime IS NULL OR u.endTime <= :endTime)")
    BigDecimal sumCostByEquipmentIdAndTimeRange(
            @Param("equipmentId") Long equipmentId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);
}
