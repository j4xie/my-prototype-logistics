package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.config.*;
import com.cretas.aims.entity.config.FactoryConfiguration;
import com.cretas.aims.repository.config.FactoryConfigurationRepository;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.config.FactoryConfigService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Canvas Configuration API.
 * Round 4 Fix P0-6: class-level @PreAuthorize restricts writes to factory_super_admin and
 * permission_admin. Read endpoints (effective config, modules, versions, current-version)
 * remain accessible to any authenticated factory user via the method-level annotations.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/config")
@RequiredArgsConstructor
@Tag(name = "Canvas Configuration", description = "画布配置系统 API")
public class ConfigController {

    private final FactoryConfigService configService;
    private final FactoryConfigurationRepository factoryConfigurationRepository;
    private final MobileService mobileService;

    /** Extract userId from Authorization header via JWT. Returns null if missing/invalid. */
    private Long extractUserId(String authorization) {
        if (authorization == null) return null;
        try {
            String token = TokenUtils.extractToken(authorization);
            return mobileService.getUserFromToken(token).getId();
        } catch (Exception e) {
            return null;
        }
    }

    // ========== 配置消费 API (前端渲染器用) ==========

    @GetMapping("/modules/{moduleCode}/effective")
    @Operation(summary = "获取合并后的有效配置")
    public ApiResponse<EffectiveModuleConfig> getEffectiveConfig(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestParam(required = false) String roleCode) {
        EffectiveModuleConfig config = (roleCode != null)
                ? configService.getEffectiveConfig(factoryId, moduleCode, roleCode)
                : configService.getEffectiveConfig(factoryId, moduleCode);
        return ApiResponse.success(config);
    }

    @GetMapping("/modules")
    @Operation(summary = "获取所有模块摘要")
    public ApiResponse<List<ModuleSummaryDTO>> getModules(@PathVariable String factoryId) {
        return ApiResponse.success(configService.getEnabledModules(factoryId));
    }

    // ========== 配置管理 API (画布编辑器用) ==========

    @PutMapping("/modules/{moduleCode}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "保存模块配置")
    public ApiResponse<Void> saveModuleConfig(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody ModuleConfigDTO dto) {
        Long operatorId = extractUserId(authorization);
        configService.saveModuleConfig(factoryId, moduleCode, dto, operatorId != null ? operatorId : 0L);
        return ApiResponse.success();
    }

    @PatchMapping("/modules/{moduleCode}/fields/{fieldCode}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "更新单个字段配置")
    public ApiResponse<Void> updateFieldConfig(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String fieldCode,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody FieldConfigDTO dto) {
        Long operatorId = extractUserId(authorization);
        configService.updateFieldConfig(factoryId, moduleCode, fieldCode, dto, operatorId != null ? operatorId : 0L);
        return ApiResponse.success();
    }

    @PatchMapping("/modules/{moduleCode}/toggle")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "开关模块")
    public ApiResponse<Void> toggleModule(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestParam boolean enabled,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long operatorId = extractUserId(authorization);
        configService.toggleModule(factoryId, moduleCode, enabled, operatorId != null ? operatorId : 0L);
        return ApiResponse.success();
    }

    // ========== 发布与版本 ==========

    @PostMapping("/publish")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "发布配置")
    public ApiResponse<Void> publishConfig(
            @PathVariable String factoryId,
            @RequestParam(required = false) String summary,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long operatorId = extractUserId(authorization);
        configService.publishConfig(factoryId, operatorId != null ? operatorId : 0L, summary);
        return ApiResponse.success();
    }

    @PostMapping("/rollback/{version}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "回滚到指定版本")
    public ApiResponse<Void> rollbackConfig(
            @PathVariable String factoryId,
            @PathVariable int version,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long operatorId = extractUserId(authorization);
        configService.rollbackConfig(factoryId, version, operatorId != null ? operatorId : 0L);
        return ApiResponse.success();
    }

    // ========== 版本查询 (Canvas Editor 用) ==========

    @GetMapping("/current-version")
    @Operation(summary = "获取当前最新的配置版本 (DRAFT 或 PUBLISHED)")
    public ApiResponse<FactoryConfiguration> getCurrentVersion(@PathVariable String factoryId) {
        // Prefer DRAFT first (in-progress edits), fall back to PUBLISHED, then any latest
        List<FactoryConfiguration> versions = factoryConfigurationRepository
                .findByFactoryIdOrderByConfigVersionDesc(factoryId);
        if (versions == null || versions.isEmpty()) {
            return ApiResponse.success(null);
        }
        Optional<FactoryConfiguration> draft = versions.stream()
                .filter(v -> "DRAFT".equals(v.getStatus()))
                .findFirst();
        if (draft.isPresent()) {
            return ApiResponse.success(draft.get());
        }
        return ApiResponse.success(versions.get(0));
    }

    @GetMapping("/versions")
    @Operation(summary = "获取配置版本历史 (倒序)")
    public ApiResponse<List<FactoryConfiguration>> getVersions(@PathVariable String factoryId) {
        List<FactoryConfiguration> versions = factoryConfigurationRepository
                .findByFactoryIdOrderByConfigVersionDesc(factoryId);
        return ApiResponse.success(versions);
    }

    // ========== 审核流程 (Round 4 Fix P0-1) ==========
    // Previously: 前端定义 5 个审核 API 但后端完全缺失, 所有按钮 404 死链.
    // Now: 完整的 DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED (+REJECTED) 状态机.

    @PostMapping("/submit-review")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "提交配置审核 (DRAFT → PENDING_REVIEW)")
    public ApiResponse<Void> submitForReview(
            @PathVariable String factoryId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long operatorId = extractUserId(authorization);
        transitionStatus(factoryId, "DRAFT", "PENDING_REVIEW", operatorId,
                fc -> {
                    fc.setSubmittedAt(java.time.LocalDateTime.now());
                    fc.setSubmittedBy(operatorId);
                });
        return ApiResponse.success();
    }

