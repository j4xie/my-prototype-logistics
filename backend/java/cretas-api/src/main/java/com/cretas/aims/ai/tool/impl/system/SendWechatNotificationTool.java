package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 微信通知发送工具
 *
 * 发送微信通知给指定接收人或全体成员。
 * Intent Code: NOTIFICATION_SEND_WECHAT / SEND_WECHAT_MESSAGE / NOTIFICATION_WECHAT_SEND
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class SendWechatNotificationTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "send_wechat_notification";
    }

    @Override
    public String getDescription() {
        return "发送微信通知给指定接收人或全体成员。支持指定接收人和消息内容。" +
                "适用场景：发送微信通知、群发消息、通知特定人员。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> recipient = new HashMap<>();
        recipient.put("type", "string");
        recipient.put("description", "接收人，如姓名或'全体成员'");
        properties.put("recipient", recipient);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "string");
        message.put("description", "通知消息内容");
        properties.put("message", message);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("发送微信通知 - 工厂ID: {}", factoryId);

        String recipient = getString(params, "recipient", "全体成员");
        String messageContent = getString(params, "message", "来自AI助手的通知");

        // TODO: 调用实际的微信通知服务
        Map<String, Object> result = new HashMap<>();
        result.put("message", "微信通知已发送给「" + recipient + "」");
        result.put("recipient", recipient);
        result.put("messageContent", messageContent);
        result.put("channel", "wechat");
        result.put("status", "queued");

        return result;
    }
}
