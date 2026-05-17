package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.bom.ApproveBomVersionRequest;
import com.cretas.aims.dto.bom.CreateBomDraftRequest;
import com.cretas.aims.dto.bom.RejectBomVersionRequest;
import com.cretas.aims.dto.bom.SubmitBomVersionRequest;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.bom.BomVersion;
import com.cretas.aims.service.bom.BomVersionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * BomVersion REST Controller (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * <p>路径前缀: {@code /api/mobile/{factoryId}/bom/versions}.
 *
 * <p>RBAC:
 * <ul>
 *   <li>Write 方法 (POST): 沿用 {@link BomController} / {@link BomRecipeController} 模式 —
 *       {@code @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})}.
 *       SCHEMA spec 提议的 {@code bom:write} 新权限码暂未引入 role binding, 故复用 production:* 系列.</li>
 *   <li>Read 方法 (GET): 公开 (无 @RequirePermission), 但 {@code @PriceSensitive} on
 *       {@link BomVersion#getSnapshotJson()} 通过 {@code PriceFieldResponseAdvice} 自动 strip
 *       cost 字段 for non-procurement-price roles.</li>
 * </ul>
 *
 * <p>Issue #710 fix (2026-05-16): 补全 4 个 write endpoint 缺失的 RBAC, 防止低权限 F006 用户
 * (viewer/operator/quality_insp/...) 直接调 approve/reject 绕过审批 (P0 RBAC bypass).
 *
 * <p>Issue #712 fix (2026-05-17): 把 raw {@code Map<String, Object>} 全部换成 typed DTO
 * + @Valid, 让错误请求返 400 而不是 500 NPE / ClassCastException.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/bom/versions")
@RequiredArgsConstructor
@Tag(name = "BOM 版本管理 (M-BOM-VER-1)", description = "BomVersion 状态机 + 历史追溯 + ECN 链")
@RequireModule("bom")
public class BomVersionController {

    private final BomVersionService versionService;

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PostMapping
    @Operation(summary = "为指定 BOM 创建新版本 DRAFT (snapshot 自动 from 当前 BomRecipe)")
    public ApiResponse<BomVersion> createDraft(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateBomDraftRequest req) {
        BomVersion draft = versionService.createDraft(factoryId, req.getBomRecipeId(), req.getCreatedBy());
        return ApiResponse.success(draft);
    }

    @GetMapping("/{versionId}")
    @Operation(summary = "BomVersion 详情")
    public ApiResponse<BomVersion> getById(
            @PathVariable String factoryId,
            @PathVariable String versionId) {
        return ApiResponse.success(versionService.getById(factoryId, versionId));
    }

    @GetMapping("/by-recipe/{bomRecipeId}/history")
    @Operation(summary = "BOM 全部历史版本 (newest first)")
    public ApiResponse<List<BomVersion>> getHistory(
            @PathVariable String factoryId,
            @PathVariable String bomRecipeId) {
        return ApiResponse.success(versionService.getHistory(factoryId, bomRecipeId));
    }

    @GetMapping("/by-recipe/{bomRecipeId}/current")
    @Operation(summary = "BOM 当前生效版本 (status=APPROVED + effective_to IS NULL)")
    public ApiResponse<BomVersion> getCurrent(
            @PathVariable String factoryId,
            @PathVariable String bomRecipeId) {
        Optional<BomVersion> current = versionService.getCurrent(factoryId, bomRecipeId);
        return current.map(ApiResponse::success)
                .orElseGet(() -> ApiResponse.error(404, "无当前生效 BomVersion: " + bomRecipeId));
    }

    @GetMapping("/by-recipe/{bomRecipeId}/effective-at")
    @Operation(summary = "BOM 某历史日期的生效版本 (订单追溯)")
    public ApiResponse<BomVersion> getEffectiveAt(
            @PathVariable String factoryId,
            @PathVariable String bomRecipeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "YYYY-MM-DD") LocalDate date) {
        Optional<BomVersion> v = versionService.getEffectiveAt(factoryId, bomRecipeId, date);
        return v.map(ApiResponse::success)
                .orElseGet(() -> ApiResponse.error(404, "日期 " + date + " 无生效 BomVersion"));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PostMapping("/{versionId}/submit")
    @Operation(summary = "提交审批 (DRAFT → PENDING_APPROVAL). 可关联 ECN.")
    public ApiResponse<BomVersion> submitForApproval(
            @PathVariable String factoryId,
            @PathVariable String versionId,
            @RequestBody(required = false) SubmitBomVersionRequest req) {
        String ecnId = req == null ? null : req.getEcnId();
        return ApiResponse.success(versionService.submitForApproval(factoryId, versionId, ecnId));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PostMapping("/{versionId}/approve")
    @Operation(summary = "审批通过 (PENDING/DRAFT → APPROVED, effective_from=today, 旧版自动 OBSOLETE)")
    public ApiResponse<BomVersion> approve(
            @PathVariable String factoryId,
            @PathVariable String versionId,
            @Valid @RequestBody ApproveBomVersionRequest req) {
        return ApiResponse.success(versionService.approve(factoryId, versionId, req.getApproverId()));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PostMapping("/{versionId}/reject")
    @Operation(summary = "拒绝 (PENDING_APPROVAL → REJECTED, terminal)")
    public ApiResponse<BomVersion> reject(
            @PathVariable String factoryId,
            @PathVariable String versionId,
            @Valid @RequestBody RejectBomVersionRequest req) {
        return ApiResponse.success(versionService.reject(factoryId, versionId, req.getApproverId(),
                req.getRejectionReason()));
    }
}
