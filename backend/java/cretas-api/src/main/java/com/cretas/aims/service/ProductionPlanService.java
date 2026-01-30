package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.production.CreateProductionPlanRequest;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
/**
 * 生产计划服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface ProductionPlanService {
    /**
     * 创建生产计划
     */
    ProductionPlanDTO createProductionPlan(String factoryId, CreateProductionPlanRequest request, Long userId);
     /**
     * 更新生产计划
      */
    ProductionPlanDTO updateProductionPlan(String factoryId, String planId, CreateProductionPlanRequest request);
     /**
     * 删除生产计划
      */
    void deleteProductionPlan(String factoryId, String planId);
     /**
     * 获取生产计划详情
      */
    ProductionPlanDTO getProductionPlanById(String factoryId, String planId);
     /**
     * 获取生产计划列表（分页）
      */
    PageResponse<ProductionPlanDTO> getProductionPlanList(String factoryId, PageRequest pageRequest);
     /**
     * 按状态获取生产计划
      */
    List<ProductionPlanDTO> getProductionPlansByStatus(String factoryId, ProductionPlanStatus status);
     /**
     * 按日期范围获取生产计划
      */
    List<ProductionPlanDTO> getProductionPlansByDateRange(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取今日生产计划
      */
    List<ProductionPlanDTO> getTodayProductionPlans(String factoryId);
     /**
     * 开始生产
      */
    ProductionPlanDTO startProduction(String factoryId, String planId);
     /**
     * 完成生产
      */
    ProductionPlanDTO completeProduction(String factoryId, String planId, BigDecimal actualQuantity);
     /**
     * 取消生产计划
      */
    void cancelProductionPlan(String factoryId, String planId, String reason);
     /**
     * 暂停生产
      */
    ProductionPlanDTO pauseProduction(String factoryId, String planId);
     /**
     * 恢复生产
      */
    ProductionPlanDTO resumeProduction(String factoryId, String planId);
     /**
     * 更新实际成本
      */
    ProductionPlanDTO updateActualCosts(String factoryId, String planId,
                                        BigDecimal materialCost,
                                        BigDecimal laborCost,
                                        BigDecimal equipmentCost,
                                        BigDecimal otherCost);
     /**
     * 分配原材料批次
      */
    void assignMaterialBatches(String factoryId, String planId, List<String> batchIds);
     /**
     * 记录材料消耗
      */
    void recordMaterialConsumption(String factoryId, String planId, String batchId, BigDecimal quantity);
     /**
     * 获取生产计划统计
      */
    Map<String, Object> getProductionStatistics(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取需要执行的计划
      */
    List<ProductionPlanDTO> getPendingPlansToExecute(String factoryId);
     /**
     * 批量创建生产计划
      */
    List<ProductionPlanDTO> batchCreateProductionPlans(String factoryId, List<CreateProductionPlanRequest> requests, Long userId);
     /**
     * 导出生产计划
      */
    byte[] exportProductionPlans(String factoryId, LocalDate startDate, LocalDate endDate);
}
