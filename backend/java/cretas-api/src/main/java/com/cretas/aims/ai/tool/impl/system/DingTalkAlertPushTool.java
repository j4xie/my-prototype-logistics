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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AIChat tool: push an alert to a DingTalk group, prefixed with a severity
 * marker so on-call sees it at a glance.
 *
 * <p>Intent code: {@code DINGTALK_ALERT_PUSH}.
 *
 * <p>Intended consumer: {@code AIInsightCard} pipeline + threshold-breach
 * Skills (inventory-analysis, equipment-diagnosis, quality-inspection)
 * forwarding warnings to operators.
 *
 * <p>Required: {@code chatId}, {@code message}.
 * <p>Optional: {@code severity} (INFO/WARN/CRITICAL, default WARN),
 *              {@code source} (which Skill/Tool raised it).
 */
@Slf4j
@Component
public class DingTalkAlertPushTool extends AbstractBusinessTool {

    @Autowired private DingTalkSendService sendService;
    @Autowired private DingTalkWebhookLogRepository logRepository;

    @Override
    public String getToolName() {
        return "dingtalk_alert_push";
    }

    @Override
    public String getDescription() {
        return "向钉钉群推送告警消息 (含严重级别前缀)。" +
                "适用场景: 库存告警 / 设备故障 / 质检异常 / 财务异常自动通知 on-call。" +
                "Intent: DINGTALK_ALERT_PUSH";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> chatId = new HashMap<>();
        chatId.put("type", "string");
        chatId.put("description", "钉钉群 conversation id");
        properties.put("chatId", chatId);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "string");
        message.put("description", "告警内容 (人类可读, ≤500字)");
        properties.put("message", message);

        Map<String, Object> severity = new HashMap<>();
        severity.put("type", "string");
        severity.put("description", "严重级别");
        severity.put("enum", List.of("INFO", "WARN", "CRITICAL"));
        severity.put("default", "WARN");
        properties.put("severity", severity);

        Map<String, Object> source = new HashMap<>();
        source.put("type", "string");
        source.put("description", "告警来源 (Skill/Tool 名)");
        properties.put("source", source);

        schema.put("properties", properties);
        schema.put("required", List.of("chatId", "message"));
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("chatId", "message");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params,
                                            Map<String, Object> context) {
        String chatId = getString(params, "chatId");
        String message = getString(params, "message");
        String severity = getString(params, "severity", "WARN");
        String source = getString(params, "source");

        String prefix = switch (severity == null ? "WARN" : severity.toUpperCase()) {
            case "INFO" -> "[INFO] ";
            case "CRITICAL" -> "[CRITICAL] ";
            default -> "[WARN] ";
        };
        String body = prefix + (source != null && !source.isBlank() ? "[" + source + "] " : "") + message;

        DingTalkWebhookLog outbound = DingTalkWebhookLog.builder()
                .factoryId(factoryId)
                .direction(Direction.OUTBOUND)
                .messageType("ALERT_PUSH")
                .dingtalkChatId(chatId)
                .messageContent(body)
                .status(Status.PENDING)
                .build();
        outbound = logRepository.save(outbound);

        SendResult result = sendService.send(outbound);

        Map<String, Object> data = new HashMap<>();
        data.put("logId", outbound.getId());
        data.put("status", outbound.getStatus().name());
        data.put("sendResult", result.getKind().name());
        data.put("severity", severity);
        if (result.getReason() != null) data.put("reason", result.getReason());

        String msg = switch (result.getKind()) {
            case SENT -> "告警已推送到钉钉群 (" + severity + ")";
            case RATE_LIMITED -> "告警超过限流, 已排队";
            case NOT_CONFIGURED -> "钉钉出方向 webhook 未配置";
            case FAILED -> "推送失败: " + result.getReason();
        };
        return buildSimpleResult(msg, data);
    }
}
