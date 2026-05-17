package com.cretas.aims.service.impl;

import com.cretas.aims.entity.CustomerPriceHistory;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.cretas.aims.repository.CustomerPriceHistoryRepository;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository;
import com.cretas.aims.service.CustomerPriceMemoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Sprint 4 W2 S-PRICE-1 — 客户记忆价服务实现.
 *
 * 读: 查 customer_price_history 最近成交 row (按 order_date DESC).
 * 写: SalesOrderConfirmedEvent listener 调 recordFromSalesOrder, 批量 dedup-insert.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerPriceMemoryServiceImpl implements CustomerPriceMemoryService {

    private final CustomerPriceHistoryRepository historyRepository;
    private final SalesOrderItemRepository salesOrderItemRepository;

    @Override
    @Transactional(readOnly = true)
    public Optional<CustomerPriceHistory> getLatest(String factoryId, String customerId, String productTypeId) {
        if (factoryId == null || customerId == null || productTypeId == null) {
            return Optional.empty();
        }
        return historyRepository.findLatestOne(factoryId, customerId, productTypeId);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BigDecimal> getLatestUnitPrice(String factoryId, String customerId, String productTypeId) {
        return getLatest(factoryId, customerId, productTypeId).map(CustomerPriceHistory::getUnitPrice);
    }

    @Override
    @Transactional
    public int recordFromSalesOrder(SalesOrder order) {
        if (order == null || order.getCustomerId() == null) {
            return 0;
        }
        List<SalesOrderItem> items = salesOrderItemRepository.findBySalesOrderId(order.getId());
        if (items.isEmpty()) {
            log.debug("S-PRICE-1 skip: SO {} has no items", order.getId());
            return 0;
        }
        int written = 0;
        for (SalesOrderItem item : items) {
            if (item.getProductTypeId() == null || item.getUnitPrice() == null) {
                continue;  // 缺关键字段 → 跳过 (不算 history)
            }
            // R4 idempotency check — same SO + customer + product → existing row 已写过, 跳过
            Optional<CustomerPriceHistory> existing = historyRepository
                    .findByFactoryIdAndCustomerIdAndProductTypeIdAndSourceSalesOrderId(
                            order.getFactoryId(), order.getCustomerId(),
                            item.getProductTypeId(), order.getId());
            if (existing.isPresent()) {
                continue;
            }
            CustomerPriceHistory row = new CustomerPriceHistory();
            row.setFactoryId(order.getFactoryId());
            row.setCustomerId(order.getCustomerId());
            row.setProductTypeId(item.getProductTypeId());
            row.setUnitPrice(item.getUnitPrice());
            row.setSourceSalesOrderId(order.getId());
            row.setSourceOrderNumber(order.getOrderNumber());
            row.setOrderDate(order.getOrderDate());
            historyRepository.save(row);
            written++;
        }
        if (written > 0) {
            log.info("S-PRICE-1 recorded {} price history rows for SO {} ({})",
                    written, order.getOrderNumber(), order.getId());
        }
        return written;
    }
}
