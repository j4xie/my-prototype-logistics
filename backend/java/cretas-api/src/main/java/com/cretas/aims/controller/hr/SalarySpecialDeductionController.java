package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.SalarySpecialDeduction;
import com.cretas.aims.entity.hr.enums.DeductionStatus;
import com.cretas.aims.entity.hr.enums.DeductionType;
import com.cretas.aims.service.hr.SalarySpecialDeductionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

/**
 * 个税专项附加扣除 REST API.
 *
 * <p>路径: /api/mobile/{factoryId}/hr/special-deductions
 *
 * <p>RBAC:
 * <ul>
 *   <li>查看 (get/list/preview): hr:read+</li>
 *   <li>编辑/状态变更/删除: hr:read_write</li>
 * </ul>
 *
 * <p>防呆策略:
 * <ul>
 *   <li>R1: /preview-for-month 接口 — dialog 编辑时显示该 user 当月所有 ACTIVE 扣除合计</li>
 *   <li>R2: response message 含 userId + deductionType + monthlyAmount + period context</li>
 *   <li>R3: deductionType / status 走 enum (前端 dropdown 6 类 + 3 状态)</li>
 *   <li>R4: 同 (user, type, validFrom) ACTIVE 防重复 (Service 抛 409 + actionHint)</li>
 * </ul>
 *
 * @author Cretas Team — P1-40 H-WAGE 专项扣除 follow-up
 * @since 2026-05-17
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/special-deductions")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class SalarySpecialDeductionController {

    private final SalarySpecialDeductionService service;

    /**
     * R1 防呆 preview: 给定 (user, yearMonth) 返回当月所有 ACTIVE 扣除明细 + 合计.
     * 前端 dialog 打开时立即拉, 让 HR 看清当前状态再决定新增/编辑.
     */
    @GetMapping("/preview-for-month")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> previewForMonth(@PathVariable String factoryId,
                                              @RequestParam Long userId,
                                              @RequestParam String yearMonth) {
        YearMonth ym;
        try {
            ym = YearMonth.parse(yearMonth);
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "yearMonth 格式必须为 YYYY-MM, got: " + yearMonth));
        }
        List<SalarySpecialDeduction> active = service.listActiveForMonth(factoryId, userId, ym);
        BigDecimal total = service.computeTotalDeductionForMonth(factoryId, userId, ym);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of(
                        "userId", userId,
                        "yearMonth", yearMonth,
                        "activeDeductions", active,
                        "totalMonthlyDeduction", total
                ),
                "message", String.format("用户 %d %s 月度专项扣除合计 ¥%s (%d 项)",
                        userId, yearMonth, total, active.size())
        ));
    }

    @PostMapping
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> create(@PathVariable String factoryId,
                                    @RequestBody Map<String, Object> body) {
        Long userId = body.get("userId") == null ? null
                : Long.valueOf(body.get("userId").toString());
        DeductionType type = body.get("deductionType") == null ? null
                : DeductionType.valueOf(body.get("deductionType").toString());
        BigDecimal monthlyAmount = body.get("monthlyAmount") == null ? null
                : new BigDecimal(body.get("monthlyAmount").toString());
        LocalDate validFrom = body.get("validFrom") == null ? null
                : LocalDate.parse(body.get("validFrom").toString());
        LocalDate validTo = body.get("validTo") == null ? null
                : LocalDate.parse(body.get("validTo").toString());
        String notes = (String) body.get("notes");

        SalarySpecialDeduction saved = service.create(
                factoryId, userId, type, monthlyAmount, validFrom, validTo, notes);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", saved,
                // R2 防呆: message 含 user + type + amount + period context
                "message", String.format("已新增 [用户 %d / %s / 月扣 ¥%s / 从 %s%s]",
                        saved.getUserId(), saved.getDeductionType(),
                        saved.getMonthlyAmount(), saved.getValidFrom(),
                        saved.getValidTo() == null ? "" : " 至 " + saved.getValidTo())
        ));
    }

    @PutMapping("/{id}")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> update(@PathVariable String factoryId,
                                    @PathVariable String id,
                                    @RequestBody Map<String, Object> body) {
        BigDecimal monthlyAmount = body.get("monthlyAmount") == null ? null
                : new BigDecimal(body.get("monthlyAmount").toString());
        LocalDate validTo = body.get("validTo") == null ? null
                : LocalDate.parse(body.get("validTo").toString());
        String notes = (String) body.get("notes");

        SalarySpecialDeduction saved = service.update(factoryId, id, monthlyAmount, validTo, notes);
        return ResponseEntity.ok(Map.of(
                "success", true, "data", saved,
                "message", String.format("已更新 [用户 %d / %s / 月扣 ¥%s]",
                        saved.getUserId(), saved.getDeductionType(), saved.getMonthlyAmount())
        ));
    }

    @PostMapping("/{id}/status")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> changeStatus(@PathVariable String factoryId,
                                           @PathVariable String id,
                                           @RequestBody Map<String, Object> body) {
        DeductionStatus newStatus = body.get("status") == null ? null
                : DeductionStatus.valueOf(body.get("status").toString());
        SalarySpecialDeduction saved = service.changeStatus(factoryId, id, newStatus);
        return ResponseEntity.ok(Map.of(
                "success", true, "data", saved,
                "message", String.format("已变更状态 [用户 %d / %s / → %s]",
                        saved.getUserId(), saved.getDeductionType(), saved.getStatus())
        ));
    }

    @DeleteMapping("/{id}")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> delete(@PathVariable String factoryId, @PathVariable String id) {
        service.delete(factoryId, id);
        return ResponseEntity.ok(Map.of("success", true, "message", "已删除"));
    }

    @GetMapping("/{id}")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> get(@PathVariable String factoryId, @PathVariable String id) {
        return service.getById(factoryId, id)
                .<ResponseEntity<?>>map(r -> ResponseEntity.ok(Map.of("success", true, "data", r)))
                .orElseGet(() -> ResponseEntity.status(404)
                        .body(Map.of("success", false, "message", "专项扣除记录不存在")));
    }

    @GetMapping
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> list(@PathVariable String factoryId,
                                  @RequestParam(required = false) Long userId,
                                  @RequestParam(required = false) DeductionStatus status,
                                  @RequestParam(required = false) DeductionType deductionType,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        Page<SalarySpecialDeduction> p = service.list(factoryId, userId, status, deductionType,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "validFrom")));
        return ResponseEntity.ok(Map.of("success", true, "data", p));
    }
}
