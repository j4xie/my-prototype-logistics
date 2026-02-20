package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.ReturnOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReturnOrderItemRepository extends JpaRepository<ReturnOrderItem, Long> {

    List<ReturnOrderItem> findByReturnOrderId(String returnOrderId);
}
