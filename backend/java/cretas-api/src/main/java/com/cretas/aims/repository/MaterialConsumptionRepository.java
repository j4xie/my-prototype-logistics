package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialConsumption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
/**
 * 原材料消耗记录数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface MaterialConsumptionRepository extends JpaRepository<MaterialConsumption, Integer> {
    /**
     * 根据生产计划查找消耗记录
     */
    List<MaterialConsumption> findByProductionPlanId(Integer productionPlanId);

    /**
     * 根据批次查找消耗记录
     */
    List<MaterialConsumption> findByBatchId(Integer batchId);

    /**
     * 查找工厂的消耗记录
     */
    List<MaterialConsumption> findByFactoryId(String factoryId);

    /**
     * 根据时间范围查找消耗记录
     */
    @Query("SELECT m FROM MaterialConsumption m WHERE m.factoryId = :factoryId " +
           "AND m.consumptionTime BETWEEN :startTime AND :endTime")
    List<MaterialConsumption> findByTimeRange(@Param("factoryId") String factoryId,
                                              @Param("startTime") LocalDateTime startTime,
                                              @Param("endTime") LocalDateTime endTime);

    /**
     * 计算生产计划的总消耗成本
     */
    @Query("SELECT SUM(m.totalCost) FROM MaterialConsumption m WHERE m.productionPlanId = :planId")
    BigDecimal calculateTotalCostByPlan(@Param("planId") Integer planId);

    /**
     * 计算批次的总消耗量
     */
    @Query("SELECT SUM(m.quantity) FROM MaterialConsumption m WHERE m.batchId = :batchId")
    BigDecimal calculateTotalQuantityByBatch(@Param("batchId") Integer batchId);

    /**
     * 获取生产计划的消耗统计
     */
    @Query("SELECT m.batch.materialType.name, SUM(m.quantity), SUM(m.totalCost) " +
           "FROM MaterialConsumption m WHERE m.productionPlanId = :planId " +
           "GROUP BY m.batch.materialType.name")
    List<Object[]> getConsumptionStatsByPlan(@Param("planId") Integer planId);

    /**
     * 删除生产计划的所有消耗记录
     */
    void deleteByProductionPlanId(Integer productionPlanId);

    /**
     * 根据生产批次ID查找消耗记录
     */
    List<MaterialConsumption> findByProductionBatchId(Long productionBatchId);
}
