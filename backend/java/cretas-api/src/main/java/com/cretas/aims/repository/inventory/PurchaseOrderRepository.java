package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, String> {

    Page<PurchaseOrder> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Page<PurchaseOrder> findByFactoryIdAndStatusOrderByCreatedAtDesc(String factoryId, PurchaseOrderStatus status, Pageable pageable);

    Optional<PurchaseOrder> findByFactoryIdAndOrderNumber(String factoryId, String orderNumber);

    List<PurchaseOrder> findByFactoryIdAndSupplierId(String factoryId, String supplierId);

    @Query("SELECT po FROM PurchaseOrder po WHERE po.factoryId = :factoryId " +
            "AND po.orderDate BETWEEN :startDate AND :endDate ORDER BY po.orderDate DESC")
    List<PurchaseOrder> findByFactoryIdAndDateRange(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /** 多组织聚合查询（总部视图） */
    Page<PurchaseOrder> findByFactoryIdInOrderByCreatedAtDesc(List<String> factoryIds, Pageable pageable);

    /** 生成订单号：统计当天该工厂的采购单数量 */
    @Query("SELECT COUNT(po) FROM PurchaseOrder po WHERE po.factoryId = :factoryId AND po.orderDate = :date")
    long countByFactoryIdAndDate(@Param("factoryId") String factoryId, @Param("date") LocalDate date);
}
