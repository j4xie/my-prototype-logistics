package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.SalaryItem;
import com.cretas.aims.entity.hr.enums.SalaryStatus;
import com.cretas.aims.service.hr.SalaryItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 月度工资单 REST API.
 *
 * <p>路径: /api/mobile/{factoryId}/hr/salaries
 *
 * <p>RBAC:
 * <ul>
 *   <li>查看 (get/list/summary): hr:read+</li>
 *   <li>编辑/确认/发放 (create/update/confirm/markPaid/delete): hr:read_write</li>
 * </ul>
 *
 * <p>防呆策略:
 * <ul>
 *   <li>R1: /preview-compute 接口供 Vue dialog 实时显示 base → social/tax/net</li>
 *   <li>R2: response message 含 user+yearMonth+amount context</li>
 *   <li>R4: 同 user+yearMonth 防重复创建 (Service 抛 409)</li>
 * </ul>
 *
 * @author Cretas Team — P1-40 H-WAGE-FULL MVP
 * @since 2026-05-17
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/salaries")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class SalaryItemController {

    private final SalaryItemService service;

    /**
     * R1 防呆 preview: 给定 baseSalary 算出 social/tax/net, 不写库.
     * 用于前端 dialog 输入 base 时 watch 触发实时显示.
     */
    @PostMapping("/preview-compute")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> previewCompute(@PathVariable String factoryId,
                                            @RequestBody Map<String, Object> body) {
        BigDecimal base = body.get("baseSalary") == null
                ? BigDecimal.ZERO
                : new BigDecimal(body.get("baseSalary").toString());
        Map<String, BigDecimal> preview = service.previewComputeFromBase(base);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", preview,
                "message", String.format("基本工资 ¥%s → 实发 ¥%s", base, preview.get("netSalary"))
        ));
    }

    @PostMapping
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> create(@PathVariable String factoryId,
                                    @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String yearMonth = (String) body.get("yearMonth");
        BigDecimal base = new BigDecimal(body.get("baseSalary").toString());
        String remark = (String) body.get("remark");
        SalaryItem saved = service.create(factoryId, userId, yearMonth, base, remark);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", saved,
                // R2 防呆: 含 user+yearMonth+amount context
                "message", String.format("已创建工资单 [用户 %d / %s / 实发 ¥%s]",
                        userId, yearMonth, saved.getNetSalary())
        ));
    }

    @PutMapping("/{id}")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> update(@PathVariable String factoryId,
                                    @PathVariable String id,
                                    @RequestBody Map<String, Object> body) {
        BigDecimal base = body.get("baseSalary") == null
                ? null
                : new BigDecimal(body.get("baseSalary").toString());
        String remark = (String) body.get("remark");
        SalaryItem saved = service.update(factoryId, id, base, remark);
        return ResponseEntity.ok(Map.of(
                "success", true, "data", saved,
                "message", String.format("已更新 [%s / 实发 ¥%s]",
                        saved.getYearMonth(), saved.getNetSalary())
        ));
    }

    /**
     * #833 follow-up R1 防呆 preview: 给定 annualBonus 算 tax + bracket label, 不写库.
     * 用于前端 dialog 输入年终奖时实时显示 "税额 ¥X (税率 Y% bracket Z)".
     */
    @PostMapping("/annual-bonus-preview")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> annualBonusPreview(@PathVariable String factoryId,
                                                @RequestBody Map<String, Object> body) {
        BigDecimal bonus = body.get("bonusAmount") == null
                ? BigDecimal.ZERO
                : new BigDecimal(body.get("bonusAmount").toString());
        Map<String, Object> preview = service.previewAnnualBonusTax(bonus);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", preview,
                "message", String.format("年终奖 ¥%s → 税额 ¥%s (税率 %s, 档位 %s)",
                        bonus, preview.get("annualBonusTax"),
                        preview.get("bracketRate"), preview.get("bracketLabel"))
        ));
    }

    /**
     * #833 follow-up: 设置/更新年终奖 (按一次性年终奖税法算 tax 写库).
     * R2 防呆: response message 含 user+yearMonth+bonus+tax context.
     * R4 防呆: PAID 状态拒改, DRAFT/CONFIRMED 可任意更新 (Service 抛 400).
     *
     * @param body { "bonusAmount": Number } 或 { "bonusAmount": null } (后者清空)
     */
    @PostMapping("/{id}/annual-bonus")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> setAnnualBonus(@PathVariable String factoryId,
                                            @PathVariable String id,
                                            @RequestBody Map<String, Object> body) {
        Object raw = body.get("bonusAmount");
        BigDecimal bonus = (raw == null) ? null : new BigDecimal(raw.toString());
        SalaryItem saved = service.setAnnualBonus(factoryId, id, bonus);
        String bonusStr = saved.getAnnualBonus() == null ? "已清空" : "¥" + saved.getAnnualBonus();
        String taxStr = saved.getAnnualBonusTax() == null ? "—" : "¥" + saved.getAnnualBonusTax();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", saved,
                // R2 防呆: 含 user+yearMonth+bonus+tax context
                "message", String.format("已设置年终奖 [用户 %d / %s / 年终奖 %s / 个税 %s]",
                        saved.getUserId(), saved.getYearMonth(), bonusStr, taxStr)
        ));
    }

    @PostMapping("/{id}/recompute")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> recompute(@PathVariable String factoryId,
                                       @PathVariable String id) {
        SalaryItem saved = service.applyComputeFromBase(factoryId, id);
        return ResponseEntity.ok(Map.of(
                "success", true, "data", saved,
                "message", String.format("已重算 [实发 ¥%s]", saved.getNetSalary())
        ));
    }

    @PostMapping("/{id}/confirm")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> confirm(@PathVariable String factoryId,
                                     @PathVariable String id,
                                     @RequestAttribute("userId") Long actorUserId) {
        SalaryItem saved = service.confirm(factoryId, id, actorUserId);
        return ResponseEntity.ok(Map.of(
                "success", true, "data", saved,
                "message", String.format("已确认 [%s 用户 %d / 实发 ¥%s]",
                        saved.getYearMonth(), saved.getUserId(), saved.getNetSalary())
        ));
    }

    @PostMapping("/{id}/pay")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> markPaid(@PathVariable String factoryId,
                                      @PathVariable String id,
                                      @RequestAttribute("userId") Long actorUserId) {
        SalaryItem saved = service.markPaid(factoryId, id, actorUserId);
        return ResponseEntity.ok(Map.of(
                "success", true, "data", saved,
                "message", String.format("已标记发放 [%s 用户 %d / 实发 ¥%s]",
                        saved.getYearMonth(), saved.getUserId(), saved.getNetSalary())
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
                        .body(Map.of("success", false, "message", "工资单不存在")));
    }

    @GetMapping
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> list(@PathVariable String factoryId,
                                  @RequestParam(required = false) String yearMonth,
                                  @RequestParam(required = false) SalaryStatus status,
                                  @RequestParam(required = false) Long userId,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        Page<SalaryItem> p = service.list(factoryId, yearMonth, status, userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "yearMonth", "userId")));
        return ResponseEntity.ok(Map.of("success", true, "data", p));
    }

    @GetMapping("/summary")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> summary(@PathVariable String factoryId,
                                     @RequestParam String yearMonth) {
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", service.summarizeMonth(factoryId, yearMonth),
                "message", String.format("%s 月度工资汇总", yearMonth)
        ));
    }
}
