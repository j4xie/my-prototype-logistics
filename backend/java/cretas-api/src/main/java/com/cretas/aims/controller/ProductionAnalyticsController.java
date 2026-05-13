package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.analytics.EfficiencyDashboardResponse;
import com.cretas.aims.dto.analytics.ProductionDashboardResponse;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.PermissionService;
import com.cretas.aims.service.impl.ProductionAnalyticsServiceImpl;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/production-analytics")
@RequiredArgsConstructor
@Tag(name = "生产分析与人效分析")
@RequireModule("production_plan")
public class ProductionAnalyticsController {

    private final ProductionAnalyticsServiceImpl analyticsService;
    private final ProductionPlanRepository planRepository;
    private final MobileService mobileService;
    private final UserRepository userRepository;
    private final PermissionService permissionService;

    /** Permission required to view cost / price fields (canonical price-view gate, see PriceFieldResponseAdvice). */
    private static final String FINANCE_READ_PERMISSION = "finance:read";

    /** Cost-bearing keys that must be nulled when caller lacks {@link #FINANCE_READ_PERMISSION}. */
    private static final List<String> COST_FIELD_KEYS = List.of(
            "estimatedMaterialCost",
            "actualMaterialCost",
            "estimatedLaborCost",
            "actualLaborCost",
            "estimatedEquipmentCost",
            "actualEquipmentCost",
            "estimatedOtherCost",
            "actualOtherCost"
    );

    // ==================== 生产分析 ====================

