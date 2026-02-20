package com.cretas.aims.service.inventory;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateDeliveryRequest;
import com.cretas.aims.dto.inventory.CreateSalesOrderRequest;
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

    PageResponse<SalesOrder> getSalesOrdersByStatus(String factoryId, SalesOrderStatus status, int page, int size);

    SalesOrder confirmOrder(String factoryId, String orderId);

    SalesOrder cancelOrder(String factoryId, String orderId);

    // ==================== 发货/出库 ====================

    SalesDeliveryRecord createDeliveryRecord(String factoryId, CreateDeliveryRequest request, Long userId);

    SalesDeliveryRecord shipDelivery(String factoryId, String deliveryId, Long userId);

    SalesDeliveryRecord confirmDelivered(String factoryId, String deliveryId);

    SalesDeliveryRecord getDeliveryRecordById(String factoryId, String deliveryId);

    PageResponse<SalesDeliveryRecord> getDeliveryRecords(String factoryId, int page, int size);

    List<SalesDeliveryRecord> getDeliveryRecordsByOrder(String salesOrderId);

    // ==================== 成品库存 ====================

    PageResponse<FinishedGoodsBatch> getFinishedGoodsBatches(String factoryId, int page, int size);

    List<FinishedGoodsBatch> getAvailableBatches(String factoryId, String productTypeId);

    FinishedGoodsBatch createFinishedGoodsBatch(String factoryId, FinishedGoodsBatch batch, Long userId);

    // ==================== 统计 ====================

    Map<String, Object> getSalesStatistics(String factoryId);
}
