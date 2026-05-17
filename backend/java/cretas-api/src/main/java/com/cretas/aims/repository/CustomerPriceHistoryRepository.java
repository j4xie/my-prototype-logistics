package com.cretas.aims.repository;

import com.cretas.aims.entity.CustomerPriceHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Sprint 4 W2 S-PRICE-1 — 客户记忆价仓库
 */
@Repository
public interface CustomerPriceHistoryRepository extends JpaRepository<CustomerPriceHistory, String> {

    /**
     * 查询客户 × 产品的最近一次成交记录 (用于 SO Item prefill 第 2 层 fallback).
     *
     * @return 最近成交 row (按订单日期 DESC, 同日 tie-break by createdAt DESC), null = 从未成交.
     */
    @Query("SELECT h FROM CustomerPriceHistory h " +
           "WHERE h.factoryId = :factoryId " +
           "  AND h.customerId = :customerId " +
           "  AND h.productTypeId = :productTypeId " +
           "ORDER BY h.orderDate DESC, h.createdAt DESC")
    List<CustomerPriceHistory> findLatestByCustomerAndProduct(
            @Param("factoryId") String factoryId,
            @Param("customerId") String customerId,
            @Param("productTypeId") String productTypeId);

    /**
     * 取最近 1 条 (convenience wrapper around findLatestByCustomerAndProduct + Pageable 1).
     */
    default Optional<CustomerPriceHistory> findLatestOne(String factoryId, String customerId, String productTypeId) {
        List<CustomerPriceHistory> rows = findLatestByCustomerAndProduct(factoryId, customerId, productTypeId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * R4 idempotency check: 同 SO + customer + product 已存在? (避免 cancel→re-confirm 重复写)
     */
    Optional<CustomerPriceHistory> findByFactoryIdAndCustomerIdAndProductTypeIdAndSourceSalesOrderId(
            String factoryId, String customerId, String productTypeId, String sourceSalesOrderId);

    /**
     * 批量查 — 销售单确认时一次写入多行 (按 SO 批 dedup).
     */
    List<CustomerPriceHistory> findBySourceSalesOrderId(String sourceSalesOrderId);
}
