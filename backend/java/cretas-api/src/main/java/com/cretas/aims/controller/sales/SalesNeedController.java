package com.cretas.aims.controller.sales;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.sales.SalesNeedCreateRequest;
import com.cretas.aims.dto.sales.SalesNeedUpdateRequest;
import com.cretas.aims.entity.enums.SalesNeedStatus;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.sales.SalesNeed;
import com.cretas.aims.service.sales.SalesNeedService;
import com.cretas.aims.utils.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Sprint 4 W2 S-NEED-1 — 客户需求 REST API.
 *
 * <p>Endpoints (base /api/mobile/{factoryId}/sales-needs):
 * <ul>
 *   <li>GET — 列表 (status,customerId 过滤)</li>
 *   <li>GET /{id} — 详情</li>
 *   <li>POST — 创建</li>
 *   <li>PUT /{id} — 更新 (仅 DRAFT)</li>
 *   <li>POST /{id}/confirm — DRAFT → CONFIRMED</li>
 *   <li>POST /{id}/convert — CONFIRMED → CONVERTED_TO_SO + 自动建 SalesOrder</li>
 *   <li>POST /{id}/cancel — 取消</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/sales-needs")
@RequiredArgsConstructor
public class SalesNeedController {

    private final SalesNeedService service;

    @GetMapping
    @RequirePermission(value = {"sales:read", "sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<Page<SalesNeed>>> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<SalesNeedStatus> statuses = parseStatuses(status);
        Page<SalesNeed> result = service.list(factoryId, statuses, customerId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{id}")
    @RequirePermission(value = {"sales:read", "sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<SalesNeed>> get(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.getById(factoryId, id)));
    }

    @PostMapping
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<SalesNeed>> create(
            @PathVariable String factoryId,
            @Valid @RequestBody SalesNeedCreateRequest req) {
        Long userId = SecurityUtils.getCurrentUserId();
        SalesNeed created = service.create(factoryId, req, userId);
        return ResponseEntity.ok(ApiResponse.success("创建成功", created));
    }

    @PutMapping("/{id}")
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<SalesNeed>> update(
            @PathVariable String factoryId,
            @PathVariable String id,
            @Valid @RequestBody SalesNeedUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.success(service.update(factoryId, id, req)));
    }

    @PostMapping("/{id}/confirm")
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<SalesNeed>> confirm(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success("已确认", service.confirm(factoryId, id)));
    }

    @PostMapping("/{id}/convert")
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<SalesOrder>> convert(
            @PathVariable String factoryId,
            @PathVariable String id) {
        Long userId = SecurityUtils.getCurrentUserId();
        SalesOrder created = service.convertToSalesOrder(factoryId, id, userId);
        return ResponseEntity.ok(ApiResponse.success("已转销售订单", created));
    }

    @PostMapping("/{id}/cancel")
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<SalesNeed>> cancel(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success("已取消", service.cancel(factoryId, id)));
    }

    private List<SalesNeedStatus> parseStatuses(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try {
                        return SalesNeedStatus.valueOf(s);
                    } catch (IllegalArgumentException e) {
                        return null;
                    }
                })
                .filter(s -> s != null)
                .collect(Collectors.toList());
    }
}
