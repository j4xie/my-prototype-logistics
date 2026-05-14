package com.cretas.aims.service.inventory;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateDeliveryRequest;
import com.cretas.aims.dto.inventory.CreateSalesOrderRequest;
import com.cretas.aims.dto.inventory.UpdateSalesOrderRequest;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.entity.inventory.SalesDeliveryRecord;
import com.cretas.aims.entity.inventory.SalesOrder;

import java.util.List;
import java.util.Map;

public interface SalesService {

    // ==================== 销售订单 ====================

    SalesOrder createSalesOrder(String factoryId, CreateSalesOrderRequest request, Long userId);

    SalesOrder getSalesOrderById(String factoryId, String orderId);

    PageResponse<SalesOrder> getSalesOrders(String factoryId, int page, int size);

    /** Bug G fix: keyword search overload (qa-prompt v2.3 Rule 12.1) */
    PageResponse<SalesOrder> getSalesOrders(String factoryId, String keyword, int page, int size);

    PageResponse<SalesOrder> getSalesOrdersByStatus(String factoryId, SalesOrderStatus status, int page, int size);

    SalesOrder confirmOrder(String factoryId, String orderId);

    /** 提交财务审核: CONFIRMED -> PENDING_FINANCE_REVIEW */
    SalesOrder submitForFinanceReview(String factoryId, String orderId);

    /** 财务审核通过: PENDING_FINANCE_REVIEW -> FINANCE_APPROVED, 触发供应链联动 */
    SalesOrder financeApproveOrder(String factoryId, String orderId, String notes, Long reviewerId);

    /**
     * 六扇门 V1 §2.2 (audit fix 2026-04-26 #6): finance approve with optional
     * estimatedCost. If provided, persists to sales_orders.estimated_cost and
     * auto-computes estimated_profit = totalAmount - estimatedCost.
     */
    SalesOrder financeApproveOrder(String factoryId, String orderId, String notes,
                                    java.math.BigDecimal estimatedCost, Long reviewerId);

    /** 财务审核驳回: PENDING_FINANCE_REVIEW -> FINANCE_REJECTED */
    SalesOrder financeRejectOrder(String factoryId, String orderId, String reason, Long reviewerId);

    SalesOrder updateSalesOrder(String factoryId, String orderId, UpdateSalesOrderRequest request);

    SalesOrder cancelOrder(String factoryId, String orderId);

    // ==================== 发货/出库 ====================

    SalesDeliveryRecord createDeliveryRecord(String factoryId, CreateDeliveryRequest request, Long userId);

    SalesDeliveryRecord shipDelivery(String factoryId, String deliveryId, Long userId);

    SalesDeliveryRecord confirmDelivered(String factoryId, String deliveryId);

    SalesDeliveryRecord getDeliveryRecordById(String factoryId, String deliveryId);

    PageResponse<SalesDeliveryRecord> getDeliveryRecords(String factoryId, int page, int size);

    List<SalesDeliveryRecord> getDeliveryRecordsByOrder(String salesOrderId);

    /** P0-NEW-1 上传签收凭证 (照片+签收人+备注) */
    SalesDeliveryRecord uploadDeliverySignature(String factoryId, String deliveryId,
                                                 List<String> photoUrls, String signedByName, String remark);

    // ==================== 成品库存 ====================

    PageResponse<FinishedGoodsBatch> getFinishedGoodsBatches(String factoryId, int page, int size);

    List<FinishedGoodsBatch> getAvailableBatches(String factoryId, String productTypeId);

    /**
     * T4-D5 #572 Phase B-1: 按 sourceWarehouseCode 过滤的可用成品批次查询.
     *
     * <p>{@code sourceWarehouseCode} 为 null/空时回落到 WH-LOG (保持 D5 默认行为, 与 Phase A 一致).
     */
    List<FinishedGoodsBatch> getAvailableBatches(String factoryId, String productTypeId, String sourceWarehouseCode);

    FinishedGoodsBatch createFinishedGoodsBatch(String factoryId, FinishedGoodsBatch batch, Long userId);

    // ==================== 公式计算 ====================

    Map<String, Object> computeOrderFormulas(String factoryId, String orderId);

    // ==================== 统计 ====================

    Map<String, Object> getSalesStatistics(String factoryId);
}
