package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.ConvertToFrozenRequest;
import com.cretas.aims.dto.material.UndoFrozenRequest;
import com.cretas.aims.dto.material.CreateMaterialBatchRequest;
import com.cretas.aims.dto.material.UpdateMaterialBatchRequest;
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
    MaterialBatchDTO createMaterialBatch(String factoryId, CreateMaterialBatchRequest request, Long userId);
     /**
     * 更新原材料批次
      */
    MaterialBatchDTO updateMaterialBatch(String factoryId, String batchId, UpdateMaterialBatchRequest request);
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
    List<MaterialBatchDTO> batchCreateMaterialBatches(String factoryId, List<CreateMaterialBatchRequest> requests, Long userId);
     /**
     * 导出库存报表 (Excel).
     *
     * @deprecated callers must pass {@code maskPrice} explicitly (RBAC). Defaults to admin (no mask).
     *             Kept for binary-compat with existing internal callers.
      */
    @Deprecated
    default byte[] exportInventoryReport(String factoryId) {
        return exportInventoryReport(factoryId, null, null, false);
    }
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
     * 导出库存报表（带日期范围）.
     *
     * @deprecated callers must pass {@code maskPrice} explicitly (RBAC). Defaults to admin (no mask).
      */
    @Deprecated
    default byte[] exportInventoryReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        return exportInventoryReport(factoryId, startDate, endDate, false);
    }

    /**
     * 导出库存报表 (Excel) with RBAC price-mask flag.
     *
     * <p>RBAC defense-in-depth (PR P0-C sweep, 2026-05-12): {@code maskPrice}=true 时
     * 采购单价 / 库存价值 列以 "—" 占位, 通过 {@link com.cretas.aims.dto.material.MaterialBatchMaskedExportDTO}
     * 渲染.
     *
     * @param factoryId  工厂 ID
     * @param startDate  起始日期 (可选, null = 不限)
     * @param endDate    结束日期 (可选, null = 不限)
     * @param maskPrice  {@code true} → 采购单价 / 库存价值 显示 "—"; {@code false} → 真实数值
     */
    byte[] exportInventoryReport(String factoryId, LocalDate startDate, LocalDate endDate, boolean maskPrice);
     /**
     * 按材料类型获取批次
      */
    List<MaterialBatchDTO> getMaterialBatchesByType(String factoryId, String materialTypeId);
     /**
     * 获取FIFO批次（先进先出）
      */
    List<MaterialBatchDTO> getFIFOBatches(String factoryId, String materialTypeId, BigDecimal requiredQuantity);

    /**
     * 获取FEFO批次（先到期先出，食品行业合规）
     */
    List<MaterialBatchDTO> getFEFOBatches(String factoryId, String materialTypeId, BigDecimal requiredQuantity);

     /**
     * 使用批次材料
      */
    MaterialBatchDTO useBatchMaterial(String factoryId, String batchId, BigDecimal quantity, String productionPlanId);
     /**
     * 调整批次数量（带操作人）
      */
    MaterialBatchDTO adjustBatchQuantity(String factoryId, String batchId, BigDecimal newQuantity, String reason, Long adjustedBy);
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

    /**
     * 撤销转冻品操作
     *
     * 业务规则：
     * 1. 批次当前状态必须是FROZEN
     * 2. 转换时间必须在10分钟内
     * 3. 操作人必须是原转换操作人或管理员
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param request 撤销请求参数
     * @return 撤销后的批次信息
     * @since 2025-11-20
     */
    MaterialBatchDTO undoFrozen(String factoryId, String batchId, UndoFrozenRequest request);

    /**
     * 重算并更新某原料类型的移动平均价
     *
     * 公式: newAvg = (existingQty × currentAvg + receiptQty × receiptPrice) / (existingQty + receiptQty)
     *
     * 入库链路若不走 createMaterialBatch (例如 PurchaseService.confirmReceive 直接 new MaterialBatch),
     * 必须显式调用本方法, 否则三价对比的"移动均价"列将永远为 null。
     *
     * @param materialTypeId 原料类型ID
     * @param receiptQty 本次入库数量
     * @param receiptPrice 本次入库单价
     * @param newBatchId 本次新建的批次ID, 用于在汇总现有量时把自己排除
     */
    void recalculateMovingAvgPrice(String materialTypeId, BigDecimal receiptQty,
                                   BigDecimal receiptPrice, String newBatchId);
}
