package com.cretas.aims.repository;

import com.cretas.aims.entity.CustomerSalesUserHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Sprint 4 W1 S-CUSTOMER-TAB-1: tab 20 数据源 + 防呆 R4 dedup 支持.
 */
@Repository
public interface CustomerSalesUserHistoryRepository
        extends JpaRepository<CustomerSalesUserHistory, String> {

    Page<CustomerSalesUserHistory> findByFactoryIdAndCustomerIdOrderByChangedAtDesc(
            String factoryId, String customerId, Pageable pageable);

    /**
     * 防呆 R4 idempotent: 5min 内同 (factoryId, customerId, newSalesUserId) 已变更过的记录.
     * Service 层用此查询: 非空 → 抛 BusinessConflictException with existingId.
     */
    @Query("SELECT h FROM CustomerSalesUserHistory h " +
           "WHERE h.factoryId = :factoryId AND h.customerId = :customerId " +
           "AND h.newSalesUserId = :newSalesUserId AND h.changedAt > :since " +
           "ORDER BY h.changedAt DESC")
    List<CustomerSalesUserHistory> findRecentChange(
            @Param("factoryId") String factoryId,
            @Param("customerId") String customerId,
            @Param("newSalesUserId") Long newSalesUserId,
            @Param("since") LocalDateTime since);
}
