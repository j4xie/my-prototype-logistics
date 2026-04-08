package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.config.*;
import com.cretas.aims.service.config.FactoryConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/config")
@RequiredArgsConstructor
@Tag(name = "Canvas Configuration", description = "画布配置系统 API")
public class ConfigController {

    private final FactoryConfigService configService;

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
            @RequestBody ModuleConfigDTO dto) {
        configService.saveModuleConfig(factoryId, moduleCode, dto, 1L); // TODO: get from JWT
        return ApiResponse.success();
    }

    @PatchMapping("/modules/{moduleCode}/fields/{fieldCode}")
    @Operation(summary = "更新单个字段配置")
    public ApiResponse<Void> updateFieldConfig(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String fieldCode,
            @RequestBody FieldConfigDTO dto) {
        configService.updateFieldConfig(factoryId, moduleCode, fieldCode, dto, 1L);
        return ApiResponse.success();
    }

    @PatchMapping("/modules/{moduleCode}/toggle")
    @Operation(summary = "开关模块")
    public ApiResponse<Void> toggleModule(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestParam boolean enabled) {
        configService.toggleModule(factoryId, moduleCode, enabled, 1L);
        return ApiResponse.success();
    }

    // ========== 发布与版本 ==========

    @PostMapping("/publish")
    @Operation(summary = "发布配置")
    public ApiResponse<Void> publishConfig(
            @PathVariable String factoryId,
            @RequestParam(required = false) String summary) {
        configService.publishConfig(factoryId, 1L, summary);
        return ApiResponse.success();
    }

    @PostMapping("/rollback/{version}")
    @Operation(summary = "回滚到指定版本")
    public ApiResponse<Void> rollbackConfig(
            @PathVariable String factoryId,
            @PathVariable int version) {
        configService.rollbackConfig(factoryId, version, 1L);
        return ApiResponse.success();
    }
}
