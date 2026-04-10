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
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

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
}
