package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.PurchaseOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseOrderItemRepository extends JpaRepository<PurchaseOrderItem, Long> {

    List<PurchaseOrderItem> findByPurchaseOrderId(String purchaseOrderId);

    List<PurchaseOrderItem> findByMaterialTypeId(String materialTypeId);
}
