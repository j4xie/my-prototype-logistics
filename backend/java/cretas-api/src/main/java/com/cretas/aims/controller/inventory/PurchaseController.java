package com.cretas.aims.controller.inventory;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreatePurchaseOrderRequest;
import com.cretas.aims.dto.inventory.CreateReceiveRecordRequest;
import com.cretas.aims.dto.inventory.UpdatePurchaseOrderRequest;
import com.cretas.aims.dto.inventory.MaterialPriceComparisonDTO;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseReceiveRecord;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.inventory.PurchaseOrderPdfService;
import com.cretas.aims.service.inventory.PurchaseService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.cretas.aims.annotation.RequirePermission;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import com.cretas.aims.annotation.RequireModule;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/purchase")
@RequiredArgsConstructor
@Tag(name = "采购管理", description = "采购订单与入库管理（工厂/餐饮通用）")
public class PurchaseController {

    private final PurchaseService purchaseService;
    private final PurchaseOrderPdfService purchaseOrderPdfService;
    private final MobileService mobileService;

    // ==================== 采购订单 ====================

    @RequireModule("purchase_order")
    @PostMapping("/orders")
    @Operation(summary = "创建采购订单")
    @RequirePermission("procurement:read_write")
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
    @Operation(summary = "采购订单列表", description = "支持可选 salesOrderId 过滤 (W-12 fix: SO 详情页'关联采购' tab 依赖)")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<PageResponse<PurchaseOrder>> listOrders(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) String salesOrderId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<PurchaseOrder> result = (salesOrderId != null && !salesOrderId.isBlank())
                ? purchaseService.getPurchaseOrdersBySalesOrder(factoryId, salesOrderId, page, size)
                : purchaseService.getPurchaseOrders(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/orders/by-status")
    @Operation(summary = "按状态查询采购订单")
    @RequirePermission({"procurement:read_write", "procurement:read"})
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
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<PurchaseOrder> getOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        PurchaseOrder order = purchaseService.getPurchaseOrderById(factoryId, orderId);
        return ApiResponse.success("查询成功", order);
    }

    /**
     * 采购订单 PDF (供货单) 下载.
     *
     * <p>六扇门 May 7 2026 transcript 客户需求:
     * <ul>
     *   <li>"采购订单要有打印功能" — 供应商打印后送货员带过来。</li>
     *   <li>"扫一下上面的拳运码" — PDF 含 Code128 一维条码 + QR 二维码 (内容 = orderNumber),
     *       仓管员扫码进入入库流程。</li>
     *   <li>"双方签字拍张照" — PDF 末尾留签收区。</li>
     * </ul>
     *
     * <p>响应是 PDF 二进制流, 浏览器作为附件下载 (Content-Disposition: attachment)。
     */
    @GetMapping("/orders/{orderId}/pdf")
    @Operation(summary = "下载采购订单 PDF (供货单)",
            description = "生成包含 Code128 条码 + QR 二维码的 PDF 供货单, 供应商打印 / 仓管员扫码入库 (六扇门 May 7 transcript)")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ResponseEntity<byte[]> downloadOrderPdf(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        PurchaseOrder order = purchaseService.getPurchaseOrderById(factoryId, orderId);
        byte[] pdfBytes = purchaseOrderPdfService.generatePurchaseOrderPdf(factoryId, orderId);

        // 文件名 = 供货单_{订单号}.pdf, 含中文需 RFC 5987 编码
        String filename = "供货单_" + (order.getOrderNumber() != null ? order.getOrderNumber() : orderId) + ".pdf";
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.add(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"order.pdf\"; filename*=UTF-8''" + encoded);
        headers.setContentLength(pdfBytes.length);
        log.info("下载采购订单 PDF: factoryId={}, orderId={}, bytes={}", factoryId, orderId, pdfBytes.length);
        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }

