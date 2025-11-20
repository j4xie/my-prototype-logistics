package com.cretas.aims.repository;

import com.cretas.aims.entity.ProductionPlanBatchUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
/**
 * 生产计划批次使用关联数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface ProductionPlanBatchUsageRepository extends JpaRepository<ProductionPlanBatchUsage, Integer> {
    /**
     * 根据生产计划查找批次使用记录
     */
    List<ProductionPlanBatchUsage> findByProductionPlanId(String productionPlanId);
     /**
     * 根据原材料批次查找使用记录
      */
    List<ProductionPlanBatchUsage> findByMaterialBatchId(String materialBatchId);
     /**
     * 计算生产计划的计划用量总和
      */
    @Query("SELECT SUM(p.plannedQuantity) FROM ProductionPlanBatchUsage p WHERE p.productionPlanId = :planId")
    BigDecimal calculateTotalPlannedQuantity(@Param("planId") String planId);
     /**
     * 计算生产计划的实际用量总和
      */
    @Query("SELECT SUM(p.actualQuantity) FROM ProductionPlanBatchUsage p WHERE p.productionPlanId = :planId")
    BigDecimal calculateTotalActualQuantity(@Param("planId") String planId);
     /**
     * 删除生产计划的所有批次使用记录
      */
    void deleteByProductionPlanId(String productionPlanId);
     /**
     * 检查批次是否已分配给生产计划
      */
    boolean existsByProductionPlanIdAndMaterialBatchId(String productionPlanId, String materialBatchId);
     /**
     * 根据生产计划ID和批次ID查找使用记录
      */
    java.util.Optional<ProductionPlanBatchUsage> findByProductionPlanIdAndBatchId(String productionPlanId, String batchId);
}
