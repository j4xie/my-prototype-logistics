package com.cretas.aims.service;

import com.cretas.aims.entity.CustomerPriceHistory;
import com.cretas.aims.entity.inventory.SalesOrder;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Sprint 4 W2 S-PRICE-1 — 客户记忆价服务.
 *
 * 提供 SO Item prefill 第 2 层 fallback 数据 (PriceList > history > productType default).
 *
 * 写入由 SalesOrderConfirmedHistoryListener 接 SalesOrderConfirmedEvent 触发,
 * 调用 {@link #recordFromSalesOrder} 批量写入 SO 各行的记忆价 (R4 dedup ensured).
 */
public interface CustomerPriceMemoryService {

    /**
     * 查询客户 × 产品的最近一次成交价.
     *
     * @return 最近成交 row (含价格 + 来源订单号 + 日期), empty = 从未成交.
     */
    Optional<CustomerPriceHistory> getLatest(String factoryId, String customerId, String productTypeId);

    /**
     * 仅查最近一次成交单价 (convenience for prefill hint).
     */
    Optional<BigDecimal> getLatestUnitPrice(String factoryId, String customerId, String productTypeId);

    /**
     * SO 确认时回调 — 写入此 SO 各行项目到 history (R4 idempotent: 同 SO+customer+product 已存在则跳过).
     *
     * @return 实际写入行数 (0 = 全部已存在 / SO 无 items, ≥1 = 新增)
     */
    int recordFromSalesOrder(SalesOrder order);
}
