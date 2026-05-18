package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.CompTimeBalance;
import com.cretas.aims.entity.hr.CompTimeLedgerEntry;
import com.cretas.aims.service.hr.CompTimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 调休账单 REST API (#835 follow-up).
 *
 * <p>路径: {@code /api/mobile/{factoryId}/hr/comptime-balances}
 *
 * <p>RBAC: mine 自查 hr:read+; users/list 仅 HR (hr:read_write).
 *
 * <p>余额变更由 OT 审批 / Leave 审批触发 (CompTimeEventListener 自动入账);
 * 此 controller 只读, 不暴露写接口 (手工调整未来需求, 走单独 HR 工具).
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/comptime-balances")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class CompTimeBalanceController {

    private final CompTimeService service;

    /** 我的余额 — 全月份倒序 / 单月. */
    @GetMapping("/mine")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> mine(@PathVariable String factoryId,
                                  @RequestAttribute("userId") Long userId,
                                  @RequestParam(required = false) String yearMonth) {
        if (yearMonth != null && !yearMonth.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", service.getBalance(factoryId, userId, yearMonth).orElse(null)));
        }
        List<CompTimeBalance> data = service.listBalances(factoryId, userId);
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    /** 某用户全部月份余额 (HR / 主管查). */
    @GetMapping("/users/{userId}")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> forUser(@PathVariable String factoryId,
                                     @PathVariable Long userId,
                                     @RequestParam(required = false) String yearMonth) {
        if (yearMonth != null && !yearMonth.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", service.getBalance(factoryId, userId, yearMonth).orElse(null)));
        }
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.listBalances(factoryId, userId)));
    }

    /** 工厂某月所有员工余额 (HR 报表). */
    @GetMapping
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> factoryMonth(@PathVariable String factoryId,
                                          @RequestParam String yearMonth) {
        return ResponseEntity.ok(Map.of("success", true,
                "data", service.listFactoryMonth(factoryId, yearMonth)));
    }

    /** 我的 ledger 明细 (分页). */
    @GetMapping("/mine/ledger")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> mineLedger(@PathVariable String factoryId,
                                        @RequestAttribute("userId") Long userId,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "50") int size) {
        Page<CompTimeLedgerEntry> data = service.listLedger(factoryId, userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of(
                        "content", data.getContent(),
                        "totalElements", data.getTotalElements(),
                        "totalPages", data.getTotalPages(),
                        "number", data.getNumber(),
                        "size", data.getSize())));
    }

    /** 某用户 ledger 明细 (HR / 主管钻取). */
    @GetMapping("/users/{userId}/ledger")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> userLedger(@PathVariable String factoryId,
                                        @PathVariable Long userId,
                                        @RequestParam(required = false) String yearMonth,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "50") int size) {
        if (yearMonth != null && !yearMonth.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", service.listLedgerByMonth(factoryId, userId, yearMonth)));
        }
        Page<CompTimeLedgerEntry> data = service.listLedger(factoryId, userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of(
                        "content", data.getContent(),
                        "totalElements", data.getTotalElements(),
                        "totalPages", data.getTotalPages(),
                        "number", data.getNumber(),
                        "size", data.getSize())));
    }
}