    @GetMapping("/dashboard")
    @Operation(summary = "生产分析仪表盘", description = "KPI + 日趋势 + 产品分布 + 工序分布")
    public ApiResponse<ProductionDashboardResponse> getProductionDashboard(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getProductionDashboard(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/daily-trend")
    @Operation(summary = "日产出趋势")
    public ApiResponse<List<Map<String, Object>>> getDailyTrend(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getDailyTrend(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/by-product")
    @Operation(summary = "按产品维度分析")
    public ApiResponse<List<Map<String, Object>>> getByProduct(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getByProduct(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/by-process")
    @Operation(summary = "按工序维度分析")
    public ApiResponse<List<Map<String, Object>>> getByProcess(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getByProcess(factoryId, dates[0], dates[1]));
    }

    // ==================== 人效分析 ====================

    @GetMapping("/efficiency/dashboard")
    @Operation(summary = "人效分析仪表盘", description = "KPI + 员工排名 + 日趋势 + 产品工时 + 交叉分析")
    public ApiResponse<EfficiencyDashboardResponse> getEfficiencyDashboard(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getEfficiencyDashboard(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/efficiency/workers")
    @Operation(summary = "员工人效排名")
    public ApiResponse<List<Map<String, Object>>> getWorkerRanking(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getWorkerRanking(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/efficiency/trend")
    @Operation(summary = "人效趋势")
    public ApiResponse<List<Map<String, Object>>> getEfficiencyTrend(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getEfficiencyTrend(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/efficiency/hours")
    @Operation(summary = "产品工时分布")
    public ApiResponse<List<Map<String, Object>>> getHoursByProduct(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getHoursByProduct(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/efficiency/cross")
    @Operation(summary = "员工x工序交叉分析")
    public ApiResponse<List<Map<String, Object>>> getWorkerProcessCross(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate[] dates = resolveDefaultDates(startDate, endDate);
        return ApiResponse.success(analyticsService.getWorkerProcessCross(factoryId, dates[0], dates[1]));
    }

    @GetMapping("/budget-vs-actual")
    @Operation(summary = "预算 vs 实际成本对比",
            description = "RBAC: 需 finance:read 或 production:read 权限. 无 finance:read 时, "
                    + "estimated*Cost / actual*Cost 字段返回 null (defense-in-depth, "
                    + "因为 PriceFieldResponseAdvice 不能识别 hand-built Map 中的成本键名 — "
                    + "见 PR #488 §F1 audit, PR #482 V1-V5 同根源).")
    @RequirePermission({"finance:read", "production:read"})
    public ApiResponse<List<Map<String, Object>>> getBudgetVsActual(
            @PathVariable String factoryId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        // RBAC defense-in-depth (PR #488 §F1, 2026-05-12):
        // PriceFieldResponseAdvice (PR #423 / PR #470) walks @PriceSensitive fields on
        // typed entities, but this endpoint returns hand-built Map<String, Object>
        // whose cost keys (estimated*Cost / actual*Cost) are NOT in the advice's
        // PRICE_VALUE_KEYS or ALWAYS_PRICE_KEYS set. Annotation gate above blocks
        // callers without finance:read OR production:read; this in-method check
        // additionally nulls cost values when caller has production:read but lacks
        // finance:read (e.g. workshop_manager / quality_inspector — they need plan
        // visibility but not cost figures).
        boolean canViewCosts = resolveCanViewCosts(authorization);

        List<ProductionPlan> plans = planRepository.findByFactoryId(factoryId);

        List<Map<String, Object>> result = plans.stream()
                .filter(p -> p.getEstimatedLaborCost() != null || p.getActualLaborCost() != null)
                .map(p -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("planId", p.getId());
                    item.put("planNumber", p.getPlanNumber());
                    item.put("productName", p.getProductType() != null ? p.getProductType().getName() : "");
                    if (canViewCosts) {
                        item.put("estimatedMaterialCost", p.getEstimatedMaterialCost());
                        item.put("actualMaterialCost", p.getActualMaterialCost());
                        item.put("estimatedLaborCost", p.getEstimatedLaborCost());
                        item.put("actualLaborCost", p.getActualLaborCost());
                        item.put("estimatedEquipmentCost", p.getEstimatedEquipmentCost());
                        item.put("actualEquipmentCost", p.getActualEquipmentCost());
                        item.put("estimatedOtherCost", p.getEstimatedOtherCost());
                        item.put("actualOtherCost", p.getActualOtherCost());
                    } else {
                        // Defense-in-depth: emit keys with null values so the client
                        // contract (key presence) stays stable while the figures are
                        // suppressed. Mirrors PriceFieldResponseAdvice null-strip
                        // semantics for @PriceSensitive fields on typed entities.
                        for (String key : COST_FIELD_KEYS) {
                            item.put(key, null);
                        }
                    }
                    item.put("status", p.getStatus());
                    return item;
                })
                .collect(Collectors.toList());

        return ApiResponse.success(result);
    }

    /**
     * Resolves whether the caller is allowed to see cost figures in the
     * {@code /budget-vs-actual} response. Closed-by-default: any failure to
     * resolve the user or check the permission returns {@code false} (mask
     * costs), preserving data confidentiality.
     *
     * <p>Mirrors {@link com.cretas.aims.security.PriceMaskResolver#shouldMaskPrice}
     * but gates on {@code finance:read} instead of {@code procurement:price:view}
     * because production-cost visibility follows finance-module RBAC, not
     * supplier-price RBAC.
     */
    private boolean resolveCanViewCosts(String authorization) {
        try {
            if (authorization == null || authorization.isBlank()) {
                return false;
            }
            String token = TokenUtils.extractToken(authorization);
            Long userId = mobileService.getUserFromToken(token).getId();
            if (userId == null) {
                return false;
            }
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) {
                return false;
            }
            return permissionService.hasPermission(user, FINANCE_READ_PERMISSION);
        } catch (Exception e) {
            log.debug("resolveCanViewCosts: defaulting fail-CLOSED (mask costs): {}", e.getMessage());
            return false;
        }
    }

    // ==================== 内部方法 ====================

    private LocalDate[] resolveDefaultDates(LocalDate startDate, LocalDate endDate) {
        if (endDate == null) endDate = LocalDate.now();
        if (startDate == null) startDate = endDate.minusDays(6);
        return new LocalDate[]{startDate, endDate};
    }
}
