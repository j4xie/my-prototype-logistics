package com.cretas.aims.controller;

import com.cretas.aims.config.RequireRole;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.config.*;
import com.cretas.aims.entity.config.FactoryConfiguration;
import com.cretas.aims.repository.config.FactoryConfigurationRepository;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.config.FactoryConfigService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.DefaultValueResolver defaultValueResolver;

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

    @org.springframework.beans.factory.annotation.Autowired
    private com.cretas.aims.repository.config.FactoryModuleConfigRepository factoryModuleConfigRepository;

    @GetMapping("/disabled-modules")
    @Operation(summary = "获取工厂禁用的模块列表")
    public ApiResponse<java.util.List<String>> getDisabledModules(@PathVariable String factoryId) {
        var published = factoryConfigurationRepository.findLatestPublished(factoryId);
        if (published.isEmpty()) return ApiResponse.success("disabled", java.util.List.of());
        int version = published.get().getConfigVersion();
        var fmcs = factoryModuleConfigRepository.findByFactoryIdAndConfigVersion(factoryId, version);
        var disabled = fmcs.stream()
                .filter(fmc -> !fmc.getEnabled())
                .map(fmc -> fmc.getModuleCode())
                .collect(java.util.stream.Collectors.toList());
        return ApiResponse.success("disabled", disabled);
    }

    @GetMapping("/modules/{moduleCode}/defaults")
    @Operation(summary = "获取模块默认值 (Canvas V2 DefaultValueResolver)")
    public ApiResponse<java.util.Map<String, Object>> getModuleDefaults(
            @PathVariable String factoryId,
            @PathVariable String moduleCode) {
        if (defaultValueResolver == null) return ApiResponse.success("defaults", java.util.Map.of());
        return ApiResponse.success("defaults", defaultValueResolver.resolveAll(factoryId, moduleCode, java.util.Map.of()));
    }

    @GetMapping("/modules/{moduleCode}/effective")
    @Operation(summary = "获取合并后的有效配置")
    public ApiResponse<EffectiveModuleConfig> getEffectiveConfig(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestParam(required = false) String roleCode) {
        try {
            EffectiveModuleConfig config = (roleCode != null)
                    ? configService.getEffectiveConfig(factoryId, moduleCode, roleCode)
                    : configService.getEffectiveConfig(factoryId, moduleCode);
            return ApiResponse.success(config);
        } catch (com.cretas.aims.exception.ResourceNotFoundException e) {
            // Module not canvas-configured yet — return LEGACY default instead of 404
            EffectiveModuleConfig legacy = new EffectiveModuleConfig();
            legacy.setModuleCode(moduleCode);
            legacy.setRenderingMode("LEGACY");
            legacy.setEnabled(true);
            return ApiResponse.success(legacy);
        }
    }

    @GetMapping("/modules")
    @Operation(summary = "获取所有模块摘要")
    public ApiResponse<List<ModuleSummaryDTO>> getModules(@PathVariable String factoryId) {
        return ApiResponse.success(configService.getEnabledModules(factoryId));
    }

    /**
     * Round 4 Fix P1-12: Runtime 创建新模块 (非标业务线, e.g. 水产 pond_management).
     *
     * 用户 Use Case:
     *   - 蓝海水产: 需要"塘管理"模块, 当前只有 17 个硬编码模块
     *   - 定制肉类: 需要"屠宰记录"模块
     *
     * 实现:
     *   1. 插入 module_schemas 记录 (moduleCode + moduleName + 空 fieldSchema)
     *   2. 自动 CREATE TABLE IF NOT EXISTS (cf_ columns 通过 dynamic-fields 加)
     *   3. 返回创建的 module 信息
     *
     * 注意: 这是 ADMIN 级操作, 需要谨慎授权.
     */
    @PostMapping("/modules")
    @RequireRole({"factory_super_admin"})
    @Operation(summary = "Runtime 创建新模块 (非标业务线)")
    public ApiResponse<Map<String, Object>> createModule(
            @PathVariable String factoryId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> body) {
        String moduleCode = (String) body.get("moduleCode");
        String moduleName = (String) body.get("moduleName");
        String moduleCategory = (String) body.getOrDefault("moduleCategory", "CUSTOM");
        String description = (String) body.get("description");

        if (moduleCode == null || !moduleCode.matches("^[a-z][a-z0-9_]{2,40}$")) {
            return ApiResponse.error("moduleCode 必须是 3-40 位小写字母/数字/下划线, 以字母开头");
        }
        if (moduleName == null || moduleName.isBlank()) {
            return ApiResponse.error("moduleName 不能为空");
        }

        // Round 5 Fix OBS-2: pass JWT-derived operatorId so MODULE_CREATED audit entries
        // are attributable to the actual user instead of hardcoded 0L.
        Long operatorId = extractUserId(authorization);
        Map<String, Object> result = configService.createCustomModule(
            factoryId, moduleCode, moduleName, moduleCategory, description,
            operatorId != null ? operatorId : 0L);
        return ApiResponse.success("模块已创建: " + moduleCode, result);
    }

    // ========== 配置管理 API (画布编辑器用) ==========

    @PutMapping("/modules/{moduleCode}")
    @RequireRole({"factory_super_admin", "permission_admin"})
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
    @RequireRole({"factory_super_admin", "permission_admin"})
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
    @RequireRole({"factory_super_admin", "permission_admin"})
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
    @RequireRole({"factory_super_admin"})
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
    @RequireRole({"factory_super_admin"})
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
    @Operation(summary = "获取配置版本历史 (倒序, 分页)")
    public ApiResponse<Map<String, Object>> getVersions(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // Round 5 Fix PERF-3: paginate version history. Previously returned ALL versions
        // unbounded; factories with years of config churn would OOM. Default pageSize=20.
        int clampedSize = Math.min(Math.max(size, 1), 200);
        org.springframework.data.domain.Page<FactoryConfiguration> pageResult =
                factoryConfigurationRepository.findByFactoryIdOrderByConfigVersionDesc(
                        factoryId,
                        org.springframework.data.domain.PageRequest.of(Math.max(page, 0), clampedSize));
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("content", pageResult.getContent());
        result.put("totalElements", pageResult.getTotalElements());
        result.put("totalPages", pageResult.getTotalPages());
        result.put("number", pageResult.getNumber());
        result.put("size", pageResult.getSize());
        return ApiResponse.success(result);
    }

    // ========== 审核流程 (Round 4 Fix P0-1) ==========
    // Previously: 前端定义 5 个审核 API 但后端完全缺失, 所有按钮 404 死链.
    // Now: 完整的 DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED (+REJECTED) 状态机.

    @PostMapping("/submit-review")
    @RequireRole({"factory_super_admin", "permission_admin"})
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
    @RequireRole({"factory_super_admin"})
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
    @RequireRole({"factory_super_admin"})
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
    @RequireRole({"factory_super_admin"})
    @Operation(summary = "立即发布 (DRAFT/APPROVED → PUBLISHED, 跳过发布窗口)")
    public ApiResponse<Void> publishNow(
            @PathVariable String factoryId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long operatorId = extractUserId(authorization);
        // publishConfig now accepts both DRAFT and APPROVED status (see FactoryConfigServiceImpl).
        configService.publishConfig(factoryId, operatorId != null ? operatorId : 0L, "立即发布");
        return ApiResponse.success();
    }

    @PostMapping("/cancel-approval")
    @RequireRole({"factory_super_admin", "permission_admin"})
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
    @RequireRole({"factory_super_admin"})
    @Operation(summary = "导出工厂完整 Canvas 配置 (modules + dynamic fields + rules)")
    public ApiResponse<Map<String, Object>> exportConfig(@PathVariable String factoryId) {
        Map<String, Object> bundle = configService.exportConfig(factoryId);
        return ApiResponse.success(bundle);
    }

    @PostMapping("/import")
    @RequireRole({"factory_super_admin"})
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

    /**
     * Round 10 Fix (R7a drag-reorder silent data loss): immediate field reorder with
     * optimistic lock. Previously the frontend updated sortOrder locally but saveDraft
     * payload didn't include it, so customers lost field ordering on page refresh.
     */
    @PostMapping("/modules/{moduleCode}/reorder-fields")
    @RequireRole({"factory_super_admin", "permission_admin"})
    @Operation(summary = "重排模块字段顺序 (Round 10 Fix)")
    public ApiResponse<Map<String, Object>> reorderFields(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody ReorderFieldsRequest request) {
        Long operatorId = extractUserId(authorization);
        Map<String, Object> result = configService.reorderFields(
                factoryId, moduleCode, request.getFieldOrder(),
                request.getExpectedVersion(), operatorId != null ? operatorId : 0L);
        return ApiResponse.success(result);
    }

    /** Shared state machine transition helper (Round 4 Fix P0-1, Round 5 Fix OBS-1) */
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
        String notes = null;
        if (mutator != null) {
            mutator.accept(target);
            notes = target.getReviewNotes();
        }
        factoryConfigurationRepository.save(target);

        // Round 5 Fix OBS-1: persist each transition to config_change_log so审计 page shows
        // DRAFT→PENDING_REVIEW→APPROVED→PUBLISHED history, not just the application log.
        configService.logWorkflowTransition(
                factoryId, target.getConfigVersion(), fromStatus, toStatus, operatorId, notes);

        log.info("Canvas audit transition: factory={} v{} {} → {} by user {}",
                factoryId, target.getConfigVersion(), fromStatus, toStatus, operatorId);
    }
}
