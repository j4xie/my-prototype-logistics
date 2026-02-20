package com.cretas.aims.service.inventory;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreatePurchaseOrderRequest;
import com.cretas.aims.dto.inventory.CreateReceiveRecordRequest;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseReceiveRecord;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;

import java.util.List;
import java.util.Map;

public interface PurchaseService {

    // ==================== 采购订单 ====================

    PurchaseOrder createPurchaseOrder(String factoryId, CreatePurchaseOrderRequest request, Long userId);

    PurchaseOrder getPurchaseOrderById(String factoryId, String orderId);

    PageResponse<PurchaseOrder> getPurchaseOrders(String factoryId, int page, int size);

    PageResponse<PurchaseOrder> getPurchaseOrdersByStatus(String factoryId, PurchaseOrderStatus status, int page, int size);

    PurchaseOrder submitOrder(String factoryId, String orderId);

    PurchaseOrder approveOrder(String factoryId, String orderId, Long approvedBy);

    PurchaseOrder cancelOrder(String factoryId, String orderId);

    PurchaseOrder updateDraftOrder(String factoryId, String orderId, CreatePurchaseOrderRequest request);

    // ==================== 采购入库 ====================

    PurchaseReceiveRecord createReceiveRecord(String factoryId, CreateReceiveRecordRequest request, Long userId);

    PurchaseReceiveRecord confirmReceive(String factoryId, String receiveId, Long userId);

    PurchaseReceiveRecord getReceiveRecordById(String factoryId, String receiveId);

    PageResponse<PurchaseReceiveRecord> getReceiveRecords(String factoryId, int page, int size);

    List<PurchaseReceiveRecord> getReceiveRecordsByOrder(String purchaseOrderId);

    // ==================== 统计 ====================

    Map<String, Object> getPurchaseStatistics(String factoryId);
}
