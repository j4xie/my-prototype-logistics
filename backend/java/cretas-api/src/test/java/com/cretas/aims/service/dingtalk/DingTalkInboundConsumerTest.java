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
import com.cretas.aims.service.dingtalk.DingTalkSendService.SendResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link DingTalkInboundConsumer}: dedup / empty content /
 * unbound user / AIChat success / AIChat exception paths. Each path is
 * specified by which log rows get written and which downstream calls happen.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DingTalkInboundConsumer.processOne")
class DingTalkInboundConsumerTest {

    @Mock private DingTalkInboundQueue inboundQueue;
    @Mock private DingTalkWebhookLogRepository logRepository;
    @Mock private DingTalkUserBindingRepository userBindingRepository;
    @Mock private IntentExecutorService intentExecutorService;
    @Mock private DingTalkSendService sendService;

    private DingTalkResponseFormatter responseFormatter;

    @InjectMocks private DingTalkInboundConsumer consumer;

    private DingTalkInboundPayload payload;

    /**
     * Snapshot capture: production code re-saves the same managed entity after
     * mutating its state (status PENDING → DELIVERED, etc.). ArgumentCaptor
     * stores references and would show the *final* state for every snapshot,
     * so we deep-copy on each save() invocation into this list.
     */
    private final List<DingTalkWebhookLog> savedSnapshots = new ArrayList<>();

    @BeforeEach
    void setUp() {
        // Real formatter (no mock — pure function, easier to assert reply content)
        responseFormatter = new DingTalkResponseFormatter();
        ReflectionTestUtils.setField(consumer, "responseFormatter", responseFormatter);
        ReflectionTestUtils.setField(consumer, "defaultFactoryId", "F006");

        payload = DingTalkInboundPayload.builder()
                .msgtype("text")
                .text(DingTalkInboundPayload.TextBody.builder().content("查询今天的生产任务").build())
                .msgId("msg_1234567890")
                .senderId("$:LWCP_v1:$STAFF_001")
                .senderNick("张三")
                .senderCorpId("ding_corp_F006")
                .conversationId("cid_GROUP_001")
                .build();

        savedSnapshots.clear();
        when(logRepository.save(any(DingTalkWebhookLog.class)))
                .thenAnswer(inv -> {
                    DingTalkWebhookLog arg = inv.getArgument(0);
                    savedSnapshots.add(deepCopy(arg));
                    return arg;
                });
        // sendService.send is a no-op for inbound-consumer tests (it has its own
        // dedicated test class); we only verify the dispatch HAPPENS.
        lenient().when(sendService.send(any())).thenReturn(SendResult.sent());
    }

    private static DingTalkWebhookLog deepCopy(DingTalkWebhookLog src) {
        return DingTalkWebhookLog.builder()
                .id(src.getId())
                .factoryId(src.getFactoryId())
                .direction(src.getDirection())
                .messageType(src.getMessageType())
                .dingtalkCorpId(src.getDingtalkCorpId())
                .dingtalkChatId(src.getDingtalkChatId())
                .dingtalkUserId(src.getDingtalkUserId())
                .dingtalkUserName(src.getDingtalkUserName())
                .dingtalkMessageId(src.getDingtalkMessageId())
                .webhookUrl(src.getWebhookUrl())
                .messageContent(src.getMessageContent())
                .messagePayload(src.getMessagePayload())
                .isSensitive(src.getIsSensitive())
                .userId(src.getUserId())
                .aiAuditLogId(src.getAiAuditLogId())
                .intentCode(src.getIntentCode())
                .sessionId(src.getSessionId())
                .status(src.getStatus())
                .errorMessage(src.getErrorMessage())
                .retryCount(src.getRetryCount())
                .nextRetryAt(src.getNextRetryAt())
                .receivedAt(src.getReceivedAt())
                .deliveredAt(src.getDeliveredAt())
                .createdAt(src.getCreatedAt())
                .updatedAt(src.getUpdatedAt())
                .build();
    }

