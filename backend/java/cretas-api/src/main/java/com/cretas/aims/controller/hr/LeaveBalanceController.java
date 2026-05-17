package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.enums.LeaveType;
import com.cretas.aims.service.hr.LeaveBalanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 假期余额查询 — 只读. 余额变更由 LeaveRequest/OvertimeRequest 审批通过时
 * 自动累计 (LeaveBalanceService.addEarned / addUsed in service layer).
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/leave-balances")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class LeaveBalanceController {

    private final LeaveBalanceService service;

    /** 我的余额 — 单月 (按 leaveType 分行). */
    @GetMapping("/mine")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> mine(@PathVariable String factoryId,
                                  @RequestAttribute("userId") Long userId,
                                  @RequestParam(required = false) String yearMonth) {
        var data = yearMonth != null
                ? service.listForUserMonth(factoryId, userId, yearMonth)
                : service.listForUser(factoryId, userId);
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    /** 某用户余额 (HR / 主管查看). */
    @GetMapping("/users/{userId}")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> forUser(@PathVariable String factoryId,
                                     @PathVariable Long userId,
                                     @RequestParam(required = false) String yearMonth) {
        var data = yearMonth != null
                ? service.listForUserMonth(factoryId, userId, yearMonth)
                : service.listForUser(factoryId, userId);
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    /** 工厂某类型某月所有用户余额 (HR 报表). */
    @GetMapping
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> byTypeMonth(@PathVariable String factoryId,
                                         @RequestParam LeaveType leaveType,
                                         @RequestParam String yearMonth) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.listByTypeMonth(factoryId, leaveType, yearMonth)));
    }
}
