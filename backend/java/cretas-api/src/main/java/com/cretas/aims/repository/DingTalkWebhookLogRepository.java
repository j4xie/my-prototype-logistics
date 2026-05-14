package com.cretas.aims.repository;

import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DingTalkWebhookLogRepository extends JpaRepository<DingTalkWebhookLog, Long> {

    Optional<DingTalkWebhookLog> findByDingtalkMessageId(String dingtalkMessageId);

    List<DingTalkWebhookLog> findBySessionIdOrderByReceivedAtAsc(String sessionId);

    Page<DingTalkWebhookLog> findByFactoryIdOrderByReceivedAtDesc(String factoryId, Pageable pageable);

    /** Retry sweep: pull FAILED rows whose nextRetryAt has elapsed. */
    @Query("SELECT l FROM DingTalkWebhookLog l " +
           "WHERE l.status = :status AND l.nextRetryAt IS NOT NULL AND l.nextRetryAt < :before " +
           "ORDER BY l.nextRetryAt ASC")
    List<DingTalkWebhookLog> findRetriable(@Param("status") Status status,
                                           @Param("before") LocalDateTime before,
                                           Pageable pageable);
}
