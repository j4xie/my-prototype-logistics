package com.cretas.aims.controller.finance;

import com.cretas.aims.entity.enums.InvoiceStatus;
import com.cretas.aims.service.finance.InvoiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}/finance/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;

    @PostMapping("/request")
    public ResponseEntity<?> requestInvoice(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = invoiceService.requestInvoice(
                factoryId,
                (String) body.get("salesOrderId"),
                new BigDecimal(body.get("amount").toString()),
                body.get("taxAmount") != null ? new BigDecimal(body.get("taxAmount").toString()) : BigDecimal.ZERO,
                (String) body.get("invoiceType"),
                userId,
                (String) body.get("remark"));
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "开票申请已提交"));
    }

    @PostMapping("/{invoiceId}/approve")
    public ResponseEntity<?> approve(
            @PathVariable String factoryId,
            @PathVariable String invoiceId,
            @RequestBody(required = false) Map<String, String> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = invoiceService.approveInvoice(factoryId, invoiceId, userId,
                body != null ? body.get("notes") : null);
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "开票申请已审核通过"));
    }

    @PostMapping("/{invoiceId}/reject")
    public ResponseEntity<?> reject(
            @PathVariable String factoryId,
            @PathVariable String invoiceId,
            @RequestBody Map<String, String> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = invoiceService.rejectInvoice(factoryId, invoiceId, userId, body.get("notes"));
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "开票申请已驳回"));
    }

    @PostMapping("/{invoiceId}/issue")
    public ResponseEntity<?> issue(
            @PathVariable String factoryId,
            @PathVariable String invoiceId,
            @RequestPart(value = "file", required = false) MultipartFile pdfFile,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        var record = invoiceService.issueInvoice(factoryId, invoiceId, pdfFile, userId);
        return ResponseEntity.ok(Map.of("success", true, "data", record, "message", "发票已开具"));
    }

    @GetMapping
    public ResponseEntity<?> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        InvoiceStatus s = status != null ? InvoiceStatus.valueOf(status) : null;
        var result = invoiceService.listInvoices(factoryId, s,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @GetMapping("/{invoiceId}")
    public ResponseEntity<?> detail(@PathVariable String factoryId, @PathVariable String invoiceId) {
        return ResponseEntity.ok(Map.of("success", true, "data", invoiceService.getInvoice(factoryId, invoiceId)));
    }
}
