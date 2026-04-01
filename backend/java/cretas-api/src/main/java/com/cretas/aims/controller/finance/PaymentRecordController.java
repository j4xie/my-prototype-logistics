package com.cretas.aims.controller.finance;

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

@RestController
@RequestMapping("/api/mobile/{factoryId}/finance/payments")
@RequiredArgsConstructor
public class PaymentRecordController {

    private final PaymentRecordService paymentRecordService;

    @PostMapping("/record")
    public ResponseEntity<?> recordPayment(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = paymentRecordService.recordPayment(
                factoryId,
                (String) body.get("salesOrderId"),
                new BigDecimal(body.get("amount").toString()),
                body.get("paymentMethod") != null ? PaymentMethod.valueOf(body.get("paymentMethod").toString()) : PaymentMethod.BANK_TRANSFER,
                body.get("paymentDate") != null && !body.get("paymentDate").toString().isEmpty() ? LocalDate.parse(body.get("paymentDate").toString()) : null,
                (String) body.get("paymentReference"),
                (String) body.get("receiptUrl"),
                userId,
                (String) body.get("remark"));
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "收款记录已创建"));
    }

    @PostMapping("/{paymentId}/verify")
    public ResponseEntity<?> verify(
            @PathVariable String paymentId,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = paymentRecordService.verifyPayment(paymentId, userId);
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "收款已确认"));
    }

    @PostMapping("/{paymentId}/reject")
    public ResponseEntity<?> reject(
            @PathVariable String paymentId,
            @RequestBody Map<String, String> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = paymentRecordService.rejectPayment(paymentId, userId, body.get("reason"));
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "收款已驳回"));
    }

    @GetMapping
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
    public ResponseEntity<?> detail(@PathVariable String paymentId) {
        return ResponseEntity.ok(Map.of("success", true, "data", paymentRecordService.getPayment(paymentId)));
    }
}
