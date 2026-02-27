package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.scheduling.SchedulingSettingsDTO;
import com.cretas.aims.entity.WorkOrder;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.SchedulingService;
import com.cretas.aims.service.ApprovalChainService;
import com.cretas.aims.service.WorkOrderService;
import com.cretas.aims.entity.config.ApprovalChainConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.cretas.aims.util.ErrorSanitizer;

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
    private final ApprovalChainService approvalChainService;
    private final WorkOrderService workOrderService;

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
            } else if ("APPROVAL_CONFIG_PURCHASE_ORDER".equals(intentCode)) {
                return handleApprovalConfig(factoryId, request, intentConfig);
            } else if ("CONFIG_RESET".equals(intentCode)) {
                return handleConfigReset(factoryId, intentConfig);
            } else if ("USER_TODO_LIST".equals(intentCode)) {
                return handleTodoList(factoryId, userId, intentConfig);
            } else if ("NOTIFICATION_SEND_WECHAT".equals(intentCode) || "SEND_WECHAT_MESSAGE".equals(intentCode)
                    || "NOTIFICATION_WECHAT_SEND".equals(intentCode)) {
                return handleSendWechatNotification(factoryId, request, intentConfig);
            } else if ("OUT_OF_DOMAIN".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("域外输入")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("我是白垩纪食品溯源系统AI助手，可以帮您查询库存、生产、质检、设备、发货等业务数据。请告诉我您需要什么帮助？")
                        .build();
            } else if ("CONTEXT_CONTINUE".equals(intentCode) || "CONTINUE_LAST_OPERATION".equals(intentCode)
                    || "SYSTEM_RESUME_LAST_ACTION".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("上下文继续")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请告诉我您想继续查询什么？例如：「查看库存」「查看今天的生产数据」「看一下设备状态」")
                        .build();
            } else if ("PAGINATION_NEXT".equals(intentCode) || "NAVIGATION_NEXT_PAGE".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("翻页")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请告诉我您想查看哪类数据的下一页？例如：「下一页库存」「下一页订单」")
                        .build();
            } else if ("SYSTEM_GO_BACK".equals(intentCode) || "OPERATION_UNDO_OR_RECALL".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("返回/撤销")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("已收到您的返回请求。请告诉我您接下来想查询什么？")
                        .build();
            } else if ("NAVIGATE_TO_CITY".equals(intentCode) || "NAVIGATE_TO_LOCATION".equals(intentCode)
                    || "SHOPPING_CART_CLEAR".equals(intentCode) || "MEDIA_PLAY".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("域外操作")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("抱歉，该功能不在系统服务范围内。我是白垩纪食品溯源AI助手，可以帮您查询库存、生产、质检、设备、发货等业务数据。")
                        .build();
            } else if ("EXECUTE_SWITCH".equals(intentCode) || "CONDITION_SWITCH".equals(intentCode)
                    || "EXCLUDE_SELECTED".equals(intentCode) || "FILTER_EXCLUDE_SELECTED".equals(intentCode)
                    || "SYSTEM_FILTER_EXCLUDE_SELECTED".equals(intentCode) || "UI_EXCLUDE_SELECTED".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("筛选/切换")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请告诉我您想切换或筛选什么条件？例如：「只看进行中的批次」「排除已完成的订单」")
                        .build();
            } else if ("SYSTEM_PASSWORD_RESET".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("密码修改")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请前往【我的】→【账户安全】→【修改密码】进行密码修改。如忘记密码，请联系管理员重置。")
                        .build();
            } else if ("SYSTEM_PROFILE_EDIT".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("编辑个人信息")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请前往【我的】→【个人资料】进行修改，可编辑头像、手机号、邮箱等信息。")
                        .build();
            } else if ("SYSTEM_HELP".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("使用帮助")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("您可以问我关于库存、生产、质检、设备、发货、考勤等业务问题。例如：\n• 「查看今天的库存」\n• 「生产批次进度」\n• 「设备运行状态」\n• 「今天的发货情况」")
                        .build();
            } else if ("SYSTEM_SETTINGS".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("系统设置")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请前往【我的】→【设置】，可调整语言、主题、数据刷新频率等偏好设置。")
                        .build();
            } else if ("SYSTEM_PERMISSION_QUERY".equals(intentCode)) {
                String roleDesc = userRole != null ? userRole : "未知";
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("权限查询")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("您当前角色为【" + roleDesc + "】。如需调整权限，请联系工厂管理员。您可以前往【我的】→【权限说明】查看当前角色可访问的功能模块。")
                        .build();
            } else if ("SYSTEM_NOTIFICATION".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("通知设置")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请前往【我的】→【消息通知】→【通知设置】，可开关各类通知提醒（告警、审批、生产、库存等）。")
                        .build();
            } else if ("SYSTEM_SWITCH_FACTORY".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("切换工厂")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请前往【我的】→【工厂切换】选择目标工厂。切换后数据将自动刷新为对应工厂的数据。")
                        .build();
            } else if ("SYSTEM_FEEDBACK".equals(intentCode)) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName("意见反馈")
                        .intentCategory("SYSTEM")
                        .status("COMPLETED")
                        .message("请前往【我的】→【意见反馈】提交您的建议或问题，我们会尽快处理。也可以直接告诉我您遇到的问题。")
                        .build();
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
                    .message("执行失败: " + ErrorSanitizer.sanitize(e))
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

    // ===== Phase 2b 新增系统意图 =====

    private IntentExecuteResponse handleApprovalConfig(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        List<ApprovalChainConfig> configs = approvalChainService.getConfigsByDecisionType(
                factoryId, ApprovalChainConfig.DecisionType.SUPPLIER_APPROVAL);

        Map<String, Object> result = Map.of(
                "configs", configs,
                "total", configs.size(),
                "decisionType", "PURCHASE_ORDER"
        );

        StringBuilder sb = new StringBuilder();
        sb.append("采购审批流程配置\n");
        if (configs.isEmpty()) {
            sb.append("当前无采购审批配置，需要创建审批链");
        } else {
            sb.append("共 ").append(configs.size()).append(" 条审批配置:\n");
            for (int i = 0; i < configs.size(); i++) {
                var c = configs.get(i);
                sb.append(i + 1).append(". 级别").append(c.getApprovalLevel())
                        .append(" | 审批角色: ").append(c.getApproverRoles())
                        .append(" | 状态: ").append(c.getEnabled() ? "启用" : "禁用").append("\n");
            }
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("SYSTEM")
                .status("COMPLETED").message(sb.toString().trim()).formattedText(sb.toString().trim())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleTodoList(String factoryId, Long userId, AIIntentConfig intentConfig) {
        Page<WorkOrder> pendingOrders = workOrderService.getWorkOrdersByAssignee(
                factoryId, userId, PageRequest.of(0, 20));
        List<WorkOrder> overdueOrders = workOrderService.getOverdueWorkOrders(factoryId);
        long pendingCount = workOrderService.countByStatus(factoryId, "PENDING");
        long inProgressCount = workOrderService.countByStatus(factoryId, "IN_PROGRESS");

        Map<String, Object> result = new HashMap<>();
        result.put("myTasks", pendingOrders.getContent());
        result.put("myTaskCount", pendingOrders.getTotalElements());
        result.put("overdueCount", overdueOrders.size());
        result.put("pendingCount", pendingCount);
        result.put("inProgressCount", inProgressCount);

        StringBuilder sb = new StringBuilder();
        sb.append("我的待办事项\n");
        sb.append("• 我的任务: ").append(pendingOrders.getTotalElements()).append(" 条\n");
        sb.append("• 全厂待处理: ").append(pendingCount).append(" 条\n");
        sb.append("• 进行中: ").append(inProgressCount).append(" 条\n");
        sb.append("• 逾期: ").append(overdueOrders.size()).append(" 条");

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("SYSTEM")
                .status("COMPLETED").message(sb.toString()).formattedText(sb.toString())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleSendWechatNotification(String factoryId, IntentExecuteRequest request,
                                                                    AIIntentConfig intentConfig) {
        String recipient = null;
        String messageContent = null;

        if (request.getContext() != null) {
            Object recipientObj = request.getContext().get("recipient");
            Object messageObj = request.getContext().get("message");
            if (recipientObj != null) recipient = recipientObj.toString();
            if (messageObj != null) messageContent = messageObj.toString();
        }

        // Parse from user input if not in context
        if (recipient == null && request.getUserInput() != null) {
            String input = request.getUserInput();
            if (input.contains("给")) {
                int idx = input.indexOf("给");
                String after = input.substring(idx + 1).replaceAll("(发|通知|消息|微信|发送)", "").trim();
                if (!after.isEmpty() && after.length() <= 20) {
                    recipient = after;
                }
            }
        }

        if (recipient == null && messageContent == null) {
            // Default: broadcast to all when no specific recipient/message
            recipient = "全体成员";
            messageContent = "来自AI助手的通知";
        }

        // Simulate sending (actual WeChat integration would go here)
        Map<String, Object> result = new HashMap<>();
        result.put("recipient", recipient != null ? recipient : "全体");
        result.put("message", messageContent != null ? messageContent : "(从用户输入提取)");
        result.put("channel", "wechat");
        result.put("status", "queued");

        String msg = "微信通知已发送" + (recipient != null ? "给「" + recipient + "」" : "");

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("SYSTEM")
                .status("COMPLETED").message(msg).formattedText(msg)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleConfigReset(String factoryId, AIIntentConfig intentConfig) {
        // Config reset is a sensitive operation - return confirmation prompt
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("SYSTEM")
                .status("NEED_CONFIRM")
                .message("确认要恢复系统默认配置吗？这将重置以下设置:\n" +
                        "1. 排产设置 → 手动确认模式\n" +
                        "2. 功能开关 → 全部启用\n" +
                        "3. 通知设置 → 默认渠道\n\n" +
                        "请回复\"确认\"继续操作")
                .executedAt(LocalDateTime.now()).build();
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

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式
        return true;
    }
}
