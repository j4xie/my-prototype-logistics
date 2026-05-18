package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.HrInsuranceConfig;
import com.cretas.aims.service.hr.HrInsuranceConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

/**
 * 工厂级 社保 / 公积金 费率配置 REST API.
 *
 * <p>路径: /api/mobile/{factoryId}/hr/insurance-config
 *
 * <p>RBAC:
 * <ul>
 *   <li>GET (current / history): hr:read+</li>
 *   <li>POST (save / reset): hr:read_write</li>
 * </ul>
 *
 * <p>防呆策略:
 * <ul>
 *   <li>R1: 费率 0 ~ 0.30 server-side validation + UI bound</li>
 *   <li>R2: response message 含 factory + effectiveFrom + 关键费率 context</li>
 *   <li>R4: factory 始终最多 1 条 ACTIVE (transactional 切换)</li>
 *   <li>R5: 重置默认 button → POST /reset-defaults 一键恢复</li>
 * </ul>
 *
 * @author Cretas Team — #833 公积金/社保 rate config follow-up
 * @since 2026-05-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/insurance-config")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class HrInsuranceConfigController {

    private final HrInsuranceConfigService service;

    /**
     * 获取当前生效的配置. yearMonth 可选, 默认本月.
     */
    @GetMapping("/current")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> getCurrent(@PathVariable String factoryId,
                                        @RequestParam(required = false) String yearMonth) {
        YearMonth ym = null;
        if (yearMonth != null && !yearMonth.isBlank()) {
            try {
                ym = YearMonth.parse(yearMonth);
            } catch (Exception ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "yearMonth 格式必须为 YYYY-MM, got: " + yearMonth));
            }
        }
        HrInsuranceConfig cfg = service.getCurrent(factoryId, ym);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", cfg,
                "message", String.format(
                        "工厂 %s 当前社保/公积金配置 (effectiveFrom=%s, 个人社保=%s%%, 个人公积金=%s%%)",
                        factoryId,
                        cfg.getEffectiveFrom() == null ? "default" : cfg.getEffectiveFrom(),
                        toPercent(sumEmployeeSocial(cfg)),
                        toPercent(cfg.getEmployeeProvidentFundRate()))
        ));
    }

    /**
     * 历史版本列表 (含 ACTIVE + ARCHIVED).
     */
    @GetMapping("/history")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> getHistory(@PathVariable String factoryId) {
        List<HrInsuranceConfig> list = service.listHistory(factoryId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", list,
                "message", String.format("工厂 %s 历史配置 %d 条", factoryId, list.size())
        ));
    }

    /**
     * 保存新版本配置. 老 ACTIVE 自动 → ARCHIVED.
     */
    @PostMapping
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> save(@PathVariable String factoryId,
                                  @RequestBody Map<String, Object> body,
                                  @RequestAttribute(value = "userId", required = false) Long actorUserId) {
        HrInsuranceConfig payload = HrInsuranceConfig.builder()
                .employeePensionRate(toBigDecimal(body.get("employeePensionRate")))
                .employerPensionRate(toBigDecimal(body.get("employerPensionRate")))
                .employeeMedicalRate(toBigDecimal(body.get("employeeMedicalRate")))
                .employerMedicalRate(toBigDecimal(body.get("employerMedicalRate")))
                .employeeUnemploymentRate(toBigDecimal(body.get("employeeUnemploymentRate")))
                .employerUnemploymentRate(toBigDecimal(body.get("employerUnemploymentRate")))
                .employeeProvidentFundRate(toBigDecimal(body.get("employeeProvidentFundRate")))
                .employerProvidentFundRate(toBigDecimal(body.get("employerProvidentFundRate")))
                .baseSalaryLowerBound(toBigDecimal(body.get("baseSalaryLowerBound")))
                .baseSalaryUpperBound(toBigDecimal(body.get("baseSalaryUpperBound")))
                .effectiveFrom(toLocalDate(body.get("effectiveFrom")))
                .remark((String) body.get("remark"))
                .build();

        HrInsuranceConfig saved = service.saveNew(factoryId, payload, actorUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", saved,
                "message", String.format(
                        "已保存 [工厂 %s / effectiveFrom %s / 个人社保 %s%% / 单位社保 %s%% / 个人公积金 %s%% / 单位公积金 %s%%]",
                        factoryId, saved.getEffectiveFrom(),
                        toPercent(sumEmployeeSocial(saved)),
                        toPercent(sumEmployerSocial(saved)),
                        toPercent(saved.getEmployeeProvidentFundRate()),
                        toPercent(saved.getEmployerProvidentFundRate()))
        ));
    }

    /**
     * R5 防呆: 重置为法定默认值 (一键恢复). 也会归档当前 ACTIVE.
     */
    @PostMapping("/reset-defaults")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> resetDefaults(@PathVariable String factoryId,
                                            @RequestAttribute(value = "userId", required = false) Long actorUserId) {
        HrInsuranceConfig saved = service.resetToDefaults(factoryId, actorUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", saved,
                "message", String.format(
                        "已重置工厂 %s 为法定默认值 (effectiveFrom %s)",
                        factoryId, saved.getEffectiveFrom())
        ));
    }

    // ===== 内部 helper =====

    private static BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal) return (BigDecimal) v;
        if (v instanceof Number) return new BigDecimal(v.toString());
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        return new BigDecimal(s);
    }

    private static LocalDate toLocalDate(Object v) {
        if (v == null) return null;
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        return LocalDate.parse(s);
    }

    private static BigDecimal sumEmployeeSocial(HrInsuranceConfig c) {
        return safe(c.getEmployeePensionRate())
                .add(safe(c.getEmployeeMedicalRate()))
                .add(safe(c.getEmployeeUnemploymentRate()));
    }

    private static BigDecimal sumEmployerSocial(HrInsuranceConfig c) {
        return safe(c.getEmployerPensionRate())
                .add(safe(c.getEmployerMedicalRate()))
                .add(safe(c.getEmployerUnemploymentRate()));
    }

    private static BigDecimal safe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String toPercent(BigDecimal rate) {
        if (rate == null) return "0.00";
        return rate.multiply(new BigDecimal("100"))
                .setScale(2, java.math.RoundingMode.HALF_UP)
                .toPlainString();
    }
}
