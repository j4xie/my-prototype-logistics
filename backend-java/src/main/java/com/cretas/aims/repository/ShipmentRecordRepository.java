package com.cretas.aims.repository;

import com.cretas.aims.entity.ShipmentRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 出货记录数据访问层
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface ShipmentRecordRepository extends JpaRepository<ShipmentRecord, String> {

    /**
     * 根据工厂ID分页查询出货记录
     */
    Page<ShipmentRecord> findByFactoryIdOrderByShipmentDateDesc(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和状态查询出货记录
     */
    Page<ShipmentRecord> findByFactoryIdAndStatusOrderByShipmentDateDesc(
            String factoryId, String status, Pageable pageable);

    /**
     * 根据工厂ID和客户ID查询出货记录
     */
    List<ShipmentRecord> findByFactoryIdAndCustomerIdOrderByShipmentDateDesc(
            String factoryId, String customerId);

    /**
     * 根据工厂ID和日期范围查询出货记录
     */
    @Query("SELECT s FROM ShipmentRecord s WHERE s.factoryId = :factoryId " +
           "AND s.shipmentDate BETWEEN :startDate AND :endDate " +
           "ORDER BY s.shipmentDate DESC")
    List<ShipmentRecord> findByFactoryIdAndDateRange(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 根据出货单号查询
     */
    Optional<ShipmentRecord> findByShipmentNumber(String shipmentNumber);

    /**
     * 根据订单号查询
     */
    List<ShipmentRecord> findByOrderNumber(String orderNumber);

    /**
     * 根据物流单号查询
     */
    Optional<ShipmentRecord> findByTrackingNumber(String trackingNumber);

    /**
     * 统计工厂出货记录数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂指定状态的出货记录数量
     */
    long countByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 根据生产批次号查询出货记录（用于溯源）
     * 通过产品名称匹配关联的出货记录
     */
    @Query("SELECT s FROM ShipmentRecord s WHERE s.factoryId = :factoryId " +
           "AND s.productName LIKE %:batchNumber% ORDER BY s.shipmentDate DESC")
    List<ShipmentRecord> findByFactoryIdAndBatchNumber(@Param("factoryId") String factoryId,
                                                        @Param("batchNumber") String batchNumber);

    /**
     * 计算指定日期范围内的总收入
     */
    @Query("SELECT COALESCE(SUM(s.totalAmount), 0) FROM ShipmentRecord s WHERE s.factoryId = :factoryId " +
           "AND s.shipmentDate BETWEEN :startDate AND :endDate AND s.status IN ('shipped', 'delivered')")
    java.math.BigDecimal calculateTotalRevenue(@Param("factoryId") String factoryId,
                                                @Param("startDate") LocalDate startDate,
                                                @Param("endDate") LocalDate endDate);

    /**
     * 统计指定日期范围内的订单数量
     */
    @Query("SELECT COUNT(s) FROM ShipmentRecord s WHERE s.factoryId = :factoryId " +
           "AND s.shipmentDate BETWEEN :startDate AND :endDate")
    long countByFactoryIdAndDateRange(@Param("factoryId") String factoryId,
                                      @Param("startDate") LocalDate startDate,
                                      @Param("endDate") LocalDate endDate);

    /**
     * 计算平均订单金额
     */
    @Query("SELECT COALESCE(AVG(s.totalAmount), 0) FROM ShipmentRecord s WHERE s.factoryId = :factoryId " +
           "AND s.shipmentDate BETWEEN :startDate AND :endDate AND s.totalAmount IS NOT NULL")
    java.math.BigDecimal calculateAverageOrderValue(@Param("factoryId") String factoryId,
                                                     @Param("startDate") LocalDate startDate,
                                                     @Param("endDate") LocalDate endDate);

    /**
     * 计算指定日期的收入（用于趋势分析）
     */
    @Query("SELECT COALESCE(SUM(s.totalAmount), 0) FROM ShipmentRecord s WHERE s.factoryId = :factoryId " +
           "AND s.shipmentDate = :date AND s.status IN ('shipped', 'delivered')")
    java.math.BigDecimal calculateDailyRevenue(@Param("factoryId") String factoryId,
                                                @Param("date") LocalDate date);
}
