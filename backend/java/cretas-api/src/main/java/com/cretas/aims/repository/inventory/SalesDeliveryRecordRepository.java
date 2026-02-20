package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.SalesDeliveryRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalesDeliveryRecordRepository extends JpaRepository<SalesDeliveryRecord, String> {

    Page<SalesDeliveryRecord> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    List<SalesDeliveryRecord> findBySalesOrderId(String salesOrderId);

    Optional<SalesDeliveryRecord> findByFactoryIdAndDeliveryNumber(String factoryId, String deliveryNumber);
}
