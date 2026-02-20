package com.cretas.aims.controller.inventory;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreatePurchaseOrderRequest;
import com.cretas.aims.dto.inventory.CreateReceiveRecordRequest;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseReceiveRecord;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.inventory.PurchaseService;
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
@RequestMapping("/api/mobile/{factoryId}/purchase")
@RequiredArgsConstructor
@Tag(name = "采购管理", description = "采购订单与入库管理（工厂/餐饮通用）")
public class PurchaseController {

    private final PurchaseService purchaseService;
    private final MobileService mobileService;

    // ==================== 采购订单 ====================

    @PostMapping("/orders")
    @Operation(summary = "创建采购订单")
    public ApiResponse<PurchaseOrder> createOrder(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreatePurchaseOrderRequest request) {
        Long userId = extractUserId(authorization);
        log.info("创建采购订单: factoryId={}, supplierId={}", factoryId, request.getSupplierId());
        PurchaseOrder order = purchaseService.createPurchaseOrder(factoryId, request, userId);
        return ApiResponse.success("采购订单创建成功", order);
    }

    @GetMapping("/orders")
    @Operation(summary = "采购订单列表")
    public ApiResponse<PageResponse<PurchaseOrder>> listOrders(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<PurchaseOrder> result = purchaseService.getPurchaseOrders(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/orders/by-status")
    @Operation(summary = "按状态查询采购订单")
    public ApiResponse<PageResponse<PurchaseOrder>> listOrdersByStatus(
            @PathVariable @NotBlank String factoryId,
            @RequestParam PurchaseOrderStatus status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<PurchaseOrder> result = purchaseService.getPurchaseOrdersByStatus(factoryId, status, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/orders/{orderId}")
    @Operation(summary = "采购订单详情")
    public ApiResponse<PurchaseOrder> getOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        PurchaseOrder order = purchaseService.getPurchaseOrderById(factoryId, orderId);
        return ApiResponse.success("查询成功", order);
    }

    @PutMapping("/orders/{orderId}")
    @Operation(summary = "编辑草稿采购订单")
    public ApiResponse<PurchaseOrder> updateDraftOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @Valid @RequestBody CreatePurchaseOrderRequest request) {
        log.info("编辑草稿采购订单: factoryId={}, orderId={}", factoryId, orderId);
        PurchaseOrder order = purchaseService.updateDraftOrder(factoryId, orderId, request);
        return ApiResponse.success("采购订单更新成功", order);
    }

    @PostMapping("/orders/{orderId}/submit")
    @Operation(summary = "提交采购订单")
    public ApiResponse<PurchaseOrder> submitOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        PurchaseOrder order = purchaseService.submitOrder(factoryId, orderId);
        return ApiResponse.success("采购订单已提交", order);
    }

    @PostMapping("/orders/{orderId}/approve")
    @Operation(summary = "审批采购订单")
    public ApiResponse<PurchaseOrder> approveOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        PurchaseOrder order = purchaseService.approveOrder(factoryId, orderId, userId);
        return ApiResponse.success("采购订单已审批", order);
    }

    @PostMapping("/orders/{orderId}/cancel")
    @Operation(summary = "取消采购订单")
    public ApiResponse<PurchaseOrder> cancelOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        PurchaseOrder order = purchaseService.cancelOrder(factoryId, orderId);
        return ApiResponse.success("采购订单已取消", order);
    }

    // ==================== 入库管理 ====================

    @PostMapping("/receives")
    @Operation(summary = "创建入库单")
    public ApiResponse<PurchaseReceiveRecord> createReceive(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateReceiveRecordRequest request) {
        Long userId = extractUserId(authorization);
        log.info("创建入库单: factoryId={}, supplierId={}", factoryId, request.getSupplierId());
        PurchaseReceiveRecord record = purchaseService.createReceiveRecord(factoryId, request, userId);
        return ApiResponse.success("入库单创建成功", record);
    }

    @GetMapping("/receives")
    @Operation(summary = "入库单列表")
    public ApiResponse<PageResponse<PurchaseReceiveRecord>> listReceives(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<PurchaseReceiveRecord> result = purchaseService.getReceiveRecords(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/receives/{receiveId}")
    @Operation(summary = "入库单详情")
    public ApiResponse<PurchaseReceiveRecord> getReceive(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String receiveId) {
        PurchaseReceiveRecord record = purchaseService.getReceiveRecordById(factoryId, receiveId);
        return ApiResponse.success("查询成功", record);
    }

    @PostMapping("/receives/{receiveId}/confirm")
    @Operation(summary = "确认入库（生成物料批次）")
    public ApiResponse<PurchaseReceiveRecord> confirmReceive(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String receiveId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        PurchaseReceiveRecord record = purchaseService.confirmReceive(factoryId, receiveId, userId);
        return ApiResponse.success("入库确认成功，物料批次已创建", record);
    }

    @GetMapping("/receives/by-order/{orderId}")
    @Operation(summary = "按采购订单查询入库记录")
    public ApiResponse<List<PurchaseReceiveRecord>> getReceivesByOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        List<PurchaseReceiveRecord> records = purchaseService.getReceiveRecordsByOrder(orderId);
        return ApiResponse.success("查询成功", records);
    }

    // ==================== 统计 ====================

    @GetMapping("/statistics")
    @Operation(summary = "采购统计数据")
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable @NotBlank String factoryId) {
        Map<String, Object> stats = purchaseService.getPurchaseStatistics(factoryId);
        return ApiResponse.success("查询成功", stats);
    }

    // ==================== 内部方法 ====================

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
