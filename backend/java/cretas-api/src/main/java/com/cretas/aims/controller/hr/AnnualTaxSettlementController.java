package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.AnnualTaxSettlement;
import com.cretas.aims.entity.hr.enums.AnnualTaxSettlementStatus;
import com.cretas.aims.service.hr.AnnualTaxSettlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 年度汇算 REST API (#833 follow-up).
 *
 * <p>路径: /api/mobile/{factoryId}/hr/annual-settlements
 *
 * <p>RBAC:
 * <ul>
 *   <li>查看 (get/list/preview): hr:read+</li>
 *   <li>计算/确认/标记申报/删除: hr:read_write</li>
 * </ul>
 *
 * <p>防呆策略:
 * <ul>
 *   <li>R1: POST /preview 给定 user+year preview 应退/应补 不写库</li>
 *   <li>R2: response message 含 user+year+refund/owed context</li>
 *   <li>R4: POST /compute idempotent — 同 (user, year) re-compute updates existing</li>
 *   <li>R5: status=REPORTED 时 compute 抛 400 (已申报税局锁住)</li>
 * </ul>
 *
 * @author Cretas Team — #833 年度汇算 follow-up
 * @since 2026-05-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/annual-settlements")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class AnnualTaxSettlementController {

    private final AnnualTaxSettlementService service;

    /**
     * R1 防呆 preview: 给定 user+year 预览汇算结果, 不写库.
     * 用于前端"计算"button → dialog 实时显示 "应退/应补 ¥X" + breakdown.
     */
    @PostMapping("/preview")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> preview(@PathVariable String factoryId,
                                     @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        Integer taxYear = Integer.valueOf(body.get("taxYear").toString());
        Map<String, Object> result = service.previewCompute(factoryId, userId, taxYear);
        BigDecimal refundOwed = (BigDecimal) result.get("refundOwed");
        String verdict = refundOwedVerdict(refundOwed);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", result,
                "message", String.format("%d 年度汇算预览 [用户 %d / %s]",
                        taxYear, userId, verdict)
        ));
    }

    /**
     * R4 防呆 idempotent compute: re-compute 同 (user, year) updates existing record.
     * R5 防呆: REPORTED 状态拒改 (Service 抛 400).
     */
    @PostMapping("/compute")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> compute(@PathVariable String factoryId,
                                     @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        Integer taxYear = Integer.valueOf(body.get("taxYear").toString());
        AnnualTaxSettlement saved = service.computeForUser(factoryId, userId, taxYear);
        String verdict = refundOwedVerdict(saved.getRefundOwed());
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", saved,
                // R2 防呆: 含 user+year+verdict+amount context
                "message", String.format("已完成 %d 年度汇算 [用户 %d / %s / 应纳税额 ¥%s / 已预缴 ¥%s]",
                        taxYear, userId, verdict,
                        saved.getAnnualTaxDue(), saved.getMonthlyPrepaidSum())
        ));
    }

    @PostMapping("/{id}/confirm")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> confirm(@PathVariable String factoryId,
                                     @PathVariable String id,
                                     @RequestAttribute("userId") Long actorUserId) {
        AnnualTaxSettlement saved = service.confirm(factoryId, id, actorUserId);
        return ResponseEntity.ok(Map.of(
                "success", true, "data", saved,
                "message", String.format("已确认 [%d 年度 / 用户 %d / %s]",
                        saved.getTaxYear(), saved.getUserId(),
                        refundOwedVerdict(saved.getRefundOwed()))
        ));
    }

    @PostMapping("/{id}/report")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> markReported(@PathVariable String factoryId,
                                          @PathVariable String id,
                                          @RequestAttribute("userId") Long actorUserId) {
        AnnualTaxSettlement saved = service.markReported(factoryId, id, actorUserId);
        return ResponseEntity.ok(Map.of(
                "success", true, "data", saved,
                "message", String.format("已申报税局 [%d 年度 / 用户 %d], 后续不可修改",
                        saved.getTaxYear(), saved.getUserId())
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
                        .body(Map.of("success", false, "message", "年度汇算记录不存在")));
    }

    @GetMapping
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> list(@PathVariable String factoryId,
                                  @RequestParam(required = false) Integer taxYear,
                                  @RequestParam(required = false) AnnualTaxSettlementStatus status,
                                  @RequestParam(required = false) Long userId,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        Page<AnnualTaxSettlement> p = service.list(factoryId, taxYear, status, userId,
                PageRequest.of(page, size,
                        Sort.by(Sort.Direction.DESC, "taxYear")
                                .and(Sort.by(Sort.Direction.ASC, "userId"))));
        return ResponseEntity.ok(Map.of("success", true, "data", p));
    }

    /**
     * 汇算结果文案 (R2 防呆): 应退 / 应补 / 平账.
     */
    private static String refundOwedVerdict(BigDecimal refundOwed) {
        if (refundOwed == null || refundOwed.signum() == 0) {
            return "平账 (无补退)";
        }
        if (refundOwed.signum() > 0) {
            return String.format("应补缴 ¥%s", refundOwed);
        }
        return String.format("应退税 ¥%s", refundOwed.abs());
    }
}
