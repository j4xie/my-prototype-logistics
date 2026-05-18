package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.HrCityInsuranceOverride;
import com.cretas.aims.entity.hr.HrEmployeeCityAssignment;
import com.cretas.aims.entity.hr.HrInsuranceConfig;
import com.cretas.aims.service.hr.HrCityInsuranceOverrideService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 城市差异化 社保 / 公积金 配置覆盖 REST API (#863 follow-up).
 *
 * <p>路径: /api/mobile/{factoryId}/hr/insurance-config/cities
 *
 * <p>RBAC: 与 HrInsuranceConfigController 一致.
 * <ul>
 *   <li>GET (list / effective preview): hr:read+</li>
 *   <li>POST/DELETE (override CRUD + assignment): hr:read_write</li>
 * </ul>
 *
 * <p>防呆策略:
 * <ul>
 *   <li>R1: 基数 / 费率范围 server-side validation</li>
 *   <li>R2: response message 含 factory + city + bounds context</li>
 *   <li>R4: (factory, city) + (factory, user) ACTIVE 唯一 (TCC + DB unique idx)</li>
 *   <li>R5: 列表为空 → UI 提示"添加首个城市覆盖"</li>
 * </ul>
 *
 * @author Cretas Team — #863 城市差异化社保 follow-up
 * @since 2026-05-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/insurance-config/cities")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class HrCityInsuranceOverrideController {

    private final HrCityInsuranceOverrideService service;

    // ============= 城市覆盖 CRUD =============

    /**
     * 列出当前 ACTIVE 城市覆盖.
     */
    @GetMapping
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> list(@PathVariable String factoryId) {
        List<HrCityInsuranceOverride> rows = service.listActive(factoryId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", rows,
                "message", String.format("工厂 %s 当前 %d 个城市覆盖配置", factoryId, rows.size())
        ));
    }

    /**
     * 历史覆盖列表 (含 ARCHIVED).
     */
    @GetMapping("/history")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> history(@PathVariable String factoryId) {
        List<HrCityInsuranceOverride> rows = service.listHistory(factoryId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", rows,
                "message", String.format("工厂 %s 历史覆盖 %d 条", factoryId, rows.size())
        ));
    }

    /**
     * 取单个城市当前覆盖 + 合并后的 effective 配置 (R1 预览用).
     */
    @GetMapping("/{cityCode}/effective")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> getEffective(@PathVariable String factoryId,
                                          @PathVariable String cityCode,
                                          @RequestParam(required = false) String yearMonth) {
        YearMonth ym = parseYearMonth(yearMonth);
        HrInsuranceConfig effective = service.getEffectiveConfigForCity(
                factoryId, cityCode, ym);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("data", effective);
        resp.put("override", service.getOverrideForCity(factoryId, cityCode, ym).orElse(null));
        resp.put("message", String.format(
                "工厂 %s 城市 %s 当前生效: 基数 ¥%s ~ ¥%s, 个人公积金 %s%%",
                factoryId, cityCode,
                effective.getBaseSalaryLowerBound() == null ? "default" : effective.getBaseSalaryLowerBound(),
                effective.getBaseSalaryUpperBound() == null ? "default" : effective.getBaseSalaryUpperBound(),
                toPercent(effective.getEmployeeProvidentFundRate())));
        return ResponseEntity.ok(resp);
    }

    /**
     * 保存新城市覆盖. 老 ACTIVE 自动 → ARCHIVED (TCC).
     */
    @PostMapping
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> save(@PathVariable String factoryId,
                                  @RequestBody Map<String, Object> body,
                                  @RequestAttribute(value = "userId", required = false) Long actorUserId) {
        @SuppressWarnings("unchecked")
        Map<String, Object> overrideRates = (Map<String, Object>) body.get("overrideRates");

        HrCityInsuranceOverride payload = HrCityInsuranceOverride.builder()
                .cityCode((String) body.get("cityCode"))
                .cityName((String) body.get("cityName"))
                .baseSalaryLowerBound(toBigDecimal(body.get("baseSalaryLowerBound")))
                .baseSalaryUpperBound(toBigDecimal(body.get("baseSalaryUpperBound")))
                .overrideRates(overrideRates)
                .effectiveFrom(toLocalDate(body.get("effectiveFrom")))
                .remark((String) body.get("remark"))
                .build();

        HrCityInsuranceOverride saved = service.saveNew(factoryId, payload, actorUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", saved,
                "message", String.format(
                        "已保存 [工厂 %s / 城市 %s%s / 缴费基数 ¥%s ~ ¥%s / 生效 %s]",
                        factoryId, saved.getCityCode(),
                        saved.getCityName() == null || saved.getCityName().isBlank()
                                ? "" : " (" + saved.getCityName() + ")",
                        saved.getBaseSalaryLowerBound(), saved.getBaseSalaryUpperBound(),
                        saved.getEffectiveFrom())
        ));
    }

    /**
     * 软删除某城市覆盖 (历史保留, 当前后 SalaryItem 回归工厂默认).
     */
    @DeleteMapping("/{id}")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> delete(@PathVariable String factoryId, @PathVariable String id) {
        service.delete(factoryId, id);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "城市覆盖已删除, 该城市员工后续按工厂默认配置"));
    }

    // ============= 员工 → 城市 分配 =============

    /**
     * 列出 factory 全部 ACTIVE 员工→城市分配.
     */
    @GetMapping("/assignments")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> listAssignments(@PathVariable String factoryId) {
        List<HrEmployeeCityAssignment> rows = service.listEmployeeAssignments(factoryId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", rows,
                "message", String.format("工厂 %s 当前 %d 个员工已分配城市", factoryId, rows.size())
        ));
    }

    /**
     * 列出某 city 当前 ACTIVE 员工分配.
     */
    @GetMapping("/{cityCode}/assignments")
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> listByCity(@PathVariable String factoryId,
                                        @PathVariable String cityCode) {
        List<HrEmployeeCityAssignment> rows =
                service.listEmployeeAssignmentsByCity(factoryId, cityCode);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", rows,
                "message", String.format("城市 %s 共 %d 名员工", cityCode, rows.size())
        ));
    }

    /**
     * 分配员工到某城市. 老分配自动归档.
     */
    @PostMapping("/assignments")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> assign(@PathVariable String factoryId,
                                     @RequestBody Map<String, Object> body,
                                     @RequestAttribute(value = "userId", required = false) Long actorUserId) {
        Long userId = toLong(body.get("userId"));
        String cityCode = (String) body.get("cityCode");
        HrEmployeeCityAssignment saved = service.assignEmployee(
                factoryId, userId, cityCode, actorUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", saved,
                "message", String.format(
                        "已分配员工 #%d 到城市 %s [工厂 %s, 生效 %s]",
                        userId, saved.getCityCode(), factoryId, saved.getEffectiveFrom())
        ));
    }

    /**
     * 取消员工的城市分配 (回归工厂默认).
     */
    @DeleteMapping("/assignments/{userId}")
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> unassign(@PathVariable String factoryId,
                                       @PathVariable Long userId) {
        service.unassignEmployee(factoryId, userId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", String.format(
                        "已取消员工 #%d 城市分配, 后续按工厂 %s 默认配置计算", userId, factoryId)
        ));
    }

    // ============= helper =============

    private static YearMonth parseYearMonth(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return YearMonth.parse(s);
        } catch (Exception ex) {
            return null;
        }
    }

    private static BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return new BigDecimal(n.toString());
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

    private static Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        return Long.parseLong(s);
    }

    private static String toPercent(BigDecimal rate) {
        if (rate == null) return "0.00";
        return rate.multiply(new BigDecimal("100"))
                .setScale(2, java.math.RoundingMode.HALF_UP)
                .toPlainString();
    }
}
