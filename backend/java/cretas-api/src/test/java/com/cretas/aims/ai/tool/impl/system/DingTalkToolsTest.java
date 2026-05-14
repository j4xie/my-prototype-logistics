package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Direction;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import com.cretas.aims.repository.DingTalkWebhookLogRepository;
import com.cretas.aims.service.dingtalk.DingTalkSendService;
import com.cretas.aims.service.dingtalk.DingTalkSendService.SendResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for the two AIChat tools: dingtalk_send_message + dingtalk_alert_push.
 *
 * <p>Verifies: required-param validation, OUTBOUND log shape, sendService
 * called exactly once, status reported back to caller, alert severity prefix.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DingTalk AIChat Tools")
class DingTalkToolsTest {

    @Mock private DingTalkSendService sendService;
    @Mock private DingTalkWebhookLogRepository logRepository;

    @InjectMocks private DingTalkSendMessageTool sendTool;
    @InjectMocks private DingTalkAlertPushTool alertTool;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        // Wire ObjectMapper inherited from AbstractTool
        injectObjectMapper(sendTool);
        injectObjectMapper(alertTool);
        // lenient: NEED_MORE_INFO short-circuits before save, so not all tests reach save()
        lenient().when(logRepository.save(any(DingTalkWebhookLog.class))).thenAnswer(inv -> {
            DingTalkWebhookLog log = inv.getArgument(0);
            log.setId(42L);
            return log;
        });
    }

    private void injectObjectMapper(Object tool) {
        ReflectionTestUtils.setField(tool, "objectMapper", objectMapper);
    }

    private ToolCall toolCall(Map<String, Object> args) throws Exception {
        return ToolCall.of("test-call-id", "irrelevant",
                objectMapper.writeValueAsString(args));
    }

    private Map<String, Object> ctx(String factoryId) {
        Map<String, Object> c = new HashMap<>();
        c.put("factoryId", factoryId);
        c.put("userId", 42L);
        c.put("userRole", "factory_admin");
        return c;
    }

    @Test
    @DisplayName("send_message: missing chatId → NEED_MORE_INFO")
    void sendMessageRequiresChatId() throws Exception {
        Map<String, Object> args = new HashMap<>();
        args.put("content", "hello");

        String result = sendTool.execute(toolCall(args), ctx("F006"));

        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = objectMapper.readValue(result, Map.class);
        assertEquals("NEED_MORE_INFO", parsed.get("status"));
        verifyNoInteractions(sendService);
        verify(logRepository, never()).save(any());
    }

    @Test
    @DisplayName("send_message: happy path writes OUTBOUND PENDING and calls sendService")
    void sendMessageWritesLogAndDispatches() throws Exception {
        when(sendService.send(any())).thenReturn(SendResult.sent());
        Map<String, Object> args = new HashMap<>();
        args.put("chatId", "cid_GROUP_001");
        args.put("content", "今日生产任务: PO-001 牛肉 100kg");
        args.put("atUserId", "$:LWCP_v1:$STAFF_001");

        String result = sendTool.execute(toolCall(args), ctx("F006"));

        ArgumentCaptor<DingTalkWebhookLog> captor = ArgumentCaptor.forClass(DingTalkWebhookLog.class);
        verify(logRepository).save(captor.capture());
        DingTalkWebhookLog saved = captor.getValue();
        assertEquals(Direction.OUTBOUND, saved.getDirection());
        assertEquals(Status.PENDING, saved.getStatus());
        assertEquals("F006", saved.getFactoryId());
        assertEquals("cid_GROUP_001", saved.getDingtalkChatId());
        assertEquals("$:LWCP_v1:$STAFF_001", saved.getDingtalkUserId());
        assertEquals("今日生产任务: PO-001 牛肉 100kg", saved.getMessageContent());
        assertEquals("AI_REPLY", saved.getMessageType());
        verify(sendService, times(1)).send(any(DingTalkWebhookLog.class));

        // Shape: {success, data: {message, data: {logId, status, sendResult, ...}}}
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = objectMapper.readValue(result, Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> outerData = (Map<String, Object>) parsed.get("data");
        @SuppressWarnings("unchecked")
        Map<String, Object> innerData = (Map<String, Object>) outerData.get("data");
        assertEquals("SENT", innerData.get("sendResult"));
        assertEquals(42, ((Number) innerData.get("logId")).intValue());
    }

    @Test
    @DisplayName("send_message: rate-limited result surfaces back to caller")
    void sendMessageRateLimitedReported() throws Exception {
        when(sendService.send(any())).thenReturn(SendResult.rateLimited());
        Map<String, Object> args = new HashMap<>();
        args.put("chatId", "cid_GROUP_001");
        args.put("content", "x");

        String result = sendTool.execute(toolCall(args), ctx("F006"));
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = objectMapper.readValue(result, Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> outerData = (Map<String, Object>) parsed.get("data");
        assertTrue(((String) outerData.get("message")).contains("限流"));
    }

    @Test
    @DisplayName("alert_push: missing message → NEED_MORE_INFO")
    void alertRequiresMessage() throws Exception {
        Map<String, Object> args = new HashMap<>();
        args.put("chatId", "cid_GROUP_001");
        args.put("severity", "WARN");

        String result = alertTool.execute(toolCall(args), ctx("F006"));
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = objectMapper.readValue(result, Map.class);
        assertEquals("NEED_MORE_INFO", parsed.get("status"));
        verifyNoInteractions(sendService);
    }

    @Test
    @DisplayName("alert_push: CRITICAL prefix + source attribution in body")
    void alertPrependsCriticalPrefixAndSource() throws Exception {
        when(sendService.send(any())).thenReturn(SendResult.sent());
        Map<String, Object> args = new HashMap<>();
        args.put("chatId", "cid_GROUP_001");
        args.put("message", "牛肉库存低于警戒线");
        args.put("severity", "CRITICAL");
        args.put("source", "inventory-analysis");

        alertTool.execute(toolCall(args), ctx("F006"));

        ArgumentCaptor<DingTalkWebhookLog> captor = ArgumentCaptor.forClass(DingTalkWebhookLog.class);
        verify(logRepository).save(captor.capture());
        String body = captor.getValue().getMessageContent();
        assertTrue(body.startsWith("[CRITICAL] [inventory-analysis] "),
                "Expected severity+source prefix, got: " + body);
        assertEquals("ALERT_PUSH", captor.getValue().getMessageType());
    }

    @Test
    @DisplayName("alert_push: WARN is the default severity prefix")
    void alertDefaultsToWarn() throws Exception {
        when(sendService.send(any())).thenReturn(SendResult.sent());
        Map<String, Object> args = new HashMap<>();
        args.put("chatId", "cid_GROUP_001");
        args.put("message", "test");
        // no severity, no source

        alertTool.execute(toolCall(args), ctx("F006"));

        ArgumentCaptor<DingTalkWebhookLog> captor = ArgumentCaptor.forClass(DingTalkWebhookLog.class);
        verify(logRepository).save(captor.capture());
        assertTrue(captor.getValue().getMessageContent().startsWith("[WARN] "));
    }
}
