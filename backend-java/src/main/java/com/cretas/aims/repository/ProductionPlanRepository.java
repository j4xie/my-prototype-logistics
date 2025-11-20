package com.cretas.aims.repository;

import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 生产计划数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface ProductionPlanRepository extends JpaRepository<ProductionPlan, String> {

    /**
     * 根据计划编号查找
     */
    Optional<ProductionPlan> findByPlanNumber(String planNumber);

    /**
     * 查找工厂的生产计划
     */
    Page<ProductionPlan> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据状态查找生产计划
     */
    List<ProductionPlan> findByFactoryIdAndStatus(String factoryId, ProductionPlanStatus status);

    /**
     * 查找指定日期范围内的生产计划
     * 暂时注释 - 数据库表中没有planned_date字段
     */
    // @Query("SELECT p FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
    //        "AND p.plannedDate BETWEEN :startDate AND :endDate")
    // List<ProductionPlan> findByDateRange(@Param("factoryId") String factoryId,
    //                                      @Param("startDate") LocalDate startDate,
    //                                      @Param("endDate") LocalDate endDate);

    /**
     * 查找今日的生产计划
     * 暂时注释 - 数据库表中没有planned_date字段
     */
    // @Query("SELECT p FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
    //        "AND p.plannedDate = CURRENT_DATE")
    // List<ProductionPlan> findTodayPlans(@Param("factoryId") String factoryId);

    /**
     * 根据产品类型查找生产计划
     */
    List<ProductionPlan> findByFactoryIdAndProductTypeId(String factoryId, Integer productTypeId);

    /**
     * 根据客户订单号查找
     */
    Optional<ProductionPlan> findByCustomerOrderNumber(String customerOrderNumber);

    /**
     * 统计生产计划状态
     */
    @Query("SELECT p.status, COUNT(p) FROM ProductionPlan p " +
           "WHERE p.factoryId = :factoryId GROUP BY p.status")
    List<Object[]> countByStatus(@Param("factoryId") String factoryId);

    /**
     * 获取需要执行的计划（待处理且到达计划日期）
     * 暂时注释 - 数据库表中没有planned_date字段
     */
    // @Query("SELECT p FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
    //        "AND p.status = 'PENDING' AND p.plannedDate <= CURRENT_DATE " +
    //        "ORDER BY p.priority DESC, p.plannedDate ASC")
    // List<ProductionPlan> findPendingPlansToExecute(@Param("factoryId") String factoryId);

    /**
     * 计算总成本
     */
    @Query("SELECT SUM(COALESCE(p.actualMaterialCost, 0) + " +
           "COALESCE(p.actualLaborCost, 0) + " +
           "COALESCE(p.actualEquipmentCost, 0) + " +
           "COALESCE(p.actualOtherCost, 0)) " +
           "FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
           "AND p.status = 'COMPLETED'")
    Double calculateTotalCost(@Param("factoryId") String factoryId);

    /**
     * 统计工厂的生产计划数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂指定状态的生产计划数量
     */
    long countByFactoryIdAndStatus(String factoryId, ProductionPlanStatus status);

    /**
     * 计算工厂的总产量
     */
    @Query("SELECT SUM(p.actualQuantity) FROM ProductionPlan p WHERE p.factoryId = :factoryId")
    BigDecimal calculateTotalOutput(@Param("factoryId") String factoryId);

    /**
     * 计算指定日期范围内的产量
     */
    @Query("SELECT SUM(p.actualQuantity) FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
           "AND p.endTime BETWEEN :startDate AND :endDate")
    BigDecimal calculateOutputBetweenDates(@Param("factoryId") String factoryId,
                                           @Param("startDate") LocalDateTime startDate,
                                           @Param("endDate") LocalDateTime endDate);

    /**
     * 计算指定日期范围内的总成本
     */
    @Query("SELECT SUM(COALESCE(p.actualMaterialCost, 0) + " +
           "COALESCE(p.actualLaborCost, 0) + " +
           "COALESCE(p.actualEquipmentCost, 0) + " +
           "COALESCE(p.actualOtherCost, 0)) " +
           "FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
           "AND p.endTime BETWEEN :startDate AND :endDate")
    BigDecimal calculateTotalCostBetweenDates(@Param("factoryId") String factoryId,
                                              @Param("startDate") LocalDateTime startDate,
                                              @Param("endDate") LocalDateTime endDate);

    /**
     * 计算指定日期范围内的原材料成本
     */
    @Query("SELECT SUM(p.actualMaterialCost) FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
           "AND p.endTime BETWEEN :startDate AND :endDate")
    BigDecimal calculateMaterialCostBetweenDates(@Param("factoryId") String factoryId,
                                                 @Param("startDate") LocalDateTime startDate,
                                                 @Param("endDate") LocalDateTime endDate);

    /**
     * 计算指定日期范围内的人工成本
     */
    @Query("SELECT SUM(p.actualLaborCost) FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
           "AND p.endTime BETWEEN :startDate AND :endDate")
    BigDecimal calculateLaborCostBetweenDates(@Param("factoryId") String factoryId,
                                              @Param("startDate") LocalDateTime startDate,
                                              @Param("endDate") LocalDateTime endDate);

    /**
     * 计算指定日期范围内的设备成本
     */
    @Query("SELECT SUM(p.actualEquipmentCost) FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
           "AND p.endTime BETWEEN :startDate AND :endDate")
    BigDecimal calculateEquipmentCostBetweenDates(@Param("factoryId") String factoryId,
                                                  @Param("startDate") LocalDateTime startDate,
                                                  @Param("endDate") LocalDateTime endDate);

    /**
     * 计算指定日期范围内的其他成本
     */
    @Query("SELECT SUM(p.actualOtherCost) FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
           "AND p.endTime BETWEEN :startDate AND :endDate")
    BigDecimal calculateOtherCostBetweenDates(@Param("factoryId") String factoryId,
                                              @Param("startDate") LocalDateTime startDate,
                                              @Param("endDate") LocalDateTime endDate);

    /**
     * 统计指定日期范围内的生产计划数量
     * 暂时注释 - 数据库表中没有planned_date字段
     */
    // @Query("SELECT COUNT(p) FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
    //        "AND p.plannedDate BETWEEN :startDate AND :endDate")
    // long countByFactoryIdAndDateRange(@Param("factoryId") String factoryId,
    //                                   @Param("startDate") LocalDate startDate,
    //                                   @Param("endDate") LocalDate endDate);

    /**
     * 统计指定日期范围内指定状态的生产计划数量
     * 暂时注释 - 数据库表中没有planned_date字段
     */
    // @Query("SELECT COUNT(p) FROM ProductionPlan p WHERE p.factoryId = :factoryId " +
    //        "AND p.status = :status AND p.plannedDate BETWEEN :startDate AND :endDate")
    // long countByFactoryIdAndStatusAndDateRange(@Param("factoryId") String factoryId,
    //                                            @Param("status") ProductionPlanStatus status,
    //                                            @Param("startDate") LocalDate startDate,
    //                                            @Param("endDate") LocalDate endDate);
}
