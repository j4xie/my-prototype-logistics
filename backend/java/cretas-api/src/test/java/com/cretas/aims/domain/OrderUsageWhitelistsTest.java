package com.cretas.aims.domain;

import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * R23 audit I3: lock the EXACT membership of every whitelist Set + the resolveSO/resolvePO
 * dispatch contract. Pre-R23, ReferenceDataControllerTest pinned its own hardcoded copies of
 * each Set — meaning "31 PASS" only proved the controller agreed with the TEST PIN, not
 * with the central constants. This test imports the actual constants and asserts:
 *
 * 1. Whitelist membership is exactly what we documented (catches accidental enum additions
 *    being silently included/excluded — the original "drift" R21 set out to prevent).
 * 2. resolveSO/resolvePO fall back to strictest (invoiceable) on unknown usage param
 *    (R20 audit S1 fail-secure).
 * 3. SO_BY_USAGE / PO_BY_USAGE Map keys exactly match what the REST API contract documents.
 */
class OrderUsageWhitelistsTest {

    // ---------- SO whitelist exact-membership lock ----------

    @Test
    void so_invoiceable_is_post_finance_approved_set() {
        assertEquals(
                Set.of(SalesOrderStatus.FINANCE_APPROVED, SalesOrderStatus.PROCESSING,
                        SalesOrderStatus.PARTIAL_DELIVERED, SalesOrderStatus.COMPLETED),
                OrderUsageWhitelists.SO_INVOICEABLE);
    }

    @Test
    void so_shippable_excludes_completed() {
        assertEquals(
                Set.of(SalesOrderStatus.FINANCE_APPROVED, SalesOrderStatus.PROCESSING,
                        SalesOrderStatus.PARTIAL_DELIVERED),
                OrderUsageWhitelists.SO_SHIPPABLE);
    }

    @Test
    void so_deliverable_includes_confirmed_distinct_from_shippable() {
        // R23 audit C3: SalesServiceImpl.createDelivery — broader than SO_SHIPPABLE
        assertEquals(
                Set.of(SalesOrderStatus.CONFIRMED, SalesOrderStatus.FINANCE_APPROVED,
                        SalesOrderStatus.PROCESSING, SalesOrderStatus.PARTIAL_DELIVERED),
                OrderUsageWhitelists.SO_DELIVERABLE);
        assertNotSame(OrderUsageWhitelists.SO_SHIPPABLE, OrderUsageWhitelists.SO_DELIVERABLE,
                "Distinct semantics — DO NOT merge");
    }

    @Test
    void so_in_flight_is_active_not_yet_completed() {
        // R23 audit C3: SalesServiceImpl.getSalesStatistics — "still in flight" count
        assertEquals(
                Set.of(SalesOrderStatus.CONFIRMED, SalesOrderStatus.PENDING_FINANCE_REVIEW,
                        SalesOrderStatus.FINANCE_APPROVED, SalesOrderStatus.PROCESSING),
                OrderUsageWhitelists.SO_IN_FLIGHT);
    }

    @Test
    void so_plannable_includes_pre_finance_states_for_production() {
        assertEquals(
                Set.of(SalesOrderStatus.CONFIRMED, SalesOrderStatus.PENDING_FINANCE_REVIEW,
                        SalesOrderStatus.FINANCE_APPROVED, SalesOrderStatus.PROCESSING,
                        SalesOrderStatus.PARTIAL_DELIVERED),
                OrderUsageWhitelists.SO_PLANNABLE);
    }

    @Test
    void so_all_excludes_only_obviously_invalid_states() {
        Set<SalesOrderStatus> all = OrderUsageWhitelists.SO_ALL;
        assertTrue(all.contains(SalesOrderStatus.CONFIRMED));
        assertTrue(all.contains(SalesOrderStatus.COMPLETED));
        assertTrue(all.contains(SalesOrderStatus.PARTIAL_DELIVERED));
        // Excluded
        for (SalesOrderStatus s : new SalesOrderStatus[]{
                SalesOrderStatus.DRAFT, SalesOrderStatus.CANCELLED, SalesOrderStatus.FINANCE_REJECTED}) {
            assertTrue(!all.contains(s), s + " must not be in SO_ALL");
        }
    }

    // ---------- PO whitelist exact-membership lock ----------

    @Test
    void po_invoiceable_is_post_finance_approved_set() {
        assertEquals(
                Set.of(PurchaseOrderStatus.FINANCE_APPROVED, PurchaseOrderStatus.PARTIAL_RECEIVED,
                        PurchaseOrderStatus.COMPLETED, PurchaseOrderStatus.CLOSED),
                OrderUsageWhitelists.PO_INVOICEABLE);
    }

