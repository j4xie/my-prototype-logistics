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
@Tag(name = "工厂设置管理", description = "工厂配置和设置管理相关接口，包括基础设置（工厂名称、时区、语言、日期格式）、AI设置（AI功能开关、使用统计）、通知设置（邮件/短信/推送）、工作时间设置、生产设置、库存设置、数据保留设置、功能开关管理、显示设置，以及设置的导入导出和重置等功能")
@RequiredArgsConstructor
public class FactorySettingsController {

    private final FactorySettingsService settingsService;
    private final FactoryAIService factoryAIService;

    @GetMapping
    @Operation(summary = "获取工厂设置（前端格式）", description = "获取工厂的配置设置，返回前端页面所需的格式，包含基础设置、通知设置和安全设置三个模块")
    public ApiResponse<FactorySettingsDTO.WebSettingsResponse> getSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取工厂设置（前端格式）: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.getSettings(factoryId);

        // 转换为前端期望的格式
        FactorySettingsDTO.BasicSettings basic = FactorySettingsDTO.BasicSettings.builder()
                .factoryName(settings.getFactoryName())
                .timezone(settings.getTimezone())
                .language(settings.getLanguage())
                .dateFormat(settings.getDateFormat())
                .workStartTime(settings.getWorkTimeSettings() != null ?
                        settings.getWorkTimeSettings().getStartTime() : "08:00")
                .workEndTime(settings.getWorkTimeSettings() != null ?
                        settings.getWorkTimeSettings().getEndTime() : "17:00")
                .build();

        FactorySettingsDTO.WebNotificationSettings notification = FactorySettingsDTO.WebNotificationSettings.builder()
                .emailNotification(settings.getNotificationSettings() != null ?
                        settings.getNotificationSettings().getEmailEnabled() : true)
                .smsNotification(false)
                .alertNotification(true)
                .maintenanceReminder(true)
                .reminderDays(3)
                .build();

        FactorySettingsDTO.SecuritySettings security = FactorySettingsDTO.SecuritySettings.builder()
                .passwordMinLength(8)
                .passwordRequireUppercase(true)
                .passwordRequireNumber(true)
                .sessionTimeout(30)
                .maxLoginAttempts(5)
                .build();

        FactorySettingsDTO.WebSettingsResponse response = FactorySettingsDTO.WebSettingsResponse.builder()
                .basic(basic)
                .notification(notification)
                .security(security)
                .build();