    @Test
    @DisplayName("happy path: bound user → INBOUND DELIVERED + OUTBOUND PENDING with AI reply")
    void happyPathWritesTwoLogs() {
        when(logRepository.findByDingtalkMessageId("msg_1234567890")).thenReturn(Optional.empty());
        DingTalkBoundUser user = mockBoundUser(42L, "F006", "factory_admin", "zhangsan");
        when(userBindingRepository.findBoundUser("$:LWCP_v1:$STAFF_001")).thenReturn(Optional.of(user));
        when(intentExecutorService.execute(eq("F006"), any(IntentExecuteRequest.class), eq(42L), eq("factory_admin")))
                .thenReturn(IntentExecuteResponse.builder()
                        .intentCode("PROCESSING_BATCH_QUERY")
                        .status("COMPLETED")
                        .formattedText("今日生产任务: PO-001 牛肉 100kg (进行中)")
                        .build());

        consumer.processOne(payload, "F006");

        // 3 saves: INBOUND PENDING, INBOUND DELIVERED (mutated), OUTBOUND PENDING (new entity)
        assertEquals(3, savedSnapshots.size(), "expected 3 saves (INBOUND init + INBOUND update + OUTBOUND)");

        // saves[0] = INBOUND PENDING initial write
        assertEquals(Direction.INBOUND, savedSnapshots.get(0).getDirection());
        assertEquals(Status.PENDING, savedSnapshots.get(0).getStatus());

        // saves[1] = INBOUND DELIVERED + userId/intentCode set
        assertEquals(Direction.INBOUND, savedSnapshots.get(1).getDirection());
        assertEquals(Status.DELIVERED, savedSnapshots.get(1).getStatus());
        assertEquals(42L, savedSnapshots.get(1).getUserId());
        assertEquals("PROCESSING_BATCH_QUERY", savedSnapshots.get(1).getIntentCode());

        // saves[2] = OUTBOUND PENDING with reply text
        assertEquals(Direction.OUTBOUND, savedSnapshots.get(2).getDirection());
        assertEquals(Status.PENDING, savedSnapshots.get(2).getStatus());
        assertEquals("今日生产任务: PO-001 牛肉 100kg (进行中)", savedSnapshots.get(2).getMessageContent());
        assertEquals("AI_REPLY", savedSnapshots.get(2).getMessageType());
        assertEquals(42L, savedSnapshots.get(2).getUserId());

        // session_id on OUTBOUND should mirror conversationId so multi-turn threads
        assertEquals("cid_GROUP_001", savedSnapshots.get(2).getSessionId());

        // IntentExecuteRequest used userInput from payload + sessionId from conversationId
        ArgumentCaptor<IntentExecuteRequest> reqCaptor = ArgumentCaptor.forClass(IntentExecuteRequest.class);
        verify(intentExecutorService).execute(eq("F006"), reqCaptor.capture(), eq(42L), eq("factory_admin"));
        assertEquals("查询今天的生产任务", reqCaptor.getValue().getUserInput());
        assertEquals("cid_GROUP_001", reqCaptor.getValue().getSessionId());
    }

    @Test
    @DisplayName("duplicate msgId → no log writes, no AI call")
    void duplicateMessageIsDropped() {
        when(logRepository.findByDingtalkMessageId("msg_1234567890"))
                .thenReturn(Optional.of(new DingTalkWebhookLog()));
        // Reset save() stub since we expect 0 invocations
        reset(logRepository);
        when(logRepository.findByDingtalkMessageId("msg_1234567890"))
                .thenReturn(Optional.of(new DingTalkWebhookLog()));

        consumer.processOne(payload, "F006");

        verify(logRepository, never()).save(any());
        verifyNoInteractions(userBindingRepository, intentExecutorService);
    }

    @Test
    @DisplayName("empty text content → INBOUND IGNORED, no AI call, no OUTBOUND")
    void emptyContentMarkedIgnored() {
        when(logRepository.findByDingtalkMessageId(any())).thenReturn(Optional.empty());
        payload.setText(DingTalkInboundPayload.TextBody.builder().content("   ").build());

        consumer.processOne(payload, "F006");

        assertEquals(2, savedSnapshots.size(), "initial PENDING + IGNORED update");
        assertEquals(Direction.INBOUND, savedSnapshots.get(0).getDirection());
        assertEquals(Status.PENDING, savedSnapshots.get(0).getStatus());
        assertEquals(Status.IGNORED, savedSnapshots.get(1).getStatus());
        assertEquals("empty text content", savedSnapshots.get(1).getErrorMessage());

        verifyNoInteractions(userBindingRepository, intentExecutorService);
    }

