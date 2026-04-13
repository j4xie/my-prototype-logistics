package com.cretas.aims.entity.inventory;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * V3 P0-9 / v1 §2.4.4 — 销售订单收款状态派生
 *
 * <p>客户 v1 §2.4.4 要求订单头展示"待收款/部分收款/已收款".
 * 字段从 paidAmount vs totalAmount 派生, 不存 DB.
 */
class SalesOrderPaymentStatusTest {

    @Test
    void zeroPaid_shouldReturnUnpaid() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(new BigDecimal("1000.00"));
        order.setPaidAmount(BigDecimal.ZERO);
        assertEquals("UNPAID", order.getPaymentStatus());
    }

    @Test
    void nullPaid_shouldReturnUnpaid() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(new BigDecimal("1000.00"));
        order.setPaidAmount(null);
        assertEquals("UNPAID", order.getPaymentStatus());
    }

    @Test
    void partialPaid_shouldReturnPartial() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(new BigDecimal("1000.00"));
        order.setPaidAmount(new BigDecimal("500.00"));
        assertEquals("PARTIAL", order.getPaymentStatus());
    }

    @Test
    void fullyPaid_shouldReturnPaid() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(new BigDecimal("1000.00"));
        order.setPaidAmount(new BigDecimal("1000.00"));
        assertEquals("PAID", order.getPaymentStatus());
    }

    @Test
    void overpaid_shouldReturnPaid() {
        SalesOrder order = new SalesOrder();
        order.setTotalAmount(new BigDecimal("1000.00"));
        order.setPaidAmount(new BigDecimal("1200.00"));
        assertEquals("PAID", order.getPaymentStatus());
    }
}
