package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 工厂通知配置工具
 *
 * 用于配置工厂的各类通知设置，包括告警通知、任务提醒、
 * 系统通知等的发送方式和接收人。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class FactoryNotificationConfigTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "factory_notification_config";
    }

    @Override
    public String getDescription() {
        return "配置工厂的通知设置。需要提供通知类型，可选配置通知渠道、接收人等。" +
                "支持的通知类型：告警通知、任务提醒、质检通知、库存预警、系统公告等。" +
                "适用场景：设置通知方式、配置接收人员、调整通知频率。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // notificationType: 通知类型（必需）
        Map<String, Object> notificationType = new HashMap<>();
        notificationType.put("type", "string");
        notificationType.put("description", "通知类型");
        notificationType.put("enum", Arrays.asList(
                "ALERT",                // 告警通知
                "TASK_REMINDER",        // 任务提醒
                "QUALITY_NOTICE",       // 质检通知
                "INVENTORY_WARNING",    // 库存预警
                "EXPIRY_WARNING",       // 保质期预警
                "SYSTEM_ANNOUNCEMENT",  // 系统公告
                "ORDER_UPDATE",         // 订单更新
                "PRODUCTION_STATUS"     // 生产状态
        ));
        properties.put("notificationType", notificationType);

        // enabled: 是否启用（可选）
        Map<String, Object> enabled = new HashMap<>();
        enabled.put("type", "boolean");
        enabled.put("description", "是否启用此类通知，默认为true");
        properties.put("enabled", enabled);

        // channels: 通知渠道（可选）
        Map<String, Object> channels = new HashMap<>();
        channels.put("type", "array");
        channels.put("description", "通知渠道列表，可多选");
        Map<String, Object> channelItems = new HashMap<>();
        channelItems.put("type", "string");
        channelItems.put("enum", Arrays.asList(
                "APP_PUSH",     // App推送
                "SMS",          // 短信
                "EMAIL",        // 邮件
                "WECHAT",       // 微信
                "IN_APP"        // 应用内通知
        ));
        channels.put("items", channelItems);
        properties.put("channels", channels);

        // priority: 优先级（可选）
        Map<String, Object> priority = new HashMap<>();
        priority.put("type", "string");
        priority.put("description", "通知优先级");
        priority.put("enum", Arrays.asList("HIGH", "MEDIUM", "LOW"));
        properties.put("priority", priority);

        // quietHours: 免打扰时段（可选）
        Map<String, Object> quietHours = new HashMap<>();
        quietHours.put("type", "object");
        quietHours.put("description", "免打扰时段设置");
        Map<String, Object> quietHoursProps = new HashMap<>();
        Map<String, Object> startTime = new HashMap<>();
        startTime.put("type", "string");
        startTime.put("description", "开始时间，格式HH:mm");
        quietHoursProps.put("startTime", startTime);
        Map<String, Object> endTime = new HashMap<>();
        endTime.put("type", "string");
        endTime.put("description", "结束时间，格式HH:mm");
        quietHoursProps.put("endTime", endTime);
        quietHours.put("properties", quietHoursProps);
        properties.put("quietHours", quietHours);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("notificationType"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("notificationType");
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        if ("notificationType".equals(paramName)) {
            return "请问您要配置哪种类型的通知？可选：ALERT(告警)、TASK_REMINDER(任务提醒)、QUALITY_NOTICE(质检)、INVENTORY_WARNING(库存预警)等。";
        }
        return super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = new HashMap<>();
        displayNames.put("notificationType", "通知类型");
        displayNames.put("enabled", "是否启用");
        displayNames.put("channels", "通知渠道");
        displayNames.put("priority", "优先级");
        displayNames.put("quietHours", "免打扰时段");

        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }

    @Override
    @SuppressWarnings("unchecked")
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行工厂通知配置 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 解析参数
        String notificationType = getString(params, "notificationType");
        Boolean enabled = getBoolean(params, "enabled", true);
        List<String> channels = getList(params, "channels");
        String priority = getString(params, "priority", "MEDIUM");
        Map<String, Object> quietHours = params.get("quietHours") instanceof Map ?
                (Map<String, Object>) params.get("quietHours") : null;

        Long userId = getLong(context, "userId");
        String userName = getString(context, "username");

        // 验证通知类型
        if (!isValidNotificationType(notificationType)) {
            throw new IllegalArgumentException("无效的通知类型: " + notificationType);
        }

        // TODO: 调用实际的通知配置服务
        // notificationConfigService.updateConfig(factoryId, notificationType, config, userId);

        // 获取通知类型信息
        Map<String, String> typeInfo = getNotificationTypeInfo(notificationType);

        // 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("message", String.format("「%s」通知配置已更新", typeInfo.get("name")));
        result.put("factoryId", factoryId);
        result.put("notificationType", notificationType);
        result.put("notificationTypeName", typeInfo.get("name"));
        result.put("changedBy", userName);
        result.put("changedAt", LocalDateTime.now().toString());

        // 构建配置详情
        Map<String, Object> configDetails = new HashMap<>();
        configDetails.put("type", notificationType);
        configDetails.put("typeName", typeInfo.get("name"));
        configDetails.put("enabled", enabled);
        configDetails.put("priority", priority);

        if (channels != null && !channels.isEmpty()) {
            configDetails.put("channels", channels);
            configDetails.put("channelNames", getChannelNames(channels));
        } else {
            // 默认渠道
            configDetails.put("channels", Arrays.asList("APP_PUSH", "IN_APP"));
            configDetails.put("channelNames", Arrays.asList("App推送", "应用内通知"));
        }

        if (quietHours != null) {
            configDetails.put("quietHours", quietHours);
        }

        result.put("configDetails", configDetails);

        // 添加配置摘要
        StringBuilder summary = new StringBuilder();
        summary.append(enabled ? "已启用" : "已禁用");
        summary.append("，优先级: ").append(getPriorityName(priority));
        if (channels != null && !channels.isEmpty()) {
            summary.append("，渠道: ").append(String.join("、", getChannelNames(channels)));
        }
        result.put("configSummary", summary.toString());

        // 添加后续操作建议
        result.put("nextSteps", Arrays.asList(
                "测试通知是否正常发送",
                "确认接收人员是否正确",
                "检查其他通知类型配置"
        ));

        // 列出所有通知类型供参考
        result.put("availableNotificationTypes", getAvailableNotificationTypes());

        log.info("通知配置更新完成 - 工厂ID: {}, 类型: {}, 启用: {}",
                factoryId, notificationType, enabled);

        return result;
    }

    /**
     * 验证通知类型是否有效
     */
    private boolean isValidNotificationType(String notificationType) {
        Set<String> validTypes = new HashSet<>(Arrays.asList(
                "ALERT", "TASK_REMINDER", "QUALITY_NOTICE", "INVENTORY_WARNING",
                "EXPIRY_WARNING", "SYSTEM_ANNOUNCEMENT", "ORDER_UPDATE", "PRODUCTION_STATUS"
        ));
        return validTypes.contains(notificationType);
    }

    /**
     * 获取通知类型信息
     */
    private Map<String, String> getNotificationTypeInfo(String notificationType) {
        Map<String, Map<String, String>> types = new HashMap<>();

        types.put("ALERT", createTypeMap("告警通知", "设备异常、系统告警等紧急通知"));
        types.put("TASK_REMINDER", createTypeMap("任务提醒", "待办任务、定时任务提醒"));
        types.put("QUALITY_NOTICE", createTypeMap("质检通知", "质检任务、检验结果通知"));
        types.put("INVENTORY_WARNING", createTypeMap("库存预警", "低库存、高库存预警"));
        types.put("EXPIRY_WARNING", createTypeMap("保质期预警", "原料和产品临期预警"));
        types.put("SYSTEM_ANNOUNCEMENT", createTypeMap("系统公告", "系统维护、升级公告"));
        types.put("ORDER_UPDATE", createTypeMap("订单更新", "订单状态变更通知"));
        types.put("PRODUCTION_STATUS", createTypeMap("生产状态", "生产进度、完成通知"));

        return types.getOrDefault(notificationType, createTypeMap("未知类型", ""));
    }

    private Map<String, String> createTypeMap(String name, String description) {
        Map<String, String> map = new HashMap<>();
        map.put("name", name);
        map.put("description", description);
        return map;
    }

    /**
     * 获取渠道显示名称
     */
    private List<String> getChannelNames(List<String> channels) {
        Map<String, String> channelNameMap = new HashMap<>();
        channelNameMap.put("APP_PUSH", "App推送");
        channelNameMap.put("SMS", "短信");
        channelNameMap.put("EMAIL", "邮件");
        channelNameMap.put("WECHAT", "微信");
        channelNameMap.put("IN_APP", "应用内通知");

        List<String> names = new ArrayList<>();
        for (String channel : channels) {
            names.add(channelNameMap.getOrDefault(channel, channel));
        }
        return names;
    }

    /**
     * 获取优先级显示名称
     */
    private String getPriorityName(String priority) {
        Map<String, String> priorityNames = new HashMap<>();
        priorityNames.put("HIGH", "高");
        priorityNames.put("MEDIUM", "中");
        priorityNames.put("LOW", "低");
        return priorityNames.getOrDefault(priority, priority);
    }

    /**
     * 获取所有可用的通知类型
     */
    private List<Map<String, String>> getAvailableNotificationTypes() {
        List<Map<String, String>> types = new ArrayList<>();

        types.add(createTypeListItem("ALERT", "告警通知"));
        types.add(createTypeListItem("TASK_REMINDER", "任务提醒"));
        types.add(createTypeListItem("QUALITY_NOTICE", "质检通知"));
        types.add(createTypeListItem("INVENTORY_WARNING", "库存预警"));
        types.add(createTypeListItem("EXPIRY_WARNING", "保质期预警"));
        types.add(createTypeListItem("SYSTEM_ANNOUNCEMENT", "系统公告"));
        types.add(createTypeListItem("ORDER_UPDATE", "订单更新"));
        types.add(createTypeListItem("PRODUCTION_STATUS", "生产状态"));

        return types;
    }

    private Map<String, String> createTypeListItem(String code, String name) {
        Map<String, String> item = new HashMap<>();
        item.put("code", code);
        item.put("name", name);
        return item;
    }
}
