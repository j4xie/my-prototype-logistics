package com.cretas.aims.repository;

import com.cretas.aims.entity.CustomerTrackingRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CustomerTrackingRecordRepository extends JpaRepository<CustomerTrackingRecord, Long> {

    Page<CustomerTrackingRecord> findByCustomerIdAndDeletedAtIsNull(String customerId, Pageable pageable);

    List<CustomerTrackingRecord> findByCustomerIdAndDeletedAtIsNullOrderByRecordTimeDesc(String customerId);

    List<CustomerTrackingRecord> findByFactoryIdAndDeletedAtIsNullOrderByRecordTimeDesc(String factoryId);

    /** Sprint 4 W1 S-CUSTOMER-TAB-1 tab 1: factoryId+customerId scoped list (defense-in-depth RLS). */
    Page<CustomerTrackingRecord> findByFactoryIdAndCustomerIdAndDeletedAtIsNullOrderByRecordTimeDesc(
            String factoryId, String customerId, Pageable pageable);

    /** 防呆 R4 dedup: 5min 内同 (factoryId, customerId, content) 重复创建检查. */
    @Query("SELECT t FROM CustomerTrackingRecord t " +
           "WHERE t.factoryId = :factoryId AND t.customerId = :customerId " +
           "AND t.content = :content AND t.recordTime > :since " +
           "AND t.deletedAt IS NULL")
    List<CustomerTrackingRecord> findRecentByContent(
            @Param("factoryId") String factoryId,
            @Param("customerId") String customerId,
            @Param("content") String content,
            @Param("since") LocalDateTime since);
}
