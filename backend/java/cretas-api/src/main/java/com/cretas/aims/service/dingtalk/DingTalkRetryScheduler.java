package com.cretas.aims.service.dingtalk;

import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Direction;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import com.cretas.aims.repository.DingTalkWebhookLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Periodic retry sweep for {@link Status#FAILED} OUTBOUND logs whose
 * {@code nextRetryAt} has elapsed. The send service (
 * {@link DingTalkSendService#send}) writes the next backoff schedule on
 * each failure, so this scheduler is the only resending mechanism after
 * inline dispatch fails.
 *
 * <p>Default cadence: every {@value #DEFAULT_INTERVAL_MS}ms (configurable via
 * {@code dingtalk.retry-interval-ms}). Each tick pulls at most
 * {@link #BATCH_PER_TICK} retriable rows to bound database load.
 *
 * <p>Concurrency: single thread (Spring's default {@link Scheduled} executor).
 * Multi-replica deployments may pick the same row twice — at-least-once is
 * acceptable for a PoC since DingTalk dedup will reject duplicate sends; if
 * exactly-once becomes required, switch to a leader-election lock.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DingTalkRetryScheduler {

    static final int BATCH_PER_TICK = 50;
    static final long DEFAULT_INTERVAL_MS = 30_000L;

    private final DingTalkWebhookLogRepository logRepository;
    private final DingTalkSendService sendService;

    @Scheduled(fixedRateString = "${dingtalk.retry-interval-ms:30000}")
    public void retryDue() {
        try {
            sweepOnce();
        } catch (Exception e) {
            log.error("DingTalkRetryScheduler.retryDue unexpected failure", e);
        }
    }

    int sweepOnce() {
        List<DingTalkWebhookLog> due = logRepository.findRetriable(
                Status.FAILED,
                LocalDateTime.now(),
                PageRequest.of(0, BATCH_PER_TICK));
        if (due.isEmpty()) return 0;

        int retried = 0;
        for (DingTalkWebhookLog log : due) {
            if (log.getDirection() != Direction.OUTBOUND) {
                continue;  // safety: only retry OUTBOUND; INBOUND failures are not re-deliverable
            }
            // Reset status to PENDING so send() flow can re-evaluate (otherwise
            // nothing visibly changes if rate-limited)
            log.setStatus(Status.PENDING);
            DingTalkRetryScheduler.log.debug("Retrying OUTBOUND log id={} attempt={}",
                    log.getId(), log.getRetryCount());
            sendService.send(log);
            retried++;
        }
        if (retried > 0) {
            DingTalkRetryScheduler.log.info("DingTalkRetryScheduler: retried {} OUTBOUND messages", retried);
        }
        return retried;
    }
}
