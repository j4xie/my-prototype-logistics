package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.AttendanceException;
import com.cretas.aims.entity.hr.enums.AttendanceExceptionStatus;
import com.cretas.aims.service.hr.AttendanceExceptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * 考勤异常 REST API (P1 #41 H-ATT-FULL MVP).
 *
 * <p>路径: /api/mobile/{factoryId}/hr/attendance-exceptions
 *
 * <p>RBAC: 列表 hr:read+; 批准/驳回/扫描 hr:read_write
 *
 * @author Cretas Team
 * @since 2026-05-17
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/attendance-exceptions")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class AttendanceExceptionController {

    private final AttendanceExceptionService service;

    /**
     * 扫描指定月份打卡 vs 排班生成异常 (R5 防呆: 重新检测 button).
     */
    @PostMapping("/detect")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> detect(@PathVariable String factoryId,
                                    @RequestBody Map<String, Object> body) {
        String yearMonth = (String) body.get("yearMonth");
        Map<String, Object> summary = service.detectExceptions(factoryId, yearMonth);
        return ResponseEntity.ok(Map.of("success", true, "data", summary,
                "message", String.format("检测完成: 扫描 %s 条, 新增 %s 条, 跳过 %s 条 (已存在)",
                        summary.get("scanned"), summary.get("created"), summary.get("skipped"))));
    }

    @GetMapping
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> list(@PathVariable String factoryId,
                                  @RequestParam(required = false) AttendanceExceptionStatus status,
                                  @RequestParam(required = false) String startDate,
                                  @RequestParam(required = false) String endDate,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        LocalDate s = startDate != null && !startDate.isBlank() ? LocalDate.parse(startDate) : null;
        LocalDate e = endDate != null && !endDate.isBlank() ? LocalDate.parse(endDate) : null;
        Page<AttendanceException> p = service.list(factoryId, status, s, e,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "workDate", "createdAt")));
        return ResponseEntity.ok(Map.of("success", true, "data", p));
    }

    @GetMapping("/{id}")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> get(@PathVariable String factoryId, @PathVariable String id) {
        return service.getById(factoryId, id)
                .<ResponseEntity<?>>map(ex -> ResponseEntity.ok(Map.of("success", true, "data", ex)))
                .orElseGet(() -> ResponseEntity.status(404)
                        .body(Map.of("success", false, "message", "异常记录不存在")));
    }

    @PostMapping("/{id}/approve")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> approve(@PathVariable String factoryId,
                                     @PathVariable String id,
                                     @RequestAttribute("userId") Long processorId,
                                     @RequestBody(required = false) Map<String, String> body) {
        String notes = body != null ? body.get("notes") : null;
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.approve(factoryId, processorId, id, notes),
                "message", "已批准"));
    }

    @PostMapping("/{id}/reject")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> reject(@PathVariable String factoryId,
                                    @PathVariable String id,
                                    @RequestAttribute("userId") Long processorId,
                                    @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.reject(factoryId, processorId, id, body.get("notes")),
                "message", "已驳回"));
    }
}
