package com.cretas.aims.repository;

import com.cretas.aims.entity.CustomerTrackingRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomerTrackingRecordRepository extends JpaRepository<CustomerTrackingRecord, Long> {

    Page<CustomerTrackingRecord> findByCustomerIdAndDeletedAtIsNull(String customerId, Pageable pageable);

    List<CustomerTrackingRecord> findByCustomerIdAndDeletedAtIsNullOrderByRecordTimeDesc(String customerId);

    List<CustomerTrackingRecord> findByFactoryIdAndDeletedAtIsNullOrderByRecordTimeDesc(String factoryId);
}
