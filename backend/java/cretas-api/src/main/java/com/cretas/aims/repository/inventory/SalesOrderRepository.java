package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.cretas.aims.entity.inventory.SalesOrder;
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
public interface SalesOrderRepository extends JpaRepository<SalesOrder, String> {

    Page<SalesOrder> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Page<SalesOrder> findByFactoryIdAndStatusOrderByCreatedAtDesc(String factoryId, SalesOrderStatus status, Pageable pageable);

    Optional<SalesOrder> findByFactoryIdAndOrderNumber(String factoryId, String orderNumber);

    List<SalesOrder> findByFactoryIdAndCustomerId(String factoryId, String customerId);

    @Query("SELECT so FROM SalesOrder so WHERE so.factoryId = :factoryId " +
            "AND so.orderDate BETWEEN :startDate AND :endDate ORDER BY so.orderDate DESC")
    List<SalesOrder> findByFactoryIdAndDateRange(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    Page<SalesOrder> findByFactoryIdInOrderByCreatedAtDesc(List<String> factoryIds, Pageable pageable);

    @Query("SELECT COUNT(so) FROM SalesOrder so WHERE so.factoryId = :factoryId AND so.orderDate = :date")
    long countByFactoryIdAndDate(@Param("factoryId") String factoryId, @Param("date") LocalDate date);
}
