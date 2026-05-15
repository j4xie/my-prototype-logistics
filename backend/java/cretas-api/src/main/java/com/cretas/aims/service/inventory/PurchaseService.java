package com.cretas.aims.service.inventory;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreatePurchaseOrderRequest;
import com.cretas.aims.dto.inventory.CreateReceiveRecordRequest;
import com.cretas.aims.dto.inventory.UpdatePurchaseOrderRequest;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseReceiveRecord;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;

import com.cretas.aims.dto.inventory.MaterialPriceComparisonDTO;

import java.util.List;
import java.util.Map;

public interface PurchaseService {

    // ==================== 采购订单 ====================

    PurchaseOrder createPurchaseOrder(String factoryId, CreatePurchaseOrderRequest request, Long userId);

    PurchaseOrder getPurchaseOrderById(String factoryId, String orderId);

    /**
     * 按订单号 (orderNumber, 如 PO-20260514-001) 查采购单 — 工厂隔离.
     *
     * <p>主要用于 PDF QR 扫码场景: 仓管员扫 PDF 上的 QR 拿到 orderNumber, 直接
     * 反查订单 + 关联明细, 进入入库收货页 (W-ABA-1 Day 3-6 PDF 扫码闭环).</p>
     *
     * @throws com.cretas.aims.exception.ResourceNotFoundException 找不到该订单号
     */
    PurchaseOrder getPurchaseOrderByNumber(String factoryId, String orderNumber);

    PageResponse<PurchaseOrder> getPurchaseOrders(String factoryId, int page, int size);

    PageResponse<PurchaseOrder> getPurchaseOrdersByStatus(String factoryId, PurchaseOrderStatus status, int page, int size);

    /** W-12 fix: filter by linked sales order id (for SO detail "关联采购" tab). */
    PageResponse<PurchaseOrder> getPurchaseOrdersBySalesOrder(String factoryId, String salesOrderId, int page, int size);

    PurchaseOrder submitOrder(String factoryId, String orderId);

    PurchaseOrder approveOrder(String factoryId, String orderId, Long approvedBy);

    PurchaseOrder cancelOrder(String factoryId, String orderId);

    PurchaseOrder submitForFinanceReview(String factoryId, String orderId);

    PurchaseOrder financeApproveOrder(String factoryId, String orderId, Long reviewedBy, String notes);

    PurchaseOrder financeRejectOrder(String factoryId, String orderId, Long reviewedBy, String notes);

    PurchaseOrder updateDraftOrder(String factoryId, String orderId, UpdatePurchaseOrderRequest request);

    // ==================== 采购入库 ====================

    PurchaseReceiveRecord createReceiveRecord(String factoryId, CreateReceiveRecordRequest request, Long userId);

    PurchaseReceiveRecord confirmReceive(String factoryId, String receiveId, Long userId);

    PurchaseReceiveRecord getReceiveRecordById(String factoryId, String receiveId);

    PageResponse<PurchaseReceiveRecord> getReceiveRecords(String factoryId, int page, int size);

    List<PurchaseReceiveRecord> getReceiveRecordsByOrder(String purchaseOrderId);

    // ==================== 统计 ====================

    Map<String, Object> getPurchaseStatistics(String factoryId);

    // ==================== 三价对比 ====================

    /**
     * 获取采购订单的三价对比数据
     * 对每个行项目比较：BOM标准单价、移动平均价、当前采购单价
     */
    List<MaterialPriceComparisonDTO> getOrderPriceComparison(String factoryId, String orderId);

    /**
     * 获取单个原料的三价信息
     * 用于采购下单时逐个原料查询参考价
     */
    MaterialPriceComparisonDTO getMaterialPriceInfo(String factoryId, String materialTypeId, java.math.BigDecimal currentPrice);
}
