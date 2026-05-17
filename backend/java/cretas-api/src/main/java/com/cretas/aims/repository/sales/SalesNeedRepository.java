package com.cretas.aims.repository.sales;

import com.cretas.aims.entity.enums.SalesNeedStatus;
import com.cretas.aims.entity.sales.SalesNeed;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Sprint 4 W2 S-NEED-1 — SalesNeed 仓储.
 */
@Repository
public interface SalesNeedRepository extends JpaRepository<SalesNeed, String> {

    Optional<SalesNeed> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    Page<SalesNeed> findByFactoryIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            String factoryId, Pageable pageable);

    Page<SalesNeed> findByFactoryIdAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(
            String factoryId, List<SalesNeedStatus> statuses, Pageable pageable);

    Page<SalesNeed> findByFactoryIdAndCustomerIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            String factoryId, String customerId, Pageable pageable);
}
