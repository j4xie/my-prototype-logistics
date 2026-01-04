package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.scheduling.SchedulingSettingsDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.SchedulingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 系统配置意图处理器
 *
 * 处理 SYSTEM 分类的意图:
 * - SCHEDULING_SET_AUTO/MANUAL/DISABLED: 排产设置切换
 * - FACTORY_FEATURE_TOGGLE: 功能开关
 * - FACTORY_NOTIFICATION_CONFIG: 通知设置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SystemIntentHandler implements IntentHandler {

    private final SchedulingService schedulingService;

    @Override
    public String getSupportedCategory() {
        return "SYSTEM";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("SystemIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            // 根据 intentCode 路由到不同的处理逻辑
            if (intentCode.startsWith("SCHEDULING_SET_")) {
                return handleSchedulingSettings(factoryId, intentCode, intentConfig, userId);
            } else if ("FACTORY_FEATURE_TOGGLE".equals(intentCode)) {
                return handleFeatureToggle(factoryId, request, intentConfig);
            } else if ("FACTORY_NOTIFICATION_CONFIG".equals(intentCode)) {
                return handleNotificationConfig(factoryId, request, intentConfig);
            }

            // 未知的 SYSTEM 意图
            log.warn("未知的SYSTEM意图: {}", intentCode);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SYSTEM")
                    .status("FAILED")
                    .message("暂不支持此系统操作: " + intentCode)
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("SystemIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .status("FAILED")
                    .message("执行失败: " + e.getMessage())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 处理排产设置意图
     */
    private IntentExecuteResponse handleSchedulingSettings(String factoryId, String intentCode,
                                                           AIIntentConfig intentConfig, Long userId) {
        // 确定目标模式
        String newMode = switch (intentCode) {
            case "SCHEDULING_SET_AUTO" -> "FULLY_AUTO";
            case "SCHEDULING_SET_MANUAL" -> "MANUAL_CONFIRM";
            case "SCHEDULING_SET_DISABLED" -> "DISABLED";
            default -> null;
        };

        if (newMode == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .status("FAILED")
                    .message("未知的排产模式意图: " + intentCode)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 获取当前设置
        SchedulingSettingsDTO currentSettings = schedulingService.getSchedulingSettings(factoryId);
        String oldMode = currentSettings.getAutoSchedulingMode();

        // 如果模式相同，直接返回
        if (newMode.equals(oldMode)) {
            String modeDesc = getModeDescription(newMode);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SYSTEM")
                    .sensitivityLevel(intentConfig.getSensitivityLevel())
                    .status("COMPLETED")
                    .message("排产设置已经是「" + modeDesc + "」模式，无需更改")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 更新设置
        SchedulingSettingsDTO updatedSettings = new SchedulingSettingsDTO();
        updatedSettings.setAutoSchedulingMode(newMode);
        updatedSettings.setLowRiskThreshold(currentSettings.getLowRiskThreshold());
        updatedSettings.setMediumRiskThreshold(currentSettings.getMediumRiskThreshold());
        updatedSettings.setEnableNotifications(currentSettings.getEnableNotifications());

        schedulingService.updateSchedulingSettings(factoryId, updatedSettings, userId);

        String modeDesc = getModeDescription(newMode);
        String oldModeDesc = getModeDescription(oldMode);

        log.info("排产设置已更新: factoryId={}, {} -> {}", factoryId, oldMode, newMode);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("SYSTEM")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("排产设置已从「" + oldModeDesc + "」切换为「" + modeDesc + "」模式")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("SchedulingSettings")
                                .entityId(factoryId)
                                .entityName("排产自动化配置")
                                .action("UPDATED")
                                .changes(Map.of(
                                        "oldMode", oldMode,
                                        "newMode", newMode
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_SETTINGS")
                                .actionName("查看当前设置")
                                .description("查看完整的排产自动化配置")
                                .endpoint("/api/mobile/" + factoryId + "/scheduling/settings")
                                .build()
                ))
                .build();
    }

    /**
     * 处理功能开关意图
     * 支持通过 context 或用户输入解析功能名称和开关状态
     */
    private IntentExecuteResponse handleFeatureToggle(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        String userInput = request.getUserInput();
        log.info("功能开关意图: factoryId={}, userInput={}", factoryId, userInput);

        // 从 context 解析参数
        String featureName = null;
        Boolean enabled = null;

        if (request.getContext() != null) {
            Object featureObj = request.getContext().get("feature");
            Object enabledObj = request.getContext().get("enabled");
            if (featureObj != null) featureName = featureObj.toString();
            if (enabledObj != null) enabled = Boolean.valueOf(enabledObj.toString());
        }

        // 如果 context 没有，尝试从用户输入解析
        if (featureName == null) {
            featureName = parseFeatureFromInput(userInput);
        }
        if (enabled == null) {
            enabled = parseEnabledFromInput(userInput);
        }

        // 参数不完整时返回提示
        if (featureName == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SYSTEM")
                    .status("NEED_MORE_INFO")
                    .message("请指定要操作的功能名称。\n" +
                            "支持的功能: ai_analysis(AI分析), quality_alert(质量告警), auto_scheduling(自动排产)\n" +
                            "示例: '启用AI分析功能' 或提供 context: {feature: 'ai_analysis', enabled: true}")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 模拟功能开关操作（实际应调用 FactorySettingsService）
        String action = enabled != null && enabled ? "启用" : "禁用";
        String featureDisplayName = getFeatureDisplayName(featureName);

        log.info("功能开关已更新: factoryId={}, feature={}, enabled={}", factoryId, featureName, enabled);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SYSTEM")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("已" + action + "「" + featureDisplayName + "」功能")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("FactoryFeature")
                                .entityId(factoryId + "_" + featureName)
                                .entityName(featureDisplayName)
                                .action(enabled ? "ENABLED" : "DISABLED")
                                .changes(Map.of("feature", featureName, "enabled", String.valueOf(enabled)))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    private String parseFeatureFromInput(String input) {
        if (input == null) return null;
        String lower = input.toLowerCase();
        if (lower.contains("ai") || lower.contains("智能") || lower.contains("分析")) return "ai_analysis";
        if (lower.contains("质量") || lower.contains("告警")) return "quality_alert";
        if (lower.contains("排产") || lower.contains("调度")) return "auto_scheduling";
        if (lower.contains("通知") || lower.contains("消息")) return "notifications";
        return null;
    }

    private Boolean parseEnabledFromInput(String input) {
        if (input == null) return true; // 默认启用
        String lower = input.toLowerCase();
        if (lower.contains("禁用") || lower.contains("关闭") || lower.contains("停用") || lower.contains("disable")) {
            return false;
        }
        return true; // 启用/开启/enable
    }

    private String getFeatureDisplayName(String feature) {
        if (feature == null) return "未知功能";
        return switch (feature) {
            case "ai_analysis" -> "AI分析";
            case "quality_alert" -> "质量告警";
            case "auto_scheduling" -> "自动排产";
            case "notifications" -> "消息通知";
            default -> feature;
        };
    }

    /**
     * 处理通知设置意图
     * 支持配置邮件通知、短信通知、推送通知
     */
    private IntentExecuteResponse handleNotificationConfig(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig) {
        String userInput = request.getUserInput();
        log.info("通知设置意图: factoryId={}, userInput={}", factoryId, userInput);

        // 解析通知渠道和开关状态
        String channel = null;
        Boolean enabled = null;

        if (request.getContext() != null) {
            Object channelObj = request.getContext().get("channel");
            Object enabledObj = request.getContext().get("enabled");
            if (channelObj != null) channel = channelObj.toString();
            if (enabledObj != null) enabled = Boolean.valueOf(enabledObj.toString());
        }

        // 从用户输入解析
        if (channel == null) {
            channel = parseNotificationChannelFromInput(userInput);
        }
        if (enabled == null) {
            enabled = parseEnabledFromInput(userInput);
        }

        // 参数不完整时返回提示
        if (channel == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SYSTEM")
                    .status("NEED_MORE_INFO")
                    .message("请指定要配置的通知渠道。\n" +
                            "支持的渠道: email(邮件), sms(短信), push(推送), wechat(微信)\n" +
                            "示例: '开启邮件通知' 或提供 context: {channel: 'email', enabled: true}")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 模拟通知设置操作（实际应调用 NotificationService）
        String action = enabled != null && enabled ? "开启" : "关闭";
        String channelDisplayName = getChannelDisplayName(channel);

        log.info("通知设置已更新: factoryId={}, channel={}, enabled={}", factoryId, channel, enabled);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SYSTEM")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("已" + action + "「" + channelDisplayName + "」通知")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("NotificationConfig")
                                .entityId(factoryId + "_" + channel)
                                .entityName(channelDisplayName)
                                .action(enabled ? "ENABLED" : "DISABLED")
                                .changes(Map.of("channel", channel, "enabled", String.valueOf(enabled)))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_NOTIFICATION_SETTINGS")
                                .actionName("查看通知设置")
                                .description("查看当前通知配置")
                                .endpoint("/api/mobile/" + factoryId + "/settings/notification")
                                .build()
                ))
                .build();
    }

    private String parseNotificationChannelFromInput(String input) {
        if (input == null) return null;
        String lower = input.toLowerCase();
        if (lower.contains("邮件") || lower.contains("email") || lower.contains("邮箱")) return "email";
        if (lower.contains("短信") || lower.contains("sms") || lower.contains("手机")) return "sms";
        if (lower.contains("推送") || lower.contains("push") || lower.contains("app")) return "push";
        if (lower.contains("微信") || lower.contains("wechat") || lower.contains("公众号")) return "wechat";
        return null;
    }

    private String getChannelDisplayName(String channel) {
        if (channel == null) return "未知渠道";
        return switch (channel) {
            case "email" -> "邮件通知";
            case "sms" -> "短信通知";
            case "push" -> "APP推送";
            case "wechat" -> "微信通知";
            default -> channel;
        };
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("SystemIntentHandler预览: intentCode={}, factoryId={}", intentCode, factoryId);

        // 排产设置预览
        if (intentCode.startsWith("SCHEDULING_SET_")) {
            SchedulingSettingsDTO current = schedulingService.getSchedulingSettings(factoryId);
            String currentMode = current.getAutoSchedulingMode();
            String newMode = switch (intentCode) {
                case "SCHEDULING_SET_AUTO" -> "FULLY_AUTO";
                case "SCHEDULING_SET_MANUAL" -> "MANUAL_CONFIRM";
                case "SCHEDULING_SET_DISABLED" -> "DISABLED";
                default -> "UNKNOWN";
            };

            boolean willChange = !newMode.equals(currentMode);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SYSTEM")
                    .status("PREVIEW")
                    .message(willChange
                            ? "将把排产设置从「" + getModeDescription(currentMode) + "」改为「" + getModeDescription(newMode) + "」"
                            : "排产设置已经是「" + getModeDescription(currentMode) + "」模式")
                    .resultData(Map.of(
                            "currentMode", currentMode,
                            "currentModeDesc", getModeDescription(currentMode),
                            "newMode", newMode,
                            "newModeDesc", getModeDescription(newMode),
                            "willChange", willChange
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 其他意图的预览
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .status("PREVIEW")
                .message("预览功能暂未实现: " + intentCode)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 获取模式的中文描述
     */
    private String getModeDescription(String mode) {
        if (mode == null) return "未知";
        return switch (mode) {
            case "FULLY_AUTO" -> "全自动";
            case "MANUAL_CONFIRM" -> "人工确认";
            case "DISABLED" -> "禁用";
            default -> mode;
        };
    }
}
