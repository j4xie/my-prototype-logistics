package com.cretas.aims.service.dingtalk;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.dingtalk.DingTalkInboundPayload;
import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Direction;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import com.cretas.aims.repository.DingTalkUserBindingRepository;
import com.cretas.aims.repository.DingTalkUserBindingRepository.DingTalkBoundUser;
import com.cretas.aims.repository.DingTalkWebhookLogRepository;
import com.cretas.aims.service.IntentExecutorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Polls the DingTalk inbound Redis queue and routes each message to the
 * AIChat intent executor (non-streaming).
 *
 * <p>Two outputs per inbound message:
 * <ol>
 *   <li>One INBOUND row written for audit/dedup</li>
 *   <li>One OUTBOUND row written with {@code status=PENDING}; the Day 4
 *       outbound sender (DingTalkSendService) consumes PENDING rows and
 *       posts to DingTalk's webhook URL</li>
 * </ol>
 *
 * <p>Dedup: messages with a previously-seen {@code dingtalkMessageId} are
 * dropped silently. DingTalk retries when its 3s ack window expires, so
 * dedup is required.
 *
 * <p>User resolution: looks up Cretas user via {@code users.dingtalk_user_id}.
 * Unbound senders get a polite "please ask admin to bind your account" reply
 * (still written as OUTBOUND so the Day 4 sender ships it).
 *
 * <p>Scope: PoC. Processes up to {@link #BATCH_PER_TICK} messages per tick.
 * Single-factory in this PoC iteration (env {@code DINGTALK_DEFAULT_FACTORY_ID},
 * default {@code F006}); multi-tenant queue selection deferred to Phase 2.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DingTalkInboundConsumer {

    static final int BATCH_PER_TICK = 10;
    static final String AI_REPLY_TYPE = "AI_REPLY";
    static final String UNBOUND_USER_REPLY =
            "您的钉钉账号尚未绑定 Cretas 账号, 请联系管理员完成绑定后再试";

    private final DingTalkInboundQueue inboundQueue;
    private final DingTalkWebhookLogRepository logRepository;
    private final DingTalkUserBindingRepository userBindingRepository;
    private final IntentExecutorService intentExecutorService;
    private final DingTalkResponseFormatter responseFormatter;
    private final DingTalkSendService sendService;

    @Value("${dingtalk.default-factory-id:F006}")
    private String defaultFactoryId;

    @Scheduled(fixedDelayString = "${dingtalk.inbound-poll-ms:5000}")
    public void consumeBatch() {
        for (int i = 0; i < BATCH_PER_TICK; i++) {
            Optional<DingTalkInboundPayload> opt = inboundQueue.dequeue(defaultFactoryId);
            if (opt.isEmpty()) return;
            try {
                processOne(opt.get(), defaultFactoryId);
            } catch (Exception e) {
                log.error("DingTalkInboundConsumer.processOne unexpected failure: msgId={}",
                        opt.get().getMsgId(), e);
            }
        }
    }

    void processOne(DingTalkInboundPayload payload, String factoryId) {
        String msgId = payload.getMsgId();
        if (logRepository.findByDingtalkMessageId(msgId).isPresent()) {
            log.debug("Dropping duplicate DingTalk inbound: msgId={}", msgId);
            return;
        }

        String userInput = payload.getText() != null ? payload.getText().getContent() : null;
        DingTalkWebhookLog inbound = DingTalkWebhookLog.builder()
                .factoryId(factoryId)
                .direction(Direction.INBOUND)
                .messageType(payload.getMsgtype() != null ? payload.getMsgtype().toUpperCase() : "TEXT")
                .dingtalkCorpId(payload.getSenderCorpId())
                .dingtalkChatId(payload.getConversationId())
                .dingtalkUserId(payload.getSenderId())
                .dingtalkUserName(payload.getSenderNick())
                .dingtalkMessageId(msgId)
                .messageContent(userInput != null ? userInput : "")
                .messagePayload(buildPayloadMap(payload))
                .status(Status.PENDING)
                .build();
        inbound = logRepository.save(inbound);

        if (userInput == null || userInput.isBlank()) {
            log.info("Ignoring DingTalk inbound with no text content: msgId={}", msgId);
            inbound.setStatus(Status.IGNORED);
            inbound.setErrorMessage("empty text content");
            logRepository.save(inbound);
            return;
        }

        Optional<DingTalkBoundUser> bound = userBindingRepository.findBoundUser(payload.getSenderId());
        if (bound.isEmpty()) {
            log.info("DingTalk sender not bound to Cretas user: senderId={} msgId={}",
                    payload.getSenderId(), msgId);
            inbound.setStatus(Status.FAILED);
            inbound.setErrorMessage("dingtalk_user_id not bound to any Cretas user");
            logRepository.save(inbound);
            writeOutboundReply(inbound, factoryId, UNBOUND_USER_REPLY, null, null);
            return;
        }

        DingTalkBoundUser user = bound.get();
        String resolvedFactoryId = user.getFactoryId() != null ? user.getFactoryId() : factoryId;

        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput(userInput)
                .sessionId(payload.getConversationId())
                .build();

        IntentExecuteResponse response;
        try {
            response = intentExecutorService.execute(
                    resolvedFactoryId, request, user.getUserId(), user.getRoleCode());
        } catch (Exception e) {
            log.error("IntentExecutorService.execute failed: msgId={} userId={}",
                    msgId, user.getUserId(), e);
            inbound.setStatus(Status.FAILED);
            inbound.setErrorMessage("AI 执行异常: " + e.getMessage());
            logRepository.save(inbound);
            writeOutboundReply(inbound, resolvedFactoryId,
                    "AI 服务暂时不可用, 请稍后再试", null, user.getUserId());
            return;
        }

        inbound.setStatus(Status.DELIVERED);
        inbound.setDeliveredAt(LocalDateTime.now());
        inbound.setUserId(user.getUserId());
        inbound.setIntentCode(response != null ? response.getIntentCode() : null);
        logRepository.save(inbound);

        String reply = responseFormatter.format(response);
        writeOutboundReply(inbound, resolvedFactoryId, reply,
                response != null ? response.getIntentCode() : null, user.getUserId());
    }

    private void writeOutboundReply(DingTalkWebhookLog inbound, String factoryId,
                                    String replyText, String intentCode, Long userId) {
        DingTalkWebhookLog outbound = DingTalkWebhookLog.builder()
                .factoryId(factoryId)
                .direction(Direction.OUTBOUND)
                .messageType(AI_REPLY_TYPE)
                .dingtalkCorpId(inbound.getDingtalkCorpId())
                .dingtalkChatId(inbound.getDingtalkChatId())
                .dingtalkUserId(inbound.getDingtalkUserId())
                .dingtalkUserName(inbound.getDingtalkUserName())
                .messageContent(replyText)
                .userId(userId)
                .intentCode(intentCode)
                .sessionId(inbound.getDingtalkChatId())
                .status(Status.PENDING)
                .build();
        outbound = logRepository.save(outbound);
        // Dispatch inline (Day 4). Send-side status transitions written back inside send().
        sendService.send(outbound);
    }

    private Map<String, Object> buildPayloadMap(DingTalkInboundPayload payload) {
        Map<String, Object> map = new HashMap<>();
        map.put("msgtype", payload.getMsgtype());
        map.put("conversationType", payload.getConversationType());
        map.put("conversationTitle", payload.getConversationTitle());
        map.put("createAt", payload.getCreateAt());
        if (payload.getAtUsers() != null) map.put("atUsers", payload.getAtUsers());
        if (payload.getExtra() != null) map.put("extra", payload.getExtra());
        return map;
    }
}
