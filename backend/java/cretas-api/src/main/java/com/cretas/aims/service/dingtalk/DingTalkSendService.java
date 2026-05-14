package com.cretas.aims.service.dingtalk;

import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import com.cretas.aims.repository.DingTalkWebhookLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * Posts a {@link DingTalkWebhookLog} (direction=OUTBOUND, status=PENDING) to
 * the DingTalk group robot webhook URL.
 *
 * <p>Mutates the log entity in-place:
 * <ul>
 *   <li>{@code SENT} on HTTP 200 + DingTalk {@code errcode=0}</li>
 *   <li>{@code FAILED} otherwise + {@code retryCount++} + {@code nextRetryAt}
 *       set per exponential backoff (60s × 2^retryCount, capped at 1h)</li>
 *   <li>Once retryCount reaches 10, status flips to {@code IGNORED}
 *       (DB constraint also caps at 10)</li>
 * </ul>
 *
 * <p>Rate limit: defers to {@link DingTalkRateLimiter} (20/min per chat).
 * When throttled, the log stays {@code PENDING} so the retry scheduler picks
 * it up later — no immediate {@code FAILED} transition.
 *
 * <p>URL signing: when {@code DINGTALK_OUTBOUND_WEBHOOK_SECRET} is set, the
 * URL is augmented with {@code &timestamp=...&sign=...} per DingTalk custom-
 * robot signature spec. Unset secret skips signing (DingTalk's optional mode).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DingTalkSendService {

    static final int MAX_RETRIES = 10;
    static final long BASE_BACKOFF_SECONDS = 60L;
    static final long MAX_BACKOFF_SECONDS = 3600L;
    static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);

    private final DingTalkWebhookLogRepository logRepository;
    private final DingTalkRateLimiter rateLimiter;
    private final ObjectMapper objectMapper;

    @Value("${dingtalk.outbound-webhook-url:}")
    private String webhookUrl;

    @Value("${dingtalk.outbound-webhook-secret:}")
    private String webhookSecret;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(HTTP_TIMEOUT)
            .build();

    /**
     * @return SendResult indicating SENT / RATE_LIMITED / FAILED / NOT_CONFIGURED.
     */
    public SendResult send(DingTalkWebhookLog outboundLog) {
        if (outboundLog == null || outboundLog.getDirection() != DingTalkWebhookLog.Direction.OUTBOUND) {
            return SendResult.fail("invalid outbound log");
        }
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.warn("DingTalk outbound webhook URL not configured; leaving log PENDING (id={})",
                    outboundLog.getId());
            return SendResult.notConfigured();
        }

        String chatId = outboundLog.getDingtalkChatId();
        if (!rateLimiter.tryAcquire(chatId)) {
            log.info("Outbound throttled (chat={}, log id={}); retry scheduler will pick up later",
                    chatId, outboundLog.getId());
            return SendResult.rateLimited();
        }

        try {
            String body = buildBody(outboundLog);
            String url = signUrlIfPossible(webhookUrl, webhookSecret);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(HTTP_TIMEOUT)
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            int errcode = parseErrcode(response.body());
            if (response.statusCode() == 200 && errcode == 0) {
                outboundLog.setStatus(Status.SENT);
                outboundLog.setDeliveredAt(LocalDateTime.now());
                outboundLog.setErrorMessage(null);
                logRepository.save(outboundLog);
                log.info("DingTalk outbound sent: logId={} chatId={} bytes={}",
                        outboundLog.getId(), chatId, body.length());
                return SendResult.sent();
            }
            return markFailed(outboundLog,
                    "HTTP " + response.statusCode() + " errcode=" + errcode + " body=" + truncate(response.body(), 200));
        } catch (Exception e) {
            log.warn("DingTalk outbound POST failed: logId={}, err={}", outboundLog.getId(), e.getMessage());
            return markFailed(outboundLog, "post failed: " + e.getMessage());
        }
    }

    SendResult markFailed(DingTalkWebhookLog outboundLog, String errorMessage) {
        int retryCount = outboundLog.getRetryCount() == null ? 0 : outboundLog.getRetryCount();
        retryCount += 1;
        outboundLog.setRetryCount(Math.min(retryCount, MAX_RETRIES));
        outboundLog.setErrorMessage(truncate(errorMessage, 2000));

        if (retryCount >= MAX_RETRIES) {
            outboundLog.setStatus(Status.IGNORED);
            outboundLog.setNextRetryAt(null);
            log.warn("DingTalk outbound abandoned after {} retries: logId={} err={}",
                    MAX_RETRIES, outboundLog.getId(), errorMessage);
        } else {
            outboundLog.setStatus(Status.FAILED);
            long backoff = Math.min(BASE_BACKOFF_SECONDS << Math.min(retryCount - 1, 6),
                    MAX_BACKOFF_SECONDS);
            outboundLog.setNextRetryAt(LocalDateTime.now().plusSeconds(backoff));
        }
        logRepository.save(outboundLog);
        return SendResult.fail(errorMessage);
    }

    String buildBody(DingTalkWebhookLog outboundLog) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("msgtype", "text");
        Map<String, String> text = new HashMap<>();
        text.put("content", outboundLog.getMessageContent() != null ? outboundLog.getMessageContent() : "");
        body.put("text", text);
        if (outboundLog.getDingtalkUserId() != null && !outboundLog.getDingtalkUserId().isBlank()) {
            Map<String, Object> at = new HashMap<>();
            at.put("atUserIds", new String[] { outboundLog.getDingtalkUserId() });
            body.put("at", at);
        }
        return objectMapper.writeValueAsString(body);
    }

    static String signUrlIfPossible(String baseUrl, String secret) throws Exception {
        if (secret == null || secret.isBlank()) return baseUrl;
        long timestamp = System.currentTimeMillis();
        String stringToSign = timestamp + "\n" + secret;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String sign = URLEncoder.encode(
                Base64.getEncoder().encodeToString(mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8))),
                StandardCharsets.UTF_8);
        char joiner = baseUrl.contains("?") ? '&' : '?';
        return baseUrl + joiner + "timestamp=" + timestamp + "&sign=" + sign;
    }

    int parseErrcode(String body) {
        if (body == null || body.isBlank()) return -1;
        try {
            Map<?, ?> parsed = objectMapper.readValue(body, Map.class);
            Object code = parsed.get("errcode");
            if (code instanceof Number) return ((Number) code).intValue();
            return -1;
        } catch (Exception e) {
            return -1;
        }
    }

    private static String truncate(String s, int n) {
        if (s == null) return null;
        return s.length() <= n ? s : s.substring(0, n);
    }

    /** Outcome of a single send attempt. Used for both inline + scheduled paths. */
    public static class SendResult {
        public enum Kind { SENT, RATE_LIMITED, FAILED, NOT_CONFIGURED }
        private final Kind kind;
        private final String reason;
        private SendResult(Kind kind, String reason) { this.kind = kind; this.reason = reason; }
        public static SendResult sent() { return new SendResult(Kind.SENT, null); }
        public static SendResult rateLimited() { return new SendResult(Kind.RATE_LIMITED, "rate limit hit"); }
        public static SendResult fail(String reason) { return new SendResult(Kind.FAILED, reason); }
        public static SendResult notConfigured() { return new SendResult(Kind.NOT_CONFIGURED, "webhook url unset"); }
        public Kind getKind() { return kind; }
        public String getReason() { return reason; }
        public boolean isSent() { return kind == Kind.SENT; }
    }
}