    @Test
    @DisplayName("unbound sender → INBOUND FAILED + OUTBOUND placeholder reply")
    void unboundSenderGetsPolicyReply() {
        when(logRepository.findByDingtalkMessageId(any())).thenReturn(Optional.empty());
        when(userBindingRepository.findBoundUser(anyString())).thenReturn(Optional.empty());

        consumer.processOne(payload, "F006");

        assertEquals(3, savedSnapshots.size(), "INBOUND PENDING + INBOUND FAILED + OUTBOUND placeholder");
        assertEquals(Status.FAILED, savedSnapshots.get(1).getStatus());
        assertEquals("dingtalk_user_id not bound to any Cretas user", savedSnapshots.get(1).getErrorMessage());

        assertEquals(Direction.OUTBOUND, savedSnapshots.get(2).getDirection());
        assertEquals(Status.PENDING, savedSnapshots.get(2).getStatus());
        assertTrue(savedSnapshots.get(2).getMessageContent().contains("尚未绑定"),
                "Unbound reply should explain the binding gap");

        verifyNoInteractions(intentExecutorService);
    }

    @Test
    @DisplayName("AIIntentService throws → INBOUND FAILED + OUTBOUND error reply")
    void aiExceptionCapturedAsOutboundError() {
        when(logRepository.findByDingtalkMessageId(any())).thenReturn(Optional.empty());
        DingTalkBoundUser user = mockBoundUser(7L, "F006", "factory_admin", "lily");
        when(userBindingRepository.findBoundUser(anyString())).thenReturn(Optional.of(user));
        when(intentExecutorService.execute(any(), any(), any(), any()))
                .thenThrow(new RuntimeException("downstream timeout"));

        consumer.processOne(payload, "F006");

        assertEquals(3, savedSnapshots.size());
        assertEquals(Status.FAILED, savedSnapshots.get(1).getStatus());
        assertTrue(savedSnapshots.get(1).getErrorMessage().contains("downstream timeout"));

        assertEquals(Direction.OUTBOUND, savedSnapshots.get(2).getDirection());
        assertEquals(Status.PENDING, savedSnapshots.get(2).getStatus());
        assertTrue(savedSnapshots.get(2).getMessageContent().contains("AI 服务暂时不可用"));
    }

    @Test
    @DisplayName("IntentResponse with no formattedText → falls back to default per status")
    void responseWithoutFormattedTextUsesFallback() {
        when(logRepository.findByDingtalkMessageId(any())).thenReturn(Optional.empty());
        DingTalkBoundUser user = mockBoundUser(11L, "F006", "warehouse_manager", "wh1");
        when(userBindingRepository.findBoundUser(anyString())).thenReturn(Optional.of(user));
        when(intentExecutorService.execute(any(), any(), any(), any()))
                .thenReturn(IntentExecuteResponse.builder()
                        .intentCode("UNKNOWN")
                        .status("NOT_RECOGNIZED")
                        .formattedText(null)
                        .build());

        consumer.processOne(payload, "F006");

        assertEquals(3, savedSnapshots.size());
        DingTalkWebhookLog outbound = savedSnapshots.get(2);
        assertEquals(Direction.OUTBOUND, outbound.getDirection());
        assertTrue(outbound.getMessageContent().contains("未识别"),
                "Fallback for NOT_RECOGNIZED should mention unrecognised intent");
    }

    private static DingTalkBoundUser mockBoundUser(Long userId, String factoryId,
                                                    String roleCode, String username) {
        return new DingTalkBoundUser() {
            @Override public Long getUserId() { return userId; }
            @Override public String getFactoryId() { return factoryId; }
            @Override public String getRoleCode() { return roleCode; }
            @Override public String getUsername() { return username; }
        };
    }
}
