package com.cretas.aims.service;

import com.cretas.aims.entity.CustomerPriceHistory;
import com.cretas.aims.entity.inventory.SalesOrder;

import java.math.BigDecimal;
import java.util.List;
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

    /**
     * 查询客户 × 产品的最近 N 条成交价历史 (用于 "价格历史" 对话框展示).
     *
     * @param factoryId     工厂 ID (必填)
     * @param customerId    客户 ID (可选 — null 表示查该 productTypeId 在所有客户的成交历史)
     * @param productTypeId 产品类型 ID (必填)
     * @param limit         最大返回条数 (1..200, &lt;1 则默认 20)
     * @return 按 orderDate DESC, createdAt DESC 排序的历史 list (含价格 + 来源订单号 + 日期).
     *         unitPrice 字段为 {@code @PriceSensitive}, 无 price 权限角色看到的 list 中 unitPrice 已被 null.
     */
    List<CustomerPriceHistory> findHistory(String factoryId, String customerId, String productTypeId, int limit);
}
