package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.ConvertToFrozenRequest;
import com.cretas.aims.dto.material.CreateMaterialBatchRequest;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
/**
 * 原材料批次服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface MaterialBatchService {
    /**
     * 创建原材料批次（入库）
     */
    MaterialBatchDTO createMaterialBatch(String factoryId, CreateMaterialBatchRequest request, Integer userId);
     /**
     * 更新原材料批次
      */
    MaterialBatchDTO updateMaterialBatch(String factoryId, String batchId, CreateMaterialBatchRequest request);
     /**
     * 删除原材料批次
      */
    void deleteMaterialBatch(String factoryId, String batchId);
     /**
     * 获取原材料批次详情
      */
    MaterialBatchDTO getMaterialBatchById(String factoryId, String batchId);
     /**
     * 获取原材料批次列表（分页）
      */
    PageResponse<MaterialBatchDTO> getMaterialBatchList(String factoryId, PageRequest pageRequest);
     /**
     * 根据状态获取批次
      */
    List<MaterialBatchDTO> getMaterialBatchesByStatus(String factoryId, MaterialBatchStatus status);
     /**
     * 获取可用批次（FIFO）
      */
    List<MaterialBatchDTO> getAvailableBatchesFIFO(String factoryId, String materialTypeId);
     /**
     * 获取即将过期的批次
      */
    List<MaterialBatchDTO> getExpiringBatches(String factoryId, Integer warningDays);
     /**
     * 获取已过期的批次
      */
    List<MaterialBatchDTO> getExpiredBatches(String factoryId);
     /**
     * 根据供应商获取批次
      */
    List<MaterialBatchDTO> getMaterialBatchesBySupplier(String factoryId, String supplierId);
     /**
     * 调整批次数量
      */
    MaterialBatchDTO adjustBatchQuantity(String factoryId, String batchId, BigDecimal adjustmentQuantity, String reason);
     /**
     * 标记批次过期
      */
    void markBatchAsExpired(String factoryId, String batchId);
     /**
     * 标记批次用完
      */
    void markBatchAsUsedUp(String factoryId, String batchId);
     /**
     * 预留批次数量
      */
    void reserveBatchQuantity(String factoryId, String batchId, BigDecimal quantity);
     /**
     * 释放预留数量
      */
    void releaseBatchQuantity(String factoryId, String batchId, BigDecimal quantity);
     /**
     * 使用批次数量
      */
    void useBatchQuantity(String factoryId, String batchId, BigDecimal quantity);
     /**
     * 计算库存总值
      */
    BigDecimal calculateInventoryValue(String factoryId);
     /**
     * 按原材料类型统计库存
      */
    Map<String, BigDecimal> getInventoryByMaterialType(String factoryId);
     /**
     * 获取低库存预警
      */
    List<Map<String, Object>> getLowStockWarnings(String factoryId);
     /**
     * 批量入库
      */
    List<MaterialBatchDTO> batchCreateMaterialBatches(String factoryId, List<CreateMaterialBatchRequest> requests, Integer userId);
     /**
     * 导出库存报表
      */
    byte[] exportInventoryReport(String factoryId);
     /**
     * 获取批次使用记录
      */
    List<Map<String, Object>> getBatchUsageHistory(String factoryId, String batchId);
     /**
     * 检查批次号是否存在
      */
    boolean checkBatchNumberExists(String batchNumber);
     /**
     * 自动检查并更新过期批次
      */
    void autoCheckAndUpdateExpiredBatches();
     /**
     * 导出库存报表（带日期范围）
      */
    byte[] exportInventoryReport(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 按材料类型获取批次
      */
    List<MaterialBatchDTO> getMaterialBatchesByType(String factoryId, String materialTypeId);
     /**
     * 获取FIFO批次（先进先出）
      */
    List<MaterialBatchDTO> getFIFOBatches(String factoryId, String materialTypeId, BigDecimal requiredQuantity);
     /**
     * 使用批次材料
      */
    MaterialBatchDTO useBatchMaterial(String factoryId, String batchId, BigDecimal quantity, String productionPlanId);
     /**
     * 调整批次数量（带操作人）
      */
    MaterialBatchDTO adjustBatchQuantity(String factoryId, String batchId, BigDecimal newQuantity, String reason, Integer adjustedBy);
     /**
     * 更新批次状态
      */
    MaterialBatchDTO updateBatchStatus(String factoryId, String batchId, MaterialBatchStatus status);
     /**
     * 预留批次材料
      */
    void reserveBatchMaterial(String factoryId, String batchId, BigDecimal quantity, String productionPlanId);
     /**
     * 释放预留材料
      */
    void releaseBatchReservation(String factoryId, String batchId, BigDecimal quantity, String productionPlanId);
     /**
     * 消耗批次材料（从预留中扣减）
      */
    void consumeBatchMaterial(String factoryId, String batchId, BigDecimal quantity, String productionPlanId);
     /**
     * 获取库存统计
      */
    Map<String, Object> getInventoryStatistics(String factoryId);
     /**
     * 获取库存价值
      */
    BigDecimal getInventoryValuation(String factoryId);
     /**
     * 处理过期批次
      */
    int handleExpiredBatches(String factoryId);

    /**
     * 转冻品
     * 将原材料批次从鲜品转换为冻品状态
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param request 转换请求参数
     * @return 转换后的批次信息
     * @since 2025-11-20
     */
    MaterialBatchDTO convertToFrozen(String factoryId, String batchId, ConvertToFrozenRequest request);
}
