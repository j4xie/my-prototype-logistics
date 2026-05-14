package com.cretas.aims.controller.integration;

import com.cretas.aims.dto.dingtalk.DingTalkInboundPayload;
import com.cretas.aims.service.dingtalk.DingTalkInboundQueue;
import com.cretas.aims.service.dingtalk.DingTalkSignatureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * DingTalk Outgoing Webhook inbound endpoint.
 *
 * <p>路径 {@code /api/dingtalk/webhook/**} 不在 {@code JwtAuthInterceptor} 的
 * 拦截 path-pattern (`/api/mobile/**` / `/api/platform/**` / `/api/admin/**` /
 * `/api/internal/**`) 内, 故公开. 实际访问控制由 HMAC SHA256 签名校验完成.
 *
 * <p>处理流程:
 * <ol>
 *   <li>从 header {@code timestamp} / {@code sign} 取出钉钉签名</li>
 *   <li>用 appSecret 计算期望签名并校验 (含 1h 重放窗口)</li>
 *   <li>校验通过 → LPUSH payload 到 Redis 队列 → 立即返回 200</li>
 *   <li>异步消费 ({@code DingTalkInboundConsumer} Day 3) 路由到 AIIntentService</li>
 * </ol>
 *
 * <p>3s ack 上限: 此端点必须在 3s 内返回 200, 否则钉钉会重试. 因此 AIChat 调用
 * 走异步队列, 不在 request thread 内执行.
 */
@Slf4j
@RestController
@RequestMapping("/api/dingtalk/webhook")
@RequiredArgsConstructor
public class DingTalkWebhookController {

    private final DingTalkSignatureService signatureService;
    private final DingTalkInboundQueue inboundQueue;

    @PostMapping("/inbound")
    public ResponseEntity<Map<String, Object>> inbound(
            @RequestHeader(value = "timestamp", required = false) String timestamp,
            @RequestHeader(value = "sign", required = false) String sign,
            @RequestParam(value = "factoryId", required = false) String factoryId,
            @RequestBody DingTalkInboundPayload payload) {

        if (!signatureService.verify(timestamp, sign)) {
            log.warn("DingTalk inbound rejected: signature invalid (msgId={}, senderId={})",
                    payload != null ? payload.getMsgId() : null,
                    payload != null ? payload.getSenderId() : null);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "errcode", 401,
                    "errmsg", "signature verification failed"
            ));
        }

        if (payload == null || payload.getMsgId() == null || payload.getMsgId().isBlank()) {
            log.warn("DingTalk inbound rejected: missing msgId");
            return ResponseEntity.badRequest().body(Map.of(
                    "errcode", 400,
                    "errmsg", "msgId is required"
            ));
        }

        boolean enqueued = inboundQueue.enqueue(factoryId, payload);
        if (!enqueued) {
            log.error("DingTalk inbound enqueue failed: msgId={}", payload.getMsgId());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "errcode", 503,
                    "errmsg", "queue temporarily unavailable, please retry"
            ));
        }

        log.info("DingTalk inbound accepted: msgId={} senderNick={} content-len={} factoryId={}",
                payload.getMsgId(),
                payload.getSenderNick(),
                payload.getText() != null && payload.getText().getContent() != null
                        ? payload.getText().getContent().length() : 0,
                factoryId);

        // Ack quickly per 3s deadline; actual reply goes via async consumer + outbound webhook.
        return ResponseEntity.ok(Map.of(
                "errcode", 0,
                "errmsg", "ok"
        ));
    }
}
