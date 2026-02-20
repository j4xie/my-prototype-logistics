package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.PurchaseReceiveRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseReceiveRecordRepository extends JpaRepository<PurchaseReceiveRecord, String> {

    Page<PurchaseReceiveRecord> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    List<PurchaseReceiveRecord> findByPurchaseOrderId(String purchaseOrderId);

    Optional<PurchaseReceiveRecord> findByFactoryIdAndReceiveNumber(String factoryId, String receiveNumber);
}
