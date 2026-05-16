package com.cretas.aims.controller.finance;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.enums.VoucherStatus;
import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.Voucher;
import com.cretas.aims.repository.VoucherRepository;
import com.cretas.aims.service.voucher.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Voucher REST API. Sprint3-E F-VFLAG-1.
 *
 * Endpoints:
 *   GET  /                       - page query (filter: status, type)
 *   GET  /{id}                   - detail
 *   GET  /by-business/{type}/{id} - lookup by source business (idempotent check from UI)
 *   POST /generate                - single generate (idempotent)
 *   POST /batch-generate          - batch UNCREATED → CREATED
 *   POST /{id}/post               - DRAFT → POSTED
 *   POST /{id}/void               - any → VOID
 *
 * Class-level RBAC: finance:read (view). Per-method RBAC raises bar for writes.
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/finance/vouchers")
@RequiredArgsConstructor
@RequirePermission({"finance:read", "finance:read_write"})
public class VoucherController {

    private final VoucherService voucherService;
    private final VoucherRepository voucherRepo;

    // ==================== Read ====================

    @GetMapping
    public ResponseEntity<?> list(
            @PathVariable String factoryId,
            @RequestParam(value = "status", required = false) VoucherStatus status,
            @RequestParam(value = "type", required = false) VoucherType type,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "voucherDate", "createdAt"));
        Page<Voucher> result;
        if (status != null) {
            result = voucherRepo.findByFactoryIdAndStatusAndDeletedAtIsNull(factoryId, status, pageable);
        } else if (type != null) {
            result = voucherRepo.findByFactoryIdAndVoucherTypeAndDeletedAtIsNull(factoryId, type, pageable);
        } else {
            result = voucherRepo.findByFactoryIdAndDeletedAtIsNull(factoryId, pageable);
        }
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> detail(@PathVariable String factoryId, @PathVariable String id) {
        Optional<Voucher> v = voucherRepo.findByIdAndFactoryIdAndDeletedAtIsNull(id, factoryId);
        if (v.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "凭证不存在"));
        }
        return ResponseEntity.ok(Map.of("success", true, "data", v.get()));
    }

    @GetMapping("/by-business/{businessType}/{businessId}")
    public ResponseEntity<?> findByBusiness(
            @PathVariable String factoryId,
            @PathVariable String businessType,
            @PathVariable String businessId) {
        Optional<Voucher> v = voucherService.findBySourceBusiness(businessType, businessId);
        if (v.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", true, "data", null, "message", "未生成凭证"));
        }
        return ResponseEntity.ok(Map.of("success", true, "data", v.get()));
    }

    // ==================== Write ====================

    @PostMapping("/generate")
    @RequirePermission("finance:read_write")
    public ResponseEntity<?> generate(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body) {
        String businessType = (String) body.get("businessType");
        String businessId = (String) body.get("businessId");
        if (businessType == null || businessId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "缺少必要参数: businessType / businessId"));
        }
        Voucher v = voucherService.createFromBusiness(factoryId, businessType, businessId);
        return ResponseEntity.ok(Map.of("success", true, "data", v, "message", "凭证已生成"));
    }

    @PostMapping("/batch-generate")
    @RequirePermission("finance:read_write")
    public ResponseEntity<?> batchGenerate(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body) {
        String businessType = (String) body.get("businessType");
        if (businessType == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "缺少必要参数: businessType"));
        }
        int count = voucherService.batchCreateForFactory(factoryId, businessType);
        Map<String, Object> data = new HashMap<>();
        data.put("businessType", businessType);
        data.put("count", count);
        return ResponseEntity.ok(Map.of("success", true, "data", data, "message", "批量生成完成"));
    }

    @PostMapping("/{id}/post")
    @RequirePermission("finance:read_write")
    public ResponseEntity<?> post(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        Voucher v = voucherService.post(id, userId);
        return ResponseEntity.ok(Map.of("success", true, "data", v, "message", "凭证已过账"));
    }

    @PostMapping("/{id}/void")
    @RequirePermission("finance:read_write")
    public ResponseEntity<?> voidVoucher(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        String reason = (String) body.getOrDefault("reason", "未填写原因");
        voucherService.voidVoucher(id, reason, userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "凭证已作废"));
    }
}
