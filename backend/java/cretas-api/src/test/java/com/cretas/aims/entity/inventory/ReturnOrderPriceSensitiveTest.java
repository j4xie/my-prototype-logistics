package com.cretas.aims.entity.inventory;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Regression guard for PR #443 follow-up F2 — ReturnOrder leak sweep.
 *
 * <p>Before fix:
 * <ul>
 *   <li>{@link ReturnOrderItem#unitPrice}, {@code lineAmount} and
 *       {@link ReturnOrder#totalAmount} had no {@code @PriceSensitive} annotation,
 *       so warehouse_manager fetching a return order saw real prices (data leak).</li>
 *   <li>{@link ReturnOrderItem#getLineAmount()} fell back to {@code BigDecimal.ZERO}
 *       when {@code unitPrice}/{@code quantity} were null, which made stripped rows
 *       appear as "free" returns (worse than null — misleads non-price users).</li>
 *   <li>{@link ReturnOrder#calculateTotalAmount()} reduced via {@code BigDecimal::add}
 *       without a null filter, so a stripped item would NPE during reduce.</li>
 * </ul>
 *
 * <p>These tests mirror the {@code SalesOrderPayableAmountTest} pattern — admin sees
 * the real numbers, warehouse_manager (simulated via field=null) sees null and never
 * 500s.
 */
class ReturnOrderPriceSensitiveTest {

    @Test
    void warehouseManagerStrip_returnsNull_notZero() {
        // Simulates PriceFieldResponseAdvice strip for warehouse_manager:
        // both unitPrice and lineAmount fields are nulled out.
        ReturnOrderItem item = new ReturnOrderItem();
        item.setQuantity(new BigDecimal("3.0000"));
        item.setUnitPrice(null);    // stripped
        item.setLineAmount(null);   // stripped

        assertNull(item.getLineAmount(),
                "Stripped unitPrice+lineAmount must propagate to getLineAmount()=null, "
                        + "not ZERO (ZERO would leak 'free return' to warehouse_manager)");
    }

    @Test
    void adminSees_persistedLineAmount_shortCircuits() {
        // factory_super_admin / accountant: nothing is stripped, lineAmount is persisted.
        ReturnOrderItem item = new ReturnOrderItem();
        item.setQuantity(new BigDecimal("3.0000"));
        item.setUnitPrice(new BigDecimal("10.0000"));
        item.setLineAmount(new BigDecimal("30.00"));

        // Persisted lineAmount wins (matches legacy behaviour).
        assertEquals(new BigDecimal("30.00"), item.getLineAmount());
    }

    @Test
    void adminSees_computedFromUnitPriceAndQuantity_whenLineAmountUnpersisted() {
        // factory_super_admin: lineAmount field empty (older row), getLineAmount
        // computes from quantity × unitPrice. Result must match SalesOrderItem
        // computation pattern (HALF_UP, scale=2).
        ReturnOrderItem item = new ReturnOrderItem();
        item.setQuantity(new BigDecimal("3.0000"));
        item.setUnitPrice(new BigDecimal("12.5000"));
        item.setLineAmount(null);

        assertEquals(new BigDecimal("37.50"), item.getLineAmount());
    }

    @Test
    void calculateTotalAmount_skipsStrippedItems_doesNotNPE() {
        // ReturnOrder mixing one stripped item + one admin-visible item must not NPE
        // during reduce (mirrors SalesOrder.calculateTotalAmount null-filter pattern).
        ReturnOrderItem stripped = new ReturnOrderItem();
        stripped.setQuantity(new BigDecimal("2.0000"));
        stripped.setUnitPrice(null);    // stripped → getLineAmount() returns null
        stripped.setLineAmount(null);

        ReturnOrderItem visible = new ReturnOrderItem();
        visible.setQuantity(new BigDecimal("3.0000"));
        visible.setLineAmount(new BigDecimal("45.00"));

        ReturnOrder order = new ReturnOrder();
        order.setItems(Arrays.asList(stripped, visible));

        // Reduce must skip null lineAmount via filter, return only the visible row's amount.
        assertEquals(new BigDecimal("45.00"), order.calculateTotalAmount(),
                "calculateTotalAmount must filter null lineAmounts (stripped items), not NPE");
    }
}
