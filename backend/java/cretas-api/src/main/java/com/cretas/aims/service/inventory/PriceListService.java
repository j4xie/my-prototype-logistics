package com.cretas.aims.service.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Issue #793 — 客户协议价 lookup service for auto-applying contract price at sales order creation.
 *
 * <p>Customer May 7 part2 L342-368 verbatim: 合同客户 = 协议价 (3 个月 / 半年 / 1 年).
 * 应在新建销售订单时自动应用客户协议价, 而不是手动输入或用 BOM 默认价.</p>
 *
 * <p>Priority: customer-specific {@code PriceList} → global {@code PriceList} → empty (caller
 * falls back to BOM default / explicit user input). User can always override price manually.</p>
 *
 * @since 2026-05-17
 */
public interface PriceListService {

    /**
     * Look up the active selling price for a given customer + product on a given date.
     *
     * <p>Resolution order:</p>
     * <ol>
     *   <li>Customer-specific {@code PriceList} where {@code customer_id = customerId} AND
     *       {@code price_type = 'SELLING_PRICE'} AND {@code asOf BETWEEN effective_from AND effective_to}.</li>
     *   <li>Global {@code PriceList} where {@code customer_id IS NULL} AND
     *       {@code price_type = 'SELLING_PRICE'} AND {@code asOf BETWEEN effective_from AND effective_to}.</li>
     *   <li>Returns empty {@link Optional} if no active price found (caller falls back to defaults).</li>
     * </ol>
     *
     * <p>The result is the {@code standard_price} from the first matching {@code PriceListItem}
     * (matched by {@code product_type_id}).</p>
     *
     * @param factoryId  tenant factory id (multi-tenant scoping)
     * @param customerId customer id (nullable — when null, only global price lists are searched)
     * @param productId  product type id (required)
     * @param asOf       reference date (typically order date or today)
     * @return active selling price, or empty if none configured
     */
    Optional<BigDecimal> findActivePriceForOrder(String factoryId,
                                                  String customerId,
                                                  String productId,
                                                  LocalDate asOf);
}
