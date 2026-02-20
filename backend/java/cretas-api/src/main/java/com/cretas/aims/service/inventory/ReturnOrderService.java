package com.cretas.aims.service.inventory;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateReturnOrderRequest;
import com.cretas.aims.entity.enums.ReturnOrderStatus;
import com.cretas.aims.entity.enums.ReturnType;
import com.cretas.aims.entity.inventory.ReturnOrder;

import java.util.Map;

public interface ReturnOrderService {

    ReturnOrder createReturnOrder(String factoryId, CreateReturnOrderRequest request, Long userId);

    ReturnOrder getReturnOrderById(String factoryId, String returnOrderId);

    PageResponse<ReturnOrder> getReturnOrders(String factoryId, ReturnType returnType,
                                               ReturnOrderStatus status, int page, int size);

    ReturnOrder submitReturnOrder(String factoryId, String returnOrderId);

    ReturnOrder approveReturnOrder(String factoryId, String returnOrderId, Long approverId);

    ReturnOrder rejectReturnOrder(String factoryId, String returnOrderId);

    ReturnOrder completeReturnOrder(String factoryId, String returnOrderId);

    Map<String, Object> getReturnOrderStatistics(String factoryId);
}
