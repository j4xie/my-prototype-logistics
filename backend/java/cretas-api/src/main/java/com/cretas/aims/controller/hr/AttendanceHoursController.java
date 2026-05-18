package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.hr.AttendanceHoursSummaryDTO;
import com.cretas.aims.service.hr.AttendanceHoursAggregatorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 工时统计 REST API (#835 follow-up — 工时统计).
 *
 * <p>路径: {@code /api/mobile/{factoryId}/hr/attendance-hours}
 *
 * <p>RBAC:
 * <ul>
 *   <li>monthly?userId=mine 自查 hr:read+</li>
 *   <li>monthly?userId=X / list HR 看板 仅 hr:read_write</li>
 * </ul>
 *
 * <p>只读聚合 — 无写接口.
 *
 * @author Cretas Team — #835 follow-up Attendance Hours
 * @since 2026-05-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/attendance-hours")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class AttendanceHoursController {

    private final AttendanceHoursAggregatorService service;

    /**
     * 单员工月度工时摘要.
     *
     * @param factoryId 路径变量
     * @param userId    员工 ID; null 表示当前登录用户 (自查)
     * @param yearMonth 格式 YYYY-MM
     */
    @GetMapping("/monthly")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> monthly(@PathVariable String factoryId,
                                     @RequestAttribute("userId") Long currentUserId,
                                     @RequestParam(required = false) Long userId,
                                     @RequestParam String yearMonth) {
        Long target = userId != null ? userId : currentUserId;
        return service.computeMonthlyHoursForUser(factoryId, target, yearMonth)
                .<ResponseEntity<?>>map(dto ->
                        ResponseEntity.ok(Map.of("success", true, "data", dto)))
                .orElseGet(() -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "data", null,
                        "message", "本月无打卡数据 — 检查 TimeClockRecord 录入")));
    }

    /**
     * 工厂某月全员工时摘要 (HR 报表).
     *
     * <p>默认 sorted by overtimeHours DESC, 让前端 Widget 直接 top N.
     */
    @GetMapping("/list")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> list(@PathVariable String factoryId,
                                  @RequestParam String yearMonth) {
        List<AttendanceHoursSummaryDTO> data =
                service.computeMonthlyHoursForFactory(factoryId, yearMonth);
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }
}
