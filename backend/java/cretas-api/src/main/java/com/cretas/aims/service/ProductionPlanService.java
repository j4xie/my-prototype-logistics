package com.cretas.aims.service;

import com.cretas.aims.dto.common.ImportResult;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.production.CreateProductionPlanRequest;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import java.io.InputStream;
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
     * 创建草稿态 (PREPARED) 生产计划 — M-PREP-1, Sprint 4 W2.
     * 与 createProductionPlan 相同, 但 status 初始化为 PREPARED 而非 PENDING。
     * 用于先创建后预览物料短缺, 满足后再 commitDraft 提交到 PENDING。
      */
    ProductionPlanDTO createDraftProductionPlan(String factoryId, CreateProductionPlanRequest request, Long userId);
     /**
     * 提交草稿态生产计划 — M-PREP-1, Sprint 4 W2.
     * 将 PREPARED 状态的计划转换为 PENDING (正式提交)。
     * 仅允许 PREPARED → PENDING, 其他状态拒绝。
      */
    ProductionPlanDTO commitDraftProductionPlan(String factoryId, String planId);
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
     * 导出生产计划 (Excel).
     *
     * <p>RBAC defense-in-depth (PR P0-C sweep, 2026-05-12): {@code maskPrice} 参数
     * 已 wired through 但目前 {@code ProductionPlanImportDTO} 不含 cost/price 列 (产品/
     * 数量/日期/优先级/产线/工人数/主管/订单号/备注), 故该参数当前 no-op. 当未来 export 加上
     * actualMaterialCost / laborCost / equipmentCost / otherCost / totalCost 等列时,
     * 该参数即可用于在 maskPrice=true 时把这些列替换为 "—". 见 PR #450 sweep matrix 行 9.
     *
     * @param factoryId  工厂 ID
     * @param startDate  起始日期
     * @param endDate    结束日期
     * @param maskPrice  {@code true} → mask cost columns (future); {@code false} → real values
     */
    byte[] exportProductionPlans(String factoryId, LocalDate startDate, LocalDate endDate,
                                 boolean maskPrice);

    /** @deprecated callers must pass {@code maskPrice} explicitly (RBAC). Defaults to admin (no mask). */
    @Deprecated
    default byte[] exportProductionPlans(String factoryId, LocalDate startDate, LocalDate endDate) {
        return exportProductionPlans(factoryId, startDate, endDate, false);
    }
     /**
     * Excel批量导入生产计划
      */
    ImportResult<ProductionPlanDTO> importProductionPlansFromExcel(String factoryId, InputStream inputStream, Long userId);
     /**
     * 生成生产计划导入模板
      */
    byte[] generateImportTemplate();

    /**
     * 从生产计划创建生产批次（计划→执行转换）
     * 映射：suggestedProductionLineId→equipmentId, estimatedWorkers→workerCount, assignedSupervisorId→supervisorId
     */
    ProductionBatch createBatchFromPlan(String factoryId, String planId);
}
