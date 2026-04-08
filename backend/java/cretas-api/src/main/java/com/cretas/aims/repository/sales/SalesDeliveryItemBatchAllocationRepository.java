package com.cretas.aims.repository.sales;

import com.cretas.aims.entity.sales.SalesDeliveryItemBatchAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface SalesDeliveryItemBatchAllocationRepository
        extends JpaRepository<SalesDeliveryItemBatchAllocation, String> {

    List<SalesDeliveryItemBatchAllocation> findByFactoryIdAndDeliveryItemId(
            String factoryId, String deliveryItemId);

    List<SalesDeliveryItemBatchAllocation> findByFactoryIdAndFinishedGoodsBatchId(
            String factoryId, String finishedGoodsBatchId);

    @Query("SELECT COALESCE(SUM(a.allocatedQty), 0) FROM SalesDeliveryItemBatchAllocation a " +
            "WHERE a.factoryId = :factoryId AND a.deliveryItemId = :deliveryItemId")
    BigDecimal sumAllocatedQtyByDeliveryItemId(
            @Param("factoryId") String factoryId,
            @Param("deliveryItemId") String deliveryItemId);

    void deleteByFactoryIdAndDeliveryItemId(String factoryId, String deliveryItemId);
}
