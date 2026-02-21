package com.cretas.aims.service.restaurant;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.restaurant.MaterialRequisition;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 领料/日消耗服务接口
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
public interface MaterialRequisitionService {

    // ==================== 查询 ====================

    /**
     * 分页查询领料记录（支持按日期、状态、类型筛选）
     */
    PageResponse<MaterialRequisition> getRequisitions(
            String factoryId,
            LocalDate date,
            MaterialRequisition.Status status,
            MaterialRequisition.RequisitionType type,
            int page, int size);

    /**
     * 查询领料详情
     */
    MaterialRequisition getRequisitionById(String factoryId, String requisitionId);

    // ==================== 创建 ====================

    /**
     * 创建领料单
     * <p>若 type = PRODUCTION 且传入了 productTypeId 和 dishQuantity，
     * 则自动按 BOM 配方计算 requestedQuantity</p>
     */
    MaterialRequisition createRequisition(String factoryId, MaterialRequisition requisition, Long userId);

    // ==================== 审批流 ====================

    /**
     * 提交领料单（DRAFT -> SUBMITTED）
     */
    MaterialRequisition submitRequisition(String factoryId, String requisitionId, Long userId);

    /**
     * 审批通过（SUBMITTED -> APPROVED），自动扣减物料批次库存
     *
     * @param actualQuantity 实际批准的领用数量（可与申请量不同）
     */
    MaterialRequisition approveRequisition(String factoryId, String requisitionId,
                                           Long approvedBy, java.math.BigDecimal actualQuantity);

    /**
     * 驳回领料单（SUBMITTED -> REJECTED）
     */
    MaterialRequisition rejectRequisition(String factoryId, String requisitionId,
                                          Long approvedBy, String reason);

    // ==================== 汇总 ====================

    /**
     * 日消耗汇总：统计指定日期每种食材的总领用量
     *
     * @return [{rawMaterialTypeId, unit, totalQuantity, materialName, ...}]
     */
    List<Map<String, Object>> getDailySummary(String factoryId, LocalDate date);

    /**
     * 统计概览（今日领料数、待审批数、本月消耗金额等）
     */
    Map<String, Object> getStatistics(String factoryId);
}
