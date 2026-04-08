package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.SalesDeliveryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SalesDeliveryItemRepository extends JpaRepository<SalesDeliveryItem, Long> {
}
