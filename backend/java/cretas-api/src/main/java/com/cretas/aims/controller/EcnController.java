package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.dto.bom.EcnCreateRequest;
import com.cretas.aims.dto.bom.EcnImpactReport;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.bom.EngineeringChangeNotice;
import com.cretas.aims.service.bom.ECNService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * ECN REST Controller (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * <p>路径前缀: {@code /api/mobile/{factoryId}/bom/ecns}.
 *
 * <p>5 reason 类: CUSTOMER_REQUEST / MATERIAL_DISCONTINUED / COST_OPTIMIZATION /
 * QUALITY_DEFECT / PROCESS_IMPROVEMENT.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/bom/ecns")
@RequiredArgsConstructor
@Tag(name = "BOM 工程变更通知 (ECN, M-BOM-VER-1)",
     description = "5 reason ECN 状态机 + 审批 + 通知 + 影响范围分析")
@RequireModule("bom")
public class EcnController {

    private final ECNService ecnService;

    @PostMapping
    @Operation(summary = "创建 ECN DRAFT (auto generateEcnNumber ECN-YYYY-NNNN)")
    public ApiResponse<EngineeringChangeNotice> create(
            @PathVariable String factoryId,
            @Valid @RequestBody EcnCreateRequest req) {
        // factoryId from path takes precedence over body (multi-tenant安全).
        req.setFactoryId(factoryId);
        return ApiResponse.success(ecnService.create(req));
    }

    @GetMapping("/{ecnId}")
    @Operation(summary = "ECN 详情")
    public ApiResponse<EngineeringChangeNotice> getById(
            @PathVariable String factoryId,
            @PathVariable String ecnId) {
        return ApiResponse.success(ecnService.getById(factoryId, ecnId));
    }

    @PostMapping("/{ecnId}/submit")
    @Operation(summary = "提交审批 (DRAFT → SUBMITTED) — 触发 notifyImpactedRoles")
    public ApiResponse<EngineeringChangeNotice> submitForApproval(
            @PathVariable String factoryId,
            @PathVariable String ecnId) {
        return ApiResponse.success(ecnService.submitForApproval(factoryId, ecnId));
    }

    @PostMapping("/{ecnId}/approve")
    @Operation(summary = "审批通过 (SUBMITTED → APPROVED) — cascade approve BomVersion DRAFT")
    public ApiResponse<EngineeringChangeNotice> approve(
            @PathVariable String factoryId,
            @PathVariable String ecnId,
            @RequestBody Map<String, Object> body) {
        Long approverId = body.get("approverId") == null ? null
                : ((Number) body.get("approverId")).longValue();
        return ApiResponse.success(ecnService.approve(factoryId, ecnId, approverId));
    }

    @PostMapping("/{ecnId}/reject")
    @Operation(summary = "拒绝 (SUBMITTED → REJECTED, terminal) — cascade reject BomVersion DRAFT")
    public ApiResponse<EngineeringChangeNotice> reject(
            @PathVariable String factoryId,
            @PathVariable String ecnId,
            @RequestBody Map<String, Object> body) {
        Long approverId = body.get("approverId") == null ? null
                : ((Number) body.get("approverId")).longValue();
        String reason = (String) body.get("rejectionReason");
        return ApiResponse.success(ecnService.reject(factoryId, ecnId, approverId, reason));
    }

    @PostMapping("/{ecnId}/notify")
    @Operation(summary = "重发通知给 notify_roles (幂等)")
    public ApiResponse<Void> notifyImpactedRoles(
            @PathVariable String factoryId,
            @PathVariable String ecnId) {
        ecnService.notifyImpactedRoles(factoryId, ecnId);
        return ApiResponse.success(null);
    }

    @PostMapping("/calculate-impact")
    @Operation(summary = "计算 ECN 影响范围 (read-only, 不创建 ECN)")
    public ApiResponse<EcnImpactReport> calculateImpact(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body) {
        String bomRecipeId = (String) body.get("bomRecipeId");
        @SuppressWarnings("unchecked")
        Map<String, Object> changeContext = (Map<String, Object>) body.get("changeContext");
        return ApiResponse.success(ecnService.calculateImpact(factoryId, bomRecipeId, changeContext));
    }

    @PostMapping("/activate-due")
    @Operation(summary = "Housekeeping: APPROVED + effective_date ≤ today → EFFECTIVE")
    public ApiResponse<Integer> activateDueApprovedEcns(
            @PathVariable String factoryId) {
        int count = ecnService.activateDueApprovedEcns(factoryId);
        return ApiResponse.success(count);
    }
}
