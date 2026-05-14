package com.cretas.aims.service.dingtalk;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link DingTalkSignatureService}: HMAC-SHA256 verification +
 * timestamp drift window + fail-closed when appSecret is unset.
 */
@DisplayName("DingTalkSignatureService — HMAC verification")
class DingTalkSignatureServiceTest {

    private static final String SECRET = "test-app-secret-1234567890";

    @Test
    @DisplayName("valid timestamp + matching signature → true")
    void validSignaturePasses() {
        DingTalkSignatureService svc = new DingTalkSignatureService(SECRET);
        String timestamp = String.valueOf(System.currentTimeMillis());
        String sign = svc.computeSign(timestamp);
        assertNotNull(sign);
        assertTrue(svc.verify(timestamp, sign));
    }

    @Test
    @DisplayName("wrong signature → false")
    void wrongSignatureFails() {
        DingTalkSignatureService svc = new DingTalkSignatureService(SECRET);
        String timestamp = String.valueOf(System.currentTimeMillis());
        assertFalse(svc.verify(timestamp, "NOT_THE_REAL_SIGNATURE_AAAAAAAAAA"));
    }

    @Test
    @DisplayName("missing timestamp → false")
    void missingTimestampFails() {
        DingTalkSignatureService svc = new DingTalkSignatureService(SECRET);
        assertFalse(svc.verify(null, "anything"));
        assertFalse(svc.verify("", "anything"));
        assertFalse(svc.verify("   ", "anything"));
    }

    @Test
    @DisplayName("missing signature → false")
    void missingSignatureFails() {
        DingTalkSignatureService svc = new DingTalkSignatureService(SECRET);
        String timestamp = String.valueOf(System.currentTimeMillis());
        assertFalse(svc.verify(timestamp, null));
        assertFalse(svc.verify(timestamp, ""));
        assertFalse(svc.verify(timestamp, "   "));
    }

    @Test
    @DisplayName("non-numeric timestamp → false")
    void nonNumericTimestampFails() {
        DingTalkSignatureService svc = new DingTalkSignatureService(SECRET);
        assertFalse(svc.verify("not-a-number", "irrelevant"));
    }

    @Test
    @DisplayName("stale timestamp (>1h in past) → false")
    void staleTimestampFails() {
        DingTalkSignatureService svc = new DingTalkSignatureService(SECRET);
        long stale = System.currentTimeMillis() - 2 * DingTalkSignatureService.MAX_TIMESTAMP_DRIFT_MS;
        String timestamp = String.valueOf(stale);
        String sign = svc.computeSign(timestamp);
        assertFalse(svc.verify(timestamp, sign));
    }

    @Test
    @DisplayName("future timestamp (>1h ahead) → false")
    void futureTimestampFails() {
        DingTalkSignatureService svc = new DingTalkSignatureService(SECRET);
        long future = System.currentTimeMillis() + 2 * DingTalkSignatureService.MAX_TIMESTAMP_DRIFT_MS;
        String timestamp = String.valueOf(future);
        String sign = svc.computeSign(timestamp);
        assertFalse(svc.verify(timestamp, sign));
    }

    @Test
    @DisplayName("appSecret unset → verify always returns false (fails closed)")
    void unconfiguredSecretFailsClosed() {
        DingTalkSignatureService svc = new DingTalkSignatureService("");
        String timestamp = String.valueOf(System.currentTimeMillis());
        // Even with a signature that would be valid against another secret,
        // unset appSecret must refuse.
        assertFalse(svc.verify(timestamp, "anything"));
    }

    @Test
    @DisplayName("appSecret whitespace-only → treated as unset")
    void whitespaceOnlySecretFailsClosed() {
        DingTalkSignatureService svc = new DingTalkSignatureService("   ");
        String timestamp = String.valueOf(System.currentTimeMillis());
        assertFalse(svc.verify(timestamp, "anything"));
    }

    @Test
    @DisplayName("computeSign returns Base64 of HmacSHA256 — deterministic")
    void computeSignDeterministic() {
        DingTalkSignatureService svc = new DingTalkSignatureService(SECRET);
        String timestamp = "1715722800000";
        String a = svc.computeSign(timestamp);
        String b = svc.computeSign(timestamp);
        assertEquals(a, b, "Same timestamp + secret must yield identical signature");
        assertNotNull(a);
        assertTrue(a.length() > 20, "Base64-encoded HMAC-SHA256 should be ~44 chars");
    }
}