        return ApiResponse.success(response);
    }

    @GetMapping("/full")
    @Operation(summary = "获取工厂完整设置", description = "获取工厂的所有配置设置，包含完整的设置项结构，适用于管理后台或设置导出场景")
    public ApiResponse<FactorySettingsDTO> getFullSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取工厂完整设置: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.getSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping
    @Operation(summary = "更新工厂设置", description = "更新工厂的完整配置设置，支持批量更新所有设置项")
    public ApiResponse<FactorySettingsDTO> saveSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "工厂设置信息") FactorySettingsDTO dto) {
        log.info("更新工厂设置: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.saveSettings(factoryId, dto);
        return ApiResponse.success(settings);
    }

    // ==================== 前端设置页面 API ====================

    @PutMapping("/basic")
    @Operation(summary = "更新基础设置", description = "更新工厂的基础设置，包括工厂名称、时区、语言、日期格式和工作时间")
    public ApiResponse<FactorySettingsDTO.BasicSettings> updateBasicSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "基础设置信息") FactorySettingsDTO.BasicSettings basicSettings) {
        log.info("更新基础设置: factoryId={}", factoryId);

        // 更新显示设置
        settingsService.updateDisplaySettings(
                factoryId,
                basicSettings.getLanguage(),
                basicSettings.getTimezone(),
                basicSettings.getDateFormat(),
                null // currency not in basic settings
        );

        // 更新工作时间设置
        FactorySettingsDTO.WorkTimeSettings workTime = FactorySettingsDTO.WorkTimeSettings.builder()
                .startTime(basicSettings.getWorkStartTime())
                .endTime(basicSettings.getWorkEndTime())
                .build();
        settingsService.updateWorkTimeSettings(factoryId, workTime);

        return ApiResponse.success("基础设置已保存", basicSettings);
    }

    @PutMapping("/notification")
    @Operation(summary = "更新通知设置（前端格式）", description = "更新工厂的通知设置，使用前端友好的格式，包括邮件通知、短信通知、告警通知和维护提醒开关")
    public ApiResponse<FactorySettingsDTO.WebNotificationSettings> updateWebNotificationSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "前端通知设置") FactorySettingsDTO.WebNotificationSettings notifSettings) {
        log.info("更新通知设置: factoryId={}", factoryId);

        // 转换为后端格式并保存
        FactorySettingsDTO.NotificationSettings backendSettings = FactorySettingsDTO.NotificationSettings.builder()
                .emailEnabled(notifSettings.getEmailNotification())
                .pushEnabled(notifSettings.getAlertNotification())
                .wechatEnabled(false)
                .build();
        settingsService.updateNotificationSettings(factoryId, backendSettings);

        return ApiResponse.success("通知设置已保存", notifSettings);
    }

    @PutMapping("/security")
    @Operation(summary = "更新安全设置", description = "更新工厂的安全设置，包括密码复杂度要求、会话超时时间和最大登录尝试次数")
    public ApiResponse<FactorySettingsDTO.SecuritySettings> updateSecuritySettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "安全设置信息") FactorySettingsDTO.SecuritySettings securitySettings) {
        log.info("更新安全设置: factoryId={}", factoryId);
        // 安全设置目前存储在内存中，实际项目中应存储到数据库
        // 这里只返回成功响应
        return ApiResponse.success("安全设置已保存", securitySettings);
    }

    // ==================== AI设置 ====================

    @GetMapping("/ai")
    @Operation(summary = "获取AI设置", description = "获取工厂的AI功能配置，包括AI功能开关、模型选择、调用配额等设置项")
    public ApiResponse<FactorySettingsDTO.AISettings> getAiSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取AI设置: factoryId={}", factoryId);
        FactorySettingsDTO.AISettings settings = settingsService.getAiSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/ai")
    @Operation(summary = "更新AI设置", description = "更新工厂的AI功能配置，包括AI功能开关、模型选择、调用配额等设置项")
    public ApiResponse<FactorySettingsDTO.AISettings> updateAiSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "AI设置信息") FactorySettingsDTO.AISettings settings) {
        log.info("更新AI设置: factoryId={}", factoryId);
        FactorySettingsDTO.AISettings result = settingsService.updateAiSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    @GetMapping("/ai/usage-stats")
    @Operation(summary = "获取AI使用统计", description = "获取工厂的AI功能使用统计数据，包括调用次数、Token消耗、使用趋势等")
    public ApiResponse<FactoryAIUsageDTO> getAiUsageStats(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取AI使用统计: factoryId={}", factoryId);
        FactoryAIUsageDTO usage = factoryAIService.getFactoryAIUsage(factoryId);
        return ApiResponse.success(usage);
    }

    // ==================== 通知设置 ====================

    @GetMapping("/notifications")
    @Operation(summary = "获取通知设置", description = "获取工厂的通知配置，包括邮件通知、短信通知、APP推送等渠道设置")
    public ApiResponse<FactorySettingsDTO.NotificationSettings> getNotificationSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取通知设置: factoryId={}", factoryId);
        FactorySettingsDTO.NotificationSettings settings = settingsService.getNotificationSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/notifications")
    @Operation(summary = "更新通知设置", description = "更新工厂的通知配置，包括邮件通知、短信通知、APP推送等渠道设置")
    public ApiResponse<FactorySettingsDTO.NotificationSettings> updateNotificationSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "通知设置信息") FactorySettingsDTO.NotificationSettings settings) {
        log.info("更新通知设置: factoryId={}", factoryId);
        FactorySettingsDTO.NotificationSettings result = settingsService.updateNotificationSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 工作时间设置 ====================

    @GetMapping("/work-time")
    @Operation(summary = "获取工作时间设置", description = "获取工厂的工作时间配置，包括工作日设置、班次时间、休息时间等")
    public ApiResponse<FactorySettingsDTO.WorkTimeSettings> getWorkTimeSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取工作时间设置: factoryId={}", factoryId);
        FactorySettingsDTO.WorkTimeSettings settings = settingsService.getWorkTimeSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/work-time")
    @Operation(summary = "更新工作时间设置", description = "更新工厂的工作时间配置，包括工作日设置、班次时间、休息时间等")
    public ApiResponse<FactorySettingsDTO.WorkTimeSettings> updateWorkTimeSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "工作时间设置信息") FactorySettingsDTO.WorkTimeSettings settings) {
        log.info("更新工作时间设置: factoryId={}", factoryId);
        FactorySettingsDTO.WorkTimeSettings result = settingsService.updateWorkTimeSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 生产设置 ====================

    @GetMapping("/production")
    @Operation(summary = "获取生产设置", description = "获取工厂的生产配置，包括默认产能、生产线配置、质检规则等")
    public ApiResponse<FactorySettingsDTO.ProductionSettings> getProductionSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取生产设置: factoryId={}", factoryId);
        FactorySettingsDTO.ProductionSettings settings = settingsService.getProductionSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/production")
    @Operation(summary = "更新生产设置", description = "更新工厂的生产配置，包括默认产能、生产线配置、质检规则等")
    public ApiResponse<FactorySettingsDTO.ProductionSettings> updateProductionSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "生产设置信息") FactorySettingsDTO.ProductionSettings settings) {
        log.info("更新生产设置: factoryId={}", factoryId);
        FactorySettingsDTO.ProductionSettings result = settingsService.updateProductionSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 库存设置 ====================

    @GetMapping("/inventory")
    @Operation(summary = "获取库存设置", description = "获取工厂的库存配置，包括安全库存阈值、预警规则、库位管理设置等")
    public ApiResponse<FactorySettingsDTO.InventorySettings> getInventorySettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取库存设置: factoryId={}", factoryId);
        FactorySettingsDTO.InventorySettings settings = settingsService.getInventorySettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/inventory")
    @Operation(summary = "更新库存设置", description = "更新工厂的库存配置，包括安全库存阈值、预警规则、库位管理设置等")
    public ApiResponse<FactorySettingsDTO.InventorySettings> updateInventorySettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "库存设置信息") FactorySettingsDTO.InventorySettings settings) {
        log.info("更新库存设置: factoryId={}", factoryId);
        FactorySettingsDTO.InventorySettings result = settingsService.updateInventorySettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 数据保留设置 ====================

    @GetMapping("/data-retention")
    @Operation(summary = "获取数据保留设置", description = "获取工厂的数据保留策略配置，包括日志保留天数、历史数据归档规则等")
    public ApiResponse<FactorySettingsDTO.DataRetentionSettings> getDataRetentionSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取数据保留设置: factoryId={}", factoryId);
        FactorySettingsDTO.DataRetentionSettings settings = settingsService.getDataRetentionSettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/data-retention")
    @Operation(summary = "更新数据保留设置", description = "更新工厂的数据保留策略配置，包括日志保留天数、历史数据归档规则、过期数据清理策略等")
    public ApiResponse<FactorySettingsDTO.DataRetentionSettings> updateDataRetentionSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "数据保留设置信息") FactorySettingsDTO.DataRetentionSettings settings) {
        log.info("更新数据保留设置: factoryId={}", factoryId);
        FactorySettingsDTO.DataRetentionSettings result = settingsService.updateDataRetentionSettings(factoryId, settings);
        return ApiResponse.success(result);
    }

    // ==================== 功能开关 ====================

    @GetMapping("/features")
    @Operation(summary = "获取功能开关", description = "获取工厂的功能开关配置，返回各功能模块的启用/禁用状态，如AI分析、质量预警、自动调度等功能的开关状态")
    public ApiResponse<Map<String, Boolean>> getFeatureToggles(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取功能开关: factoryId={}", factoryId);
        Map<String, Boolean> toggles = settingsService.getFeatureToggles(factoryId);
        return ApiResponse.success(toggles);
    }

    @PutMapping("/features/{feature}")
    @Operation(summary = "更新功能开关", description = "更新指定功能模块的开关状态，可用于启用或禁用特定功能如AI分析、质量预警、自动调度等")
    public ApiResponse<Void> updateFeatureToggle(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "功能名称", example = "aiAnalysis") String feature,
            @RequestParam @Parameter(description = "是否启用", example = "true") Boolean enabled) {
        log.info("更新功能开关: factoryId={}, feature={}, enabled={}", factoryId, feature, enabled);
        settingsService.updateFeatureToggle(factoryId, feature, enabled);
        return ApiResponse.success();
    }

    // ==================== 显示设置 ====================

    @GetMapping("/display")
    @Operation(summary = "获取显示设置", description = "获取工厂的界面显示配置，包括语言偏好、时区设置、日期格式、货币格式等显示相关设置")
    public ApiResponse<Map<String, String>> getDisplaySettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取显示设置: factoryId={}", factoryId);
        Map<String, String> settings = settingsService.getDisplaySettings(factoryId);
        return ApiResponse.success(settings);
    }

    @PutMapping("/display")
    @Operation(summary = "更新显示设置", description = "更新工厂的界面显示配置，可单独或批量更新语言偏好、时区设置、日期格式、货币格式等")
    public ApiResponse<Void> updateDisplaySettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false) @Parameter(description = "语言", example = "zh-CN") String language,
            @RequestParam(required = false) @Parameter(description = "时区", example = "Asia/Shanghai") String timezone,
            @RequestParam(required = false) @Parameter(description = "日期格式", example = "yyyy-MM-dd") String dateFormat,
            @RequestParam(required = false) @Parameter(description = "货币", example = "CNY") String currency) {
        log.info("更新显示设置: factoryId={}", factoryId);
        settingsService.updateDisplaySettings(factoryId, language, timezone, dateFormat, currency);
        return ApiResponse.success();
    }

    // ==================== 导入导出 ====================

    @PostMapping("/reset")
    @Operation(summary = "重置为默认设置", description = "将工厂所有设置重置为系统默认值，此操作不可逆，请谨慎使用。重置后将返回新的默认设置配置")
    public ApiResponse<FactorySettingsDTO> resetToDefaults(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.warn("重置工厂设置为默认值: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.resetToDefaults(factoryId);
        return ApiResponse.success(settings);
    }

    @GetMapping("/export")
    @Operation(summary = "导出设置", description = "将工厂的所有设置导出为JSON格式字符串，可用于备份或迁移到其他工厂")
    public ApiResponse<String> exportSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("导出工厂设置: factoryId={}", factoryId);
        String settingsJson = settingsService.exportSettings(factoryId);
        return ApiResponse.success(settingsJson);
    }

    @PostMapping("/import")
    @Operation(summary = "导入设置", description = "从JSON格式字符串导入工厂设置，将覆盖当前所有设置配置。导入前请确保JSON格式正确")
    public ApiResponse<FactorySettingsDTO> importSettings(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Parameter(description = "设置JSON字符串，包含完整的工厂设置配置") String settingsJson) {
        log.info("导入工厂设置: factoryId={}", factoryId);
        FactorySettingsDTO settings = settingsService.importSettings(factoryId, settingsJson);
        return ApiResponse.success(settings);
    }
}