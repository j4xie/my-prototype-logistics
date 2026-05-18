package com.cretas.aims.controller.sales;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.sales.ServiceComplaintCreateRequest;
import com.cretas.aims.dto.sales.ServiceComplaintUpdateRequest;
import com.cretas.aims.entity.enums.ServiceComplaintStatus;
import com.cretas.aims.entity.sales.ServiceComplaint;
import com.cretas.aims.service.sales.ServiceComplaintService;
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
import java.util.Map;
import java.util.stream.Collectors;

/**
 * P2 #74 S-COMPLAINT-1 — 售后服务投诉 REST API.
 *
 * <p>Endpoints (base /api/mobile/{factoryId}/service-complaints):
 * <ul>
 *   <li>GET — 列表 (status,customerId 过滤)</li>
 *   <li>GET /{id} — 详情</li>
 *   <li>POST — 创建 (R4 dedup 5min window)</li>
 *   <li>PUT /{id} — 更新 (NEW 全量 / 其他仅 handler+resolution)</li>
 *   <li>POST /{id}/start — NEW → INVESTIGATING</li>
 *   <li>POST /{id}/resolve — INVESTIGATING → RESOLVED (resolution required)</li>
 *   <li>POST /{id}/close — RESOLVED → CLOSED</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/service-complaints")
@RequiredArgsConstructor
public class ServiceComplaintController {

    private final ServiceComplaintService service;

    @GetMapping
    @RequirePermission(value = {"sales:read", "sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<Page<ServiceComplaint>>> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<ServiceComplaintStatus> statuses = parseStatuses(status);
        Page<ServiceComplaint> result = service.list(factoryId, statuses, customerId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{id}")
    @RequirePermission(value = {"sales:read", "sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<ServiceComplaint>> get(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.getById(factoryId, id)));
    }

    @PostMapping
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<ServiceComplaint>> create(
            @PathVariable String factoryId,
            @Valid @RequestBody ServiceComplaintCreateRequest req) {
        Long userId = SecurityUtils.getCurrentUserId();
        ServiceComplaint created = service.create(factoryId, req, userId);
        return ResponseEntity.ok(ApiResponse.success("创建成功", created));
    }

    @PutMapping("/{id}")
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<ServiceComplaint>> update(
            @PathVariable String factoryId,
            @PathVariable String id,
            @Valid @RequestBody ServiceComplaintUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.success(service.update(factoryId, id, req)));
    }

    @PostMapping("/{id}/start")
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<ServiceComplaint>> start(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> body) {
        Long handlerUserId = null;
        if (body != null && body.get("handledBy") != null) {
            Object raw = body.get("handledBy");
            if (raw instanceof Number n) {
                handlerUserId = n.longValue();
            } else if (raw instanceof String s && !s.isBlank()) {
                handlerUserId = Long.parseLong(s);
            }
        }
        if (handlerUserId == null) {
            handlerUserId = SecurityUtils.getCurrentUserId();
        }
        return ResponseEntity.ok(ApiResponse.success("已开始调查",
                service.startInvestigation(factoryId, id, handlerUserId)));
    }

    @PostMapping("/{id}/resolve")
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<ServiceComplaint>> resolve(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        Object raw = body == null ? null : body.get("resolution");
        String resolution = raw == null ? null : raw.toString();
        return ResponseEntity.ok(ApiResponse.success("已解决",
                service.resolve(factoryId, id, resolution)));
    }

    @PostMapping("/{id}/close")
    @RequirePermission(value = {"sales:read_write", "system:read_write"})
    public ResponseEntity<ApiResponse<ServiceComplaint>> close(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success("已关闭",
                service.close(factoryId, id)));
    }

    private List<ServiceComplaintStatus> parseStatuses(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try {
                        return ServiceComplaintStatus.valueOf(s);
                    } catch (IllegalArgumentException e) {
                        return null;
                    }
                })
                .filter(s -> s != null)
                .collect(Collectors.toList());
    }
}