    @RequireModule("purchase_order")
    @PutMapping("/orders/{orderId}")
    @Operation(summary = "编辑草稿采购订单 (partial update: 所有字段可选)")
    @RequirePermission("procurement:read_write")
    public ApiResponse<PurchaseOrder> updateDraftOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @Valid @RequestBody UpdatePurchaseOrderRequest request) {
        log.info("编辑草稿采购订单: factoryId={}, orderId={}", factoryId, orderId);
        PurchaseOrder order = purchaseService.updateDraftOrder(factoryId, orderId, request);
        return ApiResponse.success("采购订单更新成功", order);
    }

    @RequireModule("purchase_order")
    @PostMapping("/orders/{orderId}/submit")
    @Operation(summary = "提交采购订单")
    @RequirePermission("procurement:read_write")
    public ApiResponse<PurchaseOrder> submitOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        PurchaseOrder order = purchaseService.submitOrder(factoryId, orderId);
        return ApiResponse.success("采购订单已提交", order);
    }

    @RequireModule("purchase_order")
    @PostMapping("/orders/{orderId}/approve")
    @Operation(summary = "审批采购订单")
    @RequirePermission("procurement:read_write")
    public ApiResponse<PurchaseOrder> approveOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        PurchaseOrder order = purchaseService.approveOrder(factoryId, orderId, userId);
        return ApiResponse.success("采购订单已审批", order);
    }

    @RequireModule("purchase_order")
    @PostMapping("/orders/{orderId}/cancel")
    @Operation(summary = "取消采购订单")
    @RequirePermission("procurement:read_write")
    public ApiResponse<PurchaseOrder> cancelOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        PurchaseOrder order = purchaseService.cancelOrder(factoryId, orderId);
        return ApiResponse.success("采购订单已取消", order);
    }

    // ==================== 财务审核 ====================

    @RequireModule("purchase_order")
    @PostMapping("/orders/{orderId}/submit-for-finance-review")
    @Operation(summary = "提交采购订单财务审核")
    @RequirePermission("procurement:read_write")
    public ApiResponse<PurchaseOrder> submitForFinanceReview(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        PurchaseOrder order = purchaseService.submitForFinanceReview(factoryId, orderId);
        return ApiResponse.success("已提交财务审核", order);
    }

    @RequireModule("purchase_order")
    @PostMapping("/orders/{orderId}/finance-approve")
    @Operation(summary = "采购订单财务审核通过")
    @RequirePermission("finance:read_write")
    public ApiResponse<PurchaseOrder> financeApprove(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        Long userId = extractUserId(authorization);
        String notes = body != null ? body.get("notes") : null;
        PurchaseOrder order = purchaseService.financeApproveOrder(factoryId, orderId, userId, notes);
        return ApiResponse.success("财务审核通过", order);
    }

    @RequireModule("purchase_order")
    @PostMapping("/orders/{orderId}/finance-reject")
    @Operation(summary = "采购订单财务审核驳回")
    @RequirePermission("finance:read_write")
    public ApiResponse<PurchaseOrder> financeReject(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody java.util.Map<String, String> body) {
        Long userId = extractUserId(authorization);
        PurchaseOrder order = purchaseService.financeRejectOrder(factoryId, orderId, userId, body.get("notes"));
        return ApiResponse.success("财务审核已驳回", order);
    }

    // ==================== 入库管理 ====================

    @RequireModule("purchase_order")
    @PostMapping("/receives")
    @Operation(summary = "创建入库单")
    @RequirePermission({"procurement:read_write", "inventory:write"})
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
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<PageResponse<PurchaseReceiveRecord>> listReceives(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<PurchaseReceiveRecord> result = purchaseService.getReceiveRecords(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/receives/{receiveId}")
    @Operation(summary = "入库单详情")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<PurchaseReceiveRecord> getReceive(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String receiveId) {
        PurchaseReceiveRecord record = purchaseService.getReceiveRecordById(factoryId, receiveId);
        return ApiResponse.success("查询成功", record);
    }

    @RequireModule("purchase_order")
    @PostMapping("/receives/{receiveId}/confirm")
    @Operation(summary = "确认入库（生成物料批次）")
    @RequirePermission({"procurement:read_write", "inventory:write"})
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
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<List<PurchaseReceiveRecord>> getReceivesByOrder(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        List<PurchaseReceiveRecord> records = purchaseService.getReceiveRecordsByOrder(orderId);
        return ApiResponse.success("查询成功", records);
    }

    // ==================== 统计 ====================

    @GetMapping("/statistics")
    @Operation(summary = "采购统计数据")
    @RequirePermission({"procurement:read_write", "procurement:read", "report:read"})
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable @NotBlank String factoryId) {
        Map<String, Object> stats = purchaseService.getPurchaseStatistics(factoryId);
        return ApiResponse.success("查询成功", stats);
    }

    // ==================== 三价对比 ====================

    @GetMapping("/orders/{orderId}/price-comparison")
    @Operation(summary = "采购订单三价对比", description = "对比每个行项目的BOM标准单价、移动平均价、当前采购单价")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<List<MaterialPriceComparisonDTO>> getOrderPriceComparison(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        List<MaterialPriceComparisonDTO> result = purchaseService.getOrderPriceComparison(factoryId, orderId);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/materials/{materialTypeId}/price-info")
    @Operation(summary = "原料三价查询", description = "查询单个原料的BOM标准单价、移动平均价，可选传入当前价计算偏差")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<MaterialPriceComparisonDTO> getMaterialPriceInfo(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String materialTypeId,
            @RequestParam(required = false) BigDecimal currentPrice) {
        MaterialPriceComparisonDTO result = purchaseService.getMaterialPriceInfo(factoryId, materialTypeId, currentPrice);
        return ApiResponse.success("查询成功", result);
    }

    // ==================== 内部方法 ====================

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
