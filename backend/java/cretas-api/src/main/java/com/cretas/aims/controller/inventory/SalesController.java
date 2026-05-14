package com.cretas.aims.controller.inventory;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateDeliveryRequest;
import com.cretas.aims.dto.inventory.SignatureUploadRequest;
import com.cretas.aims.dto.inventory.CreateSalesOrderRequest;
import com.cretas.aims.dto.inventory.FinanceReviewRequest;
import com.cretas.aims.dto.inventory.UpdateSalesOrderRequest;
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

import com.cretas.aims.annotation.RequirePermission;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
    @RequirePermission("sales:read_write")
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
    @Operation(summary = "销售订单列表 (Bug G: ?keyword 搜索 — Rule 12.1)")
    @RequirePermission({"sales:read_write", "sales:read"})
    public ApiResponse<PageResponse<SalesOrder>> listOrders(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<SalesOrder> result = salesService.getSalesOrders(factoryId, keyword, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/orders/by-status")
    @Operation(summary = "按状态查询销售订单")
    @RequirePermission({"sales:read_write", "sales:read"})
    public ApiResponse<PageResponse<SalesOrder>> listOrdersByStatus(
            @PathVariable @NotBlank String factoryId,
            @RequestParam SalesOrderStatus status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<SalesOrder> result = salesService.getSalesOrdersByStatus(factoryId, status, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @PutMapping("/orders/{orderId}")
    @Operation(summary = "更新销售订单", description = "仅 DRAFT 状态可编辑")
    @RequirePermission("sales:read_write")
    public ApiResponse<SalesOrder> updateOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @Valid @RequestBody UpdateSalesOrderRequest request) {
        log.info("更新销售订单: factoryId={}, orderId={}", factoryId, orderId);
        SalesOrder order = salesService.updateSalesOrder(factoryId, orderId, request);
        return ApiResponse.success("销售订单更新成功", order);
    }

    @GetMapping("/orders/{orderId}")
    @Operation(summary = "销售订单详情")
    @RequirePermission({"sales:read_write", "sales:read"})
    public ApiResponse<SalesOrder> getOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        SalesOrder order = salesService.getSalesOrderById(factoryId, orderId);
        return ApiResponse.success("查询成功", order);
    }

    @GetMapping("/orders/{orderId}/formulas")
    @Operation(summary = "计算销售订单公式 (如税率分组求和)")
    @RequirePermission({"sales:read_write", "sales:read"})
    public ApiResponse<Map<String, Object>> getOrderFormulas(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        salesService.getSalesOrderById(factoryId, orderId);
        Map<String, Object> formulas = salesService.computeOrderFormulas(factoryId, orderId);
        return ApiResponse.success("公式计算完成", formulas);
    }

    @PostMapping("/orders/{orderId}/confirm")
    @Operation(summary = "确认销售订单")
    @RequirePermission("sales:read_write")
    public ApiResponse<SalesOrder> confirmOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        SalesOrder order = salesService.confirmOrder(factoryId, orderId);
        return ApiResponse.success("销售订单已确认", order);
    }

    @PostMapping("/orders/{orderId}/cancel")
    @Operation(summary = "取消销售订单")
    @RequirePermission("sales:read_write")
    public ApiResponse<SalesOrder> cancelOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        SalesOrder order = salesService.cancelOrder(factoryId, orderId);
        return ApiResponse.success("销售订单已取消", order);
    }

    // ==================== 财务审核 ====================

    @PostMapping("/orders/{orderId}/submit-for-review")
    @Operation(summary = "提交财务审核", description = "CONFIRMED -> PENDING_FINANCE_REVIEW")
    @RequirePermission("sales:read_write")
    public ApiResponse<SalesOrder> submitForFinanceReview(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        SalesOrder order = salesService.submitForFinanceReview(factoryId, orderId);
        return ApiResponse.success("销售订单已提交财务审核", order);
    }

    @PostMapping("/orders/{orderId}/finance-approve")
    @Operation(summary = "财务审核通过", description = "PENDING_FINANCE_REVIEW -> FINANCE_APPROVED, 触发供应链联动")
    @RequirePermission({"finance:read_write", "sales:read_write"})
    public ApiResponse<SalesOrder> financeApproveOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @RequestHeader("Authorization") String authorization,
            // R38 BUG-4 fix: DynamicModulePage transitions 不发 body, 改 required=false 接受空 POST
            @RequestBody(required = false) FinanceReviewRequest request) {
        Long reviewerId = extractUserId(authorization);
        String notes = request != null ? request.getNotes() : null;
        java.math.BigDecimal estimatedCost = request != null ? request.getEstimatedCost() : null;
        SalesOrder order = salesService.financeApproveOrder(
                factoryId, orderId, notes, estimatedCost, reviewerId);
        return ApiResponse.success("销售订单财务审核通过", order);
    }

    @PostMapping("/orders/{orderId}/finance-reject")
    @Operation(summary = "财务审核驳回", description = "PENDING_FINANCE_REVIEW -> FINANCE_REJECTED")
    @RequirePermission({"finance:read_write", "sales:read_write"})
    public ApiResponse<SalesOrder> financeRejectOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @RequestHeader("Authorization") String authorization,
            // R38 BUG-4 fix: DynamicModulePage transitions 不发 body
            @RequestBody(required = false) FinanceReviewRequest request) {
        Long reviewerId = extractUserId(authorization);
        String notes = request != null ? request.getNotes() : null;
        SalesOrder order = salesService.financeRejectOrder(factoryId, orderId, notes, reviewerId);
        return ApiResponse.success("销售订单财务审核已驳回", order);
    }

    // ==================== 发货/出库 ====================

    @PostMapping("/deliveries")
    @Operation(summary = "创建发货单")
    @RequirePermission("sales:read_write")
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
    @RequirePermission({"sales:read_write", "sales:read"})
    public ApiResponse<PageResponse<SalesDeliveryRecord>> listDeliveries(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<SalesDeliveryRecord> result = salesService.getDeliveryRecords(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/deliveries/{deliveryId}")
    @Operation(summary = "发货单详情")
    @RequirePermission({"sales:read_write", "sales:read"})
    public ApiResponse<SalesDeliveryRecord> getDelivery(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String deliveryId) {
        SalesDeliveryRecord record = salesService.getDeliveryRecordById(factoryId, deliveryId);
        return ApiResponse.success("查询成功", record);
    }

    @PostMapping("/deliveries/{deliveryId}/ship")
    @Operation(summary = "发货确认（扣减成品库存）")
    @RequirePermission("sales:read_write")
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
    @RequirePermission("sales:read_write")
    public ApiResponse<SalesDeliveryRecord> confirmDelivered(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String deliveryId) {
        SalesDeliveryRecord record = salesService.confirmDelivered(factoryId, deliveryId);
        return ApiResponse.success("签收确认成功", record);
    }

    @PostMapping("/deliveries/{deliveryId}/signature")
    @Operation(summary = "上传签收凭证 (P0-NEW-1 — 客户原话 2807s)")
    @RequirePermission("sales:read_write")
    public ApiResponse<SalesDeliveryRecord> uploadSignature(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String deliveryId,
            @Valid @RequestBody SignatureUploadRequest request) {
        log.info("上传签收凭证: factoryId={}, deliveryId={}, 照片数={}",
                factoryId, deliveryId,
                request.getPhotoUrls() == null ? 0 : request.getPhotoUrls().size());
        SalesDeliveryRecord record = salesService.uploadDeliverySignature(
                factoryId, deliveryId,
                request.getPhotoUrls(), request.getSignedByName(), request.getRemark());
        return ApiResponse.success("签收凭证已保存", record);
    }

    @GetMapping("/deliveries/by-order/{orderId}")
    @Operation(summary = "按销售订单查询发货记录")
    @RequirePermission({"sales:read_write", "sales:read"})
    public ApiResponse<List<SalesDeliveryRecord>> getDeliveriesByOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        List<SalesDeliveryRecord> records = salesService.getDeliveryRecordsByOrder(orderId);
        return ApiResponse.success("查询成功", records);
    }

    // ==================== 成品库存 ====================

    @GetMapping("/finished-goods")
    @Operation(summary = "成品库存列表")
    @RequirePermission({"sales:read_write", "sales:read", "inventory:read"})
    public ApiResponse<PageResponse<FinishedGoodsBatch>> listFinishedGoods(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<FinishedGoodsBatch> result = salesService.getFinishedGoodsBatches(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/finished-goods/available")
    @Operation(summary = "查询可用成品批次（按产品 + 可选 sourceWarehouseCode）")
    @RequirePermission({"sales:read_write", "sales:read", "inventory:read"})
    public ApiResponse<List<FinishedGoodsBatch>> getAvailableBatches(
            @PathVariable @NotBlank String factoryId,
            @RequestParam @NotBlank String productTypeId,
            @RequestParam(required = false) String sourceWarehouseCode) {
        // T4-D5 #572 Phase B-1: sourceWarehouseCode 可选; null/空时回落 WH-LOG (D5 默认).
        List<FinishedGoodsBatch> batches = salesService.getAvailableBatches(
                factoryId, productTypeId, sourceWarehouseCode);
        return ApiResponse.success("查询成功", batches);
    }

    // ==================== 统计 ====================

    @GetMapping("/statistics")
    @Operation(summary = "销售统计数据")
    @RequirePermission({"sales:read_write", "sales:read", "report:read"})
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
