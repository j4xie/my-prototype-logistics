package com.cretas.aims.controller.integration;

import com.cretas.aims.dto.dingtalk.DingTalkInboundPayload;
import com.cretas.aims.service.dingtalk.DingTalkInboundQueue;
import com.cretas.aims.service.dingtalk.DingTalkSignatureService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link DingTalkWebhookController}: signature gate, msgId
 * validation, enqueue failure → 503, happy-path → 200.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DingTalkWebhookController.inbound")
class DingTalkWebhookControllerTest {

    @Mock private DingTalkSignatureService signatureService;
    @Mock private DingTalkInboundQueue inboundQueue;

    @InjectMocks private DingTalkWebhookController controller;

    private DingTalkInboundPayload payload;

    @BeforeEach
    void setUp() {
        payload = DingTalkInboundPayload.builder()
                .msgtype("text")
                .text(DingTalkInboundPayload.TextBody.builder().content("查询今天的生产任务").build())
                .msgId("msg_1234567890")
                .senderId("$:LWCP_v1:$XXXX")
                .senderNick("张三")
                .senderCorpId("ding_corp_001")
                .conversationId("cidXXXXX==")
                .build();
    }

    @Test
    @DisplayName("valid signature + valid payload → 200 + enqueued")
    void happyPathReturns200() {
        when(signatureService.verify("ts", "sign")).thenReturn(true);
        when(inboundQueue.enqueue(eq("F006"), any(DingTalkInboundPayload.class))).thenReturn(true);

        ResponseEntity<Map<String, Object>> resp = controller.inbound("ts", "sign", "F006", payload);

        assertEquals(200, resp.getStatusCode().value());
        assertEquals(0, resp.getBody().get("errcode"));
        verify(inboundQueue).enqueue(eq("F006"), eq(payload));
    }

    @Test
    @DisplayName("signature verification fails → 401, never enqueues")
    void invalidSignatureReturns401() {
        when(signatureService.verify("ts", "bad-sign")).thenReturn(false);

        ResponseEntity<Map<String, Object>> resp = controller.inbound("ts", "bad-sign", "F006", payload);

        assertEquals(401, resp.getStatusCode().value());
        assertEquals(401, resp.getBody().get("errcode"));
        verifyNoInteractions(inboundQueue);
    }

    @Test
    @DisplayName("missing msgId in payload → 400")
    void missingMsgIdReturns400() {
        when(signatureService.verify(any(), any())).thenReturn(true);
        payload.setMsgId(null);

        ResponseEntity<Map<String, Object>> resp = controller.inbound("ts", "sign", "F006", payload);

        assertEquals(400, resp.getStatusCode().value());
        verifyNoInteractions(inboundQueue);
    }

    @Test
    @DisplayName("blank msgId in payload → 400")
    void blankMsgIdReturns400() {
        when(signatureService.verify(any(), any())).thenReturn(true);
        payload.setMsgId("   ");

        ResponseEntity<Map<String, Object>> resp = controller.inbound("ts", "sign", "F006", payload);

        assertEquals(400, resp.getStatusCode().value());
        verifyNoInteractions(inboundQueue);
    }

    @Test
    @DisplayName("queue enqueue fails → 503")
    void enqueueFailReturns503() {
        when(signatureService.verify(any(), any())).thenReturn(true);
        when(inboundQueue.enqueue(eq("F006"), any(DingTalkInboundPayload.class))).thenReturn(false);

        ResponseEntity<Map<String, Object>> resp = controller.inbound("ts", "sign", "F006", payload);

        assertEquals(503, resp.getStatusCode().value());
    }

    @Test
    @DisplayName("null factoryId param → routes to global queue")
    void nullFactoryIdAccepted() {
        when(signatureService.verify(any(), any())).thenReturn(true);
        when(inboundQueue.enqueue(eq(null), any(DingTalkInboundPayload.class))).thenReturn(true);

        ResponseEntity<Map<String, Object>> resp = controller.inbound("ts", "sign", null, payload);

        assertEquals(200, resp.getStatusCode().value());
        verify(inboundQueue).enqueue(eq(null), eq(payload));
    }
}
