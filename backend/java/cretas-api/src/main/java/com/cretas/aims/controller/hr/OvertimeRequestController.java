package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.OvertimeRequest;
import com.cretas.aims.entity.hr.enums.CompensationType;
import com.cretas.aims.entity.hr.enums.HrRequestStatus;
import com.cretas.aims.entity.hr.enums.OvertimeType;
import com.cretas.aims.service.hr.OvertimeRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/overtime-requests")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class OvertimeRequestController {

    private final OvertimeRequestService service;

    @PostMapping
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> create(@PathVariable String factoryId,
                                    @RequestAttribute("userId") Long userId,
                                    @RequestBody Map<String, Object> body) {
        OvertimeRequest req = service.create(factoryId, userId,
                OvertimeType.valueOf((String) body.get("overtimeType")),
                LocalDateTime.parse((String) body.get("startTime")),
                LocalDateTime.parse((String) body.get("endTime")),
                new BigDecimal(body.get("hours").toString()),
                CompensationType.valueOf((String) body.get("compensationType")),
                (String) body.get("reason"));
        return ResponseEntity.ok(Map.of("success", true, "data", req, "message", "已保存草稿"));
    }

    @PutMapping("/{id}")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> update(@PathVariable String factoryId,
                                    @PathVariable String id,
                                    @RequestAttribute("userId") Long userId,
                                    @RequestBody Map<String, Object> body) {
        OvertimeRequest req = service.update(factoryId, userId, id,
                OvertimeType.valueOf((String) body.get("overtimeType")),
                LocalDateTime.parse((String) body.get("startTime")),
                LocalDateTime.parse((String) body.get("endTime")),
                new BigDecimal(body.get("hours").toString()),
                CompensationType.valueOf((String) body.get("compensationType")),
                (String) body.get("reason"));
        return ResponseEntity.ok(Map.of("success", true, "data", req, "message", "已更新"));
    }

    @PostMapping("/{id}/submit")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> submit(@PathVariable String factoryId,
                                    @PathVariable String id,
                                    @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.submit(factoryId, userId, id), "message", "已提交审批"));
    }

    @PostMapping("/{id}/approve")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> approve(@PathVariable String factoryId,
                                     @PathVariable String id,
                                     @RequestAttribute("userId") Long approverId) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.approve(factoryId, approverId, id), "message", "已批准"));
    }

    @PostMapping("/{id}/reject")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> reject(@PathVariable String factoryId,
                                    @PathVariable String id,
                                    @RequestAttribute("userId") Long approverId,
                                    @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.reject(factoryId, approverId, id, body.get("reason")),
                "message", "已拒绝"));
    }

    @PostMapping("/{id}/cancel")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> cancel(@PathVariable String factoryId,
                                    @PathVariable String id,
                                    @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.cancel(factoryId, userId, id), "message", "已撤回"));
    }

    @GetMapping("/{id}")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> get(@PathVariable String factoryId, @PathVariable String id) {
        return service.getById(factoryId, id)
                .<ResponseEntity<?>>map(r -> ResponseEntity.ok(Map.of("success", true, "data", r)))
                .orElseGet(() -> ResponseEntity.status(404)
                        .body(Map.of("success", false, "message", "申请不存在")));
    }

    @GetMapping("/mine")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> mine(@PathVariable String factoryId,
                                  @RequestAttribute("userId") Long userId,
                                  @RequestParam(required = false) HrRequestStatus status,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        Page<OvertimeRequest> p = service.listMine(factoryId, userId, status,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of("success", true, "data", p));
    }

    @GetMapping("/pending")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> pending(@PathVariable String factoryId,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        Page<OvertimeRequest> p = service.listPending(factoryId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "submittedAt")));
        return ResponseEntity.ok(Map.of("success", true, "data", p));
    }

    @GetMapping
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> all(@PathVariable String factoryId,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "20") int size) {
        Page<OvertimeRequest> p = service.listAll(factoryId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of("success", true, "data", p));
    }

    @GetMapping("/summary")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> summary(@PathVariable String factoryId,
                                     @RequestParam String yearMonth) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.summarizeMonth(factoryId, yearMonth)));
    }
}
