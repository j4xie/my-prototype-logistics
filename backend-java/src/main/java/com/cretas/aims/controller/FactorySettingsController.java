package com.cretas.aims.controller;

import com.cretas.aims.dto.FactorySettingsDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.factory.FactoryAIUsageDTO;
import com.cretas.aims.service.FactoryAIService;
import com.cretas.aims.service.FactorySettingsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.Map;

/**
 * 工厂设置控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/settings")
@Tag(name = "工厂设置管理", description = "工厂配置和设置管理接口")
@RequiredArgsConstructor
public class FactorySettingsController {

    private final FactorySettingsService settingsService;
    private final FactoryAIService factoryAIService;

    @GetMapping
    @Operation(summary = "获取工厂设置")
    public ApiResponse<FactorySettingsDTO> getSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取工厂设置: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.getSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping
    @Operation(summary = "更新工厂设置")
    public ApiResponse<FactorySettingsDTO> saveSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid FactorySettingsDTO dto) {
        log.info("更新工厂设置: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.saveSettings(factoryId, dto);
        return ApiResponse.success(settings);
    }

    // ==================== AI设置 ====================

    @GetMapping("/ai")
    @Operation(summary = "获取AI设置")
    public ApiResponse<FactorySettingsDTO.AISettings> getAiSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取AI设置: factoryId={}", factoryId);
        FactorySettingsDTO.AISettings settings = settingsService.getAiSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/ai")
    @Operation(summary = "更新AI设置")
    public ApiResponse<FactorySettingsDTO.AISettings> updateAiSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid FactorySettingsDTO.AISettings settings) {
        log.info("更新AI设置: factoryId={}", factoryId);
        FactorySettingsDTO.AISettings result = settingsService.updateAiSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    @GetMapping("/ai/usage-stats")
    @Operation(summary = "获取AI使用统计")
    public ApiResponse<FactoryAIUsageDTO> getAiUsageStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取AI使用统计: factoryId={}", factoryId);
        FactoryAIUsageDTO usage = factoryAIService.getFactoryAIUsage(factoryId);
        return ApiResponse.success(usage);
    }

    // ==================== 通知设置 ====================

    @GetMapping("/notifications")
    @Operation(summary = "获取通知设置")
    public ApiResponse<FactorySettingsDTO.NotificationSettings> getNotificationSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取通知设置: factoryId={}", factoryId);
        FactorySettingsDTO.NotificationSettings settings = settingsService.getNotificationSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/notifications")
    @Operation(summary = "更新通知设置")
    public ApiResponse<FactorySettingsDTO.NotificationSettings> updateNotificationSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid FactorySettingsDTO.NotificationSettings settings) {
        log.info("更新通知设置: factoryId={}", factoryId);
        FactorySettingsDTO.NotificationSettings result = settingsService.updateNotificationSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 工作时间设置 ====================

    @GetMapping("/work-time")
    @Operation(summary = "获取工作时间设置")
    public ApiResponse<FactorySettingsDTO.WorkTimeSettings> getWorkTimeSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取工作时间设置: factoryId={}", factoryId);
        FactorySettingsDTO.WorkTimeSettings settings = settingsService.getWorkTimeSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/work-time")
    @Operation(summary = "更新工作时间设置")
    public ApiResponse<FactorySettingsDTO.WorkTimeSettings> updateWorkTimeSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid FactorySettingsDTO.WorkTimeSettings settings) {
        log.info("更新工作时间设置: factoryId={}", factoryId);
        FactorySettingsDTO.WorkTimeSettings result = settingsService.updateWorkTimeSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 生产设置 ====================

    @GetMapping("/production")
    @Operation(summary = "获取生产设置")
    public ApiResponse<FactorySettingsDTO.ProductionSettings> getProductionSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取生产设置: factoryId={}", factoryId);
        FactorySettingsDTO.ProductionSettings settings = settingsService.getProductionSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/production")
    @Operation(summary = "更新生产设置")
    public ApiResponse<FactorySettingsDTO.ProductionSettings> updateProductionSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid FactorySettingsDTO.ProductionSettings settings) {
        log.info("更新生产设置: factoryId={}", factoryId);
        FactorySettingsDTO.ProductionSettings result = settingsService.updateProductionSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 库存设置 ====================

    @GetMapping("/inventory")
    @Operation(summary = "获取库存设置")
    public ApiResponse<FactorySettingsDTO.InventorySettings> getInventorySettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取库存设置: factoryId={}", factoryId);
        FactorySettingsDTO.InventorySettings settings = settingsService.getInventorySettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/inventory")
    @Operation(summary = "更新库存设置")
    public ApiResponse<FactorySettingsDTO.InventorySettings> updateInventorySettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid FactorySettingsDTO.InventorySettings settings) {
        log.info("更新库存设置: factoryId={}", factoryId);
        FactorySettingsDTO.InventorySettings result = settingsService.updateInventorySettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 数据保留设置 ====================

    @GetMapping("/data-retention")
    @Operation(summary = "获取数据保留设置")
    public ApiResponse<FactorySettingsDTO.DataRetentionSettings> getDataRetentionSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取数据保留设置: factoryId={}", factoryId);
        FactorySettingsDTO.DataRetentionSettings settings = settingsService.getDataRetentionSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/data-retention")
    @Operation(summary = "更新数据保留设置")
    public ApiResponse<FactorySettingsDTO.DataRetentionSettings> updateDataRetentionSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Valid FactorySettingsDTO.DataRetentionSettings settings) {
        log.info("更新数据保留设置: factoryId={}", factoryId);
        FactorySettingsDTO.DataRetentionSettings result = settingsService.updateDataRetentionSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 功能开关 ====================

    @GetMapping("/features")
    @Operation(summary = "获取功能开关")
    public ApiResponse<Map<String, Boolean>> getFeatureToggles(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取功能开关: factoryId={}", factoryId);
        Map<String, Boolean> toggles = settingsService.getFeatureToggles(factoryId);
        return ApiResponse.success(toggles);
    }

    @PutMapping("/features/{feature}")
    @Operation(summary = "更新功能开关")
    public ApiResponse<Void> updateFeatureToggle(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "功能名称") String feature,
            @RequestParam @Parameter(description = "是否启用") Boolean enabled) {
        log.info("更新功能开关: factoryId={}, feature={}, enabled={}", factoryId, feature, enabled);
        settingsService.updateFeatureToggle(factoryId, feature, enabled);
        return ApiResponse.success();
    }

    // ==================== 显示设置 ====================

    @GetMapping("/display")
    @Operation(summary = "获取显示设置")
    public ApiResponse<Map<String, String>> getDisplaySettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.debug("获取显示设置: factoryId={}", factoryId);
        Map<String, String> settings = settingsService.getDisplaySettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/display")
    @Operation(summary = "更新显示设置")
    public ApiResponse<Void> updateDisplaySettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "语言") String language,
            @RequestParam(required = false) @Parameter(description = "时区") String timezone,
            @RequestParam(required = false) @Parameter(description = "日期格式") String dateFormat,
            @RequestParam(required = false) @Parameter(description = "货币") String currency) {
        log.info("更新显示设置: factoryId={}", factoryId);
        settingsService.updateDisplaySettings(factoryId, language, timezone, dateFormat, currency);
        return ApiResponse.success();
    }

    // ==================== 导入导出 ====================

    @PostMapping("/reset")
    @Operation(summary = "重置为默认设置")
    public ApiResponse<FactorySettingsDTO> resetToDefaults(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.warn("重置工厂设置为默认值: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.resetToDefaults(factoryId);
        return ApiResponse.success(settings);
    }

    @GetMapping("/export")
    @Operation(summary = "导出设置")
    public ApiResponse<String> exportSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("导出工厂设置: factoryId={}", factoryId);
        String settingsJson = settingsService.exportSettings(factoryId);
        return ApiResponse.success(settingsJson);
    }

    @PostMapping("/import")
    @Operation(summary = "导入设置")
    public ApiResponse<FactorySettingsDTO> importSettings(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Parameter(description = "设置JSON") String settingsJson) {
        log.info("导入工厂设置: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.importSettings(factoryId, settingsJson);
        return ApiResponse.success(settings);
    }
}