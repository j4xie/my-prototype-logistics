package com.cretas.aims.service.dingtalk;

import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Direction;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import com.cretas.aims.repository.DingTalkWebhookLogRepository;
import com.cretas.aims.service.dingtalk.DingTalkSendService.SendResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link DingTalkRetryScheduler}: filters by direction, resets
 * status to PENDING before re-dispatch, returns count of retries.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DingTalkRetryScheduler.sweepOnce")
class DingTalkRetrySchedulerTest {

    @Mock private DingTalkWebhookLogRepository logRepository;
    @Mock private DingTalkSendService sendService;

    @InjectMocks private DingTalkRetryScheduler scheduler;

    private DingTalkWebhookLog mkOutbound(Long id, int retryCount) {
        return DingTalkWebhookLog.builder()
                .id(id)
                .factoryId("F006")
                .direction(Direction.OUTBOUND)
                .messageType("AI_REPLY")
                .dingtalkChatId("cid_GROUP_001")
                .messageContent("retry me " + id)
                .status(Status.FAILED)
                .retryCount(retryCount)
                .nextRetryAt(LocalDateTime.now().minusSeconds(5))
                .build();
    }

    @Test
    @DisplayName("empty due list → 0 retries, no send calls")
    void noopWhenEmpty() {
        when(logRepository.findRetriable(eq(Status.FAILED), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(new ArrayList<>());

        int retried = scheduler.sweepOnce();

        assertEquals(0, retried);
        verifyNoInteractions(sendService);
    }

    @Test
    @DisplayName("N due OUTBOUND rows → status reset to PENDING + send invoked N times")
    void retriesAllDue() {
        DingTalkWebhookLog a = mkOutbound(1L, 2);
        DingTalkWebhookLog b = mkOutbound(2L, 3);
        when(logRepository.findRetriable(eq(Status.FAILED), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(List.of(a, b));
        when(sendService.send(any())).thenReturn(SendResult.sent());

        int retried = scheduler.sweepOnce();

        assertEquals(2, retried);
        ArgumentCaptor<DingTalkWebhookLog> captor = ArgumentCaptor.forClass(DingTalkWebhookLog.class);
        verify(sendService, times(2)).send(captor.capture());

        // sendService received both with status reset to PENDING (so internal logic re-evaluates)
        for (DingTalkWebhookLog seen : captor.getAllValues()) {
            assertEquals(Status.PENDING, seen.getStatus(),
                    "scheduler must reset status to PENDING before re-dispatch");
        }
    }

    @Test
    @DisplayName("INBOUND row in due list is skipped (safety)")
    void inboundSkipped() {
        DingTalkWebhookLog inboundRow = DingTalkWebhookLog.builder()
                .id(99L).direction(Direction.INBOUND).status(Status.FAILED)
                .retryCount(1).nextRetryAt(LocalDateTime.now().minusSeconds(60))
                .build();
        DingTalkWebhookLog outboundRow = mkOutbound(100L, 1);
        when(logRepository.findRetriable(any(), any(), any()))
                .thenReturn(List.of(inboundRow, outboundRow));
        when(sendService.send(any())).thenReturn(SendResult.sent());

        int retried = scheduler.sweepOnce();

        assertEquals(1, retried, "only OUTBOUND should be re-dispatched");
        verify(sendService, times(1)).send(any());
    }

    @Test
    @DisplayName("retryDue swallows exceptions to keep the scheduler ticking")
    void schedulerSwallowsExceptions() {
        when(logRepository.findRetriable(any(), any(), any()))
                .thenThrow(new RuntimeException("db down"));

        // Should NOT throw — scheduler must be resilient
        scheduler.retryDue();
    }
}
