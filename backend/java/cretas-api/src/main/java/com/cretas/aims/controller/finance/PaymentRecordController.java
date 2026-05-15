package com.cretas.aims.controller.finance;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.enums.PaymentMethod;
import com.cretas.aims.entity.enums.PaymentRecordStatus;
import com.cretas.aims.service.finance.PaymentRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import com.cretas.aims.annotation.RequireModule;

/**
 * Bug #4 same-cause sweep (P1 RBAC, 2026-04-18): Added class-level
 * @RequirePermission to prevent dispatcher/operator/quality/hr users from
 * bypassing finance UI gate via direct POST to /record, /{id}/verify, /{id}/reject.
 * Read endpoints accept finance:read or sales:read (SO detail page tab).
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/finance/payments")
@RequiredArgsConstructor
@RequirePermission("finance:read_write")
public class PaymentRecordController {

    private final PaymentRecordService paymentRecordService;

    // R23 P3 audit (independent reviewer #13): customer payment records settle SO
    // receivables — semantically AR, not AP. Pre-R23 had @RequireModule("finance_ap")
    // which would block AR-only tenants from recording customer payments. Fix matches
    // the AR/AP module audit pattern from R22 C4 (ArApController.recordReceivable).
    @RequireModule("finance_ar")
    @PostMapping("/record")
    @RequirePermission({"finance:read_write", "sales:read_write"})
    public ResponseEntity<?> recordPayment(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        // D2 fix: null-guard on required fields to prevent NPE → 500
        if (body.get("salesOrderId") == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "缺少必要参数: salesOrderId"));
        }
        if (body.get("amount") == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "缺少必要参数: amount"));
        }
        PaymentMethod pm;
        try {
            pm = body.get("paymentMethod") != null ? PaymentMethod.valueOf(body.get("paymentMethod").toString()) : PaymentMethod.BANK_TRANSFER;
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "无效的支付方式: " + body.get("paymentMethod")));
        }
        var record = paymentRecordService.recordPayment(
                factoryId,
                (String) body.get("salesOrderId"),
                new BigDecimal(body.get("amount").toString()),
                pm,
                body.get("paymentDate") != null && !body.get("paymentDate").toString().isEmpty() ? LocalDate.parse(body.get("paymentDate").toString()) : null,
                (String) body.get("paymentReference"),
                (String) body.get("receiptUrl"),
                userId,
                (String) body.get("remark"));
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "收款记录已创建"));
    }

    @RequireModule("finance_ar")  // R23 P3 audit: AR not AP (verify customer payment)
    @PostMapping("/{paymentId}/verify")
    @RequirePermission("finance:read_write")
    public ResponseEntity<?> verify(
            @PathVariable String paymentId,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = paymentRecordService.verifyPayment(paymentId, userId);
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "收款已确认"));
    }

    @RequireModule("finance_ar")  // R23 P3 audit: AR not AP (reject customer payment)
    @PostMapping("/{paymentId}/reject")
    @RequirePermission("finance:read_write")
    public ResponseEntity<?> reject(
            @PathVariable String paymentId,
            @RequestBody Map<String, String> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = paymentRecordService.rejectPayment(paymentId, userId, body.get("reason"));
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "收款已驳回"));
    }

    @GetMapping
    // Sprint1-Fix-K4 (2026-05-15): drop sales:read — 5x5 RBAC regression showed
    // warehouse_mgr/viewer (have sales:read) leaked customerName + salesOrderId.
    // 财务付款 detail 仅 finance 角色 + sales_manager (write) 可见; sales viewer 不行。
    @RequirePermission({"finance:read_write", "finance:read", "sales:read_write"})
    public ResponseEntity<?> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PaymentRecordStatus s = status != null ? PaymentRecordStatus.valueOf(status) : null;
        var result = paymentRecordService.listPayments(factoryId, s,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @GetMapping("/{paymentId}")
    // Sprint1-Fix-K4 (2026-05-15): drop sales:read — 5x5 RBAC regression showed
    // warehouse_mgr/viewer (have sales:read) leaked customerName + salesOrderId.
    // 财务付款 detail 仅 finance 角色 + sales_manager (write) 可见; sales viewer 不行。
    @RequirePermission({"finance:read_write", "finance:read", "sales:read_write"})
    public ResponseEntity<?> detail(@PathVariable String paymentId) {
        return ResponseEntity.ok(Map.of("success", true, "data", paymentRecordService.getPayment(paymentId)));
    }

    /** List all payment records for a sales order — used by sales order detail page tab. */
    @GetMapping("/by-sales-order/{salesOrderId}")
    // Sprint1-Fix-K4 (2026-05-15): drop sales:read — 5x5 RBAC regression showed
    // warehouse_mgr/viewer (have sales:read) leaked customerName + salesOrderId.
    // 财务付款 detail 仅 finance 角色 + sales_manager (write) 可见; sales viewer 不行。
    @RequirePermission({"finance:read_write", "finance:read", "sales:read_write"})
    public ResponseEntity<?> listBySalesOrder(@PathVariable String factoryId, @PathVariable String salesOrderId) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", paymentRecordService.listPaymentsBySalesOrder(factoryId, salesOrderId)));
    }
}