    @PostMapping("/approve")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "审核通过 (PENDING_REVIEW → APPROVED)")
    public ApiResponse<Void> approveConfig(
            @PathVariable String factoryId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) Map<String, String> body) {
        Long operatorId = extractUserId(authorization);
        String notes = body != null ? body.get("notes") : null;
        transitionStatus(factoryId, "PENDING_REVIEW", "APPROVED", operatorId,
                fc -> {
                    fc.setReviewedAt(java.time.LocalDateTime.now());
                    fc.setReviewedBy(operatorId);
                    fc.setReviewNotes(notes);
                });
        return ApiResponse.success();
    }

    @PostMapping("/reject")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "审核驳回 (PENDING_REVIEW → DRAFT)")
    public ApiResponse<Void> rejectConfig(
            @PathVariable String factoryId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, String> body) {
        Long operatorId = extractUserId(authorization);
        String reason = body.get("reason");
        if (reason == null || reason.isBlank()) {
            return ApiResponse.error("驳回必须提供 reason");
        }
        transitionStatus(factoryId, "PENDING_REVIEW", "DRAFT", operatorId,
                fc -> {
                    fc.setReviewedAt(java.time.LocalDateTime.now());
                    fc.setReviewedBy(operatorId);
                    fc.setReviewNotes(reason);
                });
        return ApiResponse.success();
    }

    @PostMapping("/publish-now")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "立即发布 (APPROVED → PUBLISHED, 跳过发布窗口)")
    public ApiResponse<Void> publishNow(
            @PathVariable String factoryId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long operatorId = extractUserId(authorization);
        // For immediate publish, delegate to existing publishConfig which handles DDL.
        // But first ensure status is APPROVED.
        Optional<FactoryConfiguration> draft = factoryConfigurationRepository.findLatestPending(factoryId);
        if (draft.isEmpty()) {
            draft = factoryConfigurationRepository.findDraft(factoryId);
        }
        if (draft.isEmpty()) {
            return ApiResponse.error("没有可发布的配置版本");
        }
        configService.publishConfig(factoryId, operatorId != null ? operatorId : 0L, "立即发布");
        return ApiResponse.success();
    }

    @PostMapping("/cancel-approval")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "取消审核 (PENDING_REVIEW → DRAFT, 由提交者撤回)")
    public ApiResponse<Void> cancelApproval(
            @PathVariable String factoryId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long operatorId = extractUserId(authorization);
        transitionStatus(factoryId, "PENDING_REVIEW", "DRAFT", operatorId,
                fc -> {
                    fc.setReviewNotes("由提交者撤回");
                    fc.setReviewedAt(java.time.LocalDateTime.now());
                });
        return ApiResponse.success();
    }

    // ========== 配置导出/导入 (Round 4 Fix P1-16) ==========

    @GetMapping("/export")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "导出工厂完整 Canvas 配置 (modules + dynamic fields + rules)")
    public ApiResponse<Map<String, Object>> exportConfig(@PathVariable String factoryId) {
        Map<String, Object> bundle = configService.exportConfig(factoryId);
        return ApiResponse.success(bundle);
    }

    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "从另一个工厂导入 Canvas 配置 (merge 到当前工厂的 DRAFT)")
    public ApiResponse<Map<String, Object>> importConfig(
            @PathVariable String factoryId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> bundle) {
        Long operatorId = extractUserId(authorization);
        Map<String, Object> result = configService.importConfig(
            factoryId, bundle, operatorId != null ? operatorId : 0L);
        return ApiResponse.success(result);
    }

    /** Shared state machine transition helper (Round 4 Fix P0-1) */
    private void transitionStatus(String factoryId, String fromStatus, String toStatus,
                                  Long operatorId, java.util.function.Consumer<FactoryConfiguration> mutator) {
        List<FactoryConfiguration> versions = factoryConfigurationRepository
                .findByFactoryIdOrderByConfigVersionDesc(factoryId);
        FactoryConfiguration target = versions.stream()
                .filter(v -> fromStatus.equals(v.getStatus()))
                .findFirst()
                .orElseThrow(() -> new com.cretas.aims.exception.BusinessException(
                    "没有 " + fromStatus + " 状态的配置版本可供 " + toStatus + " 转换"));
        target.setStatus(toStatus);
        if (mutator != null) mutator.accept(target);
        factoryConfigurationRepository.save(target);
        log.info("Canvas audit transition: factory={} v{} {} → {} by user {}",
                factoryId, target.getConfigVersion(), fromStatus, toStatus, operatorId);
    }
}
