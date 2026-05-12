package com.cretas.aims.entity.inventory;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Regression guard for PR #423 ResponseAdvice interaction —
 * {@link SalesOrder#getPayableAmount()} must not NPE when {@code totalAmount}
 * has been nulled by {@link com.cretas.aims.security.PriceFieldResponseAdvice}
 * for roles without {@code procurement:price:view}.
 *
 * <p>Bug: prior to fix, warehouse_manager hitting {@code GET /sales/orders}
 * triggered HttpMessageNotWritableException because Jackson invokes the public
 * no-arg {@code getPayableAmount()} getter and it did {@code totalAmount.subtract(...)}
 * without a null-guard.
 */
class SalesOrderPayableAmountTest {

    @Test
    void nullTotalAmount_shouldReturnNull_notNPE() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(null);   // simulates PriceFieldResponseAdvice strip
        order.setDiscountAmount(null);
        order.setTaxAmount(null);
        assertNull(order.getPayableAmount(),
                "Stripped totalAmount must propagate to payableAmount=null, not NPE");
    }

    @Test
    void nullTotalAmount_withConcreteDiscountTax_stillReturnsNull() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(null);
        order.setDiscountAmount(new BigDecimal("100.00"));
        order.setTaxAmount(new BigDecimal("50.00"));
        assertNull(order.getPayableAmount());
    }

    @Test
    void presentTotalAmount_nullDiscountAndTax_appliesZero() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(new BigDecimal("1000.00"));
        order.setDiscountAmount(null);
        order.setTaxAmount(null);
        assertEquals(new BigDecimal("1000.00"), order.getPayableAmount());
    }

    @Test
    void presentAll_computesTotalMinusDiscountPlusTax() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(new BigDecimal("1000.00"));
        order.setDiscountAmount(new BigDecimal("100.00"));
        order.setTaxAmount(new BigDecimal("130.00"));
        assertEquals(new BigDecimal("1030.00"), order.getPayableAmount());
    }
}
