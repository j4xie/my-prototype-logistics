package com.cretas.aims.service.dingtalk;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * DingTalk Outgoing Webhook HMAC-SHA256 signature verifier.
 *
 * <p>Algorithm per DingTalk open docs:
 * <pre>
 *   stringToSign = timestamp + "\n" + appSecret
 *   sign         = Base64( HmacSHA256(appSecret, stringToSign) )
 * </pre>
 *
 * <p>The verifier rejects:
 * <ul>
 *   <li>Missing/blank timestamp or signature</li>
 *   <li>Timestamp drift &gt; {@link #MAX_TIMESTAMP_DRIFT_MS} (replay protection)</li>
 *   <li>Signature mismatch (constant-time comparison)</li>
 * </ul>
 *
 * <p>Fails closed when the appSecret is unset (env-var placeholder) — refuses
 * to verify rather than auto-accept. Operators must set
 * {@code DINGTALK_APP_SECRET} before the endpoint is reachable from DingTalk.
 */
@Slf4j
@Service
public class DingTalkSignatureService {

    /** 1-hour replay window. */
    static final long MAX_TIMESTAMP_DRIFT_MS = 60 * 60 * 1000L;

    private final String appSecret;

    public DingTalkSignatureService(
            @Value("${dingtalk.app-secret:}") String appSecret) {
        this.appSecret = appSecret == null ? "" : appSecret.trim();
        if (this.appSecret.isEmpty()) {
            log.warn("DingTalk appSecret is not configured (env DINGTALK_APP_SECRET). " +
                    "Inbound webhook will reject ALL requests until configured.");
        }
    }

    /**
     * @return true if signature is valid AND timestamp is within drift window.
     */
    public boolean verify(String timestamp, String receivedSign) {
        if (appSecret.isEmpty()) {
            log.warn("Rejecting DingTalk webhook: appSecret unset");
            return false;
        }
        if (timestamp == null || timestamp.isBlank() || receivedSign == null || receivedSign.isBlank()) {
            log.warn("Rejecting DingTalk webhook: missing timestamp or sign header");
            return false;
        }
        long tsMillis;
        try {
            tsMillis = Long.parseLong(timestamp.trim());
        } catch (NumberFormatException e) {
            log.warn("Rejecting DingTalk webhook: timestamp not numeric: {}", timestamp);
            return false;
        }
        long drift = Math.abs(System.currentTimeMillis() - tsMillis);
        if (drift > MAX_TIMESTAMP_DRIFT_MS) {
            log.warn("Rejecting DingTalk webhook: timestamp drift {}ms exceeds window {}ms",
                    drift, MAX_TIMESTAMP_DRIFT_MS);
            return false;
        }
        String expected = computeSign(timestamp);
        if (expected == null) return false;
        boolean ok = constantTimeEquals(expected, receivedSign.trim());
        if (!ok) {
            log.warn("Rejecting DingTalk webhook: signature mismatch (timestamp={})", timestamp);
        }
        return ok;
    }

    String computeSign(String timestamp) {
        try {
            String stringToSign = timestamp + "\n" + appSecret;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hmac = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hmac);
        } catch (Exception e) {
            log.error("HMAC SHA256 computation failed", e);
            return null;
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] aBytes = a.getBytes(StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(aBytes, bBytes);
    }
}