    @Test
    void po_receivable_includes_pending_finance_review_for_fast_consumables() {
        assertEquals(
                Set.of(PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PENDING_FINANCE_REVIEW,
                        PurchaseOrderStatus.FINANCE_APPROVED, PurchaseOrderStatus.PARTIAL_RECEIVED),
                OrderUsageWhitelists.PO_RECEIVABLE);
    }

    @Test
    void po_ops_receivable_excludes_pending_finance_review_distinct_from_receivable() {
        // R23 audit C3: PurchaseServiceImpl.createReceiveRecord — stricter ops-side variant
        assertEquals(
                Set.of(PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.FINANCE_APPROVED,
                        PurchaseOrderStatus.PARTIAL_RECEIVED),
                OrderUsageWhitelists.PO_OPS_RECEIVABLE);
        assertNotSame(OrderUsageWhitelists.PO_RECEIVABLE, OrderUsageWhitelists.PO_OPS_RECEIVABLE,
                "Distinct — PO_OPS_RECEIVABLE excludes PENDING_FINANCE_REVIEW");
    }

    // ---------- Map key contract ----------

    @Test
    void so_by_usage_keys_match_documented_rest_contract() {
        assertEquals(
                Set.of("invoiceable", "shippable", "deliverable", "in_flight", "plannable", "all"),
                OrderUsageWhitelists.SO_BY_USAGE.keySet());
    }

    @Test
    void po_by_usage_keys_match_documented_rest_contract() {
        assertEquals(
                Set.of("invoiceable", "receivable", "ops_receivable", "all"),
                OrderUsageWhitelists.PO_BY_USAGE.keySet());
    }

    // ---------- Resolver fail-secure (R20 audit S1) ----------

    @Test
    void resolveSO_unknown_usage_returns_strictest_invoiceable() {
        // Typo / null / nonsense — all return SO_INVOICEABLE (strictest).
        assertSame(OrderUsageWhitelists.SO_INVOICEABLE, OrderUsageWhitelists.resolveSO("typo"));
        assertSame(OrderUsageWhitelists.SO_INVOICEABLE, OrderUsageWhitelists.resolveSO(null));
        assertSame(OrderUsageWhitelists.SO_INVOICEABLE, OrderUsageWhitelists.resolveSO(""));
        assertSame(OrderUsageWhitelists.SO_INVOICEABLE, OrderUsageWhitelists.resolveSO("PLANNABLE")); // case-sensitive
    }

    @Test
    void resolveSO_known_usage_returns_correct_set() {
        assertSame(OrderUsageWhitelists.SO_INVOICEABLE, OrderUsageWhitelists.resolveSO("invoiceable"));
        assertSame(OrderUsageWhitelists.SO_SHIPPABLE, OrderUsageWhitelists.resolveSO("shippable"));
        assertSame(OrderUsageWhitelists.SO_DELIVERABLE, OrderUsageWhitelists.resolveSO("deliverable"));
        assertSame(OrderUsageWhitelists.SO_IN_FLIGHT, OrderUsageWhitelists.resolveSO("in_flight"));
        assertSame(OrderUsageWhitelists.SO_PLANNABLE, OrderUsageWhitelists.resolveSO("plannable"));
        assertSame(OrderUsageWhitelists.SO_ALL, OrderUsageWhitelists.resolveSO("all"));
    }

    @Test
    void resolvePO_unknown_usage_returns_strictest_invoiceable() {
        assertSame(OrderUsageWhitelists.PO_INVOICEABLE, OrderUsageWhitelists.resolvePO("typo"));
        assertSame(OrderUsageWhitelists.PO_INVOICEABLE, OrderUsageWhitelists.resolvePO(null));
        assertSame(OrderUsageWhitelists.PO_INVOICEABLE, OrderUsageWhitelists.resolvePO(""));
    }

    @Test
    void resolvePO_known_usage_returns_correct_set() {
        assertSame(OrderUsageWhitelists.PO_INVOICEABLE, OrderUsageWhitelists.resolvePO("invoiceable"));
        assertSame(OrderUsageWhitelists.PO_RECEIVABLE, OrderUsageWhitelists.resolvePO("receivable"));
        assertSame(OrderUsageWhitelists.PO_OPS_RECEIVABLE, OrderUsageWhitelists.resolvePO("ops_receivable"));
        assertSame(OrderUsageWhitelists.PO_ALL, OrderUsageWhitelists.resolvePO("all"));
    }
}
