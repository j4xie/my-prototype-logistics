package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Direction;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import com.cretas.aims.repository.DingTalkWebhookLogRepository;
import com.cretas.aims.service.dingtalk.DingTalkSendService;
import com.cretas.aims.service.dingtalk.DingTalkSendService.SendResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AIChat tool: actively push a text message to a DingTalk group.
 *
 * <p>Intent code: {@code DINGTALK_SEND_MESSAGE}.
 *
 * <p>Required params: {@code chatId} (DingTalk group conversation id),
 *                     {@code content} (plain text body).
 * <p>Optional params: {@code atUserId}, {@code messageType} (default AI_REPLY).
 *
 * <p>Flow: writes an OUTBOUND PENDING log, then {@link DingTalkSendService#send}
 * tries to deliver inline. If sent successfully → status=SENT. If rate-limited →
 * status=PENDING (Day 5 retry scheduler will pick up). If failed →
 * status=FAILED + nextRetryAt set.
 */
@Slf4j
@Component
public class DingTalkSendMessageTool extends AbstractBusinessTool {

    @Autowired private DingTalkSendService sendService;
    @Autowired private DingTalkWebhookLogRepository logRepository;

    @Override
    public String getToolName() {
        return "dingtalk_send_message";
    }

    @Override
    public String getDescription() {
        return "主动推送一条文本消息到指定钉钉群。可携带 @ 用户。" +
                "适用场景: 通知群成员某事项 / 推送 AI 分析结果到群 / 主动播报。" +
                "Intent: DINGTALK_SEND_MESSAGE";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> chatId = new HashMap<>();
        chatId.put("type", "string");
        chatId.put("description", "钉钉群 conversation id (cidXXXX== 格式)");
        properties.put("chatId", chatId);

        Map<String, Object> content = new HashMap<>();
        content.put("type", "string");
        content.put("description", "消息正文 (纯文本)");
        properties.put("content", content);

        Map<String, Object> atUserId = new HashMap<>();
        atUserId.put("type", "string");
        atUserId.put("description", "@ 的钉钉用户 id (可选)");
        properties.put("atUserId", atUserId);

        Map<String, Object> messageType = new HashMap<>();
        messageType.put("type", "string");
        messageType.put("description", "消息分类 (AI_REPLY / ANNOUNCE / 等); 仅用于日志, 默认 AI_REPLY");
        properties.put("messageType", messageType);

        schema.put("properties", properties);
        schema.put("required", List.of("chatId", "content"));
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("chatId", "content");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params,
                                            Map<String, Object> context) {
        String chatId = getString(params, "chatId");
        String content = getString(params, "content");
        String atUserId = getString(params, "atUserId");
        String messageType = getString(params, "messageType", "AI_REPLY");

        DingTalkWebhookLog outbound = DingTalkWebhookLog.builder()
                .factoryId(factoryId)
                .direction(Direction.OUTBOUND)
                .messageType(messageType)
                .dingtalkChatId(chatId)
                .dingtalkUserId(atUserId)
                .messageContent(content)
                .status(Status.PENDING)
                .build();
        outbound = logRepository.save(outbound);

        SendResult result = sendService.send(outbound);

        Map<String, Object> data = new HashMap<>();
        data.put("logId", outbound.getId());
        data.put("status", outbound.getStatus().name());
        data.put("sendResult", result.getKind().name());
        if (result.getReason() != null) data.put("reason", result.getReason());

        String message;
        switch (result.getKind()) {
            case SENT -> message = "消息已发送到钉钉群";
            case RATE_LIMITED -> message = "群消息超过限流 (20/min), 已排队待发";
            case NOT_CONFIGURED -> message = "钉钉出方向 webhook 未配置, 消息留待管理员处理";
            default -> message = "发送失败: " + result.getReason();
        }
        return buildSimpleResult(message, data);
    }
}
