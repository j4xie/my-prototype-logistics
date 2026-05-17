package com.cretas.aims.controller;

import com.cretas.aims.entity.CustomerTrackingRecord;
import com.cretas.aims.repository.CustomerTrackingRecordRepository;
import com.cretas.aims.annotation.RequirePermission;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * S-CRM-1 (Sprint 4 Wave 2 Chat L) — customer tracking record REST endpoints.
 *
 * Entity + repository already shipped in Sprint 1. PR 8 adds the Controller
 * + DTO layer and RBAC gating. All endpoints scoped by {factoryId} path var.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/sales/customer-tracking")
@RequiredArgsConstructor
public class CustomerTrackingRecordController {

    private final CustomerTrackingRecordRepository repository;

    /**
     * GET /api/mobile/{factoryId}/sales/customer-tracking
     *   ?customerId=...   list by customer (newest first, paginated)
     *   ?page=0&size=20   pagination params
     */
    @GetMapping
    @RequirePermission("sales:view")
    public ResponseEntity<Map<String, Object>> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) String customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safeSize = Math.max(1, Math.min(size, 100));
        if (customerId != null && !customerId.isBlank()) {
            Page<CustomerTrackingRecord> p = repository.findByCustomerIdAndDeletedAtIsNull(
                    customerId, PageRequest.of(page, safeSize));
            // Filter by factory in-memory to defend tenant isolation alongside repo customer filter.
            List<CustomerTrackingRecord> safe = p.getContent().stream()
                    .filter(r -> factoryId.equals(r.getFactoryId()))
                    .toList();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", Map.of(
                            "content", safe,
                            "totalElements", p.getTotalElements(),
                            "totalPages", p.getTotalPages()
                    )
            ));
        }
        List<CustomerTrackingRecord> all = repository.findByFactoryIdAndDeletedAtIsNullOrderByRecordTimeDesc(factoryId);
        int from = Math.min(page * safeSize, all.size());
        int to = Math.min(from + safeSize, all.size());
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of(
                        "content", all.subList(from, to),
                        "totalElements", all.size(),
                        "totalPages", (int) Math.ceil(all.size() / (double) safeSize)
                )
        ));
    }

    /** GET single record. */
    @GetMapping("/{id}")
    @RequirePermission("sales:view")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String factoryId, @PathVariable Long id) {
        CustomerTrackingRecord r = repository.findById(id).orElseThrow(
                () -> new IllegalArgumentException("Tracking record not found: " + id));
        if (!factoryId.equals(r.getFactoryId())) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "factoryId mismatch"
            ));
        }
        return ResponseEntity.ok(Map.of("success", true, "data", r));
    }

    /** POST create. */
    @PostMapping
    @RequirePermission("sales:edit")
    public ResponseEntity<Map<String, Object>> create(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateTrackingRecordRequest body
    ) {
        CustomerTrackingRecord r = new CustomerTrackingRecord();
        r.setFactoryId(factoryId);
        r.setCustomerId(body.getCustomerId());
        r.setRecordTime(body.getRecordTime() != null ? body.getRecordTime() : LocalDateTime.now());
        r.setRecorderName(body.getRecorderName());
        r.setRecorderId(body.getRecorderId());
        r.setContent(body.getContent());
        r.setContactPerson(body.getContactPerson());
        r.setContactPhone(body.getContactPhone());
        r.setAddress(body.getAddress());
        r.setRemark(body.getRemark());
        repository.save(r);
        log.info("Created tracking record {} for customer {} (factory={})", r.getId(), body.getCustomerId(), factoryId);
        return ResponseEntity.ok(Map.of("success", true, "data", r));
    }

    /** DELETE soft-delete (SQLDelete on entity). */
    @DeleteMapping("/{id}")
    @RequirePermission("sales:edit")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String factoryId, @PathVariable Long id) {
        CustomerTrackingRecord r = repository.findById(id).orElseThrow(
                () -> new IllegalArgumentException("Tracking record not found: " + id));
        if (!factoryId.equals(r.getFactoryId())) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "factoryId mismatch"
            ));
        }
        repository.delete(r);
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of("id", id)));
    }

    @Data
    public static class CreateTrackingRecordRequest {
        @NotBlank
        private String customerId;
        private LocalDateTime recordTime;
        private String recorderName;
        private Long recorderId;
        @NotBlank
        private String content;
        private String contactPerson;
        private String contactPhone;
        private String address;
        private String remark;
    }
}
