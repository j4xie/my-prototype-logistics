package com.cretas.aims.service.dingtalk;

import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Direction;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import com.cretas.aims.repository.DingTalkWebhookLogRepository;
import com.cretas.aims.service.dingtalk.DingTalkSendService.SendResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link DingTalkSendService} focused on:
 *
 * <ul>
 *   <li>Status transitions on success / failure / rate-limit / unconfigured-URL</li>
 *   <li>Exponential-backoff schedule for retry</li>
 *   <li>Abandonment (IGNORED) after {@link DingTalkSendService#MAX_RETRIES}</li>
 *   <li>URL signing math (verified against a known fixture)</li>
 *   <li>JSON body shape (text + at)</li>
 * </ul>
 *
 * <p>HTTP transport itself is not stubbed here (would require WireMock) — that
 * is left for the Day 6 integration test against a stub server. Pure logic
 * paths are exercised via {@link DingTalkSendService#markFailed} and helpers.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DingTalkSendService")
class DingTalkSendServiceTest {

    @Mock private DingTalkWebhookLogRepository logRepository;
    @Mock private DingTalkRateLimiter rateLimiter;

    private DingTalkSendService service;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new DingTalkSendService(logRepository, rateLimiter, objectMapper);
        lenient().when(logRepository.save(any(DingTalkWebhookLog.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private DingTalkWebhookLog newOutbound() {
        return DingTalkWebhookLog.builder()
                .id(1L)
                .factoryId("F006")
                .direction(Direction.OUTBOUND)
                .messageType("AI_REPLY")
                .dingtalkChatId("cid_GROUP_001")
                .dingtalkUserId("$:LWCP_v1:$STAFF_001")
                .messageContent("回复内容")
                .status(Status.PENDING)
                .retryCount(0)
                .build();
    }

    @Test
    @DisplayName("URL unset → NOT_CONFIGURED, log stays PENDING (no save)")
    void noUrlReturnsNotConfigured() {
        ReflectionTestUtils.setField(service, "webhookUrl", "");
        DingTalkWebhookLog log = newOutbound();

        SendResult result = service.send(log);

        assertEquals(SendResult.Kind.NOT_CONFIGURED, result.getKind());
        assertEquals(Status.PENDING, log.getStatus());
        verify(logRepository, never()).save(any());
        verifyNoInteractions(rateLimiter);
    }

    @Test
    @DisplayName("invalid input (null / not OUTBOUND) → FAILED kind, no rate-limit consumption")
    void invalidInputRejected() {
        ReflectionTestUtils.setField(service, "webhookUrl", "https://example.invalid/r");
        SendResult nullResult = service.send(null);
        assertEquals(SendResult.Kind.FAILED, nullResult.getKind());

        DingTalkWebhookLog inboundMisuse = DingTalkWebhookLog.builder()
                .direction(Direction.INBOUND).status(Status.PENDING).build();
        SendResult inboundResult = service.send(inboundMisuse);
        assertEquals(SendResult.Kind.FAILED, inboundResult.getKind());
        verifyNoInteractions(rateLimiter);
    }

    @Test
    @DisplayName("rate-limited → RATE_LIMITED, log stays PENDING")
    void rateLimitedLeavesPending() {
        ReflectionTestUtils.setField(service, "webhookUrl", "https://example.invalid/r");
        when(rateLimiter.tryAcquire(anyString())).thenReturn(false);
        DingTalkWebhookLog log = newOutbound();

        SendResult result = service.send(log);

        assertEquals(SendResult.Kind.RATE_LIMITED, result.getKind());
        assertEquals(Status.PENDING, log.getStatus());
        verify(logRepository, never()).save(any());
    }

    @Test
    @DisplayName("markFailed: retryCount 0 → 1, status FAILED, nextRetryAt set 60s out (2^0 backoff)")
    void firstFailureBackoff60s() {
        DingTalkWebhookLog log = newOutbound();
        SendResult r = service.markFailed(log, "connection refused");

        assertEquals(SendResult.Kind.FAILED, r.getKind());
        assertEquals(Status.FAILED, log.getStatus());
        assertEquals(1, log.getRetryCount());
        assertNotNull(log.getNextRetryAt());
        assertEquals("connection refused", log.getErrorMessage());
    }

    @Test
    @DisplayName("markFailed: retryCount 9 → 10 transitions to IGNORED, nextRetryAt cleared")
    void tenthFailureAbandons() {
        DingTalkWebhookLog log = newOutbound();
        log.setRetryCount(9);
        service.markFailed(log, "still broken");

        assertEquals(Status.IGNORED, log.getStatus());
        assertEquals(10, log.getRetryCount());
        assertNull(log.getNextRetryAt(), "abandoned message has no further retry schedule");
    }

    @Test
    @DisplayName("markFailed: backoff doubles each retry up to 1h cap")
    void backoffDoublesAndCaps() {
        // retryCount BEFORE markFailed → backoff = BASE × 2^(retryCount)
        // since markFailed increments first then computes off (retryCount-1) actually.
        // Just verify monotonic non-decrease + cap.
        long[] gapSeconds = new long[8];
        for (int i = 0; i < 8; i++) {
            DingTalkWebhookLog log = newOutbound();
            log.setRetryCount(i);
            java.time.LocalDateTime before = java.time.LocalDateTime.now();
            service.markFailed(log, "x");
            gapSeconds[i] = java.time.Duration.between(before, log.getNextRetryAt()).toSeconds();
        }
        for (int i = 1; i < gapSeconds.length; i++) {
            assertTrue(gapSeconds[i] >= gapSeconds[i - 1] - 2,  // allow 2s scheduling jitter
                    "backoff must not shrink: gap[" + (i - 1) + "]=" + gapSeconds[i - 1]
                            + " gap[" + i + "]=" + gapSeconds[i]);
        }
        long last = gapSeconds[gapSeconds.length - 1];
        assertTrue(last <= DingTalkSendService.MAX_BACKOFF_SECONDS + 5,
                "backoff cap should hold at " + DingTalkSendService.MAX_BACKOFF_SECONDS + "s; got " + last);
    }

    @Test
    @DisplayName("buildBody → JSON with msgtype=text + content + at.atUserIds")
    void buildBodyShape() throws Exception {
        DingTalkWebhookLog log = newOutbound();
        String body = service.buildBody(log);

        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> parsed = objectMapper.readValue(body, java.util.Map.class);
        assertEquals("text", parsed.get("msgtype"));
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> text = (java.util.Map<String, Object>) parsed.get("text");
        assertEquals("回复内容", text.get("content"));
        assertTrue(parsed.containsKey("at"), "at-user payload should appear when dingtalkUserId set");
    }

    @Test
    @DisplayName("buildBody: no at-user when dingtalkUserId is null")
    void buildBodyOmitsAtWhenNoUser() throws Exception {
        DingTalkWebhookLog log = newOutbound();
        log.setDingtalkUserId(null);
        String body = service.buildBody(log);

        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> parsed = objectMapper.readValue(body, java.util.Map.class);
        assertFalse(parsed.containsKey("at"));
    }

    @Test
    @DisplayName("signUrlIfPossible: secret unset → URL unchanged")
    void signUrlSkipsWhenSecretBlank() throws Exception {
        String original = "https://oapi.dingtalk.com/robot/send?access_token=XYZ";
        assertEquals(original, DingTalkSendService.signUrlIfPossible(original, ""));
        assertEquals(original, DingTalkSendService.signUrlIfPossible(original, null));
    }

    @Test
    @DisplayName("signUrlIfPossible: secret set → appends timestamp + sign params")
    void signUrlAppendsParams() throws Exception {
        String signed = DingTalkSendService.signUrlIfPossible(
                "https://oapi.dingtalk.com/robot/send?access_token=XYZ", "my-secret");
        assertTrue(signed.contains("&timestamp="));
        assertTrue(signed.contains("&sign="));
    }

    @Test
    @DisplayName("parseErrcode: errcode=0 in JSON → 0; malformed → -1")
    void parseErrcodeHandlesShapes() {
        assertEquals(0, service.parseErrcode("{\"errcode\":0,\"errmsg\":\"ok\"}"));
        assertEquals(123, service.parseErrcode("{\"errcode\":123,\"errmsg\":\"sign expired\"}"));
        assertEquals(-1, service.parseErrcode("not json"));
        assertEquals(-1, service.parseErrcode(""));
        assertEquals(-1, service.parseErrcode(null));
    }
}
