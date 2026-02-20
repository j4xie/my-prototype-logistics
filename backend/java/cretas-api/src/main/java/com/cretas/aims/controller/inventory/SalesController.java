package com.cretas.aims.controller.inventory;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateDeliveryRequest;
import com.cretas.aims.dto.inventory.CreateSalesOrderRequest;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.entity.inventory.SalesDeliveryRecord;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.inventory.SalesService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/sales")
@RequiredArgsConstructor
@Tag(name = "销售管理", description = "销售订单、发货出库、成品库存（工厂/餐饮通用）")
public class SalesController {

    private final SalesService salesService;
    private final MobileService mobileService;

    // ==================== 销售订单 ====================

    @PostMapping("/orders")
    @Operation(summary = "创建销售订单")
    public ApiResponse<SalesOrder> createOrder(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateSalesOrderRequest request) {
        Long userId = extractUserId(authorization);
        log.info("创建销售订单: factoryId={}, customerId={}", factoryId, request.getCustomerId());
        SalesOrder order = salesService.createSalesOrder(factoryId, request, userId);
        return ApiResponse.success("销售订单创建成功", order);
    }

    @GetMapping("/orders")
    @Operation(summary = "销售订单列表")
    public ApiResponse<PageResponse<SalesOrder>> listOrders(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<SalesOrder> result = salesService.getSalesOrders(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/orders/by-status")
    @Operation(summary = "按状态查询销售订单")
    public ApiResponse<PageResponse<SalesOrder>> listOrdersByStatus(
            @PathVariable @NotBlank String factoryId,
            @RequestParam SalesOrderStatus status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<SalesOrder> result = salesService.getSalesOrdersByStatus(factoryId, status, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/orders/{orderId}")
    @Operation(summary = "销售订单详情")
    public ApiResponse<SalesOrder> getOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        SalesOrder order = salesService.getSalesOrderById(factoryId, orderId);
        return ApiResponse.success("查询成功", order);
    }

    @PostMapping("/orders/{orderId}/confirm")
    @Operation(summary = "确认销售订单")
    public ApiResponse<SalesOrder> confirmOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        SalesOrder order = salesService.confirmOrder(factoryId, orderId);
        return ApiResponse.success("销售订单已确认", order);
    }

    @PostMapping("/orders/{orderId}/cancel")
    @Operation(summary = "取消销售订单")
    public ApiResponse<SalesOrder> cancelOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        SalesOrder order = salesService.cancelOrder(factoryId, orderId);
        return ApiResponse.success("销售订单已取消", order);
    }

    // ==================== 发货/出库 ====================

    @PostMapping("/deliveries")
    @Operation(summary = "创建发货单")
    public ApiResponse<SalesDeliveryRecord> createDelivery(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateDeliveryRequest request) {
        Long userId = extractUserId(authorization);
        log.info("创建发货单: factoryId={}, customerId={}", factoryId, request.getCustomerId());
        SalesDeliveryRecord record = salesService.createDeliveryRecord(factoryId, request, userId);
        return ApiResponse.success("发货单创建成功", record);
    }

    @GetMapping("/deliveries")
    @Operation(summary = "发货单列表")
    public ApiResponse<PageResponse<SalesDeliveryRecord>> listDeliveries(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<SalesDeliveryRecord> result = salesService.getDeliveryRecords(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/deliveries/{deliveryId}")
    @Operation(summary = "发货单详情")
    public ApiResponse<SalesDeliveryRecord> getDelivery(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String deliveryId) {
        SalesDeliveryRecord record = salesService.getDeliveryRecordById(factoryId, deliveryId);
        return ApiResponse.success("查询成功", record);
    }

    @PostMapping("/deliveries/{deliveryId}/ship")
    @Operation(summary = "发货确认（扣减成品库存）")
    public ApiResponse<SalesDeliveryRecord> shipDelivery(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String deliveryId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        SalesDeliveryRecord record = salesService.shipDelivery(factoryId, deliveryId, userId);
        return ApiResponse.success("发货成功，成品库存已扣减", record);
    }

    @PostMapping("/deliveries/{deliveryId}/delivered")
    @Operation(summary = "签收确认")
    public ApiResponse<SalesDeliveryRecord> confirmDelivered(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String deliveryId) {
        SalesDeliveryRecord record = salesService.confirmDelivered(factoryId, deliveryId);
        return ApiResponse.success("签收确认成功", record);
    }

    @GetMapping("/deliveries/by-order/{orderId}")
    @Operation(summary = "按销售订单查询发货记录")
    public ApiResponse<List<SalesDeliveryRecord>> getDeliveriesByOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        List<SalesDeliveryRecord> records = salesService.getDeliveryRecordsByOrder(orderId);
        return ApiResponse.success("查询成功", records);
    }

    // ==================== 成品库存 ====================

    @GetMapping("/finished-goods")
    @Operation(summary = "成品库存列表")
    public ApiResponse<PageResponse<FinishedGoodsBatch>> listFinishedGoods(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<FinishedGoodsBatch> result = salesService.getFinishedGoodsBatches(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/finished-goods/available")
    @Operation(summary = "查询可用成品批次（按产品）")
    public ApiResponse<List<FinishedGoodsBatch>> getAvailableBatches(
            @PathVariable @NotBlank String factoryId,
            @RequestParam @NotBlank String productTypeId) {
        List<FinishedGoodsBatch> batches = salesService.getAvailableBatches(factoryId, productTypeId);
        return ApiResponse.success("查询成功", batches);
    }

    // ==================== 统计 ====================

    @GetMapping("/statistics")
    @Operation(summary = "销售统计数据")
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable @NotBlank String factoryId) {
        Map<String, Object> stats = salesService.getSalesStatistics(factoryId);
        return ApiResponse.success("查询成功", stats);
    }

    // ==================== 内部方法 ====================

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
