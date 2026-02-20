package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.SalesOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SalesOrderItemRepository extends JpaRepository<SalesOrderItem, Long> {

    List<SalesOrderItem> findBySalesOrderId(String salesOrderId);

    List<SalesOrderItem> findByProductTypeId(String productTypeId);
}
